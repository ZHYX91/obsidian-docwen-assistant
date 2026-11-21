import { parser, type BlockContext, type InlineContext, type Line, type MarkdownConfig } from "@lezer/markdown";

export const MATH_NODE = "AuthoredMath";

const DISPLAY_DELIMITER = /^\$\$[ \t]*\r?$/u;
const SINGLE_LINE_DISPLAY = /^\$\$[^\r\n]*?\$\$[ \t]*\r?$/u;

function lastPossibleClosers(source: string): number[] {
  const lastByQuoteDepth: number[] = [];
  for (const match of source.matchAll(/^(?:[ \t]*>)*[ \t]*\$\$[ \t]*\r?$/gmu)) {
    lastByQuoteDepth[match[0].split(">").length - 1] = match.index;
  }
  // Fewer quote marks may be a lazy continuation. Extra ones remain body text.
  let last = -1;
  for (let depth = 0; depth < lastByQuoteDepth.length; depth++) {
    last = Math.max(last, lastByQuoteDepth[depth] ?? -1);
    lastByQuoteDepth[depth] = last;
  }
  return lastByQuoteDepth;
}

// Core accepts lazy continuation in formulas owned by a quote or list item.
function continuesContainer(line: string, quoteOnly: boolean): boolean {
  const probe = "x\n" + line;
  const first = parser.parse(probe).topNode.firstChild;
  return (first?.name === "Paragraph" && first.to === probe.length) ||
    (quoteOnly && /^ATXHeading[1-6]$/u.test(first?.nextSibling?.name ?? ""));
}

/** Keep math opaque to the resource scanners without changing Markdown offsets. */
export function authoredMath(source: string, unmatchedOpeners: Set<number>): MarkdownConfig {
  const exhausted = new WeakSet<InlineContext>();
  const lastClosers = lastPossibleClosers(source);

  function candidateQuoteDepth(context: BlockContext, line: Line): number {
    if (!DISPLAY_DELIMITER.test(line.text.slice(line.pos)) ||
      unmatchedOpeners.has(context.lineStart + line.pos)) return -1;

    let quoteDepth = 0;
    for (let depth = 0; depth < context.depth; depth++) {
      if (context.parentType(depth).name === "Blockquote") quoteDepth++;
    }
    const lastCloser = lastClosers[Math.min(quoteDepth, lastClosers.length - 1)] ?? -1;
    return lastCloser > context.lineStart + line.text.length + 1 ? quoteDepth : -1;
  }

  return {
    defineNodes: [MATH_NODE],
    parseBlock: [{
      name: "DisplayMath",
      after: "FencedCode",
      endLeaf(context, line) {
        return SINGLE_LINE_DISPLAY.test(line.text.slice(line.pos)) || candidateQuoteDepth(context, line) >= 0;
      },
      parse(context, line) {
        const content = line.text.slice(line.pos);
        const start = context.lineStart + line.pos;
        if (SINGLE_LINE_DISPLAY.test(content)) {
          context.addElement(context.elt(MATH_NODE, start, context.lineStart + line.text.length));
          context.nextLine();
          return true;
        }
        const quoteDepth = candidateQuoteDepth(context, line);
        if (quoteDepth < 0) return false;
        const inset = line.baseIndent;
        const quoted = context.parentType().name === "Blockquote";
        const quoteOnly = quoteDepth + 1 === context.depth && quoted;
        let previousBlank = false;
        let hasBody = false;
        while (context.nextLine()) {
          const body = line.text.slice(line.basePos);
          const blank = body.trim() === "";
          if (line.baseIndent < inset && !(quoted && line.markers.length === quoteDepth)) {
            if (blank && quoted) break;
            if (!blank && (previousBlank || !continuesContainer(body, quoteOnly))) break;
          }
          if (hasBody && DISPLAY_DELIMITER.test(body)) {
            context.addElement(context.elt(MATH_NODE, start, context.lineStart + line.text.length));
            context.nextLine();
            return true;
          }
          previousBlank = blank;
          hasBody = true;
        }
        // Lezer can't rewind a block parser. The caller retries with this opener
        // disabled so CommonMark sees all the consumed lines as authored.
        unmatchedOpeners.add(start);
        return true;
      },
    }],
    parseInline: [{
      name: "InlineMath",
      before: "InlineCode",
      parse(context, next, start) {
        if (next !== 36) return -1;
        const display = context.char(start + 1) === 36;
        const body = start + (display ? 2 : 1);
        if (body >= context.end || (!display && (context.char(start - 1) === 36 ||
          /\s/u.test(context.slice(body, body + 1)) || exhausted.has(context)))) return -1;

        for (let at = body; at < context.end; at++) {
          if (display && (context.char(at) === 10 || context.char(at) === 13)) return -1;
          if (context.char(at) === 92) {
            if (!display || (context.char(at + 1) !== 10 && context.char(at + 1) !== 13)) at++;
            continue;
          }
          if (context.char(at) !== 36) continue;
          if (display) {
            if (context.char(at + 1) === 36) return context.addElement(context.elt(MATH_NODE, start, at + 2));
            continue;
          }
          if (/\s/u.test(context.slice(at - 1, at)) || /[0-9]/u.test(context.slice(at + 1, at + 2))) continue;
          return context.addElement(context.elt(MATH_NODE, start, at + 1));
        }
        // Subsequent openers in this paragraph cannot find a closer either.
        if (!display) exhausted.add(context);
        return -1;
      },
    }],
  };
}

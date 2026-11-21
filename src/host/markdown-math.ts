import { parser, type InlineContext, type Line, type MarkdownConfig } from "@lezer/markdown";

export const MATH_NODE = "AuthoredMath";

function startsMathBlock(line: Line): boolean {
  const start = line.pos;
  return line.text.startsWith("$$", start) && line.text.indexOf("$$", start + 2) < 0;
}

// Obsidian accepts an unmarked paragraph continuation inside a quoted or
// listed formula. Let CommonMark decide whether a dedented line interrupts it.
function continuesParagraph(line: string): boolean {
  const probe = "x\n" + line;
  const first = parser.parse(probe).topNode.firstChild;
  return first?.name === "Paragraph" && first.to === probe.length;
}

/** Keep math opaque to the resource scanners without changing Markdown offsets. */
export function authoredMath(): MarkdownConfig {
  const exhausted = new WeakMap<InlineContext, Set<string>>();
  return {
    defineNodes: [MATH_NODE],
    parseBlock: [{
      name: "DisplayMath",
      after: "FencedCode",
      endLeaf: (_context, line) => startsMathBlock(line),
      parse(context, line) {
        if (!startsMathBlock(line)) return false;
        const start = context.lineStart + line.pos;
        const inset = line.baseIndent;
        const quoted = context.parentType().name === "Blockquote";
        let quoteDepth = 0;
        for (let depth = 0; depth < context.depth; depth++) {
          if (context.parentType(depth).name === "Blockquote") quoteDepth++;
        }
        let end = context.lineStart + line.text.length;
        let previousBlank = false;
        while (context.nextLine()) {
          const blank = line.text.trim() === "";
          if (line.baseIndent < inset && !(quoted && line.markers.length === quoteDepth)) {
            if (blank && quoted) break;
            if (!blank && (previousBlank || !continuesParagraph(line.text.slice(line.basePos)))) break;
          }
          previousBlank = blank;
          end = context.lineStart + line.text.length;
          if (line.text.slice(line.pos).trimEnd().endsWith("$$")) {
            context.nextLine();
            break;
          }
        }
        context.addElement(context.elt(MATH_NODE, start, end));
        return true;
      },
    }],
    parseInline: [{
      name: "InlineMath",
      before: "InlineCode",
      parse(context, next, start) {
        if (next !== 36) return -1;
        const delimiter = context.char(start + 1) === 36 ? "$$" : "$";
        const body = start + delimiter.length;
        if (body >= context.end || (delimiter === "$" && /\s/u.test(context.slice(body, body + 1)))) return -1;
        if (exhausted.get(context)?.has(delimiter)) return -1;

        for (let at = body; at < context.end; at++) {
          if (context.char(at) === 92) { at++; continue; }
          if (context.slice(at, at + delimiter.length) !== delimiter) continue;
          if (delimiter === "$" && (/\s/u.test(context.slice(at - 1, at)) ||
            /[0-9]/u.test(context.slice(at + 1, at + 2)))) continue;
          return context.addElement(context.elt(MATH_NODE, start, at + delimiter.length));
        }
        // Subsequent openers in this paragraph cannot find a closer either.
        const missing = exhausted.get(context) ?? new Set<string>();
        missing.add(delimiter);
        exhausted.set(context, missing);
        return -1;
      },
    }],
  };
}

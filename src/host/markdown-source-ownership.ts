/*!
Bundled Lezer parser licenses
@lezer/markdown
MIT License

Copyright (C) 2020 by Marijn Haverbeke <marijn@haverbeke.berlin> and others

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

@lezer/common
MIT License

Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

@lezer/highlight
MIT License

Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
import { parser } from "@lezer/markdown";
import { authoredMath, MATH_NODE } from "./markdown-math";
import { propertiesEnd } from "./markdown-properties";

// Wiki targets are Obsidian atoms. In particular, a backtick in one target
// cannot pair with a backtick in another target to create a CommonMark code span.
const wikiParser = parser.configure({
  defineNodes: ["AuthoredWiki", "AuthoredWikiImage"],
  parseInline: [{
    name: "AuthoredWiki",
    before: "InlineCode",
    parse(context, next, position) {
      const image = next === 33 && context.slice(position, position + 3) === "![[";
      if (!image && !(next === 91 && context.slice(position, position + 2) === "[[")) return -1;
      const bodyStart = position + (image ? 3 : 2);
      const closing = context.text.indexOf("]]", bodyStart - context.offset);
      if (closing < 0) return -1;
      const end = context.offset + closing + 2;
      if (/[\r\n]/u.test(context.slice(bodyStart, end))) return -1;
      return context.addElement(context.elt(image ? "AuthoredWikiImage" : "AuthoredWiki", position, end));
    },
  }],
});

function parseWithMath(source: string) {
  // Lezer splits on LF. Keep each physical break at its original offset and
  // omit the second character of CRLF through parse ranges. Lezer maps node
  // positions across these gaps back to the original UTF-16 coordinates.
  const parserSource = source.replace(/\r/gu, "\n");
  const ranges: { from: number; to: number }[] = [];
  let from = 0;
  for (const match of source.matchAll(/\r\n/gu)) {
    ranges.push({ from, to: match.index + 1 });
    from = match.index + 2;
  }
  if (from > 0 && from < source.length) ranges.push({ from, to: source.length });
  const logicalSource = ranges.length ? source.replace(/\r\n?/gu, "\n") : parserSource;
  const unmatchedOpeners = new Set<number>();
  const authoredParser = wikiParser.configure(authoredMath(logicalSource, unmatchedOpeners));
  let previousCount: number;
  let tree;
  do {
    previousCount = unmatchedOpeners.size;
    tree = authoredParser.parse(parserSource, [], ranges.length ? ranges : undefined);
  } while (unmatchedOpeners.size !== previousCount);
  return tree;
}

const LITERAL_NODES = new Set([MATH_NODE, "FencedCode", "CodeBlock", "InlineCode", "HTMLBlock", "HTMLTag", "CommentBlock",
  "Comment", "ProcessingInstruction", "ProcessingInstructionBlock"]);

export interface AuthoredMarkdown {
  readonly source: string;
  readonly tree: ReturnType<typeof parseWithMath>;
  readonly imageSource: string;
  readonly navigationSource: string;
}

interface SourceRange {
  readonly from: number;
  readonly to: number;
}

// Tree traversal and comment scanning both produce disjoint ranges in source order.
function maskRanges(source: string, ranges: readonly SourceRange[]): string {
  if (!ranges.length) return source;
  const parts: string[] = [];
  let offset = 0;
  for (const { from, to } of ranges) {
    parts.push(source.slice(offset, from),
      source.slice(from, to).replace(/[^\r\n]+/gu, text => " ".repeat(text.length)));
    offset = to;
  }
  parts.push(source.slice(offset));
  return parts.join("");
}

function maskComments(source: string, tree: AuthoredMarkdown["tree"]): string {
  if (!source.includes("%%")) return source;
  // Only a marker outside an existing syntax atom can open a comment.
  const protectedRanges: SourceRange[] = [];
  tree.iterate({ enter(node) {
    if (LITERAL_NODES.has(node.name)
      || ["URL", "LinkTitle", "Image", "AuthoredWiki", "AuthoredWikiImage"].includes(node.name)) {
      protectedRanges.push({ from: node.from, to: node.to });
      return false;
    }
  } });
  const visible = maskRanges(source, protectedRanges);
  const comments: SourceRange[] = [];
  for (let position = visible.indexOf("%%"); position !== -1;) {
    if (isEscaped(source, position)) {
      position = visible.indexOf("%%", position + 1);
      continue;
    }
    const closing = source.indexOf("%%", position + 2);
    const end = closing < 0 ? source.length : closing + 2;
    comments.push({ from: position, to: end });
    position = visible.indexOf("%%", end);
  }
  return maskRanges(source, comments);
}

/** Parse ownership without changing any UTF-16 source positions or original bytes. */
export function parseAuthoredMarkdown(source: string): AuthoredMarkdown {
  const end = propertiesEnd(source);
  const preliminary = end ? maskRanges(source, [{ from: 0, to: end }]) : source;
  const preliminaryTree = parseWithMath(preliminary);
  const parsedSource = maskComments(preliminary, preliminaryTree);
  const tree = parsedSource === preliminary ? preliminaryTree : parseWithMath(parsedSource);
  const literalRanges: SourceRange[] = [];
  const imageRanges: SourceRange[] = [];
  tree.iterate({ enter(node) {
    if (node.name === "Image" || node.name === "AuthoredWikiImage") {
      imageRanges.push({ from: node.from, to: node.to });
      return false;
    }
    if (LITERAL_NODES.has(node.name) || node.name === "URL" || node.name === "LinkTitle") {
      literalRanges.push({ from: node.from, to: node.to });
      return false;
    }
  } });
  const imageSource = maskRanges(parsedSource, literalRanges);
  const navigationSource = maskRanges(imageSource, imageRanges);
  return { source, tree, imageSource, navigationSource };
}

export interface CachedMarkdownReference {
  readonly original: string;
  readonly link: string;
  readonly position: {
    readonly start: { readonly offset: number };
    readonly end: { readonly offset: number };
  };
}

/** Keep host-supported forms (including reference images), excluding literal atoms. */
export function activeCachedReferences(
  references: readonly CachedMarkdownReference[],
  source: string,
  visibleSource: string,
): CachedMarkdownReference[] {
  return references.filter(({ original, position }) =>
    isActiveCachedReference(source, visibleSource, original, position.start.offset, position.end.offset),
  ).sort((left, right) => left.position.start.offset - right.position.start.offset);
}

function isActiveCachedReference(
  source: string,
  visibleSource: string,
  original: string,
  start: number,
  end: number,
): boolean {
  // Preserve the existing downstream stale-cache rejection instead of hiding it.
  if (source.slice(start, end) !== original) return true;
  if (!original.startsWith("![") && !original.startsWith("[[")) return true;
  if (isEscaped(source, start)) return false;
  return visibleSource.slice(start, end) === original;
}

export function isEscaped(source: string, start: number): boolean {
  let backslashes = 0;
  for (let index = start - 1; index >= 0 && source[index] === "\\"; index -= 1) backslashes += 1;
  return backslashes % 2 === 1;
}

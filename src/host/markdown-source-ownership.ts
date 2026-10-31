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

// Wiki targets are Obsidian atoms. In particular, a backtick in one target
// cannot pair with a backtick in another target to create a CommonMark code span.
const authoredParser = parser.configure({
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

const LITERAL_NODES = new Set(["FencedCode", "CodeBlock", "InlineCode", "HTMLBlock", "HTMLTag", "CommentBlock",
  "Comment", "ProcessingInstruction", "ProcessingInstructionBlock"]);

/** Parse ownership without changing any UTF-16 source positions or original bytes. */
export function parseAuthoredMarkdown(source: string) {
  const characters = source.split("");
  const frontmatter = /^(?:\uFEFF)?---[ \t]*\r?\n[\s\S]*?(?:\r?\n(?:---|\.\.\.)[ \t]*(?=\r?\n|$)|$)/u.exec(source);
  if (frontmatter) mask(characters, 0, frontmatter[0].length);

  // Obsidian comments can span Markdown blocks. Only an opener outside an
  // existing syntax atom can own following text; a literal %% in code/HTML,
  // a destination, or a Wiki target cannot hide later document resources.
  const preliminary = characters.join("");
  const protectedCharacters = preliminary.split("");
  authoredParser.parse(preliminary).iterate({ enter(node) {
    if (LITERAL_NODES.has(node.name)
      || ["URL", "LinkTitle", "Image", "AuthoredWiki", "AuthoredWikiImage"].includes(node.name)) {
      mask(protectedCharacters, node.from, node.to);
      return false;
    }
  } });
  for (let position = 0; position < source.length - 1; position += 1) {
    if (protectedCharacters[position] !== "%" || protectedCharacters[position + 1] !== "%"
      || isEscaped(source, position)) continue;
    const closing = preliminary.indexOf("%%", position + 2);
    const end = closing < 0 ? source.length : closing + 2;
    mask(characters, position, end);
    position = end - 1;
  }
  const parsedSource = characters.join("");
  return { tree: authoredParser.parse(parsedSource), parsedSource };
}

export function maskProtectedSource(
  source: string,
  { preserveImageDestinations = false }: { preserveImageDestinations?: boolean } = {},
): string {
  const { tree, parsedSource } = parseAuthoredMarkdown(source);
  const characters = parsedSource.split("");
  tree.iterate({ enter(node) {
    if (node.name === "Image" || node.name === "AuthoredWikiImage") {
      if (!preserveImageDestinations) mask(characters, node.from, node.to);
      return false;
    }
    if (LITERAL_NODES.has(node.name) || node.name === "URL" || node.name === "LinkTitle") {
      mask(characters, node.from, node.to);
      return false;
    }
  } });
  return characters.join("");
}

/** Keep host-supported forms (including reference images), excluding literal atoms. */
export function isActiveCachedReference(
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

function mask(characters: string[], start: number, end: number): void {
  for (let index = start; index < end; index += 1) {
    if (characters[index] !== "\n" && characters[index] !== "\r") characters[index] = " ";
  }
}

function isEscaped(source: string, start: number): boolean {
  let backslashes = 0;
  for (let index = start - 1; index >= 0 && source[index] === "\\"; index -= 1) backslashes += 1;
  return backslashes % 2 === 1;
}

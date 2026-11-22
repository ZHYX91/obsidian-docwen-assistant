/*!
Bundled js-yaml license
(The MIT License)

Copyright (C) 2011-2015 by Vitaly Puzrin

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
import { FAILSAFE_SCHEMA, load, Type, YAMLException } from "js-yaml";

const OPEN = /^(?:\uFEFF)?---[ \t]*(?:\r\n?|\n)/u;
const CLOSE = /(?:^|\r\n?|\n)(?:---|\.\.\.)[ \t]*(?=[\r\n]|$)/u;
// All explicit tags retain only their YAML node shape. Classification never
// runs a custom tag constructor or uses the parsed values in the export.
const kinds = ["scalar", "sequence", "mapping"] as const;
const structureSchema = FAILSAFE_SCHEMA.extend(kinds.map(kind => new Type("", { kind, multi: true })));

function yamlMapping(content: string): boolean {
  try {
    // An explicit document start disambiguates legal first keys such as "---foo".
    const value = load("---\n" + content, { schema: structureSchema, json: true });
    return typeof value === "object" && value !== null && !Array.isArray(value);
  } catch (error) {
    if (!(error instanceof YAMLException)) throw error;
    return false;
  }
}

// Obsidian notes can use an unquoted image as a complete property or list
// value. Interpret only its shape in this private YAML parse view.
const BARE_IMAGE = /^([^\r\n]*?:[ \t]+|[ \t]*-[ \t]+)(!\[\[[^\]\r\n]+\]\]|!\[[^\]\r\n]*\](?:\([^\r\n]*\))?)([ \t]+#[^\r\n]*|[ \t]*)$/gmu;

/** UTF-16 end offset of the empty or mapping-shaped properties at the start of a note. */
export function propertiesEnd(source: string): number {
  const open = OPEN.exec(source);
  if (!open) return 0;
  const afterOpen = source.slice(open[0].length);
  const close = CLOSE.exec(afterOpen);
  if (!close) return 0;
  const content = afterOpen.slice(0, close.index);
  if (/[^ \t\r\n]/u.test(content) && !yamlMapping(content)) {
    const compatible = content.replace(BARE_IMAGE, "$1image$3");
    if (compatible === content || !yamlMapping(compatible)) return 0;
  }
  return open[0].length + close.index + close[0].length;
}

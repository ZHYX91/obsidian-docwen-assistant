import { parseAuthoredMarkdown } from "../src/host/markdown-source-ownership";
import { describe, expect, it, vi } from "vitest";
import { scanAuthoredImageEmbeds, scanImageOccurrences } from "../src/host/markdown-image-embed-coverage";
import { scanAuthoredWikiNavigations } from "../src/host/markdown-wiki-navigation-coverage";
import { propertiesEnd } from "../src/host/markdown-properties";
import { buildDeclaredMarkdownInputs } from "../src/host/declared-markdown-snapshot";

vi.mock("obsidian", () => ({ TFile: class TFile {}, parseLinktext: vi.fn() }));

const outside = "![[photo.png]] [[Target]]";
const formula = "[[x]] + ![[literal.png]]";

describe("Word export source boundaries", () => {
  it.each([
    "---\n\n",
    "---\r\n\r\n",
    "---\n---\n",
    '---\nheading: "[[Property]]"\n---\n',
  ])("keeps body references after a rule or frontmatter %j", (prefix) => {
    const source = prefix + outside;
    expect(scanAuthoredWikiNavigations(parseAuthoredMarkdown(source)).map(item => item.token)).toEqual(["[[Target]]"]);
    expect(scanAuthoredImageEmbeds(source).map(item => item.token)).toEqual(["![[photo.png]]"]);
  });

  it.each([
    "---\n---foo: plain\nlink: [[Property]]\n---\n",
    "---\r\n---foo: plain\r\nlink: [[Property]]\r\n...\r\n",
    "--- \nheading: [[Property]]\n--- \n",
  ])("keeps YAML frontmatter opaque and resumes body scanning after %j", (prefix) => {
    const source = prefix + outside;
    expect(scanAuthoredWikiNavigations(parseAuthoredMarkdown(source)).map(item => item.token)).toEqual(["[[Target]]"]);
    expect(scanAuthoredImageEmbeds(source).map(item => item.token)).toEqual(["![[photo.png]]"]);
  });

  it.each([
    "# Section",
    "A paragraph",
    "- First item",
    "title: [unfinished",
  ])("preserves body references between thematic breaks after %j", (firstLine) => {
    const source = ["---", firstLine, "", outside, "", "---", "Tail"].join("\n");
    expect(scanAuthoredWikiNavigations(parseAuthoredMarkdown(source)).map(item => item.start)).toEqual([source.indexOf("[[Target]]")]);
    expect(scanAuthoredImageEmbeds(source).map(item => item.start)).toEqual([source.indexOf("![[photo.png]]")]);
  });

  it.each([
    'aliases:\n  - "[[Property]]"\ncover: ![[front.png]]',
    'summary: |\n  ---\n  [[Property]] ![[front.png]]',
    '{"title": "[[Property]] ![[front.png]]"}',
  ])("keeps nested and flow-style properties opaque (%j)", (properties) => {
    const source = ["\uFEFF--- ", properties, "...\t", outside, "---"].join("\r\n");
    expect(scanAuthoredWikiNavigations(parseAuthoredMarkdown(source)).map(item => item.token)).toEqual(["[[Target]]"]);
    expect(scanAuthoredImageEmbeds(source).map(item => item.token)).toEqual(["![[photo.png]]"]);
  });

  it.each([
    ["封面: ![[图片.png|240]] # 预览", true],
    ["附件:\n  - ![示例](附件/图 片.png)", true],
    ["related: &note \"[[笔记]]\"\nalias: *note", true],
    ["related: *missing", false],
    ["cover: ![[未结束", false],
    ["cover: ![图片](未结束", false],
    ["# 只有标题", false],
    ["title:\t 示例", true],
  ])("classifies the entire candidate properties block %j", (properties, expected) => {
    const prefix = ["---", properties, "..."].join("\n");
    const source = prefix + "\n" + outside;
    expect(propertiesEnd(source)).toBe(expected ? prefix.length : 0);
  });

  it.each([
    "$" + formula + "$",
    "Text $$" + formula + "$$",
    "Text $$ " + formula + " $$",
    "$$ " + formula + " $$",
    "$$\n" + formula + "\n\n# still math\n$$",
    "> $$\n> " + formula + "\n> $$",
    "> $$\n> first line\n# " + formula + "\n$$",
    "- $$\n  first line\n" + formula + "\n$$",
    "- $$\n  " + formula + "\n  $$",
    "$$\r\n" + formula + "\r\n$$",
    "$x\\$ " + formula + "$",
  ])("excludes math without losing the ranges of subsequent references in %j", (math) => {
    const source = math + "\n\n" + outside;
    const markdown = parseAuthoredMarkdown(source);
    const links = scanAuthoredWikiNavigations(markdown);
    expect(links.map(link => link.start)).toEqual([source.indexOf("[[Target]]")]);
    expect(scanImageOccurrences(markdown).filter(item => item.requiresCache).map(item => item.image.token))
      .toEqual(["![[photo.png]]"]);
  });

  it.each([
    ["$$ price marker\n", "\n$$"],
    ["$$\n", ""],
    ["> $$\n> ", ""],
    ["- $$\n  ", ""],
    ["$$\n", "\nIndented $$\n"],
    ["$$\n", "\n $$"],
    ["$$\n$$\n", ""],
    ["- $$\n  ", "\n\n# Outside list\n$$"],
    ["Text $$\n", "\n$$"],
  ])("keeps active resources after %j without a matching display close (%j)", (prefix, suffix) => {
    const source = prefix + "![Photo](photo.png) [[Target]]" + suffix;
    expect(scanAuthoredImageEmbeds(source).map(item => item.token)).toEqual(["![Photo](photo.png)"]);
    expect(scanAuthoredWikiNavigations(parseAuthoredMarkdown(source)).map(item => item.start)).toEqual([source.indexOf("[[Target]]")]);
  });

  it("keeps a valid quoted formula after an unclosed top-level delimiter", () => {
    const source = "$$\n> $$\n> " + formula + "\n> $$\n\n" + outside;
    expect(scanAuthoredImageEmbeds(source).map(item => item.token)).toEqual(["![[photo.png]]"]);
    expect(scanAuthoredWikiNavigations(parseAuthoredMarkdown(source)).map(item => item.token)).toEqual(["[[Target]]"]);
  });

  it.each(["\\$[[x]]$", "$ [[x]] $", "$[[x]]$5", "$[[x]]", "Price $5 [[x]] and $10"])(
    "retains a real navigation when dollar signs do not delimit math: %j", (source) => {
      expect(scanAuthoredWikiNavigations(parseAuthoredMarkdown(source)).map(item => item.token)).toEqual(["[[x]]"]);
    },
  );

  it("retains UTF-16 cache offsets across adjacent masked ranges and physical line breaks", () => {
    const source = ["图😀 `%%[[Code]]`%%甲😀", "ignored ![[no.png]]%%![[图😀.png]]", "[[正文😀]]"].join("\r\n");
    const markdown = parseAuthoredMarkdown(source);
    const image = "![[图😀.png]]";
    const link = "[[正文😀]]";
    expect(markdown.imageSource).toHaveLength(source.length);
    expect(markdown.navigationSource).toHaveLength(source.length);
    expect(markdown.imageSource.match(/\r\n/gu)).toHaveLength(2);
    expect(scanImageOccurrences(markdown).map(item => item.image.start)).toEqual([source.indexOf(image)]);
    expect(scanAuthoredWikiNavigations(markdown).map(item => item.start)).toEqual([source.indexOf(link)]);
  });

  it("prepares the Word snapshot when Obsidian returns no links for a formula", async () => {
    const boundary = vi.spyOn(await import("../src/host/markdown-properties"), "propertiesEnd");
    const source = "---\nname: test\n---\n$$\n" + formula + "\n$$";
    const file = { path: "Math.md", extension: "md" };
    const sourceInput = { path: "Math.md", logicalPath: "Math.md", role: "source", kind: "document",
      mediaType: "text/markdown" } as const;
    const app = { metadataCache: { getFileCache: () => ({}) } };
    try {
      const snapshot = await buildDeclaredMarkdownInputs(app as never, file as never, source, "",
        new AbortController().signal, sourceInput, "a".repeat(64));
      expect(snapshot.inputs).toEqual([sourceInput]);
      expect(snapshot.resourceBindings).toBeUndefined();
      expect(boundary).toHaveBeenCalledTimes(1);
    } finally {
      boundary.mockRestore();
    }
  });
});

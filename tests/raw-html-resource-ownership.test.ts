import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({
  MarkdownView: class MarkdownView {},
  TFile: class TFile {},
  parseLinktext: (link: string) => ({ path: link }),
}));
vi.mock("node:fs/promises", async (importOriginal) => ({
  ...await importOriginal<typeof import("node:fs/promises")>(),
  writeFile: vi.fn(),
}));

import { buildDeclaredMarkdownInputs } from "../src/host/declared-markdown-snapshot";
import { TFile } from "obsidian";
import { scanAuthoredImageEmbeds, type CachedEmbedLike } from "../src/host/markdown-image-embed-coverage";
import { scanAuthoredWikiNavigations, type CachedLinkLike } from "../src/host/markdown-wiki-navigation-coverage";

const literalReferences = "![[hidden.png]]\n![hidden](hidden.webp)\n[[Hidden note]]";
const rawBlocks = [
  { name: "raw block interrupting an incomplete inline comment", source: "Text <!--\n<pre>\n-->\n\n" + literalReferences + "\n" },
  ...["pre", "script", "style", "textarea"].map((tag) => ({
    name: tag,
    source: `<${tag}>\n${literalReferences}\n</${tag}>\n`,
  })),
  { name: "uppercase raw tag", source: `<PRE class="example">\n${literalReferences}\n</PRE>\n` },
  { name: "unclosed raw block", source: `<pre>\n${literalReferences}\n` },
  { name: "raw block containing blank lines", source: `<pre>\n\n${literalReferences}\n\n</pre>\n` },
  {
    name: "blockquote",
    source: ["<pre>", ...literalReferences.split("\n"), "</pre>"].map((line) => `> ${line}`).join("\n") + "\n",
  },
  {
    name: "list item",
    source: "- <textarea>\n" + literalReferences.split("\n").map((line) => `  ${line}`).join("\n") + "\n  </textarea>\n",
  },
];

beforeEach(() => vi.clearAllMocks());

async function buildWithEmptyMetadata(source: string, cache: {
  embeds: readonly CachedEmbedLike[]; links: readonly CachedLinkLike[];
} = { embeds: [], links: [] }) {
  const getFirstLinkpathDest = vi.fn();
  const readBinary = vi.fn();
  const app = {
    metadataCache: { getFileCache: () => cache, getFirstLinkpathDest },
    vault: { readBinary },
  };
  const sourceInput = {
    path: "source.md",
    kind: "document" as const,
    role: "source" as const,
    logicalPath: "notes/example.md",
    mediaType: "text/markdown",
  };
  const snapshot = await buildDeclaredMarkdownInputs(
    app as never,
    { path: "notes/example.md", extension: "md" } as never,
    source,
    "unused-workspace",
    new AbortController().signal,
    sourceInput,
    createHash("sha256").update(source).digest("hex"),
  );
  expect(getFirstLinkpathDest).not.toHaveBeenCalled();
  expect(readBinary).not.toHaveBeenCalled();
  expect(writeFile).not.toHaveBeenCalled();
  return { snapshot, sourceInput };
}

describe("raw HTML resource ownership", () => {
  it.each([
    "<pre>\n<!--\n</pre>\n\n",
    "```text\n<!--\n```\n\n",
    "`<!--`\n\n",
    "%%\n<pre>\n%%\n\n",
    '[label](https://example.test "literal `") ![[active.png]] [[Active note]] `code\n\n',
    "[label](https://example.test/path`segment) ![[active.png]] [[Active note]] `code\n\n",
    "`unclosed ![[active.png]] [[Active note]]\n```text\nliteral`\n```\n\n",
    "> <pre>\n> literal\n\n",
    "Text <!-- ![[hidden.png]] [[Hidden note]] %% -->\n\n",
    "Text <?x ![[hidden.png]] [[Hidden note]] %% ?>\n\n",
    "<?x ![[hidden.png]] [[Hidden note]] %% ?>\n\n",
  ])("retains real block-external resources after literal delimiters in %j", async (prefix) => {
    const source = prefix + "![[active.png]] [[Active note]]\n";
    expect(new Set(scanAuthoredImageEmbeds(source).map((item) => item.link))).toEqual(new Set(["active.png"]));
    expect(new Set(scanAuthoredWikiNavigations(source).map((item) => item.link))).toEqual(new Set(["Active note"]));
    const cached = (original: string, link: string) => ({ original, link,
      position: { start: { offset: source.indexOf(original) }, end: { offset: source.indexOf(original) + original.length } } });
    const image = Object.assign(new TFile(), { path: "assets/active.png", extension: "png" });
    const note = Object.assign(new TFile(), { path: "notes/Active note.md", extension: "md" });
    const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO1sAAAAASUVORK5CYII=", "base64");
    const readBinary = vi.fn(async () => bytes);
    const app = { metadataCache: {
      getFileCache: () => ({
        embeds: [...source.matchAll(/!\[\[active\.png\]\]/gu)].map((match) => ({ ...cached("![[active.png]]", "active.png"),
          position: { start: { offset: match.index }, end: { offset: match.index + match[0].length } } })),
        links: [...source.matchAll(/(?<!!)\[\[Active note\]\]/gu)].map((match) => ({ ...cached("[[Active note]]", "Active note"),
          position: { start: { offset: match.index }, end: { offset: match.index + match[0].length } } })),
      }),
      getFirstLinkpathDest: (link: string) => link === "active.png" ? image : note,
    }, vault: { readBinary, getName: () => "Fixture" } };
    const snapshot = await buildDeclaredMarkdownInputs(app as never, { path: "note.md" } as never,
      source, "unused-workspace", new AbortController().signal,
      { path: "source.md", kind: "document", role: "source", logicalPath: "note.md", mediaType: "text/markdown" },
      createHash("sha256").update(source).digest("hex"));
    expect(snapshot.inputs).toHaveLength(2);
    expect(snapshot.inputs[1]).toMatchObject({ logicalPath: "assets/active.png", role: "linked_resource", mediaType: "image/png" });
    expect(snapshot.resourceBindings?.images).toEqual([{ authored_token: "![[active.png]]", logical_path: "assets/active.png" }]);
    expect(snapshot.resourceBindings?.wiki_links?.[0]?.authored_token).toBe("[[Active note]]");
    expect(readBinary).toHaveBeenCalledExactlyOnceWith(image);
    expect(writeFile).toHaveBeenCalledExactlyOnceWith(expect.any(String), bytes);
  });


  it.each([
    '[label](https://example.test "literal `") [[Active note]] `code\n',
    '[label](https://example.test/path`segment) [[Active note]] `code\n',
    '![[foo`bar.png]] [[Foo`bar]]',
  ])("keeps Wiki atoms outside destinations and titles: %j", (source) => {
    expect(scanAuthoredWikiNavigations(source).map((item) => item.link)).toEqual([
      source.includes("Foo`bar") ? "Foo`bar" : "Active note",
    ]);
  });

  it.each([
    { source: '![ref][image]\n\n[image]: active.png\n', token: '![ref][image]' },
    { source: '![alt `code`](<active.png> "title `")\n', token: '![alt `code`](<active.png> "title `")' },
  ])("preserves a host-supported active image form: $token", async ({ source, token }) => {
    const image = Object.assign(new TFile(), { path: "assets/active.png", extension: "png" });
    const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO1sAAAAASUVORK5CYII=", "base64");
    const readBinary = vi.fn(async () => bytes);
    const app = { metadataCache: {
      getFileCache: () => ({ embeds: [{ original: token, link: "active.png",
        position: { start: { offset: 0 }, end: { offset: token.length } } }], links: [] }),
      getFirstLinkpathDest: () => image,
    }, vault: { readBinary, getName: () => "Fixture" } };
    const snapshot = await buildDeclaredMarkdownInputs(app as never, { path: "note.md" } as never,
      source, "unused-workspace", new AbortController().signal,
      { path: "source.md", kind: "document", role: "source", logicalPath: "note.md", mediaType: "text/markdown" },
      createHash("sha256").update(source).digest("hex"));
    expect(snapshot.inputs[1]).toMatchObject({ logicalPath: "assets/active.png", role: "linked_resource" });
    expect(snapshot.resourceBindings?.images).toEqual([{ authored_token: token, logical_path: "assets/active.png" }]);
    expect(readBinary).toHaveBeenCalledExactlyOnceWith(image);
  });

  it("does not let a generic inline tag interrupt an existing paragraph", () => {
    const source = "Paragraph\n<span>\n![[active.png]] [[Active note]]\n";
    expect(scanAuthoredImageEmbeds(source).map((item) => item.link)).toEqual(["active.png"]);
    expect(scanAuthoredWikiNavigations(source).map((item) => item.link)).toEqual(["Active note"]);
  });

  it("ignores cache entries whose exact source range belongs to literal HTML", async () => {
    const source = "<pre>\n![[hidden.png]]\n[[Hidden note]]\n</pre>\n";
    const cached = (original: string, link: string) => ({
      original, link, position: { start: { offset: source.indexOf(original) },
        end: { offset: source.indexOf(original) + original.length } },
    });
    const { snapshot, sourceInput } = await buildWithEmptyMetadata(source, {
      embeds: [cached("![[hidden.png]]", "hidden.png")],
      links: [cached("[[Hidden note]]", "Hidden note")],
    });
    expect(snapshot).toEqual({ inputs: [sourceInput], resourceBindings: undefined });
  });

  it.each(rawBlocks)("keeps $name contents out of both resource scanners", ({ source }) => {
    expect(scanAuthoredImageEmbeds(source)).toEqual([]);
    expect(scanAuthoredWikiNavigations(source)).toEqual([]);
  });

  it.each(rawBlocks)("accepts $name literal text without host resource metadata", async ({ source }) => {
    const { snapshot, sourceInput } = await buildWithEmptyMetadata(source);
    expect(snapshot).toEqual({ inputs: [sourceInput], resourceBindings: undefined });
  });

  it.each(["pre", "script", "style", "textarea"])(
    "retains exact source ranges for active references after a closed %s block",
    (tag) => {
      const image = "![[outside.png]]";
      const markdownImage = "![outside](outside.webp)";
      const link = "[[Outside note]]";
      const source = `😀\n\n<${tag}>\n${literalReferences}\n</${tag}>\n\n${image}\n${markdownImage}\n${link}\n`;
      expect(scanAuthoredImageEmbeds(source)).toEqual([
        { start: source.indexOf(image), end: source.indexOf(image) + image.length, token: image, link: "outside.png" },
        { start: source.indexOf(markdownImage), end: source.indexOf(markdownImage) + markdownImage.length, token: markdownImage, link: "outside.webp" },
      ]);
      expect(scanAuthoredWikiNavigations(source)).toEqual([
        { start: source.indexOf(link), end: source.indexOf(link) + link.length, token: link, link: "Outside note" },
      ]);
    },
  );

  it.each([
    { token: "![[outside.png]]", diagnostic: "image metadata", target: "outside.png" },
    { token: "![outside](outside.webp)", diagnostic: "image metadata", target: "outside.webp" },
    { token: "[[Outside note]]", diagnostic: "WikiLink metadata", target: "Outside note" },
  ])("still rejects an uncovered active reference: $token", async ({ token, diagnostic, target }) => {
    const source = `<pre>\n${literalReferences}\n</pre>\n\n${token}\n`;
    const pending = buildWithEmptyMetadata(source);
    await expect(pending).rejects.toMatchObject({
      code: "vault_input_invalid",
      message: expect.stringContaining(diagnostic),
    });
    await expect(pending).rejects.toMatchObject({
      message: expect.stringContaining(target),
    });
  });

  it("ends a closed HTML block inside a quote before active document references", () => {
    const source = "> <pre>\n> ![[hidden.png]]\n> [[Hidden note]]\n> </pre>\n\n![[outside.png]]\n[[Outside note]]\n";
    expect(scanAuthoredImageEmbeds(source).map((image) => image.link)).toEqual(["outside.png"]);
    expect(scanAuthoredWikiNavigations(source).map((link) => link.link)).toEqual(["Outside note"]);
  });

  it("does not let a tag displayed in fenced code claim the following Markdown", () => {
    const source = "```html\n<pre>\n```\n\n![[outside.png]]\n[[Outside note]]\n";
    expect(scanAuthoredImageEmbeds(source).map((image) => image.link)).toEqual(["outside.png"]);
    expect(scanAuthoredWikiNavigations(source).map((link) => link.link)).toEqual(["Outside note"]);
  });
});

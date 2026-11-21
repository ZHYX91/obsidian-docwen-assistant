import { describe, expect, it, vi } from "vitest";
import { scanAuthoredImageEmbeds } from "../src/host/markdown-image-embed-coverage";
import { scanAuthoredWikiNavigations } from "../src/host/markdown-wiki-navigation-coverage";
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
    expect(scanAuthoredWikiNavigations(source).map(item => item.token)).toEqual(["[[Target]]"]);
    expect(scanAuthoredImageEmbeds(source).map(item => item.token)).toEqual(["![[photo.png]]"]);
  });

  it.each([
    "$" + formula + "$",
    "Text $$ " + formula + " $$",
    "$$\n" + formula + "\n\n# still math\n$$",
    "> $$\n> " + formula + "\n> $$",
    "> $$\n> first line\n" + formula,
    "- $$\n  first line\n" + formula,
    "- $$\n  " + formula + "\n  $$",
    "$$\r\n" + formula + "\r\n$$",
    "$x\\$ " + formula + "$",
  ])("excludes math without losing the ranges of subsequent references in %j", (math) => {
    const source = math + "\n\n" + outside;
    const [link] = scanAuthoredWikiNavigations(source);
    expect(scanAuthoredWikiNavigations(source)).toHaveLength(1);
    expect(link.start).toBe(source.indexOf("[[Target]]"));
    expect(scanAuthoredImageEmbeds(source).map(item => item.token)).toEqual(["![[photo.png]]"]);
  });

  it.each(["\\$[[x]]$", "$ [[x]] $", "$[[x]]$5", "$[[x]]", "Price $5 [[x]] and $10"])(
    "retains a real navigation when dollar signs do not delimit math: %j", (source) => {
      expect(scanAuthoredWikiNavigations(source).map(item => item.token)).toEqual(["[[x]]"]);
    },
  );

  it("prepares the Word snapshot when Obsidian returns no links for a formula", async () => {
    const source = "$$\n" + formula + "\n$$";
    const file = { path: "Math.md", extension: "md" };
    const sourceInput = { path: "Math.md", logicalPath: "Math.md", role: "source", kind: "document",
      mediaType: "text/markdown" } as const;
    const app = { metadataCache: { getFileCache: () => ({}) } };
    const snapshot = await buildDeclaredMarkdownInputs(app as never, file as never, source, "",
      new AbortController().signal, sourceInput, "a".repeat(64));
    expect(snapshot.inputs).toEqual([sourceInput]);
    expect(snapshot.resourceBindings).toBeUndefined();
  });
});

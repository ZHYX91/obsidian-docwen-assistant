import { describe, expect, it } from "vitest";

import {
  findUncoveredWikiNavigations,
  scanAuthoredWikiNavigations,
} from "../src/host/markdown-wiki-navigation-coverage";

describe("Markdown WikiLink navigation cache coverage", () => {
  it("finds active local ordinary WikiLinks and ignores embeds/fragment-only/remote links", () => {
    const source = [
      "# Note",
      "",
      "[[Other Note]]",
      "[[Folder/Target#Section|Label]]",
      "![[Embedded Note]]",
      "[[#Local heading]]",
      "[[https://example.test/page]]",
      "",
    ].join("\n");

    const scanned = scanAuthoredWikiNavigations(source);

    expect(scanned.map((item) => item.token)).toEqual([
      "[[Other Note]]",
      "[[Folder/Target#Section|Label]]",
    ]);
    for (const item of scanned) expect(source.slice(item.start, item.end)).toBe(item.token);
  });

  it("ignores navigation-looking syntax in protected Markdown regions", () => {
    const tick = String.fromCharCode(96);
    const fence = tick.repeat(3);
    const source = [
      "---",
      "target: [[Frontmatter]]",
      "---",
      "\\[[Escaped]]",
      tick + "[[Inline]]" + tick,
      "<!-- [[HtmlComment]] -->",
      "%% [[ObsidianComment]] %%",
      "<span data-link=\"[[Attribute]]\">literal</span>",
      fence + "md",
      "[[Fenced]]",
      fence,
      "    [[Indented]]",
      "[[Real]]",
    ].join("\n");

    expect(scanAuthoredWikiNavigations(source).map((item) => item.link)).toEqual(["Real"]);
  });

  it("reports only source WikiLinks not exactly covered by cached metadata", () => {
    const source = "😀 [[Old]]\n[[New#Section|Alias]]\n";
    const oldToken = "[[Old]]";
    const oldStart = source.indexOf(oldToken);

    const missing = findUncoveredWikiNavigations(source, [{
      link: "Old",
      original: oldToken,
      position: {
        start: { offset: oldStart },
        end: { offset: oldStart + oldToken.length },
      },
    }]);

    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({ token: "[[New#Section|Alias]]", link: "New#Section" });
  });
});

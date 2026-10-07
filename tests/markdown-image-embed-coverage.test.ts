import { describe, expect, it } from "vitest";

import {
  findUncoveredImageEmbeds,
  scanAuthoredImageEmbeds,
} from "../src/host/markdown-image-embed-coverage";

describe("Markdown image embed cache coverage", () => {
  it("finds active local Wiki and Markdown image embeds with exact source ranges", () => {
    const source = [
      "# Note",
      "",
      "![[assets/chart.png|200]]",
      "![photo](images/photo.webp \"title\")",
      "![[Other Note]]",
      "![remote](https://example.test/remote.png)",
      "",
    ].join("\n");

    const scanned = scanAuthoredImageEmbeds(source);

    expect(scanned.map((item) => item.token)).toEqual([
      "![[assets/chart.png|200]]",
      "![photo](images/photo.webp \"title\")",
    ]);
    for (const item of scanned) {
      expect(source.slice(item.start, item.end)).toBe(item.token);
    }
  });

  it("ignores image-looking syntax in literal Markdown regions", () => {
    const tick = String.fromCharCode(96);
    const fence = tick.repeat(3);
    const source = [
      "---",
      "cover: ![[frontmatter.png]]",
      "---",
      "",
      "\\![[escaped.png]]",
      tick + "![[inline.png]]" + tick,
      "<!-- ![[html-comment.png]] -->",
      "%% ![[obsidian-comment.png]] %%",
      "<span data-image=\"![[attribute.png]]\">literal</span>",
      fence + "md",
      "![[fenced.png]]",
      fence,
      "    ![[indented.png]]",
      "",
      "![[real.png]]",
    ].join("\n");

    expect(scanAuthoredImageEmbeds(source).map((item) => item.link)).toEqual(["real.png"]);
  });

  it("reports only source image tokens not exactly covered by cached metadata", () => {
    const source = "😀 ![[old.png]]\n![[new.png|300]]\n";
    const oldToken = "![[old.png]]";
    const oldStart = source.indexOf(oldToken);

    const missing = findUncoveredImageEmbeds(source, [{
      link: "old.png",
      original: oldToken,
      position: {
        start: { offset: oldStart },
        end: { offset: oldStart + oldToken.length },
      },
    }]);

    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({
      token: "![[new.png|300]]",
      link: "new.png",
    });
  });
});

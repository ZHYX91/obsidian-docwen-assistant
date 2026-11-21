import { Window } from "happy-dom";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  findUncoveredImageEmbeds,
  includeUncachedImages,
  scanAuthoredImageEmbeds,
} from "../src/host/markdown-image-embed-coverage";

let host: Window;
beforeAll(() => {
  host = new Window();
  vi.stubGlobal("DOMParser", host.DOMParser);
});
afterAll(async () => {
  await host.happyDOM.close();
  vi.unstubAllGlobals();
});

describe("Markdown image embed cache coverage", () => {
  it("checks raw reference cache opposition even when an active-cache filter omitted that record", () => {
    const source = "![image]\n\n[image]: active.png\n";
    const raw = [{ original: "![stale]", link: "old.png", position: {
      start: { offset: 0 }, end: { offset: "![image]".length },
    } }];
    expect(includeUncachedImages(source, [], raw)).toEqual([]);
    expect(findUncoveredImageEmbeds(source, includeUncachedImages(source, [], raw))).toHaveLength(1);
  });

  it("matches repeated cached images without rescanning raw metadata for each occurrence", () => {
    const token = "![alt](assets/p.png)";
    const line = token + "\n\n";
    const count = 128;
    const source = line.repeat(count);
    const cached = Array.from({ length: count }, (_, index) => ({
      original: token, link: "assets/p.png",
      position: { start: { offset: index * line.length }, end: { offset: index * line.length + token.length } },
    }));
    let reads = 0;
    const raw = cached.map((embed) => ({
      ...embed, get position() { reads += 1; return embed.position; },
    })).reverse();
    expect(includeUncachedImages(source, cached, raw)).toEqual(cached);
    expect(reads).toBeLessThan(count * 8);
  });

  it("checks unsorted overlapping ranges and displaced identical tokens without blocking adjacent images", () => {
    const token = "![alt](assets/p.png)";
    const other = "![other](assets/q.png)";
    const source = [token, token, token, other].join(" ");
    const start = token.length + 1;
    const raw = [
      { original: "stale", link: "old.png", position: { start: { offset: start - 1 }, end: { offset: start } } },
      { original: "old", link: "old.png", position: { start: { offset: 1 }, end: { offset: start * 2 } } },
      { original: other, link: "assets/q.png", position: { start: { offset: 500 }, end: { offset: 520 } } },
    ];
    expect(includeUncachedImages(source, [], raw).map((embed) => embed.position.start.offset)).toEqual([start * 2]);
  });

  it.each([
    ["![photo](<media/my photo.png>)", "media/my photo.png"],
    ["![photo](media/photo(1).png)", "media/photo(1).png"],
    ["![photo](media/photo\\(1\\).png \"title (1)\")", "media/photo(1).png"],
  ])("requires exact cache coverage for %s", (source, link) => {
    const missing = findUncoveredImageEmbeds(source, []);
    expect(missing).toEqual([{ start: 0, end: source.length, token: source, link }]);
  });

  it.each([
    ["![ref][image]", "[image]: active.png", "active.png"],
    ["![image][]", "[image]: active.png", "active.png"],
    ["![image]", "[image]: active.png", "active.png"],
    ["![ref][  IMAGE\t label  ]", "[image label]: active.png", "active.png"],
    ["![Straße]", "[STRASSE]: active.png", "active.png"],
    ["![ref][image]", "[image]:\n  <media/my photo.png>\n  \"image title\"", "media/my photo.png"],
    ["![ref][image]", "[image]: media/photo\\(1\\).png 'escaped \\' title'", "media/photo(1).png"],
    ["![ref][image]", "> [image]: active.png", "active.png"],
    ["![ref][image]", "- [image]: active.png", "active.png"],
    ["![ref][IMAGE   NAME]", "[image\nname]: active.png", "active.png"],
    ["![ref][image]", "[image]: active.png \"a title\ncontinued here\"", "active.png"],
  ])("requires cache coverage for resolved reference image %s", (token, definition, link) => {
    const source = "😀 " + token + "\n\n" + definition + "\n";
    const start = source.indexOf(token);
    const expected = { start, end: start + token.length, token, link };
    expect(findUncoveredImageEmbeds(source, [])).toEqual([expected]);
    expect(findUncoveredImageEmbeds(source, [{
      original: token, link,
      position: { start: { offset: start }, end: { offset: start + token.length } },
    }])).toEqual([]);
  });

  it("uses the first definition and does not borrow a later image destination", () => {
    expect(scanAuthoredImageEmbeds("![image]\n\n[image]: first.png\n[IMAGE]: second.png\n"))
      .toMatchObject([{ token: "![image]", link: "first.png" }]);
    expect(scanAuthoredImageEmbeds("![image]\n\n[image]: https://example.test/remote.png\n[IMAGE]: local.png\n"))
      .toEqual([]);
  });

  it.each([
    "![undefined]",
    "![alt][missing]\n\n[alt]: active.png",
    "![image]()\n\n[image]: active.png",
    "![image](<>)\n\n[image]: active.png",
    "![image]\n\nParagraph\n[image]: active.png",
    "![image]\n\n[image]: active.png invalid trailing text",
    "![image]\n\n```\n[image]: hidden.png\n```",
    "![image]\n\n<pre>\n[image]: hidden.png\n</pre>",
    "![image]\n\n%% [image]: hidden.png %%",
    "---\n[image]: hidden.png\n---\n\n![image]",
    "`![image]`\n\n[image]: hidden.png",
    "<pre>\n![image]\n</pre>\n\n[image]: hidden.png",
    "![image]\n\n[image]: //example.test/remote.png",
    "![image]\n\n[image]: &#104;ttps://example.test/remote.png",
    "![image]\n\n[image]: https%3A%2F%2Fexample.test%2Fremote.png",
  ])("does not invent an active local reference image in %j", (source) => {
    expect(scanAuthoredImageEmbeds(source)).toEqual([]);
  });

  it("resolves multiline labels inside blockquotes without changing source ranges", () => {
    const source = "> ![im\n> age]\n>\n> [im\n> age]: active.png\n";
    const token = "![im\n> age]";
    const start = source.indexOf(token);
    expect(scanAuthoredImageEmbeds(source)).toEqual([
      { start, end: start + token.length, token, link: "active.png" },
    ]);
  });

  it.each([
    ["media/photo\\(1\\).png", "media/photo(1).png"],
    ["<media/a&amp;b&#46;png>", "media/a&b.png"],
    ["image&period;png", "image.png"],
    ["image&#x2e;png", "image.png"],
    ["name\\&period;.png", "name&period;.png"],
    ["name&amp;period;.png", "name&period;.png"],
    ["media/my%20photo%2epng", "media/my photo.png"],
    ["media/my%20photo%2epng", "media/my%20photo%2epng"],
    ["media/photo%23tag.png", "media/photo%23tag.png"],
    ["media/photo%3ftag.png", "media/photo%3Ftag.png"],
    ["media/my\\%20photo.png", "media/my%2520photo.png"],
    ["media/photo\\#tag.png", "media/photo%23tag.png"],
    ["media/photo\\?tag.png", "media/photo%3Ftag.png"],
    ["media/my&#37;20photo.png", "media/my photo.png"],
    ["<media/my&#32;photo.png>", "media/my photo.png"],
  ])("compares the current reference target %s with its semantic cache link", (destination, link) => {
    const token = "![ref][image]";
    const source = token + "\n\n[image]: " + destination + "\n";
    const cache = [{ original: token, link, position: { start: { offset: 0 }, end: { offset: token.length } } }];
    expect(scanAuthoredImageEmbeds(source)).toHaveLength(1);
    expect(findUncoveredImageEmbeds(source, cache)).toEqual([]);
  });

  it.each([
    ["[image]: new.png", "old.png"],
    ["[image]: https://example.test/image.png", "old.png"],
    ["", "old.png"],
    ["[image]: media/my%2520photo.png", "media/my photo.png"],
    ["[image]: media/my%2520photo.png", "media/my%20photo.png"],
    ["[image]: malformed%GG.png", "malformed%GG.png"],
    ["[image]: media/photo%23tag.png", "media/photo#tag.png"],
    ["[image]: media/photo%3ftag.png", "media/photo?tag.png"],
    ["[image]: media/photo%2523tag.png", "media/photo%23tag.png"],
    ["[image]: media/photo%2Ftag.png", "media/photo/tag.png"],
    ["[image]: media/my\\%20photo.png", "media/my photo.png"],
    ["[image]: media/my\\%20photo.png", "media/my%20photo.png"],
    ["[image]: media/photo\\#tag.png", "media/photo#tag.png"],
    ["[image]: media/photo\\?tag.png", "media/photo?tag.png"],
  ])("rejects a stale or ambiguous reference cache target: %s / %s", (definition, link) => {
    const token = "![ref][image]";
    const source = token + "\n\n" + definition + "\n";
    const cache = [{ original: token, link, position: { start: { offset: 0 }, end: { offset: token.length } } }];
    expect(findUncoveredImageEmbeds(source, cache)).toHaveLength(1);
  });

  it("rejects conflicting reference cache records and preserves Wiki host resolution", () => {
    const token = "![ref][image]";
    const position = { start: { offset: 0 }, end: { offset: token.length } };
    expect(findUncoveredImageEmbeds(token + "\n\n[image]: current.png\n", [
      { original: token, link: "current.png", position },
      { original: token, link: "old.png", position },
    ])).toHaveLength(1);
    const wiki = "![[active.png]]";
    expect(findUncoveredImageEmbeds(wiki, [{ original: wiki, link: "assets/active.png",
      position: { start: { offset: 0 }, end: { offset: wiki.length } },
    }])).toEqual([]);
  });

  it("matches whole backtick delimiters and treats escaped openers as text", () => {
    const source = "`unclosed `` ![[active.png]]\n\n\\` ![[also-active.png]]\n\n"
      + "``literal ` ![[hidden.png]] `` ![[last.png]]";
    expect(scanAuthoredImageEmbeds(source).map((item) => item.link)).toEqual([
      "active.png", "also-active.png", "last.png",
    ]);
  });

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

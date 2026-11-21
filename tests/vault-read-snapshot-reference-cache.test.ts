import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { Window } from "happy-dom";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({ MarkdownView: class MarkdownView {}, TFile: class TFile {} }));

let host: Window;
beforeAll(() => {
  host = new Window();
  vi.stubGlobal("DOMParser", host.DOMParser);
});
afterAll(async () => {
  await host.happyDOM.close();
  vi.unstubAllGlobals();
});

type Embed = { original: string; link: string; position: { start: { offset: number }; end: { offset: number } } };
function cached(source: string, token: string, link: string): Embed {
  const start = source.indexOf(token);
  return { original: token, link, position: { start: { offset: start }, end: { offset: start + token.length } } };
}

async function fixture(source: string, embeds: Embed[] = [], options: {
  imagePath?: string; extension?: string; knownSize?: number; bytes?: Uint8Array;
  resolve?: boolean; links?: Embed[];
} = {}) {
  const { TFile } = await import("obsidian");
  const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
  let currentSource = source;
  const file = Object.assign(new TFile(), { path: "Assistant-QA/References.md", extension: "md" });
  const bytes = options.bytes ?? new Uint8Array([1, 2, 3]);
  const image = Object.assign(new TFile(), {
    path: options.imagePath ?? "Assistant-QA/assets/green-marker.png",
    extension: options.extension ?? "png", stat: { size: options.knownSize ?? bytes.length },
  });
  const imageRead = vi.fn(async () => Uint8Array.from(bytes).buffer);
  const getFirstLinkpathDest = vi.fn((_link: string, _sourcePath: string) => options.resolve === false ? null : image);
  const app = {
    workspace: { getLeavesOfType: () => [] },
    vault: {
      getFileByPath: (value: string) => value === file.path ? file : value === image.path ? image : null,
      readBinary: async (target: typeof file) => target === file ? new TextEncoder().encode(currentSource).buffer : imageRead(),
    },
    metadataCache: { getFileCache: () => ({ embeds, links: options.links ?? [] }), getFirstLinkpathDest },
  };
  const controller = new AbortController();
  let workspace: string | undefined;
  const run = () => new VaultReadSnapshot(app as never).run(file, controller.signal, async snapshot => {
    workspace = snapshot.inputPath;
    const declared = await snapshot.getDeclaredMarkdownInputs();
    return {
      declared, source: await readFile(snapshot.inputPath),
      resourceBytes: await Promise.all(declared!.inputs.slice(1).map(input => readFile(input.path))),
    };
  });
  return { run, imageRead, getFirstLinkpathDest, controller, image, workspace: () => workspace,
    changeSource: (next: string) => { currentSource = next; } };
}

describe("uncached local reference images", () => {
  it("binds the exact A2 References bytes with empty host embeds and links", async () => {
    const raw = await readFile(new URL("../acceptance/fixtures/References.md", import.meta.url));
    expect(raw.length).toBe(290);
    expect(createHash("sha256").update(raw).digest("hex"))
      .toBe("5a5d9f8c102239ff80eb8143cc86e2812bdc5064c98cf160d163dbb48ead097a");
    const imageBytes = await readFile(new URL("../acceptance/fixtures/assets/green-marker.png", import.meta.url));
    expect(createHash("sha256").update(imageBytes).digest("hex"))
      .toBe("6c77aed8dfbdb84b6e9960c43dddf4d887e096a8a3c6c81d49a0154e92128027");
    const test = await fixture(raw.toString("utf8"), [], { bytes: imageBytes });
    const completed = await test.run();
    expect(completed.value!.source).toEqual(raw);
    expect(completed.value!.declared!.resourceBindings).toEqual({
      authored_sha256: createHash("sha256").update(raw).digest("hex"),
      images: ["![full][first]", "![collapsed][]", "![shortcut]"].map(authored_token => ({
        authored_token, logical_path: "Assistant-QA/assets/green-marker.png",
      })),
    });
    expect(completed.value!.declared!.inputs).toHaveLength(2);
    expect(completed.value!.resourceBytes).toEqual([imageBytes]);
    expect(test.imageRead).toHaveBeenCalledTimes(1);
    expect(test.getFirstLinkpathDest.mock.calls).toEqual(Array.from({ length: 3 }, () => [
      "assets/green-marker.png", "Assistant-QA/References.md",
    ]));
    await expect(stat(test.workspace()!)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("combines parsed references with exact inline and Wiki cache ranges", async () => {
    const source = "😀\r\n![inline](inline.png)\r\n![[wiki.png]]\r\n![full][image]\r\n![image][]\r\n![image]\r\n\r\n[image]: chosen.png\r\n";
    const test = await fixture(source, [cached(source, "![inline](inline.png)", "inline.png"), cached(source, "![[wiki.png]]", "wiki.png")], {
      imagePath: "Host-selected/cross-folder.png",
    });
    const completed = await test.run();
    expect(completed.value!.declared!.resourceBindings!.images).toHaveLength(5);
    expect(completed.value!.declared!.resourceBindings!.images.every(binding => binding.logical_path === "Host-selected/cross-folder.png")).toBe(true);
    expect(test.imageRead).toHaveBeenCalledTimes(1);
  });

  it.each(["![inline](inline.png)", "![[wiki.png]]", "[[Other Note]]"])("preserves missing exact cache refusal for %s", async token => {
    const test = await fixture(token + "\n![image]\n\n[image]: chosen.png\n");
    await expect(test.run()).rejects.toMatchObject({ code: "vault_input_invalid" });
    expect(test.getFirstLinkpathDest).not.toHaveBeenCalled();
    expect(test.imageRead).not.toHaveBeenCalled();
  });

  it.each(["wrong-target", "conflict", "shifted-start", "shifted-end", "wrong-original", "displaced-token", "overlap"])("rejects existing reference cache %s before resolution", async kind => {
    const source = "😀 ![image]\n\n[image]: current.png\n";
    const valid = cached(source, "![image]", "current.png");
    const embeds = kind === "conflict" ? [valid, { ...valid, link: "old.png" }]
      : kind === "wrong-target" ? [{ ...valid, link: "old.png" }]
      : kind === "wrong-original" ? [{ ...valid, original: "![wrong]" }]
      : kind === "displaced-token" ? [{ ...valid, position: { start: { offset: 100 }, end: { offset: 108 } } }]
      : kind === "overlap" ? [{ original: "other", link: "old.png", position: {
        start: { offset: valid.position.start.offset - 1 }, end: { offset: valid.position.start.offset + 2 },
      } }]
      : [{ ...valid, position: { start: { offset: valid.position.start.offset + (kind === "shifted-start" ? 1 : 0) },
        end: { offset: valid.position.end.offset + (kind === "shifted-end" ? 1 : 0) } } }];
    const test = await fixture(source, embeds);
    await expect(test.run()).rejects.toMatchObject({ code: "vault_input_invalid" });
    expect(test.getFirstLinkpathDest).not.toHaveBeenCalled();
    expect(test.imageRead).not.toHaveBeenCalled();
  });

  it("allows a repeated reference with a valid cache entry only for its first occurrence", async () => {
    const source = "![image]\n![image]\n\n[image]: current.png\n";
    const test = await fixture(source, [cached(source, "![image]", "current.png")]);
    expect((await test.run()).value!.declared!.inputs).toHaveLength(2);
    expect(test.imageRead).toHaveBeenCalledTimes(1);
  });

  it("does not let an unrelated valid embed block an uncached reference", async () => {
    const source = "![[other.png]]\n![image]\n\n[image]: current.png\n";
    const test = await fixture(source, [cached(source, "![[other.png]]", "other.png")]);
    expect((await test.run()).value!.declared!.resourceBindings!.images).toHaveLength(2);
  });

  it("ignores an undeclared resolver locator on an existing host cache record", async () => {
    const source = "![image]\n\n[image]: current.png\n";
    const poisoned = Object.assign(cached(source, "![image]", "current.png"), { linkpath: "decoy.png" });
    const test = await fixture(source, [poisoned]);
    expect((await test.run()).value!.declared!.inputs).toHaveLength(2);
    expect(test.getFirstLinkpathDest).toHaveBeenCalledExactlyOnceWith("current.png", "Assistant-QA/References.md");
  });

  it.each([
    ["media/my%20photo%2epng", "media/my photo.png"],
    ["media/photo\\(1\\).png", "media/photo(1).png"],
    ["<media/a&amp;b&#46;png>", "media/a&b.png"],
    ["current.png?download=1#view", "current.png"],
  ])("converts an unambiguous reference URI path once: %s", async (destination, linkpath) => {
    const test = await fixture("![image]\n\n[image]: " + destination + "\n");
    expect((await test.run()).value!.declared!.inputs).toHaveLength(2);
    expect(test.getFirstLinkpathDest).toHaveBeenCalledExactlyOnceWith(linkpath, "Assistant-QA/References.md");
  });

  it.each([
    "media/photo%23tag.png", "media/photo%3Ftag.png", "media/photo%2Ftag.png", "media/photo%5Ctag.png",
    "media/my%2520photo.png", "media/photo\\#tag.png", "malformed%GG.png",
  ])("keeps ambiguous URI-to-host paths fail-closed without trying alternatives: %s", async destination => {
    const test = await fixture("![image]\n\n[image]: " + destination + "\n");
    await expect(test.run()).rejects.toMatchObject({ code: "vault_input_invalid" });
    expect(test.getFirstLinkpathDest).not.toHaveBeenCalled();
    expect(test.imageRead).not.toHaveBeenCalled();
  });

  it.each([
    "![missing]", "![image]\n\n[image]: https://example.test/image.png", "![image]\n\n[image]: active.png invalid text",
    "`![image]`\n\n[image]: active.png", "\\![image]\n\n[image]: active.png", "```\n![image]\n```\n\n[image]: active.png",
    "<div>\n![image]\n</div>\n\n[image]: active.png", "<!-- ![image] -->\n\n[image]: active.png",
    "%% ![image] %%\n\n[image]: active.png", "---\ncover: ![image]\n---\n\n[image]: active.png",
    "[ordinary]\n\n[ordinary]: active.png",
  ])("does not create resource inputs from literal, ordinary, remote or invalid syntax: %s", async source => {
    const test = await fixture(source);
    expect((await test.run()).value!.declared!.inputs).toHaveLength(1);
    expect(test.getFirstLinkpathDest).not.toHaveBeenCalled();
    expect(test.imageRead).not.toHaveBeenCalled();
  });

  it.each([undefined, "https://example.test/new.png", "current.png"])("does not reuse an old cached reference when definition becomes %s", async destination => {
    const source = "![image]\n\n" + (destination === undefined ? "" : "[image]: " + destination);
    const test = await fixture(source, [cached(source, "![image]", "old.png")]);
    await expect(test.run()).rejects.toMatchObject({ code: "vault_input_invalid" });
    expect(test.getFirstLinkpathDest).not.toHaveBeenCalled();
  });

  it.each([
    { resolve: false }, { imagePath: "../outside.png" }, { extension: "svg" },
    { knownSize: 6_000_001 }, { bytes: new Uint8Array() },
  ])("retains host resolution, path, type and byte checks: %j", async options => {
    const test = await fixture("![image]\n\n[image]: current.png\n", [], options);
    await expect(test.run()).rejects.toMatchObject({ code: "vault_input_invalid" });
  });

  it("preserves cancellation during a reference image read", async () => {
    const test = await fixture("![image]\n\n[image]: current.png\n");
    test.imageRead.mockImplementation(async () => {
      test.controller.abort();
      return new Uint8Array([1]).buffer;
    });
    await expect(test.run()).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects source changes while preparing uncached reference resources", async () => {
    const test = await fixture("![image]\n\n[image]: current.png\n");
    test.imageRead.mockImplementation(async () => {
      test.changeSource("# Changed\n");
      return new Uint8Array([1]).buffer;
    });
    await expect(test.run()).rejects.toMatchObject({ code: "vault_content_conflict" });
  });
});

describe("source-relative inline images", () => {
  const image = "![Marker](assets/green-marker.png)";
  const sample = (closing: string) => "# Export probe\n\n$$\nx^2\n" + closing + "\n" + image + "\n\nAfter image.\n";

  it.each(["", "$$\n"])("binds an exact existing image with empty host cache (closing=%j)", async closing => {
    const source = sample(closing);
    const test = await fixture(source);
    const result = (await test.run()).value!;
    expect(result.source.toString("utf8")).toBe(source);
    expect(result.resourceBytes).toEqual([Buffer.from([1, 2, 3])]);
    expect(result.declared!.resourceBindings!.images).toEqual([
      { authored_token: image, logical_path: "Assistant-QA/assets/green-marker.png" },
    ]);
    expect(test.getFirstLinkpathDest).not.toHaveBeenCalled();
  });

  it("reports a missing exact image and ignores a like-named file elsewhere", async () => {
    const test = await fixture(sample(""), [], { imagePath: "Elsewhere/assets/green-marker.png" });
    await expect(test.run()).rejects.toMatchObject({
      code: "vault_input_invalid", details: { imageIssue: "missing", imageName: "green-marker.png" },
    });
    expect(test.getFirstLinkpathDest).not.toHaveBeenCalled();
    expect(test.imageRead).not.toHaveBeenCalled();
  });

  it("refuses a fallback when there is a displaced cache record for the same token", async () => {
    const source = sample("");
    const record = cached(source, image, "stale.png");
    const test = await fixture(source, [{ ...record, position: {
      start: { offset: record.position.start.offset + 1 }, end: { offset: record.position.end.offset + 1 },
    } }]);
    await expect(test.run()).rejects.toMatchObject({
      code: "vault_input_invalid", details: { imageIssue: "metadata", imageName: "green-marker.png" },
    });
    expect(test.imageRead).not.toHaveBeenCalled();
  });

  it.each(["../assets/green-marker.png", "assets/a%2Fgreen-marker.png", "!wiki"])(
    "keeps ambiguous, parent-directory and Wiki forms subject to exact cache (%s)",
    async target => {
      const source = target === "!wiki" ? "![[assets/green-marker.png]]" : "![Marker](" + target + ")";
      const test = await fixture(source);
      await expect(test.run()).rejects.toMatchObject({
        code: "vault_input_invalid", details: { imageIssue: "metadata" },
      });
      expect(test.imageRead).not.toHaveBeenCalled();
    },
  );

  it("rejects an unsupported image with a percent-encoded extension instead of silently dropping it", async () => {
    const test = await fixture("![Marker](assets/marker%2esvg)", [], {
      imagePath: "Assistant-QA/assets/marker.svg", extension: "svg",
    });
    await expect(test.run()).rejects.toMatchObject({ code: "vault_input_invalid" });
    expect(test.imageRead).not.toHaveBeenCalled();
  });

  it("does not bind a relative image inside a closed formula", async () => {
    const test = await fixture("$$\nx^2\n\n" + image + "\n$$\n");
    expect((await test.run()).value!.declared!.inputs).toHaveLength(1);
    expect(test.imageRead).not.toHaveBeenCalled();
  });
});

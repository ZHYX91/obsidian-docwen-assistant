import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({ MarkdownView: class MarkdownView {}, TFile: class TFile {} }));

const LIMIT = 6_000_000;

async function fixture(
  sizes: readonly { known: number; actual: number }[],
  references = sizes.map((_size, index) => index),
) {
  const { TFile } = await import("obsidian");
  const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
  const file = Object.assign(new TFile(), { path: "notes/current.md", extension: "md" });
  const images = sizes.map((size, index) => Object.assign(new TFile(), {
    path: `assets/image-${index}.png`, extension: "png", stat: { size: size.known, mtime: 1, ctime: 1 },
  }));
  const tokens = references.map(index => `![[image-${index}.png]]`);
  const source = tokens.join("\n") + "\n";
  let offset = 0;
  const embeds = tokens.map((token, index) => {
    const start = offset;
    offset += token.length + 1;
    return { link: `image-${references[index]}.png`, original: token,
      position: { start: { offset: start }, end: { offset: start + token.length } } };
  });
  const imageRead = vi.fn(async (image: typeof images[number]) => {
    const index = images.indexOf(image);
    return new Uint8Array(sizes[index]!.actual).buffer;
  });
  const app = {
    workspace: { getLeavesOfType: () => [] },
    vault: {
      getFileByPath: (value: string) => value === file.path ? file : images.find(image => image.path === value) ?? null,
      readBinary: async (target: typeof file) => target === file
        ? new TextEncoder().encode(source).buffer : imageRead(target as typeof images[number]),
    },
    metadataCache: {
      getFileCache: () => ({ embeds }),
      getFirstLinkpathDest: (link: string) => images.find(image => image.path.endsWith(`/${link}`)) ?? null,
    },
  };
  const controller = new AbortController();
  const run = () => new VaultReadSnapshot(app as never).run(
    file as never, controller.signal, async snapshot => {
      const result = await snapshot.getDeclaredMarkdownInputs();
      return Promise.all(result!.inputs.slice(1).map(async input => (await readFile(input.path)).length));
    },
  );
  return { run, imageRead, controller };
}

describe("declared embedded image budget", () => {
  it("rejects a known oversized image before calling readBinary", async () => {
    // The sentinel's tiny payload keeps this regression independent of large allocations.
    const test = await fixture([{ known: 128 * 1024 * 1024, actual: 1 }]);
    await expect(test.run()).rejects.toMatchObject({ code: "vault_input_invalid" });
    expect(test.imageRead).not.toHaveBeenCalled();
  });

  it("checks the remaining budget before reading the next unique image", async () => {
    const test = await fixture([{ known: 3, actual: 3 }, { known: LIMIT - 2, actual: 1 }]);
    await expect(test.run()).rejects.toMatchObject({ code: "vault_input_invalid" });
    expect(test.imageRead).toHaveBeenCalledTimes(1);
  });

  it("checks actual bytes when the cached file size understates the image", async () => {
    const test = await fixture([{ known: 1, actual: LIMIT + 1 }]);
    await expect(test.run()).rejects.toMatchObject({ code: "vault_input_invalid" });
    expect(test.imageRead).toHaveBeenCalledTimes(1);
  });

  it("rejects empty images after reading", async () => {
    const test = await fixture([{ known: 1, actual: 0 }]);
    await expect(test.run()).rejects.toMatchObject({ code: "vault_input_invalid" });
  });

  it("accepts the exact budget and reads repeated image references once", async () => {
    const test = await fixture([{ known: LIMIT, actual: LIMIT }], [0, 0]);
    const result = await test.run();
    expect(result.value).toEqual([LIMIT]);
    expect(test.imageRead).toHaveBeenCalledTimes(1);
  });

  it("preserves cancellation while an image read is pending", async () => {
    const test = await fixture([{ known: 1, actual: 1 }]);
    test.imageRead.mockImplementation(async () => {
      test.controller.abort();
      return new Uint8Array([1]).buffer;
    });
    await expect(test.run()).rejects.toMatchObject({ name: "AbortError" });
  });
});

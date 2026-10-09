import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({
  MarkdownView: class MarkdownView {},
  TFile: class TFile {},
  parseLinktext: (linktext: string) => {
    const selector = linktext.indexOf("#");
    return selector < 0
      ? { path: linktext, subpath: "" }
      : { path: linktext.slice(0, selector), subpath: linktext.slice(selector) };
  },
}));

describe("VaultReadSnapshot WikiLink navigation bindings", () => {
  it.each([
    { link: "Other", encodedSubpath: "" },
    { link: "Other#Section", encodedSubpath: "%23Section" },
    { link: "Other#^block-id", encodedSubpath: "%23%5Eblock-id" },
  ])("resolves only the file path and preserves the selector for $link", async ({ link, encodedSubpath }) => {
    const { TFile } = await import("obsidian");
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const file = Object.assign(new TFile(), { path: "Notes/Current.md", extension: "md" });
    const target = Object.assign(new TFile(), { path: "Notes/Other.md", extension: "md" });
    const token = `[[${link}|Other note]]`;
    const source = "See " + token + ".\n";
    const start = source.indexOf(token);
    const app = {
      workspace: { getLeavesOfType: () => [] },
      vault: { getFileByPath: (filePath: string) => filePath === file.path ? file : null,
        getName: () => "Knowledge Base",
        readBinary: vi.fn(async (requested: unknown) => {
          if (requested === file) return new TextEncoder().encode(source).buffer;
          throw new Error("navigation targets are not copied as resource bytes");
        }),
      },
      metadataCache: {
        getFileCache: vi.fn(() => ({
          embeds: [],
          links: [{
            link,
            original: token,
            position: { start: { offset: start }, end: { offset: start + token.length } },
          }],
        })),
        // Obsidian's public API accepts a linkpath, without heading/block subpath.
        getFirstLinkpathDest: vi.fn((linkpath: string) => linkpath === "Other" ? target : null),
      },
    };

    const completed = await new VaultReadSnapshot(app as never).run(
      file as never,
      new AbortController().signal,
      async (snapshot) => snapshot.getDeclaredMarkdownInputs(),
    );

    expect(completed.value?.inputs).toMatchObject([
      { role: "source", logicalPath: "Notes/Current.md", mediaType: "text/markdown" },
    ]);
    expect(completed.value?.resourceBindings).toEqual({
      authored_sha256: createHash("sha256").update(source).digest("hex"),
      images: [],
      wiki_links: [{
        authored_token: token,
        href: `obsidian://open?vault=Knowledge%20Base&file=Notes%2FOther.md${encodedSubpath}`,
      }],
    });
    expect(app.vault.readBinary).toHaveBeenCalled();
    expect(app.vault.readBinary.mock.calls.every(([requested]) => requested === file)).toBe(true);
    expect(app.metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith("Other", "Notes/Current.md");
  });

  it("fails closed when a current local WikiLink is absent from Obsidian metadata", async () => {
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const file = { path: "Notes/Current.md", extension: "md" };
    const source = "[[Fresh Note]]\n";
    const getFirstLinkpathDest = vi.fn();
    const app = {
      workspace: { getLeavesOfType: () => [] },
      vault: { getFileByPath: (filePath: string) => filePath === file.path ? file : null, getName: () => "Knowledge", readBinary: async () => new TextEncoder().encode(source).buffer },
      metadataCache: {
        getFileCache: vi.fn(() => ({ embeds: [], links: [] })),
        getFirstLinkpathDest,
      },
    };

    const pending = new VaultReadSnapshot(app as never).run(
      file as never,
      new AbortController().signal,
      async (snapshot) => snapshot.getDeclaredMarkdownInputs(),
    );

    await expect(pending).rejects.toMatchObject({
      code: "vault_input_invalid",
      message: expect.stringContaining("Fresh Note"),
    });
    expect(getFirstLinkpathDest).not.toHaveBeenCalled();
  });

  it("does not invent a navigation URI for a cached but unresolved WikiLink", async () => {
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const file = { path: "Notes/Current.md", extension: "md" };
    const token = "[[Missing]]";
    const source = token + "\n";
    const app = {
      workspace: { getLeavesOfType: () => [] },
      vault: { getFileByPath: (filePath: string) => filePath === file.path ? file : null, getName: () => "Knowledge", readBinary: async () => new TextEncoder().encode(source).buffer },
      metadataCache: {
        getFileCache: vi.fn(() => ({
          embeds: [],
          links: [{
            link: "Missing",
            original: token,
            position: { start: { offset: 0 }, end: { offset: token.length } },
          }],
        })),
        getFirstLinkpathDest: vi.fn(() => null),
      },
    };

    const completed = await new VaultReadSnapshot(app as never).run(
      file as never,
      new AbortController().signal,
      async (snapshot) => snapshot.getDeclaredMarkdownInputs(),
    );

    expect(completed.value?.resourceBindings).toBeUndefined();
  });
});

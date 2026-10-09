import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({ MarkdownView: class MarkdownView {}, TFile: class TFile {} }));

describe("VaultReadSnapshot image cache coverage", () => {
  it.each(["declared", "resolved"] as const)(
    "fails closed when current Markdown image metadata is missing on the %s path",
    async (mode) => {
      const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
      const file = { path: "notes/current.md", extension: "md" };
      const source = "# Current\n\n![[fresh.png]]\n";
      const getFirstLinkpathDest = vi.fn();
      const app = {
        workspace: { getLeavesOfType: () => [] },
        vault: { getFileByPath: (filePath: string) => filePath === file.path ? file : null, readBinary: async () => new TextEncoder().encode(source).buffer },
        metadataCache: {
          getFileCache: vi.fn(() => ({ embeds: [] })),
          getFirstLinkpathDest,
        },
      };

      const pending = new VaultReadSnapshot(app as never).run(
        file as never,
        new AbortController().signal,
        async (snapshot) => mode === "declared"
          ? snapshot.getDeclaredMarkdownInputs()
          : snapshot.getResolvedMarkdownInputs(),
      );

      await expect(pending).rejects.toMatchObject({
        code: "vault_input_invalid",
        message: expect.stringContaining("fresh.png"),
      });
      expect(getFirstLinkpathDest).not.toHaveBeenCalled();
    },
  );

  it.each([
    "![photo](<media/my photo.png>)",
    "![photo](media/photo(1).png)",
  ])("rejects uncovered Markdown image destinations: %s", async (image) => {
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const source = "# Current\n\n" + image + "\n";
    const file = { path: "notes/current.md", extension: "md" };
    const app = {
      workspace: { getLeavesOfType: () => [] },
      vault: { getFileByPath: (filePath: string) => filePath === file.path ? file : null, readBinary: async () => new TextEncoder().encode(source).buffer },
      metadataCache: {
        getFileCache: vi.fn(() => ({ embeds: [] })),
        getFirstLinkpathDest: vi.fn(),
      },
    };
    await expect(new VaultReadSnapshot(app as never).run(
      file as never,
      new AbortController().signal,
      async (snapshot) => snapshot.getDeclaredMarkdownInputs(),
    )).rejects.toMatchObject({ code: "vault_input_invalid" });
  });

  it("does not treat an ordinary Markdown note embed as a missing image declaration", async () => {
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const file = { path: "notes/current.md", extension: "md" };
    const source = "# Current\n\n![[Other Note]]\n";
    const app = {
      workspace: { getLeavesOfType: () => [] },
      vault: { getFileByPath: (filePath: string) => filePath === file.path ? file : null, readBinary: async () => new TextEncoder().encode(source).buffer },
      metadataCache: {
        getFileCache: vi.fn(() => ({ embeds: [] })),
        getFirstLinkpathDest: vi.fn(),
      },
    };

    const completed = await new VaultReadSnapshot(app as never).run(
      file as never,
      new AbortController().signal,
      async (snapshot) => snapshot.getDeclaredMarkdownInputs(),
    );

    expect(completed.value?.inputs).toMatchObject([
      { role: "source", logicalPath: "notes/current.md", mediaType: "text/markdown" },
    ]);
    expect(completed.value?.resourceBindings).toBeUndefined();
  });
});

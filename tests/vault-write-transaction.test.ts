import { writeFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({ MarkdownView: class MarkdownView {} }));

describe("VaultWriteTransaction", () => {
  it("runs DocWen on isolated files and commits one editor transaction", async () => {
    const { VaultWriteTransaction } = await import("../src/host/vault-write-transaction");
    let value = "# Heading\n";
    const editor = {
      getValue: vi.fn(() => value),
      offsetToPos: vi.fn(() => ({ line: 1, ch: 0 })),
      transaction: vi.fn((transaction: { changes: Array<{ text: string }> }) => {
        value = transaction.changes[0].text;
      }),
    };
    const file = { path: "note.md", name: "note.md" };
    const view = { file, editor, requestSave: vi.fn() };
    const leaf = { view };
    const app = {
      workspace: { getLeavesOfType: vi.fn(() => [leaf]) },
      vault: { read: vi.fn(), process: vi.fn(), getFileByPath: vi.fn(() => file) },
    };
    const owner = new VaultWriteTransaction(app as never);

    await owner.run(file as never, async (inputPath, outputPath, _hash, _signal) => {
      expect(inputPath).not.toContain("note.md");
      await writeFile(outputPath, "# 1. Heading\n", "utf8");
    }, new AbortController().signal);

    expect(editor.transaction).toHaveBeenCalledOnce();
    expect(view.requestSave).toHaveBeenCalledOnce();
    expect(value).toBe("# 1. Heading\n");
    expect(app.vault.process).not.toHaveBeenCalled();
  });

  it("refuses to overwrite an editor that changed while DocWen was running", async () => {
    const { VaultWriteTransaction } = await import("../src/host/vault-write-transaction");
    let value = "# Heading\n";
    const editor = {
      getValue: vi.fn(() => value),
      offsetToPos: vi.fn(() => ({ line: 1, ch: 0 })),
      transaction: vi.fn(),
    };
    const file = { path: "note.md", name: "note.md" };
    const view = { file, editor, requestSave: vi.fn() };
    const leaf = { view };
    const app = {
      workspace: { getLeavesOfType: vi.fn(() => [leaf]) },
      vault: { read: vi.fn(), process: vi.fn(), getFileByPath: vi.fn(() => file) },
    };

    const pending = new VaultWriteTransaction(app as never).run(
      file as never,
      async (_inputPath, outputPath) => {
        await writeFile(outputPath, "# 1. Heading\n", "utf8");
        value = "# User edit\n";
      },
      new AbortController().signal,
    );

    await expect(pending).rejects.toMatchObject({ code: "vault_content_conflict" });
    expect(editor.transaction).not.toHaveBeenCalled();
    expect(view.requestSave).not.toHaveBeenCalled();
  });

  it("refuses to commit when the matched Markdown leaf identity changes", async () => {
    const { VaultWriteTransaction } = await import("../src/host/vault-write-transaction");
    let value = "# Heading\n";
    const editor = {
      getValue: vi.fn(() => value),
      offsetToPos: vi.fn(() => ({ line: 1, ch: 0 })),
      transaction: vi.fn(),
    };
    const file = { path: "note.md", name: "note.md" };
    const view = { file, editor, requestSave: vi.fn() };
    const originalLeaf = { id: "original" };
    let leaves = [{ ...originalLeaf, view }];
    const app = {
      workspace: {
        getLeavesOfType: vi.fn(() => leaves),
      },
      vault: { read: vi.fn(), process: vi.fn(), getFileByPath: vi.fn(() => file) },
    };

    const pending = new VaultWriteTransaction(app as never).run(
      file as never,
      async (_inputPath, outputPath) => {
        await writeFile(outputPath, "# 1. Heading\n", "utf8");
        leaves = [{ id: "replacement", view }];
      },
      new AbortController().signal,
    );

    await expect(pending).rejects.toMatchObject({ code: "vault_target_changed" });
    expect(editor.transaction).not.toHaveBeenCalled();
    expect(view.requestSave).not.toHaveBeenCalled();
  });

  it("uses Vault.process with a snapshot check for inactive files", async () => {
    const { VaultWriteTransaction } = await import("../src/host/vault-write-transaction");
    const file = { path: "note.md", name: "note.md" };
    const vault = {
      read: vi.fn().mockResolvedValue("# Heading\n"),
      process: vi.fn(async (_file, update: (value: string) => string) => update("# Heading\n")),
      getFileByPath: vi.fn(() => file),
    };
    const app = {
      workspace: { getLeavesOfType: vi.fn(() => []) },
      vault,
    };

    await new VaultWriteTransaction(app as never).run(
      file as never,
      async (_inputPath, outputPath) => writeFile(outputPath, "# 1. Heading\n", "utf8"),
      new AbortController().signal,
    );

    expect(vault.process).toHaveBeenCalledOnce();
  });

  it("fails closed when the source is open in multiple Markdown editors", async () => {
    const { VaultWriteTransaction } = await import("../src/host/vault-write-transaction");
    const file = { path: "note.md", name: "note.md" };
    const createLeaf = () => ({
      view: {
        file,
        editor: { getValue: vi.fn(() => "# Heading\n") },
        requestSave: vi.fn(),
      },
    });
    const vault = { read: vi.fn(), process: vi.fn(), getFileByPath: vi.fn(() => file) };
    const app = {
      workspace: { getLeavesOfType: vi.fn(() => [createLeaf(), createLeaf()]) },
      vault,
    };

    await expect(new VaultWriteTransaction(app as never).run(
      file as never,
      async () => undefined,
      new AbortController().signal,
    )).rejects.toMatchObject({ code: "vault_target_changed" });
    expect(vault.read).not.toHaveBeenCalled();
    expect(vault.process).not.toHaveBeenCalled();
  });

  it("rejects a same-content TFile replacement before Vault.process", async () => {
    const { VaultWriteTransaction } = await import("../src/host/vault-write-transaction");
    const file = { path: "note.md", name: "note.md" };
    const replacement = { path: "note.md", name: "note.md" };
    let registeredFile = file;
    const vault = {
      read: vi.fn().mockResolvedValue("# Heading\n"),
      process: vi.fn(),
      getFileByPath: vi.fn(() => registeredFile),
    };
    const app = { workspace: { getLeavesOfType: vi.fn(() => []) }, vault };

    const operation = new VaultWriteTransaction(app as never).run(
      file as never,
      async (_inputPath, outputPath) => {
        await writeFile(outputPath, "# 1. Heading\n", "utf8");
        registeredFile = replacement;
      },
      new AbortController().signal,
    );

    await expect(operation).rejects.toMatchObject({ code: "vault_target_changed" });
    expect(vault.process).not.toHaveBeenCalled();
  });

  it("rejects a TFile whose fixed original path changes", async () => {
    const { VaultWriteTransaction } = await import("../src/host/vault-write-transaction");
    const file = { path: "note.md", name: "note.md" };
    const vault = {
      read: vi.fn().mockResolvedValue("# Heading\n"),
      process: vi.fn(),
      getFileByPath: vi.fn((candidate: string) => candidate === "note.md" ? file : null),
    };
    const app = { workspace: { getLeavesOfType: vi.fn(() => []) }, vault };

    const operation = new VaultWriteTransaction(app as never).run(
      file as never,
      async (_inputPath, outputPath) => {
        await writeFile(outputPath, "# 1. Heading\n", "utf8");
        file.path = "renamed.md";
      },
      new AbortController().signal,
    );

    await expect(operation).rejects.toMatchObject({ code: "vault_target_changed" });
    expect(vault.process).not.toHaveBeenCalled();
  });

  it("revalidates open-editor state inside the Vault.process callback", async () => {
    const { VaultWriteTransaction } = await import("../src/host/vault-write-transaction");
    const file = { path: "note.md", name: "note.md" };
    let leaves: unknown[] = [];
    const editor = { getValue: vi.fn(() => "# Heading\n") };
    const vault = {
      read: vi.fn().mockResolvedValue("# Heading\n"),
      process: vi.fn(async (_file, update: (value: string) => string) => {
        leaves = [{ view: { file, editor, requestSave: vi.fn() } }];
        return update("# Heading\n");
      }),
      getFileByPath: vi.fn(() => file),
    };
    const app = { workspace: { getLeavesOfType: vi.fn(() => leaves) }, vault };

    const operation = new VaultWriteTransaction(app as never).run(
      file as never,
      async (_inputPath, outputPath) => writeFile(outputPath, "# 1. Heading\n", "utf8"),
      new AbortController().signal,
    );

    await expect(operation).rejects.toMatchObject({ code: "vault_target_changed" });
    expect(vault.process).toHaveBeenCalledOnce();
  });

  it("revalidates file identity after Vault.process", async () => {
    const { VaultWriteTransaction } = await import("../src/host/vault-write-transaction");
    const file = { path: "note.md", name: "note.md" };
    const replacement = { path: "note.md", name: "note.md" };
    let registeredFile = file;
    const vault = {
      read: vi.fn().mockResolvedValue("# Heading\n"),
      process: vi.fn(async (_file, update: (value: string) => string) => {
        const published = update("# Heading\n");
        registeredFile = replacement;
        return published;
      }),
      getFileByPath: vi.fn(() => registeredFile),
    };
    const app = { workspace: { getLeavesOfType: vi.fn(() => []) }, vault };

    const operation = new VaultWriteTransaction(app as never).run(
      file as never,
      async (_inputPath, outputPath) => writeFile(outputPath, "# 1. Heading\n", "utf8"),
      new AbortController().signal,
    );

    await expect(operation).rejects.toMatchObject({ code: "vault_target_changed" });
    expect(vault.process).toHaveBeenCalledOnce();
  });
});

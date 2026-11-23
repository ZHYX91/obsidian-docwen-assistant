import { writeFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { VaultReadSnapshot } from "../src/host/vault-read-snapshot";
import { VaultWriteTransaction } from "../src/host/vault-write-transaction";

vi.mock("obsidian", () => ({ MarkdownView: class MarkdownView {} }));

describe.each(["export", "numbering"] as const)("%s editor source", action => {
  function fixture(text: string, edit?: string) {
    let current = text;
    const file = { path: "Note.md" };
    const editor = { getValue: () => current, offsetToPos: () => ({ line: 0, ch: text.length }),
      transaction: vi.fn(({ changes }: { changes: { text: string }[] }) => { current = changes[0].text; }) };
    const view = { file, editor, requestSave: vi.fn() };
    const leaf = { view };
    const app = { workspace: { getLeavesOfType: () => [leaf] }, vault: { getFileByPath: () => file } };
    const work = vi.fn(() => { if (edit !== undefined) current = edit; });
    const publish = vi.fn(async () => undefined);
    const signal = new AbortController().signal;
    const run = () => action === "export"
      ? new VaultReadSnapshot(app as never).run(file as never, signal, async snapshot => {
        work();
        return snapshot.publish(publish);
      })
      : new VaultWriteTransaction(app as never).run(file as never, async (_input, output) => {
        work();
        await writeFile(output, "# Numbered");
      }, signal);
    return { run, work, publish, editor, current: () => current };
  }

  it("rejects editor text that cannot round-trip through UTF-8", async () => {
    const state = fixture("# Unpaired \ud83d");
    await expect(state.run()).rejects.toMatchObject({ code: "cli_input_invalid" });
    expect(state.work).not.toHaveBeenCalled();
    expect(state.current()).toBe("# Unpaired \ud83d");
  });

  it("keeps a concurrent edit even when both strings encode to identical UTF-8", async () => {
    const edited = "# 😀 \ude00";
    const state = fixture("# 😀 \ufffd", edited);
    await expect(state.run()).rejects.toMatchObject({ code: "vault_content_conflict" });
    expect(state.publish).not.toHaveBeenCalled();
    expect(state.editor.transaction).not.toHaveBeenCalled();
    expect(state.current()).toBe(edited);
  });
});

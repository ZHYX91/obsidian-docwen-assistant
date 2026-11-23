import { describe, expect, it, vi } from "vitest";
import { INPUT_HANDLE_LIMITS } from "../src/docwen/client";
import { VaultReadSnapshot } from "../src/host/vault-read-snapshot";
import { VaultWriteTransaction } from "../src/host/vault-write-transaction";

vi.mock("obsidian", () => ({ MarkdownView: class MarkdownView {}, TFile: class TFile {} }));

describe.each(["export", "numbering"] as const)("%s input size", action => {
  it.each(["reported", "actual"] as const)("checks the %s byte length before preparing a task", async size => {
    const limit = INPUT_HANDLE_LIMITS.fileBytes;
    const file = { path: "large.md", stat: { size: size === "reported" ? limit + 1 : 1, mtime: 1, ctime: 1 } };
    // Model a stale host stat without reserving half a gigabyte in the test process.
    const bytes = new ArrayBuffer(1);
    if (size === "actual") Object.defineProperty(bytes, "byteLength", { value: limit + 1 });
    const readBinary = vi.fn(async () => bytes);
    const app = { workspace: { getLeavesOfType: () => [] }, vault: { getFileByPath: () => file, readBinary } };
    const work = vi.fn(async () => undefined);
    const signal = new AbortController().signal;
    const operation = action === "export"
      ? new VaultReadSnapshot(app as never).run(file as never, signal, work)
      : new VaultWriteTransaction(app as never).run(file as never, work, signal);
    await expect(operation).rejects.toMatchObject({ code: "cli_input_invalid", details: { actual: limit + 1, limit } });
    expect(readBinary).toHaveBeenCalledTimes(size === "reported" ? 0 : 1);
    expect(work).not.toHaveBeenCalled();
  });
});

it("uses the open editor's current content even when the on-disk file was larger", async () => {
  const file = { path: "edited.md", stat: { size: INPUT_HANDLE_LIMITS.fileBytes + 1, mtime: 1, ctime: 1 } };
  const editor = { getValue: () => "# Shortened note\n" };
  const readBinary = vi.fn();
  const leaf = { view: { file, editor } };
  const app = { workspace: { getLeavesOfType: () => [leaf] }, vault: { getFileByPath: () => file, readBinary } };
  const result = await new VaultReadSnapshot(app as never).run(file as never, new AbortController().signal, async () => "done");
  expect(result.value).toBe("done");
  expect(readBinary).not.toHaveBeenCalled();
});

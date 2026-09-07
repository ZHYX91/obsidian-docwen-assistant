import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { captureExportTarget } from "../src/host/export-target-snapshot";

vi.mock("obsidian", () => ({}));
vi.mock("../src/host/vault-files", () => ({
  resolveAbsoluteFilePath: (_vault: unknown, file: { absolutePath: string }) => file.absolutePath,
}));
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "docwen-assistant-export-directory-"));
  roots.push(root);
  const parent = path.join(root, "output");
  await mkdir(parent);
  const output = path.join(parent, "note_20260907_180000_fromMd");
  const leaf = { view: { file: { absolutePath: path.join(output, "note.md") }, editor: { getValue: () => "unsaved" } } };
  const leaves: typeof leaf[] = [];
  const app = { vault: {}, workspace: { getLeavesOfType: () => leaves } };
  const controller = new AbortController();
  return { parent, output, leaf, leaves, controller, capture: () => captureExportTarget(app as never, parent, controller.signal) };
}

describe("export directory snapshot", () => {
  it("publishes to a new root and permits unrelated parent edits", async () => {
    const f = await fixture();
    const snapshot = await f.capture();
    f.leaf.view.file.absolutePath = path.join(f.parent, "unrelated.md");
    f.leaves.push(f.leaf);
    await writeFile(f.leaf.view.file.absolutePath, "user");
    const commit = vi.fn().mockResolvedValue("published");
    expect(await snapshot.publish(f.output, commit)).toBe("published");
    expect(commit).toHaveBeenCalledOnce();
  });

  it("preserves a result root created during conversion", async () => {
    const f = await fixture();
    const snapshot = await f.capture();
    await mkdir(f.output);
    await writeFile(path.join(f.output, "user.md"), "keep");
    const commit = vi.fn();
    await expect(snapshot.publish(f.output, commit)).rejects.toMatchObject({ code: "vault_content_conflict" });
    expect(commit).not.toHaveBeenCalled();
    expect(await readFile(path.join(f.output, "user.md"), "utf8")).toBe("keep");
  });

  it.each(["already open", "opened during conversion"])("preserves a result editor %s", async (when) => {
    const f = await fixture();
    if (when === "already open") f.leaves.push(f.leaf);
    const snapshot = await f.capture();
    if (when !== "already open") f.leaves.push(f.leaf);
    const commit = vi.fn();
    await expect(snapshot.publish(f.output, commit)).rejects.toMatchObject({ code: "vault_content_conflict" });
    expect(commit).not.toHaveBeenCalled();
  });

  it("rejects a replaced parent even at the same path", async () => {
    const f = await fixture();
    const snapshot = await f.capture();
    await rename(f.parent, `${f.parent}-moved`);
    await mkdir(f.parent);
    await expect(snapshot.publish(f.output, vi.fn())).rejects.toMatchObject({ code: "vault_content_conflict" });
  });

  it("rejects a root outside the selected parent", async () => {
    const f = await fixture();
    const snapshot = await f.capture();
    await expect(snapshot.publish(path.join(f.parent, "nested", "root"), vi.fn())).rejects.toMatchObject({ code: "vault_content_conflict" });
  });

  it("preserves cancellation before publication", async () => {
    const f = await fixture();
    const snapshot = await f.capture();
    f.controller.abort();
    const commit = vi.fn();
    await expect(snapshot.publish(f.output, commit)).rejects.toMatchObject({ name: "AbortError" });
    expect(commit).not.toHaveBeenCalled();
  });
});

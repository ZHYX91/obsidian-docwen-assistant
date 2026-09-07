import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

async function fixture(initial: string | null = "existing output") {
  const root = await mkdtemp(path.join(tmpdir(), "docwen-assistant-export-target-"));
  roots.push(root);
  const output = path.join(root, "output.md");
  if (initial !== null) await writeFile(output, initial, "utf8");
  let text = initial ?? "";
  const editor = { getValue: () => text };
  const view = { file: { absolutePath: output }, editor };
  const leaf = { view };
  const leaves: typeof leaf[] = [];
  const app = { vault: {}, workspace: { getLeavesOfType: () => leaves } };
  const controller = new AbortController();
  return {
    output, leaves, leaf, controller,
    setText: (value: string) => { text = value; },
    capture: () => captureExportTarget(app as never, output, controller.signal),
  };
}

describe("export destination snapshot", () => {
  it("permits only the unchanged destination observed before conversion", async () => {
    const target = await fixture();
    target.leaves.push(target.leaf);
    const snapshot = await target.capture();
    expect(snapshot.overwrite).toBe(true);
    const commit = vi.fn().mockResolvedValue("published");
    expect(await snapshot.publish(commit)).toBe("published");
    expect(commit).toHaveBeenCalledOnce();
  });

  it("preserves a destination edited while conversion runs", async () => {
    const target = await fixture();
    const snapshot = await target.capture();
    await writeFile(target.output, "user changed output", "utf8");
    const commit = vi.fn();
    await expect(snapshot.publish(commit)).rejects.toMatchObject({ code: "vault_content_conflict" });
    expect(commit).not.toHaveBeenCalled();
    expect(await readFile(target.output, "utf8")).toBe("user changed output");
  });

  it("does not grant overwrite permission to a newly created destination", async () => {
    const target = await fixture(null);
    const snapshot = await target.capture();
    expect(snapshot.overwrite).toBe(false);
    await writeFile(target.output, "created by the user", "utf8");
    const commit = vi.fn();
    await expect(snapshot.publish(commit)).rejects.toMatchObject({ code: "vault_content_conflict" });
    expect(commit).not.toHaveBeenCalled();
    expect(await readFile(target.output, "utf8")).toBe("created by the user");
  });

  it("refuses a destination removed during conversion", async () => {
    const target = await fixture();
    const snapshot = await target.capture();
    await rm(target.output);
    const commit = vi.fn();
    await expect(snapshot.publish(commit)).rejects.toMatchObject({ code: "vault_content_conflict" });
    expect(commit).not.toHaveBeenCalled();
  });

  it("preserves unsaved content already present in the destination editor", async () => {
    const target = await fixture();
    target.leaves.push(target.leaf);
    target.setText("unsaved user content");
    await expect(target.capture()).rejects.toMatchObject({ code: "vault_content_conflict" });
  });

  it("preserves destination editor changes before they reach disk", async () => {
    const target = await fixture();
    target.leaves.push(target.leaf);
    const snapshot = await target.capture();
    target.setText("new unsaved edit");
    const commit = vi.fn();
    await expect(snapshot.publish(commit)).rejects.toMatchObject({ code: "vault_content_conflict" });
    expect(commit).not.toHaveBeenCalled();
    expect(await readFile(target.output, "utf8")).toBe("existing output");
  });

  it("refuses a destination whose editor opens during conversion", async () => {
    const target = await fixture();
    const snapshot = await target.capture();
    target.leaves.push(target.leaf);
    const commit = vi.fn();
    await expect(snapshot.publish(commit)).rejects.toMatchObject({ code: "vault_content_conflict" });
    expect(commit).not.toHaveBeenCalled();
  });

  it("preserves cancellation at the publication boundary", async () => {
    const target = await fixture();
    const snapshot = await target.capture();
    target.controller.abort();
    const commit = vi.fn();
    await expect(snapshot.publish(commit)).rejects.toMatchObject({ name: "AbortError" });
    expect(commit).not.toHaveBeenCalled();
  });
});

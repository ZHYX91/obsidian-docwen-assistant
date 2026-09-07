import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as integrity from "../src/docwen/output-integrity";
import type { ValidatedArtifactBundle } from "../src/docwen/machine-client";
import { atomicCommitDirectory, captureOutputDirectory } from "../src/docwen/output-directory";

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "docwen-assistant-directory-"));
  roots.push(root);
  const source = path.join(root, "staging");
  const output = path.join(root, "output");
  await mkdir(source);
  await mkdir(output);
  const node = "通知_20260907_180000_fromDocx";
  const child = "通知_附件_20260907_180000_fromDocx";
  const bundle: ValidatedArtifactBundle = {
    schema: "docwen.artifact_bundle.v2", layout_schema: "docwen.document_node.v1", bundle_id: "bundle.directory", task_id: "task.directory",
    producer: { name: "DocWen", product_version: "0.10.0", machine_protocol: "docwen.machine.v1" },
    artifacts: [], entries: [{ artifact_id: "main", preferred: true, role: "primary", ordinal: 0 }],
    relations: [
      { type: "attachment_of", source_artifact_id: "attachment", target_artifact_id: "main", role: "attachment", ordinal: 0 },
      { type: "resource_of", source_artifact_id: "image", target_artifact_id: "main", role: "image", ordinal: 0 },
      { type: "resource_of", source_artifact_id: "manifest", target_artifact_id: "main", role: "manifest", ordinal: 1 },
    ],
  };
  const files = [
    { id: "attachment", name: `${child}/${child}.md`, type: "text/markdown", kind: "document" as const, text: "![image](../seal.png)" },
    { id: "main", name: `${node}.md`, type: "text/markdown", kind: "document" as const, text: `[附件](${child}/${child}.md)` },
    { id: "image", name: "seal.png", type: "image/png", kind: "resource" as const, text: "png" },
    { id: "manifest", name: "docwen-node.json", type: "application/vnd.docwen.document-node+json", kind: "resource" as const, text: "{}" },
  ];
  for (const file of files) {
    const absolutePath = path.join(source, file.id);
    const bytes = Buffer.from(file.text);
    await writeFile(absolutePath, bytes);
    bundle.artifacts.push({
      artifact_id: file.id, kind: file.kind, locator: file.id, logical_path: `${node}/${file.name}`,
      suggested_name: path.basename(file.name), media_type: file.type, size_bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"), absolutePath,
    });
  }
  return { root, output, source, bundle, node, child, parent: await captureOutputDirectory(output) };
}

describe("conversion directory publication", () => {
  it("keeps nested links, resources and manifest and chooses the preferred output explicitly", async () => {
    const f = await fixture();
    const result = await atomicCommitDirectory(f.bundle, f.parent);
    expect(result.output).toBe(path.join(f.output, f.node, `${f.node}.md`));
    expect(result.outputs).toEqual([result.output, path.join(f.output, f.node, f.child, `${f.child}.md`)]);
    expect(await readFile(result.output, "utf8")).toBe(`[附件](${f.child}/${f.child}.md)`);
    expect(await readFile(path.join(f.output, f.node, "seal.png"), "utf8")).toBe("png");
    expect(await readdir(f.output)).toEqual([f.node]);
  });

  it.each(["file", "directory"])("preserves a pre-existing %s with the chosen root name", async (kind) => {
    const f = await fixture();
    const target = path.join(f.output, f.node);
    if (kind === "file") await writeFile(target, "user");
    else await mkdir(target);
    await expect(atomicCommitDirectory(f.bundle, f.parent)).rejects.toMatchObject({ code: "cli_commit_failed" });
    expect(await readdir(f.output)).toEqual([f.node]);
    if (kind === "file") expect(await readFile(target, "utf8")).toBe("user");
  });

  it("preserves a root created while the host checks publication", async () => {
    const f = await fixture();
    await expect(atomicCommitDirectory(f.bundle, f.parent, undefined, async (target, commit) => {
      await mkdir(target);
      await writeFile(path.join(target, "user.txt"), "keep");
      return commit();
    })).rejects.toMatchObject({ code: "cli_commit_failed" });
    expect(await readFile(path.join(f.output, f.node, "user.txt"), "utf8")).toBe("keep");
    expect(await readdir(f.output)).toEqual([f.node]);
  });

  it("cancels after preparation without publishing a partial directory", async () => {
    const f = await fixture();
    const controller = new AbortController();
    await expect(atomicCommitDirectory(f.bundle, f.parent, controller.signal, async (_target, commit) => {
      controller.abort();
      return commit();
    })).rejects.toMatchObject({ code: "cli_cancelled" });
    expect(await readdir(f.output)).toEqual([]);
  });

  it("rejects prepared file changes during the host guard", async () => {
    const f = await fixture();
    await expect(atomicCommitDirectory(f.bundle, f.parent, undefined, async (_target, commit) => {
      const temporary = (await readdir(f.output)).find((name) => name.startsWith(".docwen-output-"))!;
      await writeFile(path.join(f.output, temporary, `${f.node}.md`), "changed");
      return commit();
    })).rejects.toMatchObject({ code: "cli_integrity_error" });
    expect(await readdir(f.output)).toEqual([]);
  });

  it("checks the live source after all prepared-byte validation finishes", async () => {
    const f = await fixture();
    const originalVerify = integrity.verifyArtifactIdentity;
    let sourceChanged = false;
    let preparedChecks = 0;
    vi.spyOn(integrity, "verifyArtifactIdentity").mockImplementation(async (...args) => {
      const result = await originalVerify(...args);
      if (!args[2] && ++preparedChecks === f.bundle.artifacts.length * 2) sourceChanged = true;
      return result;
    });
    await expect(atomicCommitDirectory(f.bundle, f.parent, undefined, async (_target, commit) => {
      if (sourceChanged) throw new Error("source changed");
      return commit();
    })).rejects.toThrow("source changed");
    expect(await readdir(f.output)).toEqual([]);
  });

  it("does not reinterpret a late cancellation as unpublished output", async () => {
    const f = await fixture();
    const controller = new AbortController();
    const result = await atomicCommitDirectory(f.bundle, f.parent, controller.signal, async (_target, commit) => {
      const outcome = await commit();
      controller.abort();
      return outcome;
    });
    expect(await readFile(result.output, "utf8")).toContain("附件");
  });

  it("permits unrelated parent contents but rejects parent replacement", async () => {
    const f = await fixture();
    await writeFile(path.join(f.output, "unrelated.md"), "user");
    await expect(f.parent.assertCurrent()).resolves.toBeUndefined();
    await rename(f.output, `${f.output}-moved`);
    await mkdir(f.output);
    await expect(atomicCommitDirectory(f.bundle, f.parent)).rejects.toMatchObject({ code: "cli_commit_failed" });
    expect(await readdir(f.output)).toEqual([]);
  });

  it.each(["../escape.md", "other/else.md", "root/CON.md"])("rejects an invalid logical output %s", async (logical) => {
    const f = await fixture();
    f.bundle.artifacts[0]!.logical_path = logical;
    await expect(atomicCommitDirectory(f.bundle, f.parent)).rejects.toMatchObject({ code: "cli_integrity_error" });
    expect(await readdir(f.output)).toEqual([]);
  });
});

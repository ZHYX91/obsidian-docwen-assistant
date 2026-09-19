import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocWenClient } from "../src/docwen/client";
import type { ValidatedArtifactBundle } from "../src/docwen/machine-client";
import { atomicCommitDirectory, captureOutputDirectory } from "../src/docwen/output-directory";
import { atomicCommitBundle } from "../src/docwen/output-files";
import { getFailureWarnings } from "../src/docwen/operation-outcome";
import { VaultWriteTransaction } from "../src/host/vault-write-transaction";

const faults = vi.hoisted(() => ({ remove: null as RegExp | null }));
vi.mock("node:fs/promises", async (load) => {
  const actual = await load<typeof import("node:fs/promises")>();
  return {
    ...actual,
    rm: async (...args: Parameters<typeof actual.rm>) => {
      if (faults.remove?.test(String(args[0]))) {
        throw Object.assign(new Error("private-path-and-document-content-must-not-leak"), { code: "EACCES" });
      }
      return actual.rm(...args);
    },
  };
});
vi.mock("obsidian", () => ({ MarkdownView: class MarkdownView {}, TFile: class TFile {} }));

const roots: string[] = [];
afterEach(async () => {
  faults.remove = null;
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function makeBundle(source: string): Promise<ValidatedArtifactBundle> {
  const bytes = Buffer.from("# New result\n");
  const absolutePath = path.join(source, "produced.md");
  await writeFile(absolutePath, bytes);
  return {
    schema: "docwen.artifact_bundle.v3", layout_schema: "docwen.document_node.v1",
    bundle_id: "bundle.lifecycle", task_id: "task.lifecycle",
    producer: { name: "DocWen", product_version: "0.12.0", machine_protocol: "docwen.machine.v2" },
    artifacts: [{
      artifact_id: "main", kind: "document", locator: "produced.md", logical_path: "result/result.md",
      suggested_name: "result.md", media_type: "text/markdown", size_bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"), absolutePath,
    }],
    entries: [{ artifact_id: "main", preferred: true, role: "primary", ordinal: 0 }], relations: [],
  };
}

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "docwen-output-lifecycle-"));
  roots.push(root);
  const output = path.join(root, "output");
  await mkdir(output);
  return { root, output, target: path.join(output, "chosen.md"), bundle: await makeBundle(root) };
}

describe("publication and cleanup boundaries", () => {
  it.each(["cleanup", "save", "transaction"])("keeps an editor publication after a %s failure", async (failure) => {
    let value = "# Heading\n";
    const editor = {
      getValue: () => value,
      offsetToPos: () => ({ line: 1, ch: 0 }),
      transaction: vi.fn((transaction: { changes: Array<{ text: string }> }) => {
        value = transaction.changes[0].text;
        if (failure === "transaction") throw new Error("late transaction listener failure");
      }),
    };
    const file = { path: "note.md", name: "note.md" };
    const requestSave = vi.fn(() => { if (failure === "save") throw new Error("save scheduling failed"); });
    const leaf = { view: { file, editor, requestSave } };
    const app = {
      workspace: { getLeavesOfType: () => [leaf] },
      vault: { getFileByPath: () => file },
    };
    if (failure === "cleanup") faults.remove = /docwen-assistant-numbering-/u;
    const warnings = await new VaultWriteTransaction(app as never).run(file as never, async (input, output) => {
      roots.push(path.dirname(input));
      await writeFile(output, "# 1. Heading\n");
    }, new AbortController().signal);
    expect(value).toBe("# 1. Heading\n");
    expect(editor.transaction).toHaveBeenCalledOnce();
    expect(requestSave).toHaveBeenCalledOnce();
    expect(warnings).toMatchObject([{ code: failure === "cleanup" ? "input_cleanup_failed" : "post_publish_failed" }]);
  });

  it("reports an unconfirmed Vault write without retrying when the host fails after accepting content", async () => {
    const file = { path: "note.md", name: "note.md" };
    const process = vi.fn(async (_file: unknown, update: (value: string) => string) => {
      expect(update("# Heading\n")).toBe("# 1. Heading\n");
      throw new Error("write result unknown");
    });
    const app = {
      workspace: { getLeavesOfType: () => [] },
      vault: { read: async () => "# Heading\n", getFileByPath: () => file, process },
    };
    await expect(new VaultWriteTransaction(app as never).run(file as never, async (_input, output) => {
      await writeFile(output, "# 1. Heading\n");
    }, new AbortController().signal)).rejects.toMatchObject({
      code: "vault_reconciliation_failed", details: { outputState: "unconfirmed" },
    });
    expect(process).toHaveBeenCalledOnce();
  });

  it.each(["bak", "new"])("keeps committed output when %s cleanup fails", async (suffix) => {
    const f = await fixture();
    await writeFile(f.target, "old result");
    faults.remove = new RegExp(`\\.${suffix}$`, "u");
    const result = await atomicCommitBundle(f.bundle, f.target, true);
    expect(await readFile(f.target, "utf8")).toBe("# New result\n");
    expect(result.outputs).toEqual([f.target]);
    expect(result.warnings).toEqual([{ code: "output_cleanup_failed", phase: "cleanup", detailCode: "EACCES" }]);
    const retained = (await readdir(f.output)).find((name) => name.endsWith(`.${suffix}`));
    expect(retained).toBeDefined();
    expect(await readFile(path.join(f.output, retained!), "utf8")).toBe(suffix === "bak" ? "old result" : "# New result\n");
    expect(JSON.stringify(result.warnings)).not.toContain("private-path");
  });

  it("preserves a backup changed by another writer after publication", async () => {
    const f = await fixture();
    await writeFile(f.target, "old result");
    const result = await atomicCommitBundle(f.bundle, f.target, true, undefined, async (commit) => {
      const published = await commit();
      const backup = (await readdir(f.output)).find((name) => name.endsWith(".bak"))!;
      await writeFile(path.join(f.output, backup), "external change");
      return published;
    });
    expect(await readFile(f.target, "utf8")).toBe("# New result\n");
    const backup = (await readdir(f.output)).find((name) => name.endsWith(".bak"))!;
    expect(await readFile(path.join(f.output, backup), "utf8")).toBe("external change");
    expect(result.warnings[0]).toMatchObject({ code: "output_cleanup_failed", detailCode: "cli_integrity_error" });
  });

  it.each(["after", "pending", "twice"])("retains one publication when a host callback fails %s commit", async (when) => {
    const f = await fixture();
    await writeFile(f.target, "old result");
    const result = await atomicCommitBundle(f.bundle, f.target, true, undefined, async (commit) => {
      const pending = commit();
      if (when === "after") await pending;
      if (when === "twice") await commit();
      throw new Error("host callback failed");
    });
    expect(await readFile(f.target, "utf8")).toBe("# New result\n");
    expect(result.warnings).toMatchObject([{ code: "post_publish_failed", phase: "post_publish" }]);
    expect(await readdir(f.output)).toEqual(["chosen.md"]);
  });

  it("rejects a callback that returns success without committing", async () => {
    const f = await fixture();
    await writeFile(f.target, "old result");
    await expect(atomicCommitBundle(f.bundle, f.target, true, undefined, async () => undefined as never))
      .rejects.toMatchObject({ code: "cli_commit_failed" });
    expect(await readFile(f.target, "utf8")).toBe("old result");
    expect(await readdir(f.output)).toEqual(["chosen.md"]);
  });

  it("returns a warning when a published directory lock cannot be removed", async () => {
    const f = await fixture();
    faults.remove = /\.lock$/u;
    const result = await atomicCommitDirectory(f.bundle, await captureOutputDirectory(f.output));
    expect(await readFile(result.output, "utf8")).toBe("# New result\n");
    expect(result.warnings).toEqual([{ code: "output_cleanup_failed", phase: "cleanup", detailCode: "EACCES" }]);
    expect((await readdir(f.output)).filter((name) => name.endsWith(".lock"))).toHaveLength(1);
  });

  it("retains a published directory when the host subsequently throws", async () => {
    const f = await fixture();
    const result = await atomicCommitDirectory(f.bundle, await captureOutputDirectory(f.output), undefined, async (_root, commit) => {
      await commit();
      throw new Error("late host failure");
    });
    expect(await readFile(result.output, "utf8")).toBe("# New result\n");
    expect(result.warnings).toEqual([{ code: "post_publish_failed", phase: "post_publish" }]);
  });

  it("carries Machine staging cleanup failure with the successful result", async () => {
    const f = await fixture();
    const input = path.join(f.root, "source.md");
    await writeFile(input, "# Original\n");
    const client = new DocWenClient({
      runTask: async (request: { output: { staging_root: { path: string } } }) => {
        roots.push(request.output.staging_root.path);
        return { bundle: await makeBundle(request.output.staging_root.path) };
      },
    } as never);
    faults.remove = /docwen-assistant-machine-/u;
    const result = await client.numberMarkdown(input, f.target, "remove");
    expect(await readFile(result.output, "utf8")).toBe("# New result\n");
    expect(result.warnings).toEqual([{ code: "task_cleanup_failed", phase: "cleanup", detailCode: "EACCES" }]);
  });

  it.each([false, true])("reports snapshot cleanup without masking publication or primary failure (failure=%s)", async (fail) => {
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const app = {
      workspace: { getLeavesOfType: () => [] },
      vault: { readBinary: async () => new TextEncoder().encode("source").buffer },
    };
    faults.remove = /docwen-assistant-snapshot-/u;
    const primary = new Error("source changed");
    const pending = new VaultReadSnapshot(app as never).run(
      { path: "source.md", extension: "md" } as never, new AbortController().signal,
      async (snapshot) => {
        roots.push(path.dirname(snapshot.inputPath));
        if (fail) throw primary;
        return snapshot.publish(async () => "published");
      },
    );
    if (fail) {
      await expect(pending).rejects.toBe(primary);
      expect(getFailureWarnings(primary)).toEqual([{ code: "input_cleanup_failed", phase: "cleanup", detailCode: "EACCES" }]);
    } else {
      expect(await pending).toEqual({ value: "published", warnings: [{ code: "input_cleanup_failed", phase: "cleanup", detailCode: "EACCES" }] });
    }
  });
});

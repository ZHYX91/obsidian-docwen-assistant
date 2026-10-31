import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocWenClient, type ConvertRequest, type ConvertTarget } from "../src/docwen/client";
import { LocalCliError } from "../src/docwen/errors";
import { validateArtifactBundle, type DocWenMachineClient, type MachineCapability, type MachineTaskRequest } from "../src/docwen/machine-client";
import * as integrity from "../src/docwen/output-integrity";

const roots: string[] = [];
const mediaTypes = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  md: "text/markdown",
};

afterEach(async () => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function fixture(target: ConvertTarget, mutate?: (bundle: Record<string, unknown>) => void) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "docwen-client-flat-")));
  roots.push(root);
  const output = path.join(root, "output");
  await mkdir(output);
  const input = path.join(root, "source.md");
  await writeFile(input, "# source\n");
  const capability: MachineCapability = {
    capability_id: target === "docx" ? "convert.markdown_source.to_docx" : `convert.markdown.to_${target}`,
    operation: "convert",
    input_shape: { slots: [{ role: "source", kind: "document", media_types: ["text/markdown"], min_items: 1, max_items: 1 }], undeclared_roles: "reject" },
    output_media_types: [mediaTypes[target]],
    output_shape: { cardinality: "one", artifact_kinds: ["document"], relation_types: [], atomic_bundle: true },
    options_schema: { properties: {} }, availability: "available", dependencies: [], limitations: [],
  };
  const runTask = vi.fn(async (request: MachineTaskRequest) => {
    expect(request.inputs).toMatchObject([{ media_type: "text/markdown", logical_path: "notes/source.md", kind: "document", role: "source" }]);
    expect(request.capability_id).toBe(capability.capability_id);
    const name = `source_20261031_120000_fromMd.${target}`;
    await writeFile(path.join(request.output.staging_root.path, name), "converted");
    const bundle = {
      schema: "docwen.artifact_bundle.v3", layout_schema: "docwen.artifact_layout.v1", bundle_id: "bundle.flat", task_id: "task.flat",
      producer: { name: "DocWen", product_version: "0.20.0", machine_protocol: "docwen.machine.v2" },
      artifacts: [{ artifact_id: "output", kind: "document", locator: name, suggested_name: name, logical_path: name,
        media_type: mediaTypes[target], size_bytes: 9, sha256: createHash("sha256").update("converted").digest("hex") }],
      entries: [{ artifact_id: "output", role: "primary", ordinal: 0, preferred: true }], relations: [],
    };
    mutate?.(bundle);
    for (const artifact of bundle.artifacts) {
      if (artifact.locator === name) continue;
      const bytes = Buffer.from(artifact.artifact_id);
      await writeFile(path.join(request.output.staging_root.path, artifact.locator), bytes);
      artifact.size_bytes = bytes.length;
      artifact.sha256 = createHash("sha256").update(bytes).digest("hex");
    }
    return { bundle: await validateArtifactBundle(bundle, request.output.staging_root.path, "task.flat", "0.20.0"), diagnostics: [] };
  });
  const query = vi.fn(async (method: string) => {
    if (method === "file/inspect") return { file_path: input, content_sha256: "a".repeat(64), size_bytes: 9, decision: "allow", supported_actions: ["convert"], declared_format: "markdown", detected_format: "markdown", warning_code: "", reason_code: "", workflow_category: "markdown", media_type: "text/markdown" };
    if (method === "capability/list") return { capabilities: [capability] };
    throw new Error(`Unexpected query: ${method}`);
  });
  const machine = {
    runTask: async (builder: Parameters<DocWenMachineClient["runTask"]>[0]) => runTask(typeof builder === "function" ? await builder(query) : builder),
  } as unknown as DocWenMachineClient;
  const request: ConvertRequest = { target, outputDirectory: output, inputs: [{ path: input, kind: "document", role: "source", logicalPath: "notes/source.md", mediaType: "text/markdown" }] };
  return { root, output, request, runTask, client: new DocWenClient(machine), target: path.join(output, `source_20261031_120000_fromMd.${target}`) };
}

describe("public conversion client flat output", () => {
  it.each(["docx", "xlsx"] as const)("publishes one validated %s directly into the selected parent", async (target) => {
    const f = await fixture(target);
    const result = await f.client.convert(f.request);
    expect(result).toMatchObject({ output: f.target, outputs: [f.target], warnings: [] });
    expect(result.resultDirectory).toBeUndefined();
    expect(await readFile(f.target, "utf8")).toBe("converted");
    expect(await readdir(f.output)).toEqual([path.basename(f.target)]);
  });

  it.each(["file", "directory"])("preserves a pre-existing output %s", async (kind) => {
    const f = await fixture("docx");
    if (kind === "file") await writeFile(f.target, "user bytes");
    else await mkdir(f.target);
    await expect(f.client.convert(f.request)).rejects.toMatchObject({ code: "cli_commit_failed" });
    if (kind === "file") expect(await readFile(f.target, "utf8")).toBe("user bytes");
    else expect((await lstat(f.target)).isDirectory()).toBe(true);
    expect(await readdir(f.output)).toEqual([path.basename(f.target)]);
  });

  it("does not replace an external file created after the last absence check", async () => {
    const f = await fixture("docx");
    const original = integrity.regularFileIdentity;
    let preparedChecks = 0;
    vi.spyOn(integrity, "regularFileIdentity").mockImplementation(async (file) => {
      const result = await original(file);
      if (path.basename(file).endsWith(".new")) {
        // The publisher's second identity read follows its final target absence check.
        preparedChecks += 1;
        if (preparedChecks === 2) await writeFile(f.target, "external bytes");
      }
      return result;
    });
    await expect(f.client.convert(f.request)).rejects.toMatchObject({ code: "cli_commit_failed" });
    expect(preparedChecks).toBeGreaterThanOrEqual(2);
    expect(await readFile(f.target, "utf8")).toBe("external bytes");
    expect(await readdir(f.output)).toEqual([path.basename(f.target)]);
  });

  it.each(["guard", "cancel", "editor"])("keeps publication guarded by %s and removes prepared output on rejection", async (reason) => {
    const f = await fixture("docx");
    const controller = new AbortController();
    f.request.publish = async (target, commit) => {
      expect(target).toBe(f.target);
      if (reason === "editor") throw Object.assign(new Error("Output editor is open"), { code: "vault_content_conflict" });
      return commit(() => {
        if (reason === "cancel") controller.abort();
        else throw Object.assign(new Error("Source changed"), { code: "vault_target_changed" });
      });
    };
    await expect(f.client.convert(f.request, controller.signal)).rejects.toMatchObject({
      code: reason === "cancel" ? "cli_cancelled" : reason === "editor" ? "vault_content_conflict" : "vault_target_changed",
    });
    expect(await readdir(f.output)).toEqual([]);
  });

  it("rejects a changed selected parent during host publication checks", async () => {
    const f = await fixture("docx");
    f.request.publish = async (_target, commit) => {
      await rename(f.output, path.join(f.root, "moved"));
      await mkdir(f.output);
      return commit();
    };
    await expect(f.client.convert(f.request)).rejects.toMatchObject({ code: "cli_commit_failed" });
    expect(await readdir(f.output)).toEqual([]);
    await expect(lstat(path.join(f.root, "moved", path.basename(f.target)))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("runs the source guard after awaited parent checks", async () => {
    const f = await fixture("docx");
    let hostChecked = false;
    let changed = false;
    const original = integrity.regularFileIdentity;
    vi.spyOn(integrity, "regularFileIdentity").mockImplementation(async (file) => {
      if (hostChecked) changed = true;
      return original(file);
    });
    f.request.publish = async (_target, commit) => {
      hostChecked = true;
      return commit(() => { if (changed) throw new LocalCliError("cli_input_invalid", "Source changed after the host check"); });
    };
    await expect(f.client.convert(f.request)).rejects.toMatchObject({ code: "cli_input_invalid" });
    expect(await readdir(f.output)).toEqual([]);
  });

  it.each(["extra", "media", "kind", "role", "name", "nested", "unsafe", "markdown"])("rejects inconsistent flat output: %s", async (change) => {
    const f = await fixture(change === "markdown" ? "md" : "xlsx", (raw) => {
      const artifacts = raw.artifacts as Array<Record<string, unknown>>;
      const entries = raw.entries as Array<Record<string, unknown>>;
      if (change === "extra") { artifacts.push({ ...artifacts[0], artifact_id: "second", locator: "second.xlsx", logical_path: "second.xlsx", suggested_name: "second.xlsx" }); entries.push({ artifact_id: "second", role: "primary", ordinal: 1, preferred: false }); }
      if (change === "media") artifacts[0]!.media_type = "text/csv";
      if (change === "kind") artifacts[0]!.kind = "resource";
      if (change === "role") entries[0]!.role = "supplementary";
      if (change === "name") artifacts[0]!.suggested_name = "different.xlsx";
      if (change === "nested") artifacts[0]!.logical_path = "node/output.xlsx";
      if (change === "unsafe") artifacts[0]!.logical_path = "../output.xlsx";
    });
    await expect(f.client.convert(f.request)).rejects.toMatchObject({ code: "cli_integrity_error" });
    expect(await readdir(f.output)).toEqual([]);
  });

  it("keeps a document-node output in its complete result directory", async () => {
    const f = await fixture("md", (raw) => {
      raw.layout_schema = "docwen.document_node.v1";
      const artifacts = raw.artifacts as Array<Record<string, unknown>>;
      artifacts[0]!.logical_path = `node/${String(artifacts[0]!.suggested_name)}`;
    });
    const result = await f.client.convert(f.request);
    expect(result.resultDirectory).toBe(path.join(f.output, "node"));
    expect(await readFile(result.output, "utf8")).toBe("converted");
    expect(await readdir(f.output)).toEqual(["node"]);
  });

  it("preserves an attachment and each document's independently owned resources", async () => {
    const f = await fixture("md", (raw) => {
      raw.layout_schema = "docwen.document_node.v1";
      const artifacts = raw.artifacts as Array<Record<string, unknown>>;
      artifacts[0]!.logical_path = "node/main.md";
      artifacts.push(
        { ...artifacts[0], artifact_id: "attachment", locator: "attachment.md", logical_path: "node/attachment/attachment.md", suggested_name: "attachment.md" },
        { ...artifacts[0], artifact_id: "main-image", kind: "resource", media_type: "image/png", locator: "main.png", logical_path: "node/image.png", suggested_name: "image.png" },
        { ...artifacts[0], artifact_id: "attachment-image", kind: "resource", media_type: "image/png", locator: "attachment.png", logical_path: "node/attachment/image.png", suggested_name: "image.png" },
      );
      raw.relations = [
        { type: "attachment_of", role: "attachment", source_artifact_id: "attachment", target_artifact_id: "output", ordinal: 0 },
        { type: "resource_of", role: "image", source_artifact_id: "main-image", target_artifact_id: "output", ordinal: 0 },
        { type: "resource_of", role: "image", source_artifact_id: "attachment-image", target_artifact_id: "attachment", ordinal: 0 },
      ];
    });
    const result = await f.client.convert(f.request);
    expect(result.outputs).toEqual([path.join(f.output, "node/main.md"), path.join(f.output, "node/attachment/attachment.md")]);
    expect(await readFile(path.join(f.output, "node/image.png"), "utf8")).toBe("main-image");
    expect(await readFile(path.join(f.output, "node/attachment/image.png"), "utf8")).toBe("attachment-image");
    expect(await readdir(f.output)).toEqual(["node"]);
  });
});

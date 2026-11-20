import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { DocWenClient } from "../src/docwen/client";
import { validateArtifactBundle, type DocWenMachineClient, type MachineTaskRequest } from "../src/docwen/machine-client";
import { VaultWriteTransaction } from "../src/host/vault-write-transaction";

vi.mock("obsidian", () => ({ MarkdownView: class MarkdownView {} }));

function noteHost(open: boolean) {
  const original = "# Original note\n";
  let content = original;
  const file = { path: "note.md" };
  const editor = {
    getValue: () => content,
    offsetToPos: () => ({ line: 1, ch: 0 }),
    transaction: vi.fn((transaction: { changes: Array<{ text: string }> }) => {
      content = transaction.changes[0].text;
    }),
  };
  const view = { file, editor, requestSave: vi.fn() };
  const leaf = { view };
  const app = {
    workspace: { getLeavesOfType: () => open ? [leaf] : [] },
    vault: {
      getFileByPath: () => file,
      read: vi.fn(async () => content),
      process: vi.fn(async (_file: unknown, update: (value: string) => string) => {
        content = update(content);
        return content;
      }),
    },
  };
  return { app, file, editor, view, original, content: () => content };
}

const invalidCases = ["docx", "node-without-root", "node-with-related-resource", "resource", "fragment", "supplementary", "not-preferred", "extra-resource", "extra-document", "invalid-utf8", "truncated-utf8"] as const;

const nodeRoot = "合成笔记_20260620_101523_fromMd";
const nodeFile = `${nodeRoot}.md`;
const nodePath = `${nodeRoot}/${nodeFile}`;

async function coreNumberingResult(request: MachineTaskRequest, text: string, overrides: {
  locator?: string; logicalPath?: string; suggestedName?: string; ordinal?: number;
} = {}) {
  const stagingRoot = request.output.staging_root.path;
  const locator = overrides.locator ?? nodePath;
  const file = path.join(stagingRoot, locator);
  await mkdir(path.dirname(file), { recursive: true });
  const bytes = Buffer.from(text);
  await writeFile(file, bytes);
  const bundle = await validateArtifactBundle({
    schema: "docwen.artifact_bundle.v3", bundle_id: "bundle.numbering", task_id: "task.numbering",
    producer: { name: "DocWen", product_version: "0.23.0", machine_protocol: "docwen.machine.v2" },
    layout_schema: "docwen.document_node.v1",
    artifacts: [{ artifact_id: "artifact.1", kind: "document", media_type: "text/markdown",
      locator, logical_path: overrides.logicalPath ?? locator, suggested_name: overrides.suggestedName ?? nodeFile,
      size_bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }],
    entries: [{ artifact_id: "artifact.1", ordinal: overrides.ordinal ?? 0, role: "primary", preferred: true }],
    relations: [],
  }, stagingRoot, "task.numbering", "0.23.0");
  return { taskId: "task.numbering", bundle, plan: {}, diagnostics: [], metrics: {} };
}

describe("numbering output contract", () => {
  it.each([true, false])("adds then clears numbering with Core's Markdown node (open=%s)", async (open) => {
    const host = noteHost(open);
    const numbered = "# 1 Original note\n";
    const machine = {
      runTask: async (request: MachineTaskRequest) => {
        const adding = request.options.add_numbering === true;
        expect(await readFile(request.inputs[0].locator.path, "utf8")).toBe(adding ? host.original : numbered);
        return coreNumberingResult(request, adding ? numbered : host.original);
      },
    };
    const client = new DocWenClient(machine as unknown as DocWenMachineClient);
    const transaction = new VaultWriteTransaction(host.app as never);
    for (const operation of ["add", "remove"] as const) {
      await transaction.run(host.file as never, async (input, output, _sha256, signal) =>
        (await client.numberMarkdown(input, output, operation, "hierarchical_standard", signal)).warnings,
      new AbortController().signal);
      expect(host.content()).toBe(operation === "add" ? numbered : host.original);
    }
    expect(open ? host.editor.transaction : host.app.vault.process).toHaveBeenCalledTimes(2);
  });

  it.each([
    { name: "nested child", locator: `child/${nodePath}` },
    { name: "mismatched node name", locator: `other/${nodeFile}` },
    { name: "non-Markdown extension", locator: `${nodeRoot}/${nodeRoot}.txt`, suggestedName: `${nodeRoot}.txt` },
    { name: "mismatched suggested name", suggestedName: "result.md" },
    { name: "mismatched staging locator", locator: "other.md", logicalPath: nodePath },
    { name: "nonzero primary ordinal", ordinal: 1 },
  ])("preserves the note for a document node with $name", async (overrides) => {
    const host = noteHost(true);
    const machine = { runTask: (request: MachineTaskRequest) => coreNumberingResult(request, "# 1 Original note\n", overrides) };
    const client = new DocWenClient(machine as unknown as DocWenMachineClient);
    await expect(new VaultWriteTransaction(host.app as never).run(host.file as never,
      async (input, output, _sha256, signal) =>
        (await client.numberMarkdown(input, output, "remove", undefined, signal)).warnings,
      new AbortController().signal)).rejects.toMatchObject({ code: "cli_integrity_error" });
    expect(host.content()).toBe(host.original);
    expect(host.editor.transaction).not.toHaveBeenCalled();
  });

  it.each(["", "\ufeff# 中文 😀\r\n", "a".repeat(65_535) + "中文 😀\n"])(
    "publishes valid Markdown without changing its UTF-8 bytes (%#)", async (text) => {
      const host = noteHost(true);
      const bytes = Buffer.from(text);
      const machine = {
        runTask: async (request: MachineTaskRequest) => {
          const stagingRoot = request.output.staging_root.path;
          await writeFile(path.join(stagingRoot, "result.md"), bytes);
          const bundle = await validateArtifactBundle({
            schema: "docwen.artifact_bundle.v3", bundle_id: "bundle.numbering", task_id: "task.numbering",
            producer: { name: "DocWen", product_version: "0.23.0", machine_protocol: "docwen.machine.v2" },
            layout_schema: "docwen.artifact_layout.v1",
            artifacts: [{ artifact_id: "artifact.1", kind: "document", locator: "result.md",
              logical_path: "result.md", suggested_name: "result.md", media_type: "text/markdown",
              size_bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }],
            entries: [{ artifact_id: "artifact.1", ordinal: 0, role: "primary", preferred: true }], relations: [],
          }, stagingRoot, "task.numbering", "0.23.0");
          return { taskId: "task.numbering", bundle, plan: {}, diagnostics: [], metrics: {} };
        },
      };
      const client = new DocWenClient(machine as unknown as DocWenMachineClient);
      await new VaultWriteTransaction(host.app as never).run(host.file as never,
        async (input, output, _sha256, signal) =>
          (await client.numberMarkdown(input, output, "remove", undefined, signal)).warnings,
        new AbortController().signal);
      expect(host.content()).toBe(text);
      expect(host.editor.transaction).toHaveBeenCalledOnce();
      expect(host.view.requestSave).toHaveBeenCalledOnce();
    },
  );

  it.each(invalidCases.flatMap((fixture) => [true, false].map((open) => ({ fixture, open }))))(
    "preserves the note when $fixture is returned (open=$open)", async ({ fixture, open }) => {
      const host = noteHost(open);
      const bytes = fixture === "docx"
        ? await readFile(new URL("./fixtures/detected-format.docx", import.meta.url))
        : fixture === "invalid-utf8" ? Buffer.from([0x23, 0x20, 0xff, 0xfe, 0x0a])
          : fixture === "truncated-utf8" ? Buffer.from([0x23, 0x20, 0xe4, 0xb8])
            : Buffer.from("# 1 Original note\n");
      let stagingRoot = "";
      let validated = 0;
      const machine = {
        runTask: async (request: MachineTaskRequest) => {
          stagingRoot = request.output.staging_root.path;
          const filename = fixture === "docx" ? "result.docx" : "result.md";
          const relatedResource = fixture === "node-with-related-resource";
          const locator = relatedResource ? nodePath : filename;
          if (relatedResource) await mkdir(path.join(stagingRoot, nodeRoot));
          await writeFile(path.join(stagingRoot, locator), bytes);
          const artifact = {
            artifact_id: "artifact.1",
            kind: fixture === "resource" ? "resource" : fixture === "fragment" ? "fragment" : "document",
            locator, logical_path: locator, suggested_name: path.posix.basename(locator),
            media_type: fixture === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/markdown",
            size_bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"),
          };
          const artifacts = [artifact];
          const entries = [{ artifact_id: artifact.artifact_id, ordinal: 0,
            role: fixture === "supplementary" ? "supplementary" : "primary", preferred: fixture !== "not-preferred" }];
          if (fixture === "extra-resource" || fixture === "extra-document" || relatedResource) {
            const extra = relatedResource ? `${nodeRoot}/extra.md` : "extra.md";
            await writeFile(path.join(stagingRoot, extra), bytes);
            artifacts.push({ ...artifact, artifact_id: "artifact.2", locator: extra, logical_path: extra,
              suggested_name: "extra.md", kind: fixture === "extra-document" ? "document" : "resource" });
            if (!relatedResource) {
              entries.push({ artifact_id: "artifact.2", ordinal: 1, preferred: false,
                role: fixture === "extra-document" ? "primary" : "supplementary" });
            }
          }
          const bundle = await validateArtifactBundle({
            schema: "docwen.artifact_bundle.v3", bundle_id: "bundle.numbering", task_id: "task.numbering",
            producer: { name: "DocWen", product_version: "0.23.0", machine_protocol: "docwen.machine.v2" },
            layout_schema: fixture === "node-without-root" || relatedResource ? "docwen.document_node.v1" : "docwen.artifact_layout.v1",
            artifacts, entries, relations: relatedResource ? [{ type: "resource_of", role: "original",
              source_artifact_id: "artifact.2", target_artifact_id: "artifact.1" }] : [],
          }, stagingRoot, "task.numbering", "0.23.0");
          validated += 1;
          return { taskId: "task.numbering", bundle, plan: {}, diagnostics: [], metrics: {} };
        },
      };
      const client = new DocWenClient(machine as unknown as DocWenMachineClient);
      await expect(new VaultWriteTransaction(host.app as never).run(host.file as never,
        async (input, output, _sha256, signal) =>
          (await client.numberMarkdown(input, output, "add", "gongwen_standard", signal)).warnings,
        new AbortController().signal)).rejects.toMatchObject({ code: "cli_integrity_error" });
      expect(validated).toBe(1);
      expect(host.content()).toBe(host.original);
      expect(host.editor.transaction).not.toHaveBeenCalled();
      expect(host.view.requestSave).not.toHaveBeenCalled();
      expect(host.app.vault.process).not.toHaveBeenCalled();
      await expect(lstat(stagingRoot)).rejects.toMatchObject({ code: "ENOENT" });
    },
  );

  it.each([true, false])("rejects invalid UTF-8 at the final host write boundary (open=%s)", async (open) => {
    const host = noteHost(open);
    await expect(new VaultWriteTransaction(host.app as never).run(host.file as never,
      async (_input, output) => writeFile(output, Buffer.from([0xff])),
      new AbortController().signal)).rejects.toMatchObject({ code: "vault_input_invalid" });
    expect(host.content()).toBe(host.original);
    expect(host.editor.transaction).not.toHaveBeenCalled();
    expect(host.view.requestSave).not.toHaveBeenCalled();
    expect(host.app.vault.process).not.toHaveBeenCalled();
  });

  it.each(["", "\ufeff# 中文 😀\r\n", "# Literal replacement character \ufffd\n"])(
    "preserves valid UTF-8 text exactly: %j", async (text) => {
      const host = noteHost(true);
      await new VaultWriteTransaction(host.app as never).run(host.file as never,
        async (_input, output) => writeFile(output, text, "utf8"), new AbortController().signal);
      expect(host.content()).toBe(text);
      expect(host.editor.transaction).toHaveBeenCalledOnce();
      expect(host.view.requestSave).toHaveBeenCalledOnce();
    },
  );
});

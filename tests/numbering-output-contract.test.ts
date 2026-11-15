import { createHash } from "node:crypto";
import { lstat, readFile, writeFile } from "node:fs/promises";
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

const invalidCases = ["docx", "document-node", "resource", "fragment", "supplementary", "not-preferred", "extra-resource", "extra-document", "invalid-utf8", "truncated-utf8"] as const;

describe("numbering output contract", () => {
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
          await writeFile(path.join(stagingRoot, filename), bytes);
          const artifact = {
            artifact_id: "artifact.1",
            kind: fixture === "resource" ? "resource" : fixture === "fragment" ? "fragment" : "document",
            locator: filename, logical_path: filename, suggested_name: filename,
            media_type: fixture === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/markdown",
            size_bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"),
          };
          const artifacts = [artifact];
          const entries = [{ artifact_id: artifact.artifact_id, ordinal: 0,
            role: fixture === "supplementary" ? "supplementary" : "primary", preferred: fixture !== "not-preferred" }];
          if (fixture === "extra-resource" || fixture === "extra-document") {
            await writeFile(path.join(stagingRoot, "extra.md"), bytes);
            artifacts.push({ ...artifact, artifact_id: "artifact.2", locator: "extra.md", logical_path: "extra.md",
              suggested_name: "extra.md", kind: fixture === "extra-resource" ? "resource" : "document" });
            entries.push({ artifact_id: "artifact.2", ordinal: 1, preferred: false,
              role: fixture === "extra-resource" ? "supplementary" : "primary" });
          }
          const bundle = await validateArtifactBundle({
            schema: "docwen.artifact_bundle.v3", bundle_id: "bundle.numbering", task_id: "task.numbering",
            producer: { name: "DocWen", product_version: "0.23.0", machine_protocol: "docwen.machine.v2" },
            layout_schema: fixture === "document-node" ? "docwen.document_node.v1" : "docwen.artifact_layout.v1",
            artifacts, entries, relations: [],
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

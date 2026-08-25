import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { DocWenClient } from "../src/docwen";
import {
  atomicCommitBundle,
  INPUT_HANDLE_LIMITS,
  PROOFREAD_REPORT_LIMIT_BYTES,
} from "../src/docwen/client";
import type {
  DocWenMachineClient,
  MachineTaskRequest,
  ValidatedArtifactBundle,
} from "../src/docwen";

const roots: string[] = [];

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "docwen-assistant-test-"));
  roots.push(root);
  return root;
}

function inspection(filePath: string, format = "markdown") {
  const mediaType = format === "markdown"
    ? "text/markdown"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return {
    file_path: filePath,
    content_sha256: "a".repeat(64),
    size_bytes: 1,
    decision: "allow",
    supported_actions: ["inspect", "convert", "validate", "number markdown"],
    declared_format: format,
    detected_format: format,
    warning_code: "",
    reason_code: "",
    workflow_category: format === "markdown" ? "markdown" : "document",
    media_type: mediaType,
  };
}

function sourceInput(filePath: string) {
  return {
    path: filePath,
    kind: "document" as const,
    role: "source" as const,
    logicalPath: "notes/note.md",
    mediaType: "text/markdown",
  };
}

function bundleFor(
  taskId: string,
  artifactPath: string,
  mediaType: string,
  kind: "document" | "resource" = "document",
  bytes = Buffer.from("fixture"),
): ValidatedArtifactBundle {
  return {
    schema: "docwen.artifact_bundle.v2",
    bundle_id: "bundle.1",
    task_id: taskId,
    producer: { name: "DocWen", product_version: "0.9.0", machine_protocol: "docwen.machine.v1" },
    layout_schema: "docwen.artifact_layout.v1",
    artifacts: [{
      artifact_id: "artifact.1",
      kind,
      locator: path.basename(artifactPath),
      logical_path: path.basename(artifactPath),
      suggested_name: path.basename(artifactPath),
      media_type: mediaType,
      size_bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      absolutePath: artifactPath,
    }],
    entries: [{
      artifact_id: "artifact.1",
      role: kind === "resource" ? "supplementary" : "primary",
      ordinal: 0,
      preferred: true,
    }],
    relations: [],
  };
}

function bundleWithRelated(
  primaryPath: string,
  primaryBytes: Buffer,
  relatedPath: string,
  relatedBytes: Buffer,
): ValidatedArtifactBundle {
  return {
    schema: "docwen.artifact_bundle.v2",
    bundle_id: "bundle.related",
    task_id: "task.related",
    producer: { name: "DocWen", product_version: "0.9.0", machine_protocol: "docwen.machine.v1" },
    layout_schema: "docwen.artifact_layout.v1",
    artifacts: [
      {
        artifact_id: "artifact.primary",
        kind: "document",
        locator: path.basename(primaryPath),
        logical_path: path.basename(primaryPath),
        suggested_name: path.basename(primaryPath),
        media_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size_bytes: primaryBytes.length,
        sha256: createHash("sha256").update(primaryBytes).digest("hex"),
        absolutePath: primaryPath,
      },
      {
        artifact_id: "artifact.related",
        kind: "resource",
        locator: path.basename(relatedPath),
        logical_path: path.basename(relatedPath),
        suggested_name: "image.png",
        media_type: "image/png",
        size_bytes: relatedBytes.length,
        sha256: createHash("sha256").update(relatedBytes).digest("hex"),
        absolutePath: relatedPath,
      },
    ],
    entries: [
      { artifact_id: "artifact.primary", role: "primary", ordinal: 0, preferred: true },
      { artifact_id: "artifact.related", role: "supplementary", ordinal: 1, preferred: false },
    ],
    relations: [],
  };
}

async function transactionResidue(root: string): Promise<string[]> {
  return (await readdir(root)).filter((name) =>
    name.startsWith(".docwen-") || (name.includes(".docwen-") && name.endsWith(".bak")));
}

function machine(query: ReturnType<typeof vi.fn>, runTask = vi.fn()): DocWenMachineClient {
  return {
    query,
    runTask,
    locale: () => "en_US",
    dispose: vi.fn(),
  } as unknown as DocWenMachineClient;
}

describe("DocWenClient Machine semantics", () => {
  it("maps GUI and resource queries without argv", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ state: "opened" })
      .mockResolvedValueOnce({
        kind: "templates",
        resources: [{ id: "template.1", name: "Standard", target: "docx" }],
      });
    const client = new DocWenClient(machine(query));

    await client.guiOpen("D:\\Vault\\note.md");
    await expect(client.templates("docx")).resolves.toEqual([
      { id: "template.1", name: "Standard", target: "docx", description: undefined },
    ]);
    expect(query.mock.calls).toEqual([
      ["gui/open", { timeout_seconds: 10, file_path: "D:\\Vault\\note.md" }, undefined],
      ["resource/list", { kind: "templates", locale: "en_US", target: "docx" }, undefined],
    ]);
  });

  it("parses only D2 capability input_shape slots", async () => {
    const query = vi.fn().mockResolvedValue({
      capabilities: [{
        capability_id: "convert.markdown.to_docx",
        operation: "convert",
        input_shape: {
          slots: [
            { role: "source", kind: "document", media_types: ["text/markdown"], min_items: 1 },
            { role: "linked_resource", kind: "resource", media_types: ["image/png"], min_items: 0 },
          ],
          undeclared_roles: "reject",
        },
        output_media_types: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        output_shape: { cardinality: "one", artifact_kinds: ["document"], relation_types: [], atomic_bundle: true },
        options_schema: {},
        availability: "available",
        dependencies: [],
        limitations: [],
      }],
    });
    const client = new DocWenClient(machine(query));

    await expect(client.runtimeCapabilities()).resolves.toMatchObject({
      capabilities: [{ input_shape: { undeclared_roles: "reject" } }],
    });

    query.mockResolvedValueOnce({
      capabilities: [{
        capability_id: "convert.markdown.to_docx",
        operation: "convert",
        input_media_types: ["text/markdown"],
        input_shape: { slots: [{ role: "source", kind: "document", media_types: ["text/markdown"], min_items: 1 }], undeclared_roles: "reject" },
        output_media_types: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        output_shape: { cardinality: "one", artifact_kinds: ["document"], relation_types: [], atomic_bundle: true },
        options_schema: {}, availability: "available", dependencies: [], limitations: [],
      }],
    });
    await expect(client.runtimeCapabilities()).rejects.toMatchObject({ code: "cli_invalid_envelope" });
  });

  it("builds an integrity-pinned inspection handle", async () => {
    const root = await temporaryRoot();
    const input = path.join(root, "note.md");
    await writeFile(input, "# note\n", "utf8");
    const query = vi.fn().mockResolvedValue(inspection(input));
    const client = new DocWenClient(machine(query));

    await expect(client.inspect(input)).resolves.toMatchObject({
      detectedFormat: "markdown",
      mediaType: "text/markdown",
    });
    expect(query.mock.calls[0]![0]).toBe("file/inspect");
    expect(query.mock.calls[0]![1].input).toMatchObject({
      locator: { kind: "local_path", path: input },
      size_bytes: 7,
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/u),
    });
  });

  it("honors cancellation before hashing a local input handle", async () => {
    const root = await temporaryRoot();
    const input = path.join(root, "note.md");
    await writeFile(input, "# note\n", "utf8");
    const query = vi.fn();
    const controller = new AbortController();
    controller.abort();
    const client = new DocWenClient(machine(query));

    await expect(client.inspect(input, controller.signal)).rejects.toMatchObject({ code: "cli_cancelled" });
    expect(query).not.toHaveBeenCalled();
  });

  it("maps conversion options to a Machine capability and atomically commits output", async () => {
    const root = await temporaryRoot();
    const input = path.join(root, "note.md");
    const neutral = path.join(root, "resolved-document.json");
    const numberingPlan = path.join(root, "numbering-export-plan.json");
    const output = path.join(root, "note.docx");
    await writeFile(input, "# note\n", "utf8");
    await writeFile(neutral, "{}", "utf8");
    await writeFile(numberingPlan, "{}", "utf8");
    const query = vi.fn().mockResolvedValue(inspection(input));
    const runTask = vi.fn().mockImplementation(async (request: MachineTaskRequest) => {
      const artifactPath = path.join(request.output.staging_root.path, "note.docx");
      await writeFile(artifactPath, "fixture", "utf8");
      return {
        taskId: "task.1",
        plan: {},
        bundle: bundleFor("task.1", artifactPath, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        diagnostics: [],
        metrics: {},
      };
    });
    const client = new DocWenClient(machine(query, runTask));

    await expect(client.convert({
      sourceInput: sourceInput(input),
      inputs: [
        {
          path: neutral,
          kind: "document",
          role: "neutral_document",
          logicalPath: "resolved-document.json",
          mediaType: "application/vnd.docwen.resolved-document+json",
        },
        {
          path: numberingPlan,
          kind: "resource",
          role: "numbering_export_plan",
          logicalPath: "numbering-export-plan.json",
          mediaType: "application/vnd.docwen.numbering-export-plan+json",
        },
      ],
      outputPath: output,
      target: "docx",
      template: "template.standard",
      headingMergeMode: "always",
    })).resolves.toMatchObject({ output, bundleId: "bundle.1" });
    expect(await readFile(output, "utf8")).toBe("fixture");
    expect(runTask.mock.calls[0]![0]).toMatchObject({
      capability_id: "convert.markdown.to_docx",
      inputs: [
        {
          kind: "document",
          role: "neutral_document",
          logical_path: "resolved-document.json",
          media_type: "application/vnd.docwen.resolved-document+json",
        },
        {
          kind: "resource",
          role: "numbering_export_plan",
          logical_path: "numbering-export-plan.json",
          media_type: "application/vnd.docwen.numbering-export-plan+json",
        },
      ],
      options: {
        template_name: "template.standard",
        heading_merge_mode: "always",
      },
    });
  });

  it("sends only explicit typed inputs and never discovers a physical decoy", async () => {
    const root = await temporaryRoot();
    const source = path.join(root, "note.md");
    const linked = path.join(root, "actual.png");
    const decoy = path.join(root, "decoy.png");
    const output = path.join(root, "note.docx");
    await writeFile(source, "![[actual.png]]\n", "utf8");
    await writeFile(linked, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    await writeFile(decoy, "DECOY", "utf8");
    const runTask = vi.fn().mockImplementation(async (request: MachineTaskRequest) => {
      expect(request.inputs).toHaveLength(2);
      expect(request.inputs.map((input) => input.logical_path)).toEqual(["notes/note.md", "assets/actual.png"]);
      expect(request.inputs.map((input) => input.role)).toEqual(["source", "linked_resource"]);
      expect(request.inputs[1]!.locator.path).not.toBe(path.resolve(decoy));
      const artifactPath = path.join(request.output.staging_root.path, "note.docx");
      await writeFile(artifactPath, "fixture", "utf8");
      return {
        taskId: "task.1",
        plan: {},
        bundle: bundleFor("task.1", artifactPath, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        diagnostics: [],
        metrics: {},
      };
    });
    const client = new DocWenClient(machine(vi.fn().mockResolvedValue(inspection(source)), runTask));

    await client.convert({
      inputs: [
        sourceInput(source),
        {
          path: linked,
          kind: "resource",
          role: "linked_resource",
          logicalPath: "assets/actual.png",
          mediaType: "image/png",
        },
      ],
      outputPath: output,
      target: "docx",
    });

    expect(runTask).toHaveBeenCalledOnce();
  });

  it("rejects invalid or duplicate logical paths before Machine task planning", async () => {
    const root = await temporaryRoot();
    const source = path.join(root, "note.md");
    const linked = path.join(root, "actual.png");
    await writeFile(source, "# note\n", "utf8");
    await writeFile(linked, "png", "utf8");
    const runTask = vi.fn();
    const client = new DocWenClient(machine(vi.fn().mockResolvedValue(inspection(source)), runTask));

    await expect(client.convert({
      inputs: [
        { ...sourceInput(source), logicalPath: "notes/../note.md" },
        { path: linked, kind: "resource", role: "linked_resource", logicalPath: "notes/../note.md", mediaType: "image/png" },
      ],
      outputPath: path.join(root, "note.docx"),
      target: "docx",
    })).rejects.toMatchObject({ code: "cli_input_invalid" });

    await expect(client.convert({
      inputs: [
        sourceInput(source),
        ...Array.from({ length: INPUT_HANDLE_LIMITS.count }, (_, index) => ({
          path: linked,
          kind: "resource" as const,
          role: "linked_resource" as const,
          logicalPath: `assets/linked-${index}.png`,
          mediaType: "image/png",
        })),
      ],
      outputPath: path.join(root, "note.docx"),
      target: "docx",
    })).rejects.toMatchObject({ code: "cli_input_invalid" });
    expect(runTask).not.toHaveBeenCalled();
  });

  it("reads the preferred JSON report resource", async () => {
    const root = await temporaryRoot();
    const input = path.join(root, "note.md");
    await writeFile(input, "１ note\n", "utf8");
    const query = vi.fn().mockResolvedValue(inspection(input));
    const runTask = vi.fn().mockImplementation(async (request: MachineTaskRequest) => {
      const reportPath = path.join(request.output.staging_root.path, "report.json");
      const reportBytes = Buffer.from(JSON.stringify({
        schema: "docwen.proofread_report.v2",
        file: "note.md",
        source: {
          content_sha256: request.inputs[0]!.sha256,
          encoding: "utf-8",
          decode_errors: "replace",
        },
        location_contract: {
          id: "docwen.proofread-text-range",
          version: 1,
          coordinate_system: "unicode_code_point",
          offset_base: 0,
          line_base: 0,
          column_base: 0,
          range_end: "exclusive",
        },
        checks_enabled: {
          symbol_pairing: false,
          symbol_correction: true,
          typos_rule: false,
          sensitive_word: false,
        },
        issues: [{
          range: {
            start: { offset: 0, line: 0, column: 0 },
            end: { offset: 1, line: 0, column: 1 },
          },
          matched_text: "１",
          error_text: "１",
          suggestion: "1",
          error_type: "Fullwidth symbol",
          source: "symbol",
          rule_key: "symbol_correct",
        }],
        summary: { symbol_correct: 1 },
      }), "utf8");
      await writeFile(reportPath, reportBytes);
      return {
        taskId: "task.1",
        plan: {},
        bundle: bundleFor("task.1", reportPath, "application/json", "resource", reportBytes),
        diagnostics: [],
        metrics: {},
      };
    });
    const client = new DocWenClient(machine(query, runTask));

    const report = await client.validate(input, ["symbol"]);
    expect(report).toMatchObject({
      file: "note.md",
      issues: [{
        range: { start: { line: 0, column: 0 }, end: { line: 0, column: 1 } },
        error_text: "１",
        rule_key: "symbol_correct",
      }],
    });
    expect(runTask.mock.calls[0]![0].options).toEqual({
      enable_symbol_pairing: false,
      enable_symbol_correction: true,
      enable_typos_rule: false,
      enable_sensitive_word: false,
    });
  });

  it("rejects the removed proofread report 1.x projection", async () => {
    const root = await temporaryRoot();
    const input = path.join(root, "note.md");
    await writeFile(input, "１ note\n", "utf8");
    const query = vi.fn().mockResolvedValue(inspection(input));
    const runTask = vi.fn().mockImplementation(async (request: MachineTaskRequest) => {
      const reportPath = path.join(request.output.staging_root.path, "report.json");
      const reportBytes = Buffer.from(JSON.stringify({
        schema: "docwen.proofread_report.v1",
        file: "note.md",
        source: { content_sha256: request.inputs[0]!.sha256, encoding: "utf-8", decode_errors: "replace" },
        location_contract: {
          id: "docwen.proofread-text-range",
          version: 1,
          coordinate_system: "unicode_code_point",
          offset_base: 0,
          line_base: 0,
          column_base: 0,
          range_end: "exclusive",
        },
        checks_enabled: {
          symbol_pairing: false,
          symbol_correction: true,
          typos_rule: false,
          sensitive_word: false,
        },
        issues: [{ line: 1, col_start: 1, col_end: 1, matched_text: "１" }],
        summary: { symbol_correct: 1 },
      }), "utf8");
      await writeFile(reportPath, reportBytes);
      return {
        taskId: "task.1",
        plan: {},
        bundle: bundleFor("task.1", reportPath, "application/json", "resource", reportBytes),
        diagnostics: [],
        metrics: {},
      };
    });
    const client = new DocWenClient(machine(query, runTask));

    await expect(client.validate(input, ["symbol"])).rejects.toMatchObject({ code: "cli_invalid_envelope" });
  });

  it("rejects an oversized proofreading report before reading it into memory", async () => {
    const root = await temporaryRoot();
    const input = path.join(root, "note.md");
    await writeFile(input, "# note\n", "utf8");
    const query = vi.fn().mockResolvedValue(inspection(input));
    const runTask = vi.fn().mockImplementation(async (request: MachineTaskRequest) => {
      const reportPath = path.join(request.output.staging_root.path, "report.json");
      await writeFile(reportPath, "{}", "utf8");
      const reportBundle = bundleFor("task.1", reportPath, "application/json", "resource");
      reportBundle.artifacts[0]!.size_bytes = PROOFREAD_REPORT_LIMIT_BYTES + 1;
      return {
        taskId: "task.1",
        plan: {},
        bundle: reportBundle,
        diagnostics: [],
        metrics: {},
      };
    });
    const client = new DocWenClient(machine(query, runTask));

    await expect(client.validate(input, ["symbol"])).rejects.toMatchObject({ code: "cli_output_limit" });
  });

  it("maps numbering to the dedicated transform capability", async () => {
    const root = await temporaryRoot();
    const input = path.join(root, "note.md");
    const output = path.join(root, "numbered.md");
    await writeFile(input, "# note\n", "utf8");
    const runTask = vi.fn().mockImplementation(async (request: MachineTaskRequest) => {
      const artifactPath = path.join(request.output.staging_root.path, "note.md");
      await writeFile(artifactPath, "fixture", "utf8");
      return {
        taskId: "task.1",
        plan: {},
        bundle: bundleFor("task.1", artifactPath, "text/markdown"),
        diagnostics: [],
        metrics: {},
      };
    });
    const client = new DocWenClient(machine(vi.fn(), runTask));

    await client.numberMarkdown(input, output, "add", "gongwen_standard");
    expect(runTask.mock.calls[0]![0]).toMatchObject({
      capability_id: "transform.markdown.heading_numbering",
      options: { remove_numbering: true, add_numbering: true, numbering_scheme: "gongwen_standard" },
    });
  });

  it("revalidates staged bytes and leaves no output when the validated source changes", async () => {
    const staging = await temporaryRoot();
    const destination = await temporaryRoot();
    const artifactPath = path.join(staging, "note.docx");
    const outputPath = path.join(destination, "note.docx");
    await writeFile(artifactPath, "fixture", "utf8");
    const validated = bundleFor(
      "task.1",
      artifactPath,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    await writeFile(artifactPath, "tampered", "utf8");

    await expect(atomicCommitBundle(validated, outputPath, false)).rejects.toMatchObject({
      code: "cli_commit_failed",
    });
    await expect(lstat(outputPath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await transactionResidue(destination)).toEqual([]);
  });

  it("overwrites only the explicitly selected primary and never clobbers a related artifact", async () => {
    const staging = await temporaryRoot();
    const destination = await temporaryRoot();
    const primaryPath = path.join(staging, "note.docx");
    const relatedPath = path.join(staging, "image.png");
    const outputPath = path.join(destination, "result.docx");
    const relatedOutput = path.join(destination, "image.png");
    const primaryBytes = Buffer.from("new-primary", "utf8");
    const relatedBytes = Buffer.from("new-related", "utf8");
    await writeFile(primaryPath, primaryBytes);
    await writeFile(relatedPath, relatedBytes);
    await writeFile(outputPath, "old-primary", "utf8");
    await writeFile(relatedOutput, "keep-related", "utf8");
    const validated = bundleWithRelated(primaryPath, primaryBytes, relatedPath, relatedBytes);

    await expect(atomicCommitBundle(validated, outputPath, false)).rejects.toMatchObject({
      code: "cli_commit_failed",
    });
    expect(await readFile(outputPath, "utf8")).toBe("old-primary");
    expect(await readFile(relatedOutput, "utf8")).toBe("keep-related");

    await expect(atomicCommitBundle(validated, outputPath, true)).rejects.toMatchObject({
      code: "cli_commit_failed",
    });
    expect(await readFile(outputPath, "utf8")).toBe("old-primary");
    expect(await readFile(relatedOutput, "utf8")).toBe("keep-related");
    expect(await transactionResidue(destination)).toEqual([]);

    await rm(relatedOutput);
    await expect(atomicCommitBundle(validated, outputPath, true)).resolves.toEqual([outputPath, relatedOutput]);
    expect(await readFile(outputPath)).toEqual(primaryBytes);
    expect(await readFile(relatedOutput)).toEqual(relatedBytes);
    expect(await transactionResidue(destination)).toEqual([]);
  });

  it("refuses directory and supported symlink targets without moving or deleting them", async () => {
    const staging = await temporaryRoot();
    const destination = await temporaryRoot();
    const artifactPath = path.join(staging, "note.docx");
    const bytes = Buffer.from("fixture", "utf8");
    await writeFile(artifactPath, bytes);
    const validated = bundleFor(
      "task.1",
      artifactPath,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    const directoryTarget = path.join(destination, "directory.docx");
    await mkdir(directoryTarget);

    await expect(atomicCommitBundle(validated, directoryTarget, true)).rejects.toMatchObject({
      code: "cli_commit_failed",
    });
    expect((await lstat(directoryTarget)).isDirectory()).toBe(true);

    const symlinkTarget = path.join(destination, "linked.docx");
    try {
      await symlink(artifactPath, symlinkTarget, "file");
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
      if (["EACCES", "EPERM", "ENOSYS", "ENOTSUP"].includes(String(code))) return;
      throw error;
    }
    await expect(atomicCommitBundle(validated, symlinkTarget, true)).rejects.toMatchObject({
      code: "cli_commit_failed",
    });
    expect((await lstat(symlinkTarget)).isSymbolicLink()).toBe(true);
    expect(await readFile(artifactPath)).toEqual(bytes);
    expect(await transactionResidue(destination)).toEqual([]);
  });
});

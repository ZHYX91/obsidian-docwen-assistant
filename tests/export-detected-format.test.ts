import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExportActions } from "../src/actions/export-actions";
import { DocWenCapabilityService } from "../src/docwen/capability-service";
import type { ConvertRequest, FileInspection, TaskInput } from "../src/docwen/client";
import type { MachineCapability } from "../src/docwen/machine-client";
import { DEFAULT_SETTINGS } from "../src/settings-model";

const ui = vi.hoisted(() => ({ confirm: vi.fn(), review: vi.fn(), commit: vi.fn() }));
vi.mock("obsidian", () => ({ TFile: class TFile {}, MarkdownView: class MarkdownView {}, Modal: class Modal {}, SuggestModal: class SuggestModal {} }));
vi.mock("../src/host/notices", () => ({ showNotice: vi.fn() }));
vi.mock("../src/host/confirm", () => ({ confirmDetectedFormat: ui.confirm }));
vi.mock("../src/host/export-review", () => ({ confirmExport: ui.review }));
vi.mock("../src/host/vault-files", () => ({ resolveAbsoluteFilePath: () => "/vault/source.txt" }));
vi.mock("../src/host/electron-dialogs", () => ({
  getElectronOpenDialog: () => ({ showOpenDialog: async () => ({ canceled: false, filePaths: ["/output"] }) }),
}));
vi.mock("../src/host/export-target-snapshot", () => ({
  captureExportTarget: async () => ({ publish: async (_root: string, commit: () => Promise<unknown>) => commit() }),
}));

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF = "application/pdf";
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function machineCapability(mediaType: string, kind: "document" | "resource"): MachineCapability {
  return {
    capability_id: "convert.detected.to_markdown", operation: "convert",
    input_shape: {
      slots: [{ role: "source", kind, media_types: [mediaType], min_items: 1, max_items: 1 }],
      undeclared_roles: "reject",
    },
    output_media_types: ["text/markdown"],
    output_shape: { cardinality: "one", artifact_kinds: ["document"], relation_types: [], atomic_bundle: true },
    options_schema: { type: "object", properties: { use_detected_format: { type: "boolean" } }, additionalProperties: false },
    availability: "available", dependencies: [], limitations: [],
  };
}

async function fixture(extension = "txt", detectedMedia = DOCX, kind: "document" | "resource" = "document") {
  // This is a complete minimal OOXML package, not text relabelled as DOCX.
  const bytes = detectedMedia === DOCX
    ? await readFile(new URL("./fixtures/detected-format.docx", import.meta.url))
    : Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");
  const file = { path: `Detected-format.${extension}`, name: `Detected-format.${extension}`, extension };
  let currentFile = file;
  let currentBytes = bytes;
  const app = {
    workspace: { getLeavesOfType: () => [] },
    vault: {
      getFileByPath: (requested: string) => requested === file.path ? currentFile : null,
      readBinary: async () => Uint8Array.from(currentBytes).buffer,
    },
  };
  const captured: TaskInput[] = [];
  const inspections: FileInspection[] = [];
  const inspect = vi.fn(async (source: TaskInput) => {
    const isolated = await readFile(source.path);
    expect(isolated).toEqual(currentBytes);
    captured.push(source);
    const inspection: FileInspection = {
      filePath: source.path, contentSha256: digest(isolated), sizeBytes: isolated.length,
      decision: "require_explicit_acceptance", supportedActions: ["convert"], declaredFormat: extension,
      detectedFormat: detectedMedia === DOCX ? "docx" : "pdf", workflowCategory: "document",
      warningCode: "", reasonCode: "extension_mismatch", mediaType: detectedMedia,
    };
    inspections.push(inspection);
    return inspection;
  });
  const convert = vi.fn(async (request: ConvertRequest) => {
    expect(request.inputs).toEqual([request.sourceInput]);
    expect(await readFile(request.inputs[0].path)).toEqual(bytes);
    await request.publish!("/output/result", async (assertIdentity) => {
      expect(assertIdentity).toBeTypeOf("function");
      assertIdentity!();
      ui.commit();
    });
    return { output: "/output/result/result.md", warnings: [] };
  });
  const client = {
    inspect, convert,
    runtimeCapabilities: async () => ({ contractId: "docwen.machine.v2", capabilities: [machineCapability(detectedMedia, kind)] }),
  };
  const capabilities = new DocWenCapabilityService(client as never);
  const controller = new AbortController();
  const runner = {
    run: async (_key: unknown, _notice: string, action: (lease: unknown) => Promise<void>) =>
      action({ signal: controller.signal, isCurrent: () => !controller.signal.aborted }),
    presentWarnings: vi.fn(), presentCompletion: vi.fn(),
  };
  const actions = new ExportActions(app as never, client as never, capabilities, () => DEFAULT_SETTINGS, runner as never);
  return {
    run: () => actions.toMarkdown(file as never), convert, inspect, captured, inspections, controller,
    replaceIdentity: () => { currentFile = { ...file }; },
    changeBytes: () => { currentBytes = Buffer.from("changed source"); },
  };
}

describe("accepted detected-format exports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ui.confirm.mockResolvedValue(true);
    ui.review.mockResolvedValue(true);
  });

  it("cancels a real DOCX named .txt without starting review, conversion or publication", async () => {
    const test = await fixture();
    ui.confirm.mockResolvedValue(false);
    await test.run();
    expect(ui.confirm).toHaveBeenCalledOnce();
    expect(ui.review).not.toHaveBeenCalled();
    expect(test.convert).not.toHaveBeenCalled();
    expect(ui.commit).not.toHaveBeenCalled();
  });

  it.each([
    ["txt", DOCX, "document"],
    ["xlsx", DOCX, "document"],
    ["docx", PDF, "resource"],
  ] as const)("binds %s to accepted %s media and %s kind in the request only", async (extension, mediaType, kind) => {
    const test = await fixture(extension, mediaType, kind);
    await test.run();
    expect(ui.review).toHaveBeenCalledOnce();
    expect(test.convert).toHaveBeenCalledOnce();
    expect(ui.commit).toHaveBeenCalledOnce();
    const request = test.convert.mock.calls[0][0];
    const captured = test.captured[1];
    expect(request.sourceInput).toEqual({ ...captured, kind, mediaType });
    expect(request.sourceInput).not.toBe(captured);
    expect(request.useDetectedFormat).toBe(true);
    expect(request.sourceInput?.logicalPath).toBe(`Detected-format.${extension}`);
    if (extension === "txt") expect(captured.mediaType).toBe("text/plain");
    if (extension === "xlsx") expect(captured.kind).toBe("resource");
    if (extension === "docx") expect(captured.kind).toBe("document");
  });

  it.each(["path", "digest", "decision", "slot"])("rejects an inspection whose %s no longer matches the accepted binding", async (changed) => {
    const test = await fixture();
    ui.confirm.mockImplementation(async () => {
      const inspection = test.inspections[1];
      if (changed === "path") inspection.filePath = "another-snapshot.txt";
      if (changed === "digest") inspection.contentSha256 = "0".repeat(64);
      if (changed === "decision") inspection.decision = "allow";
      if (changed === "slot") inspection.mediaType = PDF;
      return true;
    });
    await expect(test.run()).rejects.toMatchObject({ code: "cli_input_invalid" });
    expect(ui.review).not.toHaveBeenCalled();
    expect(test.convert).not.toHaveBeenCalled();
    expect(ui.commit).not.toHaveBeenCalled();
  });

  it.each(["identity", "bytes"])("preserves publication refusal after source %s changes during confirmation", async (changed) => {
    const test = await fixture();
    ui.confirm.mockImplementation(async () => {
      if (changed === "identity") test.replaceIdentity();
      else test.changeBytes();
      return true;
    });
    await expect(test.run()).rejects.toMatchObject({ code: changed === "identity" ? "vault_target_changed" : "vault_content_conflict" });
    expect(ui.commit).not.toHaveBeenCalled();
  });

  it("does not project detected metadata without explicit acceptance", async () => {
    const test = await fixture();
    test.inspect.mockImplementation(async (source) => ({
      filePath: source.path, contentSha256: digest(await readFile(source.path)), sizeBytes: 890,
      declaredFormat: "txt", warningCode: "", reasonCode: "",
      decision: "allow", mediaType: DOCX, supportedActions: ["convert"], workflowCategory: "document", detectedFormat: "docx",
    }));
    await expect(test.run()).rejects.toMatchObject({ code: "cli_input_invalid" });
    expect(ui.confirm).not.toHaveBeenCalled();
    expect(test.convert).not.toHaveBeenCalled();
  });

  it("ignores Continue returned after the operation was cancelled", async () => {
    const test = await fixture();
    ui.confirm.mockImplementation(async () => {
      test.controller.abort();
      return true;
    });
    await expect(test.run()).rejects.toMatchObject({ name: "AbortError" });
    expect(ui.review).not.toHaveBeenCalled();
    expect(test.convert).not.toHaveBeenCalled();
    expect(ui.commit).not.toHaveBeenCalled();
  });
});

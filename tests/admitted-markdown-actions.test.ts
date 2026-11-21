import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NumberingActions } from "../src/actions/numbering-actions";
import { ProofreadActions } from "../src/actions/proofread-actions";
import { DocWenCapabilityService } from "../src/docwen/capability-service";
import type { FileInspection, TaskInput } from "../src/docwen/client";
import { DEFAULT_SETTINGS } from "../src/settings-model";

const confirm = vi.hoisted(() => vi.fn());
vi.mock("obsidian", () => ({ TFile: class {}, ItemView: class {}, MarkdownView: class {}, Modal: class {}, SuggestModal: class {} }));
vi.mock("../src/host/confirm", () => ({ confirmDetectedFormat: confirm }));
vi.mock("../src/host/notices", () => ({ showNotice: vi.fn() }));

const text = "# 1. Heading\n";
const cleaned = "# Heading\n";
const hash = (data: Buffer) => createHash("sha256").update(data).digest("hex");

function fixture(extension: string, bytes = Buffer.from(text)) {
  const file = { path: "Notes/Source." + extension, name: "Source." + extension, extension };
  let disk: Buffer = bytes;
  const process = vi.fn(async (_file, update: (current: string) => string) => {
    const result = update(disk.toString("utf8"));
    disk = Buffer.from(result);
    return result;
  });
  const app = {
    workspace: { getLeavesOfType: () => [], getActiveFile: () => file },
    vault: { getFileByPath: () => file, read: async () => disk.toString("utf8"),
      readBinary: async () => Uint8Array.from(disk).buffer, process },
  };
  const inspect = vi.fn(async (input: string | TaskInput): Promise<FileInspection> => {
    const path = typeof input === "string" ? input : input.path;
    const contents = await readFile(path);
    const suffix = extname(path);
    const canonical = suffix === ".md" || suffix === ".markdown";
    return {
      filePath: path, sizeBytes: contents.length, contentSha256: hash(contents),
      decision: canonical ? "allow" : suffix === ".txt" ? "allow_with_warning" : "require_explicit_acceptance",
      declaredFormat: canonical ? "markdown" : suffix.slice(1), detectedFormat: "markdown", workflowCategory: "markdown",
      warningCode: suffix === ".txt" ? "FILE_FORMAT_COMPATIBLE_TEXT" : "", reasonCode: "", mediaType: "text/markdown",
      supportedActions: ["validate", "number markdown"],
    };
  });
  const capabilities = ["validate.markdown", "transform.markdown.heading_numbering"].map((id) => ({
    capability_id: id, operation: id.startsWith("validate") ? "validate" : "transform", availability: "available",
    input_shape: { slots: [{ role: "source", kind: "document", media_types: ["text/markdown"], min_items: 1, max_items: 1 }] },
    options_schema: { properties: {} }, output_media_types: ["text/markdown"],
  }));
  const validate = vi.fn(async (input: TaskInput) => {
    expect(input.mediaType).toBe("text/markdown");
    expect(await readFile(input.path)).toEqual(bytes);
    return { issues: [], warnings: [] };
  });
  const numberMarkdown = vi.fn(async (input: string, output: string) => {
    const content = await readFile(input, "utf8");
    await writeFile(output, content.replace("# 1. Heading", cleaned.trimEnd()));
    return { diagnostics: [], warnings: [] };
  });
  const client = { inspect, validate, numberMarkdown, runtimeCapabilities: async () => ({ capabilities }) };
  const service = new DocWenCapabilityService(client as never);
  const runner = {
    run: async (_key: unknown, _notice: unknown, work: (lease: unknown) => Promise<unknown>) =>
      work({ signal: new AbortController().signal, isCurrent: () => true }),
    presentCompletion: vi.fn(), presentWarnings: vi.fn(),
  };
  const view = { captureLifetime: () => () => true, ownOperation: () => () => true, updateResults: vi.fn() };
  return {
    process, numberMarkdown, validate, inspect, current: () => disk, replaceDisk: (value: Buffer) => { disk = value; }, view,
    proofread: () => new ProofreadActions(app as never, client as never, service, () => DEFAULT_SETTINGS, runner as never, vi.fn()).run(file as never, view as never),
    number: () => new NumberingActions(app as never, client as never, service, runner as never).remove(file as never),
  };
}

describe("Markdown edit and proofreading sources", () => {
  beforeEach(() => { confirm.mockReset().mockResolvedValue(true); });
  it("proofreads a compatible text file using verified Markdown bytes", async () => {
    const state = fixture("txt");
    await state.proofread();
    expect(state.validate).toHaveBeenCalledOnce();
    expect(state.view.updateResults).toHaveBeenCalledOnce();
    expect(confirm).not.toHaveBeenCalled();
  });
  it.each(["proofread", "number"] as const)("honors declining a cross-family %s action", async action => {
    const state = fixture("docx");
    confirm.mockResolvedValue(false);
    await state[action]().catch(error => { if (error.name !== "AbortError") throw error; });
    expect(confirm).toHaveBeenCalledOnce();
    expect(state.process).not.toHaveBeenCalled();
    expect(state.numberMarkdown).not.toHaveBeenCalled();
    expect(state.validate).not.toHaveBeenCalled();
    expect(state.current()).toEqual(Buffer.from(text));
  });
  it("accepts cross-family numbering only after inspecting the original suffix and the canonical copy", async () => {
    const state = fixture("docx");
    await state.number();
    expect(confirm.mock.calls[0][2]).toMatchObject({ sourceName: "Notes/Source.docx", changesHeadings: true });
    expect(state.inspect.mock.calls.map(([input]) => extname(typeof input === "string" ? input : input.path))).toEqual([".docx", ".markdown"]);
    expect(state.current().toString()).toBe(cleaned);
  });
  it("preserves valid replacement characters and a UTF-8 BOM", async () => {
    const state = fixture("md", Buffer.from("\uFEFF" + text + "\uFFFD"));
    await state.number();
    expect(state.current()).toEqual(Buffer.from("\uFEFF" + cleaned + "\uFFFD"));
  });
  it("keeps a concurrent byte edit even when Vault.process would decode it as the original text", async () => {
    const original = Buffer.from(text + "\uFFFD");
    const changed = Buffer.concat([Buffer.from(text), Buffer.from([0xff])]);
    const state = fixture("md", original);
    state.numberMarkdown.mockImplementationOnce(async (_input, output) => {
      await writeFile(output, cleaned);
      state.replaceDisk(changed);
      return { diagnostics: [], warnings: [] };
    });
    await expect(state.number()).rejects.toMatchObject({ code: "vault_content_conflict" });
    expect(state.current()).toEqual(changed);
    expect(state.process).not.toHaveBeenCalled();
  });
  it("refuses invalid UTF-8 without rewriting replacement characters into a closed note", async () => {
    const bytes = Buffer.concat([Buffer.from(text), Buffer.from([0xff])]);
    const state = fixture("md", bytes);
    await expect(state.number()).rejects.toMatchObject({ code: "vault_input_invalid" });
    expect(state.current()).toEqual(bytes);
    expect(state.process).not.toHaveBeenCalled();
  });
});

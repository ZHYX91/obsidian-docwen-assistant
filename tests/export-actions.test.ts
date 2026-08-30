import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  notices: [] as string[],
  pickerItems: [] as Array<{ id: string }>,
}));

vi.mock("obsidian", () => ({ TFile: class TFile {} }));
vi.mock("../src/i18n", () => ({
  t: (key: string, values?: { count?: string; filename?: string }) => {
    if (values?.filename) return `${key}:${values.filename}`;
    if (values?.count) return `${key}:${values.count}`;
    return key;
  },
}));
vi.mock("../src/host/notices", () => ({ showNotice: (message: string) => state.notices.push(message) }));
vi.mock("../src/host/file-system", () => ({ pathExists: () => false }));
vi.mock("../src/host/vault-files", () => ({ resolveAbsoluteFilePath: () => "D:\\Vault\\note.bin" }));
vi.mock("../src/host/confirm", () => ({ confirmDetectedFormat: vi.fn().mockResolvedValue(true) }));
vi.mock("../src/host/electron-dialogs", () => ({
  getElectronSaveDialog: () => ({
    showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: "D:\\Vault\\note.docx" }),
  }),
}));
vi.mock("../src/host/vault-read-snapshot", () => ({
  VaultReadSnapshot: class VaultReadSnapshot {
    async run<T>(
      _file: unknown,
      _signal: AbortSignal,
      work: (snapshot: {
        inputPath: string;
        contentSha256: string;
        sourceInput: unknown;
        inputs: unknown[];
        resolvedMarkdownInputs: unknown[];
      }) => Promise<T>,
    ): Promise<T> {
      const sourceInput = {
        path: "D:\\Temp\\input.bin",
        kind: "document",
        role: "source",
        logicalPath: "note.md",
        mediaType: "text/markdown",
      };
      return work({
        inputPath: "D:\\Temp\\input.bin",
        contentSha256: "sha",
        sourceInput,
        inputs: [sourceInput],
        resolvedMarkdownInputs: [
          {
            path: "D:\\Temp\\resolved-document.json",
            kind: "document",
            role: "neutral_document",
            logicalPath: "resolved-document.json",
            mediaType: "application/vnd.docwen.resolved-document+json",
          },
          {
            path: "D:\\Temp\\numbering-export-plan.json",
            kind: "resource",
            role: "numbering_export_plan",
            logicalPath: "numbering-export-plan.json",
            mediaType: "application/vnd.docwen.numbering-export-plan+json",
          },
        ],
      });
    }
  },
}));
vi.mock("../src/utils/suggest-modal", () => ({
  ItemPickerModal: class ItemPickerModal {
    constructor(_app: unknown, items: Array<{ id: string }>) {
      state.pickerItems = items;
    }
    open(): void {}
  },
}));

describe("ExportActions optimization discovery", () => {
  beforeEach(() => {
    resetState();
  });

  it("does not query optimization resources when Core advertises no action route", async () => {
    const { ExportActions } = await import("../src/actions/export-actions");
    const signal = new AbortController().signal;
    const runner = {
      run: async (_key: string, _message: string, action: (context: unknown) => Promise<void>) =>
        action({ signal, isCurrent: () => true }),
      presentFailure: vi.fn(),
    };
    const capability = {
      inspection: { decision: "allow" },
      source: { id: "binary", category: "binary", routes: [] },
    };
    const capabilities = {
      requireAction: vi.fn().mockResolvedValue(capability),
      requireConversionRoute: vi.fn().mockReturnValue({ options: [] }),
      requireTaskInputs: vi.fn(),
      optimizationActionIds: vi.fn().mockReturnValue([]),
      findApplicableOptimizations: vi.fn().mockReturnValue([]),
      requiresDetectedFormatAcceptance: vi.fn().mockReturnValue(false),
    };
    const docwen = {
      optimizations: vi.fn(),
      convert: vi.fn().mockResolvedValue({ output: "D:\\Vault\\note.docx", outputs: [], bundleId: "bundle.1" }),
    };
    const actions = new ExportActions(
      {} as never,
      docwen as never,
      capabilities as never,
      () => ({} as never),
      runner as never,
    );

    await actions.toDocx({ path: "note.bin", name: "note.bin" } as never);

    expect(docwen.optimizations).not.toHaveBeenCalled();
    expect(docwen.convert).toHaveBeenCalledOnce();
    expect(state.notices).toEqual(["noticeExportSuccess:note.docx"]);
  });

  it("offers only resources returned by the exact route-action to resource-id join", async () => {
    const { ExportActions } = await import("../src/actions/export-actions");
    const signal = new AbortController().signal;
    const runner = {
      run: async (_key: string, _message: string, action: (context: unknown) => Promise<void>) =>
        action({ signal, isCurrent: () => true }),
      presentFailure: vi.fn(),
    };
    const joined = { id: "gongwen", name: "Gongwen", scopes: ["opaque"] };
    const capability = {
      inspection: { decision: "allow" },
      source: { id: "docx", category: "document", routes: [] },
    };
    const capabilities = {
      requireAction: vi.fn().mockResolvedValue(capability),
      requireConversionRoute: vi.fn().mockReturnValue({ options: [] }),
      requireTaskInputs: vi.fn(),
      optimizationActionIds: vi.fn().mockReturnValue(["gongwen"]),
      findApplicableOptimizations: vi.fn().mockReturnValue([joined]),
    };
    const docwen = {
      optimizations: vi.fn().mockResolvedValue([
        joined,
        { id: "unrelated", name: "Unrelated", scopes: [] },
      ]),
    };
    const actions = new ExportActions(
      {} as never,
      docwen as never,
      capabilities as never,
      () => ({} as never),
      runner as never,
    );

    await actions.toMarkdown({ path: "note.docx", name: "note.docx" } as never);

    expect(docwen.optimizations).toHaveBeenCalledWith(signal);
    expect(capabilities.findApplicableOptimizations).toHaveBeenCalledWith(
      capability,
      [joined, { id: "unrelated", name: "Unrelated", scopes: [] }],
      "md",
    );
    expect(state.pickerItems.map((item) => item.id)).toEqual(["__none__", "gongwen"]);
  });
});

describe("ExportActions advisory proofreading", () => {
  beforeEach(() => {
    resetState();
  });

  it("shows the proofreading result and converts without route-unsupported check options", async () => {
    const { ExportActions } = await import("../src/actions/export-actions");
    const signal = new AbortController().signal;
    const runner = advisoryRunner(signal);
    const capability = markdownCapability();
    const capabilities = advisoryCapabilities(capability);
    const docwen = {
      optimizations: vi.fn(),
      validate: vi.fn().mockResolvedValue({ issues: [{ message: "typo" }] }),
      convert: vi.fn().mockResolvedValue({ output: "D:\\Vault\\note.docx", outputs: [], bundleId: "bundle.1" }),
    };
    const actions = new ExportActions(
      {} as never,
      docwen as never,
      capabilities as never,
      () => markdownSettings(true) as never,
      runner as never,
    );

    await actions.toDocx({ path: "note.md", name: "note.md" } as never);

    expect(capabilities.requireAction).toHaveBeenCalledWith(
      "D:\\Temp\\input.bin",
      "validate",
      signal,
    );
    expect(docwen.validate).toHaveBeenCalledWith(
      expect.objectContaining({ path: "D:\\Temp\\input.bin", logicalPath: "note.md", role: "source" }),
      ["all"],
      signal,
    );
    expect(docwen.validate.mock.invocationCallOrder[0]).toBeLessThan(
      docwen.convert.mock.invocationCallOrder[0],
    );
    expect(docwen.convert.mock.calls[0][0]).not.toHaveProperty("checks");
    expect(state.notices).toEqual([
      "noticeProofreadSuccess:1",
      "noticeExportSuccess:note.docx",
    ]);
    expect(runner.presentFailure).not.toHaveBeenCalled();
  });

  it("warns when proofreading fails and still performs the conversion", async () => {
    const { ExportActions } = await import("../src/actions/export-actions");
    const signal = new AbortController().signal;
    const runner = advisoryRunner(signal);
    const capability = markdownCapability();
    const capabilities = advisoryCapabilities(capability);
    const proofreadError = new Error("proofread unavailable");
    const docwen = {
      optimizations: vi.fn(),
      validate: vi.fn().mockRejectedValue(proofreadError),
      convert: vi.fn().mockResolvedValue({ output: "D:\\Vault\\note.docx", outputs: [], bundleId: "bundle.1" }),
    };
    const actions = new ExportActions(
      {} as never,
      docwen as never,
      capabilities as never,
      () => markdownSettings(true) as never,
      runner as never,
    );

    await actions.toDocx({ path: "note.md", name: "note.md" } as never);

    expect(runner.presentFailure).toHaveBeenCalledWith("noticeProofreadFailed", proofreadError);
    expect(docwen.convert).toHaveBeenCalledOnce();
    expect(docwen.convert.mock.calls[0][0]).not.toHaveProperty("checks");
    expect(state.notices).toEqual(["noticeExportSuccess:note.docx"]);
  });

  it("does not invoke proofreading when the user disables the advisory", async () => {
    const { ExportActions } = await import("../src/actions/export-actions");
    const signal = new AbortController().signal;
    const runner = advisoryRunner(signal);
    const capability = markdownCapability();
    const capabilities = advisoryCapabilities(capability);
    const docwen = {
      optimizations: vi.fn(),
      validate: vi.fn(),
      convert: vi.fn().mockResolvedValue({ output: "D:\\Vault\\note.docx", outputs: [], bundleId: "bundle.1" }),
    };
    const actions = new ExportActions(
      {} as never,
      docwen as never,
      capabilities as never,
      () => markdownSettings(false) as never,
      runner as never,
    );

    await actions.toDocx({ path: "note.md", name: "note.md" } as never);

    expect(docwen.validate).not.toHaveBeenCalled();
    expect(docwen.convert).toHaveBeenCalledOnce();
    expect(docwen.convert.mock.calls[0][0]).not.toHaveProperty("checks");
  });

  it("honors explicit cancellation during advisory proofreading", async () => {
    const { ExportActions } = await import("../src/actions/export-actions");
    const signal = new AbortController().signal;
    const runner = advisoryRunner(signal);
    const capability = markdownCapability();
    const capabilities = advisoryCapabilities(capability);
    const docwen = {
      optimizations: vi.fn(),
      validate: vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError")),
      convert: vi.fn(),
    };
    const actions = new ExportActions(
      {} as never,
      docwen as never,
      capabilities as never,
      () => markdownSettings(true) as never,
      runner as never,
    );

    await expect(actions.toDocx({ path: "note.md", name: "note.md" } as never)).rejects.toThrow(
      "cancelled",
    );

    expect(docwen.convert).not.toHaveBeenCalled();
    expect(runner.presentFailure).not.toHaveBeenCalled();
  });

  it("delegates the resolved DOCX and sidecar pair to one DocWen conversion", async () => {
    const { ExportActions } = await import("../src/actions/export-actions");
    const signal = new AbortController().signal;
    const runner = advisoryRunner(signal);
    const capability = markdownCapability();
    const capabilities = advisoryCapabilities(capability);
    const docwen = {
      optimizations: vi.fn(),
      validate: vi.fn(),
      convert: vi.fn().mockResolvedValue({
        output: "D:\\Vault\\note.docx",
        outputs: ["D:\\Vault\\note.docx", "D:\\Vault\\note.docx.docwen"],
        bundleId: "bundle.1",
      }),
    };
    const actions = new ExportActions(
      {} as never,
      docwen as never,
      capabilities as never,
      () => markdownSettings(false) as never,
      runner as never,
    );

    await actions.toDocx({ path: "note.md", name: "note.md" } as never);

    expect(docwen.convert).toHaveBeenCalledWith(expect.objectContaining({
      inputs: [
        expect.objectContaining({ role: "neutral_document" }),
        expect.objectContaining({ role: "numbering_export_plan" }),
      ],
      outputPath: resolve("D:\\Vault\\note.docx"),
    }), signal);
    expect(state.notices).toEqual(["noticeExportSuccess:note.docx"]);
    expect(runner.presentFailure).not.toHaveBeenCalled();
  });
});

function resetState(): void {
  state.notices.length = 0;
  state.pickerItems = [];
}

function advisoryRunner(signal: AbortSignal) {
  return {
    run: async (_key: string, _message: string, action: (context: unknown) => Promise<void>) =>
      action({ signal, isCurrent: () => true }),
    presentFailure: vi.fn(),
  };
}

function markdownCapability() {
  return {
    inspection: { decision: "allow" },
    source: { id: "markdown", category: "markdown", routes: [] },
  };
}

function advisoryCapabilities(capability: ReturnType<typeof markdownCapability>) {
  return {
    requireAction: vi.fn().mockResolvedValue(capability),
    requireConversionRoute: vi.fn().mockReturnValue({ options: [] }),
    requireTaskInputs: vi.fn(),
    optimizationActionIds: vi.fn().mockReturnValue([]),
    findApplicableOptimizations: vi.fn().mockReturnValue([]),
    requiresDetectedFormatAcceptance: vi.fn().mockReturnValue(false),
  };
}

function markdownSettings(proofreadOnConvert: boolean) {
  return {
    proofreadOnConvert,
    proofreadTypo: true,
    proofreadSymbol: true,
    proofreadPunct: true,
    proofreadSensitive: true,
    headingMergeMode: "punct_required",
    mdToDocCleanNumbering: "default",
    mdToDocAddNumbering: "default",
    headingNumberingRenderMode: "default",
  };
}

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  notices: [] as string[],
  updateResults: vi.fn(),
}));

vi.mock("obsidian", () => ({ TFile: class TFile {} }));
vi.mock("../src/i18n", () => ({
  t: (key: string, values?: { count?: string }) =>
    values?.count ? `${key}:${values.count}` : key,
}));
vi.mock("../src/host/notices", () => ({
  showNotice: (message: string) => state.notices.push(message),
}));
vi.mock("../src/host/vault-read-snapshot", () => ({
  VaultReadSnapshot: class VaultReadSnapshot {
    async run<T>(
      _file: unknown,
      _signal: AbortSignal,
      work: (snapshot: {
        inputs: Array<{ path: string }>;
        contentSha256: string;
        publish: <U>(commit: () => Promise<U>) => Promise<U>;
      }) => Promise<T>,
    ): Promise<{ value: T; warnings: [] }> {
      return { value: await work({ inputs: [{ path: "D:\\Temp\\source.md" }], contentSha256: "a".repeat(64), publish: async (commit) => commit() }), warnings: [] };
    }
  },
}));
vi.mock("../src/proofread-view", () => ({
  ProofreadView: class ProofreadView {},
  PROOFREAD_VIEW_TYPE: "docwen-proofread-view",
}));

describe("ProofreadActions", () => {
  beforeEach(() => {
    state.notices.length = 0;
    state.updateResults.mockReset();
  });

  it("runs the captured file in the activated view through the shared entry", async () => {
    const { ProofreadActions } = await import("../src/actions/proofread-actions");
    const file = { path: "Selected.md" };
    const view = {};
    const actions = new ProofreadActions({} as never, {} as never, {} as never,
      () => ({} as never), {} as never);
    vi.spyOn(actions, "activateView").mockResolvedValue(view as never);
    const run = vi.spyOn(actions, "run").mockResolvedValue();
    await actions.activateAndRun(file as never);
    expect(run).toHaveBeenCalledWith(file, view);
  });

  it.each([null, { path: "Other.md" }])("refreshes the displayed source despite active file %s", async (activeFile) => {
    const { ProofreadActions } = await import("../src/actions/proofread-actions");
    const file = { name: "Source.md", path: "Notes/Source.md" };
    const getActiveFile = vi.fn().mockReturnValue(activeFile);
    const getFileByPath = vi.fn().mockReturnValue(file);
    const actions = new ProofreadActions(
      { vault: { getFileByPath }, workspace: { getActiveFile } } as never,
      {} as never, {} as never, () => ({} as never), {} as never,
    );
    const run = vi.spyOn(actions, "run").mockResolvedValue();
    await actions.refresh(file.path, {} as never);
    expect(getFileByPath).toHaveBeenCalledWith(file.path);
    expect(run).toHaveBeenCalledWith(file, {});
    expect(getActiveFile).not.toHaveBeenCalled();
  });

  it("does not switch to another active note when the displayed source is missing", async () => {
    const { ProofreadActions } = await import("../src/actions/proofread-actions");
    const getActiveFile = vi.fn().mockReturnValue({ path: "Other.md" });
    const actions = new ProofreadActions(
      { vault: { getFileByPath: () => null }, workspace: { getActiveFile } } as never,
      {} as never, {} as never, () => ({} as never), {} as never,
    );
    const run = vi.spyOn(actions, "run").mockResolvedValue();
    await actions.refresh("Deleted.md", {} as never);
    expect(run).not.toHaveBeenCalled();
    expect(getActiveFile).not.toHaveBeenCalled();
    expect(state.notices).toEqual(["noticeProofreadNoMdFile"]);
  });

  it("uses the active note only when the view has no previous source", async () => {
    const { ProofreadActions } = await import("../src/actions/proofread-actions");
    const file = { path: "First.md" };
    const actions = new ProofreadActions(
      { workspace: { getActiveFile: () => file } } as never,
      {} as never, {} as never, () => ({} as never), {} as never,
    );
    const run = vi.spyOn(actions, "run").mockResolvedValue();
    await actions.refresh("", {} as never);
    expect(run).toHaveBeenCalledWith(file, {});
  });

  it("labels results with the Vault file name instead of the temporary snapshot name", async () => {
    const { ProofreadActions } = await import("../src/actions/proofread-actions");
    const signal = new AbortController().signal;
    const runner = {
      presentCompletion: (summary: string) => state.notices.push(summary),
      presentWarnings: vi.fn(),
      run: async (
        _operation: unknown,
        _failureKey: string,
        action: (context: { signal: AbortSignal; isCurrent: () => boolean }) => Promise<unknown>,
      ) => action({ signal, isCurrent: () => true }),
    };
    const app = {
      workspace: {
        getLeavesOfType: vi.fn().mockReturnValue([{ view: { updateResults: state.updateResults } }]),
      },
    };
    const capabilities = { requireAction: vi.fn().mockResolvedValue({}) };
    const issues = [{ rule_key: "spacing" }];
    const docwen = {
      validate: vi.fn().mockResolvedValue({
        file: "source.md",
        issues, warnings: [],
      }),
    };
    const actions = new ProofreadActions(
      app as never,
      docwen as never,
      capabilities as never,
      () => ({
        proofreadTypo: true,
        proofreadSymbol: true,
        proofreadPunct: true,
        proofreadSensitive: true,
      } as never),
      runner as never,
    );
    const file = { name: "Proofread example.md", path: "Examples/Proofread example.md" };

    await actions.run(file as never, { captureLifetime: () => () => true, ownOperation: () => () => true, updateResults: state.updateResults } as never);

    expect(capabilities.requireAction).toHaveBeenCalledWith(
      expect.objectContaining({ path: "D:\\Temp\\source.md" }),
      "validate",
      signal,
    );
    expect(docwen.validate).toHaveBeenCalledWith(
      expect.objectContaining({ path: "D:\\Temp\\source.md" }),
      ["all"],
      signal,
    );
    expect(state.updateResults).toHaveBeenCalledWith(
      issues,
      "Proofread example.md",
      "Examples/Proofread example.md",
      "a".repeat(64),
    );
    expect(state.notices).toEqual(["noticeProofreadSuccess:1"]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  notices: [] as string[],
  writerRun: vi.fn(),
}));

vi.mock("obsidian", () => ({ TFile: class TFile {} }));
vi.mock("../src/host/notices", () => ({ showNotice: (message: string) => state.notices.push(message) }));
vi.mock("../src/i18n", () => ({
  t: (key: string, values?: { filename?: string }) => values?.filename ? `${key}:${values.filename}` : key,
}));
vi.mock("../src/utils/suggest-modal", () => ({ ItemPickerModal: class ItemPickerModal {} }));
vi.mock("../src/host/vault-write-transaction", () => ({
  VaultWriteTransaction: class VaultWriteTransaction {
    run = state.writerRun;
  },
}));

describe("NumberingActions", () => {
  beforeEach(() => {
    state.notices.length = 0;
    state.writerRun.mockReset();
  });

  it("treats a successful empty scheme list as empty without a fallback", async () => {
    const { NumberingActions } = await import("../src/actions/numbering-actions");
    const runner = {
      run: async (_key: string, _message: string, action: (context: unknown) => Promise<void>) =>
        action({ signal: new AbortController().signal, isCurrent: () => true }),
    };
    const docwen = { numberingSchemes: vi.fn().mockResolvedValue([]) };
    const actions = new NumberingActions({} as never, docwen as never, {} as never, runner as never);

    await actions.add({ path: "note.md", name: "note.md" } as never);

    expect(state.notices).toEqual(["settingsNumberingSchemeError"]);
    expect(state.writerRun).not.toHaveBeenCalled();
  });

  it("uses isolated input/output paths and never asks Core for an in-place Vault write", async () => {
    const { NumberingActions } = await import("../src/actions/numbering-actions");
    const signal = new AbortController().signal;
    const runner = {
      run: async (_key: string, _message: string, action: (context: unknown) => Promise<void>) =>
        action({ signal, isCurrent: () => true }),
    };
    const docwen = { numberMarkdown: vi.fn().mockResolvedValue({}) };
    const capabilities = {
      requireAction: vi.fn().mockResolvedValue({ inspection: { contentSha256: "snapshot-sha" } }),
    };
    state.writerRun.mockImplementation(async (
      _file: unknown,
      transform: (
        input: string,
        output: string,
        sha: string,
        transformSignal: AbortSignal,
      ) => Promise<void>,
      writerSignal: AbortSignal,
    ) => transform("isolated/input.md", "isolated/output.md", "snapshot-sha", writerSignal));
    const actions = new NumberingActions(
      {} as never,
      docwen as never,
      capabilities as never,
      runner as never,
    );

    await actions.remove({ path: "folder/note.md", name: "note.md" } as never);

    expect(capabilities.requireAction).toHaveBeenCalledWith(
      "isolated/input.md",
      "number markdown",
      signal,
    );
    expect(docwen.numberMarkdown).toHaveBeenCalledWith(
      "isolated/input.md",
      "isolated/output.md",
      "remove",
      undefined,
      signal,
      "folder/note.md",
    );
    expect(state.notices).toEqual(["noticeNumberingSuccess:note.md"]);
  });
});

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
      work: (snapshot: { inputs: Array<{ path: string }> }) => Promise<T>,
    ): Promise<T> {
      return work({ inputs: [{ path: "D:\\Temp\\source.md" }] });
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

  it("labels results with the Vault file name instead of the temporary snapshot name", async () => {
    const { ProofreadActions } = await import("../src/actions/proofread-actions");
    const signal = new AbortController().signal;
    const runner = {
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
        issues,
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

    await actions.run(file as never);

    expect(state.updateResults).toHaveBeenCalledWith(
      issues,
      "Proofread example.md",
      "Examples/Proofread example.md",
    );
    expect(state.notices).toEqual(["noticeProofreadSuccess:1"]);
  });
});

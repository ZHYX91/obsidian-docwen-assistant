import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSettingsSnapshot, normalizeSettings } from "../src/settings-model";

const state = vi.hoisted(() => ({
  activeFile: null as null | { path: string },
  cachedCapability: null as null | Error | { inspection: { supportedActions: string[] } },
  cleanup: [] as string[],
  commands: [] as Array<Record<string, unknown>>,
  loadData: async (): Promise<unknown> => ({}),
  operationItems: [] as Array<{ generation: number; kind: string; state: string }>,
  cancelled: [] as number[],
  cancelAllCalls: 0,
  capabilityResetCalls: 0,
  monitorResetCalls: 0,
  savedData: [] as unknown[],
  throwFromRibbon: false,
}));

class FakeElement {
  addClass(): void {}
  setAttribute(): void {}
}

vi.mock("obsidian", () => ({
  Plugin: class Plugin {
    app = {
      workspace: {
        getActiveFile: () => state.activeFile,
        on: () => ({ unload: () => undefined }),
        detachLeavesOfType: () => state.cleanup.push("view"),
      },
      vault: {
        on: () => ({ unload: () => undefined }),
      },
    };
    loadData = () => state.loadData();
    saveData = async (value: unknown) => { state.savedData.push(structuredClone(value)); };
    registerEvent(): void {}
    addRibbonIcon(): FakeElement {
      if (state.throwFromRibbon) throw new Error("ribbon failed");
      return new FakeElement();
    }
    addSettingTab(): void {}
    addStatusBarItem(): FakeElement { return new FakeElement(); }
    registerView(): void {}
    addCommand(command: Record<string, unknown>): Record<string, unknown> {
      state.commands.push(command);
      return command;
    }
  },
  TFile: class TFile {},
}));

vi.mock("../src/settings", () => ({ SettingTab: class SettingTab {} }));
vi.mock("../src/i18n", () => ({ t: (key: string) => key }));
vi.mock("../src/host-language", () => ({
  getDocWenLanguage: () => "en-US",
  initializePluginI18n: () => undefined,
}));
vi.mock("../src/host/vault-files", () => ({
  resolveAbsoluteFilePath: (_vault: unknown, file: { path: string } | null) =>
    file ? `D:\\Vault\\${file.path}` : null,
}));
vi.mock("../src/host/notices", () => ({ showNotice: () => undefined }));
vi.mock("../src/proofread-view", () => ({
  PROOFREAD_VIEW_TYPE: "docwen-proofread",
  ProofreadView: class ProofreadView {},
}));
vi.mock("../src/app/register-file-menu", () => ({ registerFileMenu: () => undefined }));
vi.mock("../src/actions/action-runner", () => ({ ActionRunner: class ActionRunner {} }));
vi.mock("../src/actions/export-actions", () => ({ ExportActions: class ExportActions {} }));
vi.mock("../src/actions/gui-actions", () => ({ GuiActions: class GuiActions {} }));
vi.mock("../src/actions/numbering-actions", () => ({ NumberingActions: class NumberingActions {} }));
vi.mock("../src/actions/proofread-actions", () => ({ ProofreadActions: class ProofreadActions {} }));
vi.mock("../src/docwen", () => ({
  resolveDocWenLaunchTarget: (_mode: string, value: string) => value,
  DocWenMachineClient: class DocWenMachineClient {
    dispose(): void {
      state.cleanup.push("client");
    }
  },
  DocWenClient: class DocWenClient {
    constructor(private readonly client: { dispose: () => void }) {}
    dispose(): void {
      this.client.dispose();
    }
  },
  DocWenCapabilityService: class DocWenCapabilityService {
    preload(): void {}
    peek(): typeof state.cachedCapability {
      return state.cachedCapability;
    }
    findConversionRoute(_capability: unknown, target: string): object | null {
      return target === "docx" ? {} : null;
    }
    reset(): void {
      state.capabilityResetCalls += 1;
      state.cleanup.push("capabilities");
    }
  },
}));
vi.mock("../src/docwen/connection-monitor", () => ({
  DocWenConnectionMonitor: class DocWenConnectionMonitor {
    getStatus(): { state: "unchecked" } { return { state: "unchecked" }; }
    check(): Promise<never> { return Promise.reject(new Error("not configured")); }
    reset(): void { state.monitorResetCalls += 1; }
  },
}));
vi.mock("../src/runtime/operation-coordinator", () => ({
  OperationCoordinator: class OperationCoordinator {
    getSnapshot(): { operations: typeof state.operationItems } {
      return { operations: [...state.operationItems] };
    }
    cancelGeneration(generation: number): void {
      state.cancelled.push(generation);
    }
    cancelAll(): void {
      state.cancelAllCalls += 1;
    }
    dispose(): void {
      state.cleanup.push("operations");
    }
  },
}));
vi.mock("../src/operation-status", () => ({
  OperationStatus: class OperationStatus {
    dispose(): void { state.cleanup.push("status"); }
    refresh(): void {}
  },
}));

describe("DocWenPlugin lifecycle", () => {
  beforeEach(() => {
    state.cleanup.length = 0;
    state.commands.length = 0;
    state.activeFile = null;
    state.cachedCapability = null;
    state.operationItems.length = 0;
    state.cancelled.length = 0;
    state.cancelAllCalls = 0;
    state.capabilityResetCalls = 0;
    state.monitorResetCalls = 0;
    state.savedData.length = 0;
    state.throwFromRibbon = false;
    state.loadData = async () => createSettingsSnapshot(normalizeSettings(null));
  });

  it("rolls back partially initialized resources in reverse order", async () => {
    const { default: DocWenPlugin } = await import("../src/main");
    const plugin = new DocWenPlugin({} as never, {} as never);
    state.throwFromRibbon = true;

    await expect(plugin.onload()).rejects.toThrow("ribbon failed");

    expect(state.cleanup).toEqual(["status", "operations", "capabilities", "client"]);
  });

  it("does not register runtime resources after unload wins an awaited load", async () => {
    let resolveLoad!: (value: unknown) => void;
    state.loadData = () => new Promise((resolve) => {
      resolveLoad = resolve;
    });
    const { default: DocWenPlugin } = await import("../src/main");
    const plugin = new DocWenPlugin({} as never, {} as never);

    const loading = plugin.onload();
    plugin.onunload();
    resolveLoad({});
    await loading;

    expect(state.cleanup).toEqual([]);
  });

  it("resets operations, connection state, and capability state through one runtime entry", async () => {
    const { default: DocWenPlugin } = await import("../src/main");
    const plugin = new DocWenPlugin({} as never, {} as never);
    await plugin.onload();

    plugin.resetDocWenRuntime();

    expect(state.cancelAllCalls).toBe(1);
    expect(state.monitorResetCalls).toBe(1);
    expect(state.capabilityResetCalls).toBe(1);
    plugin.onunload();
  });

  it("uses completed Core capabilities for command availability", async () => {
    state.activeFile = { path: "note.md" };
    state.cachedCapability = { inspection: { supportedActions: ["validate"] } };
    const { default: DocWenPlugin } = await import("../src/main");
    const plugin = new DocWenPlugin({} as never, {} as never);

    await plugin.onload();

    const check = (id: string) => state.commands.find((command) => command.id === id)?.checkCallback as
      ((checking: boolean) => boolean);
    expect(check("export-docx-background")(true)).toBe(true);
    expect(check("export-xlsx-background")(true)).toBe(false);
    expect(check("proofread-md")(true)).toBe(true);
    expect(check("add-numbering")(true)).toBe(false);
    plugin.onunload();
  });

  it("registers keyboard cancellation for one or all active operations", async () => {
    const { default: DocWenPlugin } = await import("../src/main");
    const plugin = new DocWenPlugin({} as never, {} as never);
    await plugin.onload();
    const check = (id: string) => state.commands.find((command) => command.id === id)?.checkCallback as
      ((checking: boolean) => boolean);

    expect(check("cancel-active-operation")(true)).toBe(false);
    expect(check("cancel-all-operations")(true)).toBe(false);
    state.operationItems.push(
      { generation: 4, kind: "proofread", state: "running" },
      { generation: 9, kind: "export", state: "running" },
    );
    expect(check("cancel-active-operation")(false)).toBe(true);
    expect(state.cancelled).toEqual([9]);
    expect(check("cancel-all-operations")(false)).toBe(true);
    expect(state.cancelAllCalls).toBe(1);
    plugin.onunload();
  });

  it("migrates legacy unversioned settings through the serialized persistence boundary", async () => {
    state.loadData = async () => ({
      docwenCliPath: "D:\\DocWen\\DocWenCLI.exe",
      extractImages: false,
    });
    const { default: DocWenPlugin } = await import("../src/main");
    const plugin = new DocWenPlugin({} as never, {} as never);

    await plugin.onload();
    await vi.waitFor(() => expect(state.savedData).toHaveLength(1));

    expect(state.savedData[0]).toMatchObject({
      schemaVersion: 2,
      docwenConnectionMode: "manual",
      docwenCliPath: "D:\\DocWen\\DocWenCLI.exe",
      extractImages: false,
    });
    expect(plugin.getSettingsSaveState()).toBe("saved");
    plugin.onunload();
  });

  it("does not rewrite or save settings from a future schema", async () => {
    const future = {
      schemaVersion: 3,
      language: "en",
      extractImages: false,
      futureField: { preserve: "exactly" },
    };
    const before = structuredClone(future);
    state.loadData = async () => future;
    const { default: DocWenPlugin } = await import("../src/main");
    const plugin = new DocWenPlugin({} as never, {} as never);

    await plugin.onload();
    await Promise.resolve();

    expect(state.savedData).toEqual([]);
    expect(future).toEqual(before);
    expect(plugin.getSettingsSaveState()).toBe("blocked");
    expect(plugin.getSettingsCompatibility()).toMatchObject({
      status: "incompatible",
      storedSchemaVersion: 3,
      reason: "future-schema",
    });

    plugin.settings.extractImages = true;
    await expect(plugin.saveSettings()).rejects.toMatchObject({
      code: "settings_schema_incompatible",
    });
    expect(state.savedData).toEqual([]);
    expect(future).toEqual(before);
    plugin.onunload();
  });
});

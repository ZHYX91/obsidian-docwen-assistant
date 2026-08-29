import { beforeEach, describe, expect, it, vi } from "vitest";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { initI18n } from "../src/i18n";

const lifecycle = vi.hoisted(() => [] as string[]);
const hostState = vi.hoisted(() => ({
  dialog: null as null | {
    showOpenDialog: (options: unknown) => Promise<{ canceled: boolean; filePaths: string[] }>;
  },
  files: new Set<string>(),
}));
const buttons: FakeButton[] = [];
const dropdowns: FakeDropdown[] = [];
const settings: FakeSetting[] = [];
const toggles: FakeToggle[] = [];

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly classList = { add: vi.fn(), remove: vi.fn() };
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, ((event: FakeKeyboardEvent) => void)[]>();
  readonly dataset: Record<string, string> = {};
  readonly ownerDocument = { defaultView: {
    requestAnimationFrame: (callback: FrameRequestCallback) => (callback(0), 1),
    cancelAnimationFrame: vi.fn(),
    getComputedStyle: () => ({ direction: "ltr" }),
  } };
  private innerHtml = "";
  onInnerHTMLChange: ((value: string) => void) | null = null;
  hidden = false;
  isConnected = true;
  textContent = "";
  id = "";
  tabIndex = 0;
  type = "";
  readOnly = false;
  href = "";
  target = "";
  rel = "";
  scrollWidth = 0;
  clientWidth = 0;
  scrollLeft = 0;

  get innerHTML(): string { return this.innerHtml; }
  set innerHTML(value: string) { this.innerHtml = value; this.onInnerHTMLChange?.(value); }

  createDiv(options?: FakeElementOptions): FakeElement { return this.append(options); }
  createEl(_tag?: string, options?: FakeElementOptions): FakeElement { return this.append(options); }
  createSpan(): FakeElement { return this.append(); }
  addClass(value: string): void { this.classList.add(value); }
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    if (name === "id") this.id = value;
    if (name === "tabindex") this.tabIndex = Number(value);
  }
  addEventListener(type: string, callback: (event: FakeKeyboardEvent) => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(callback);
    this.listeners.set(type, listeners);
  }
  dispatch(type: string, key = ""): FakeKeyboardEvent {
    const event = new FakeKeyboardEvent(key);
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }
  focus(): void {}
  scrollIntoView(): void {}
  getBoundingClientRect(): DOMRect { return { left: 0, width: 0 } as DOMRect; }
  querySelector(): null { return null; }
  empty(): void { lifecycle.push("empty"); this.children.length = 0; this.textContent = ""; }
  private append(options?: FakeElementOptions): FakeElement {
    const child = new FakeElement();
    if (options?.text) child.textContent = options.text;
    if (options?.cls) child.addClass(options.cls);
    for (const [name, value] of Object.entries(options?.attr ?? {})) child.setAttribute(name, value);
    this.children.push(child);
    return child;
  }
}

interface FakeElementOptions {
  attr?: Record<string, string>;
  cls?: string;
  text?: string;
}

class FakeKeyboardEvent {
  defaultPrevented = false;
  constructor(readonly key: string) {}
  preventDefault(): void { this.defaultPrevented = true; }
}

class FakeSetting {
  readonly settingEl: FakeElement;
  readonly descEl = new FakeElement();
  readonly infoEl = new FakeElement();
  readonly nameEl = new FakeElement();
  constructor(container: FakeElement) { this.settingEl = container.createDiv(); settings.push(this); }
  setName(value?: unknown): this { this.nameEl.textContent = String(value ?? ""); return this; }
  setDesc(value?: unknown): this { this.descEl.textContent = String(value ?? ""); return this; }
  setClass(value: string): this { this.settingEl.addClass(value); return this; }
  setHeading(): this { return this; }
  addButton(callback: (button: FakeButton) => void): this {
    const button = new FakeButton();
    buttons.push(button);
    callback(button);
    return this;
  }
  addText(callback: (text: FakeText) => void): this { callback(new FakeText()); return this; }
  addDropdown(callback: (dropdown: FakeDropdown) => void): this {
    const dropdown = new FakeDropdown();
    dropdowns.push(dropdown);
    callback(dropdown);
    return this;
  }
  addToggle(callback: (toggle: FakeToggle) => void): this {
    const toggle = new FakeToggle();
    toggles.push(toggle);
    callback(toggle);
    return this;
  }
}

class FakeButton {
  readonly buttonEl = new FakeElement();
  disabled = false;
  label = "";
  click: (() => void) | null = null;
  setButtonText(value: string): this { this.label = value; return this; }
  setTooltip(): this { return this; }
  setDisabled(value: boolean): this { this.disabled = value; return this; }
  onClick(callback: () => void): this { this.click = callback; return this; }
}
class FakeText {
  readonly inputEl = new FakeElement();
  setPlaceholder(): this { return this; }
  setValue(): this { return this; }
  onChange(): this { return this; }
}
class FakeDropdown {
  readonly selectEl = new FakeElement();
  readonly options = new Map<string, string>();
  disabled = false;
  value = "";
  change: ((value: string) => void | Promise<void>) | null = null;
  constructor() { this.selectEl.onInnerHTMLChange = (value) => { if (value === "") this.options.clear(); }; }
  addOption(value: string, label: string): this { this.options.set(value, label); return this; }
  addOptions(options: Record<string, string>): this {
    for (const [value, label] of Object.entries(options)) this.addOption(value, label);
    return this;
  }
  setValue(value: string): this { this.value = value; return this; }
  setDisabled(value: boolean): this { this.disabled = value; return this; }
  onChange(callback: (value: string) => void | Promise<void>): this { this.change = callback; return this; }
  async choose(value: string): Promise<void> { this.value = value; await this.change?.(value); }
}
class FakeToggle {
  change: ((value: boolean) => void | Promise<void>) | null = null;
  disabled = false;
  value = false;
  setValue(value: boolean): this { this.value = value; return this; }
  setDisabled(value: boolean): this { this.disabled = value; return this; }
  onChange(callback: (value: boolean) => void | Promise<void>): this { this.change = callback; return this; }
  async choose(value: boolean): Promise<void> { this.value = value; await this.change?.(value); }
}

vi.mock("obsidian", () => ({
  PluginSettingTab: class PluginSettingTab {
    readonly containerEl = new FakeElement();
    constructor(readonly app: unknown, readonly plugin: unknown) {}
    hide(): void { lifecycle.push("base-hide"); }
    update(): void { lifecycle.push("base-update"); }
  },
  Setting: FakeSetting,
}));
vi.mock("../src/main", () => ({ default: class DocWenPlugin {} }));
vi.mock("../src/host/file-system", () => ({
  isDirectory: () => false,
  isFile: (candidate: string) => hostState.files.has(candidate),
  pathExists: (candidate: string) => hostState.files.has(candidate),
}));
vi.mock("../src/host/electron-dialogs", () => ({ getElectronOpenDialog: () => hostState.dialog }));
vi.mock("../src/host/notices", () => ({ showNotice: vi.fn() }));

describe("settings surface lifecycle", () => {
  beforeEach(() => {
    initI18n("en");
    buttons.length = 0;
    dropdowns.length = 0;
    settings.length = 0;
    toggles.length = 0;
    hostState.dialog = null;
    hostState.files.clear();
  });

  it("uses the custom top-tab surface", async () => {
    const { DEFAULT_SETTINGS } = await import("../src/settings-model");
    const { SettingTab } = await import("../src/settings");
    const tab = new SettingTab({} as never, settingsPlugin(DEFAULT_SETTINGS) as never);

    expect(tab.getSettingDefinitions()).toEqual([]);
    tab.display();

    const root = tab.containerEl.children[0];
    const tabList = root.children[0];
    const panel = root.children[1];
    expect(tabList.attributes.get("role")).toBe("tablist");
    expect(tabList.children).toHaveLength(5);
    expect(tabList.children.map((item) => item.attributes.get("aria-selected")))
      .toEqual(["true", "false", "false", "false", "false"]);
    expect(panel.attributes.get("role")).toBe("tabpanel");
    expect(settings.some((setting) => setting.nameEl.textContent === "General")).toBe(false);
  });

  it("renders Usage as one help card without repeating the tab title", async () => {
    const { DEFAULT_SETTINGS } = await import("../src/settings-model");
    const { SettingTab } = await import("../src/settings");
    const tab = new SettingTab({} as never, settingsPlugin(DEFAULT_SETTINGS) as never);
    tab.display();
    const tabButtons = tab.containerEl.children[0].children[0].children;

    tabButtons[4].dispatch("click");

    const usage = settings.at(-1)!;
    expect(usage.settingEl.classList.add).toHaveBeenCalledWith("docwen-settings-help");
    expect(usage.nameEl.textContent).toBe("");
    expect(usage.descEl.children).toHaveLength(1);
    expect(usage.descEl.children[0].children).toHaveLength(4);
  });

  it("runs the Doctor action by mouse or keyboard and ignores unrelated keys", async () => {
    const { DEFAULT_SETTINGS } = await import("../src/settings-model");
    const { SettingTab } = await import("../src/settings");
    const plugin = settingsPlugin(DEFAULT_SETTINGS);
    const tab = new SettingTab({} as never, plugin as never);
    tab.display();
    const doctor = settings.find((setting) => setting.nameEl.textContent === "Check DocWen connection")!;

    doctor.settingEl.dispatch("keydown", "Escape");
    expect(plugin.runDoctorCheck).not.toHaveBeenCalled();
    const keyboardEvent = doctor.settingEl.dispatch("keydown", "Enter");
    doctor.settingEl.dispatch("click");

    expect(keyboardEvent.defaultPrevented).toBe(true);
    expect(plugin.runDoctorCheck).toHaveBeenCalledTimes(2);
    expect(doctor.settingEl.attributes.get("role")).toBe("button");
  });

  it("persists tab controls and refreshes dependent disabled states", async () => {
    const { DEFAULT_SETTINGS } = await import("../src/settings-model");
    const { SettingTab } = await import("../src/settings");
    const save = vi.fn().mockResolvedValue(undefined);
    const plugin = settingsPlugin(DEFAULT_SETTINGS, save);
    const tab = new SettingTab({} as never, plugin as never);
    tab.display();
    const tabButtons = tab.containerEl.children[0].children[0].children;
    tabButtons[1].dispatch("click");
    const extractImages = toggles[0];

    await extractImages.choose(false);
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());

    expect(plugin.settings.extractImages).toBe(false);
    expect(dropdowns.some((dropdown) => dropdown.disabled)).toBe(true);
  });

  it("rebuilds translated tab labels after a language change", async () => {
    const { DEFAULT_SETTINGS } = await import("../src/settings-model");
    const { SettingTab } = await import("../src/settings");
    const plugin = settingsPlugin(DEFAULT_SETTINGS);
    plugin.saveSettings = vi.fn(async () => initI18n(String(plugin.settings.language)));
    const tab = new SettingTab({} as never, plugin as never);
    tab.display();

    await dropdowns[0].choose("zh-CN");
    await vi.waitFor(() => expect(plugin.settings.language).toBe("zh-CN"));

    const tabButtons = tab.containerEl.children[0].children[0].children;
    expect(tabButtons[0].textContent).toBe("常规");
    expect(tabButtons[4].textContent).toBe("使用方法");
  });

  it("invalidates the verified connection before saving a connection-mode change", async () => {
    const { DEFAULT_SETTINGS } = await import("../src/settings-model");
    const { SettingTab } = await import("../src/settings");
    const plugin = settingsPlugin(DEFAULT_SETTINGS);
    const tab = new SettingTab({} as never, plugin as never);
    tab.display();

    await dropdowns[1].choose("manual");

    expect(plugin.settings.docwenConnectionMode).toBe("manual");
    expect(plugin.resetDocWenRuntime).toHaveBeenCalledOnce();
  });

  it("resets the full DocWen runtime after selecting a manual executable", async () => {
    const { DEFAULT_SETTINGS } = await import("../src/settings-model");
    const { SettingTab } = await import("../src/settings");
    const root = mkdtempSync(path.join(tmpdir(), "docwen-settings-surface-"));
    const cliPath = path.join(root, process.platform === "win32" ? "DocWenCLI.exe" : "DocWenCLI");
    writeFileSync(cliPath, "fixture");
    chmodSync(cliPath, 0o755);
    try {
      hostState.files.add(cliPath);
      hostState.dialog = {
        showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: [cliPath] }),
      };
      const plugin = settingsPlugin({ ...DEFAULT_SETTINGS, docwenConnectionMode: "manual" });
      const tab = new SettingTab({} as never, plugin as never);

      await (tab as unknown as {
        selectDocWenLocation(kind: "program"): Promise<void>;
      }).selectDocWenLocation("program");

      expect(plugin.settings.docwenCliPath).toBe(cliPath);
      expect(plugin.resetDocWenRuntime).toHaveBeenCalledOnce();
      expect(plugin.runDoctorCheck).toHaveBeenCalledOnce();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lets the host hide the settings surface before clearing local element references", async () => {
    const { DEFAULT_SETTINGS } = await import("../src/settings-model");
    const { SettingTab } = await import("../src/settings");
    const plugin = settingsPlugin(DEFAULT_SETTINGS);
    const tab = new SettingTab({} as never, plugin as never);
    const internals = tab as unknown as {
      configurePathStatus(setting: FakeSetting): void;
      pathStatusElements: Set<FakeElement>;
    };
    internals.configurePathStatus(new FakeSetting(new FakeElement()));
    lifecycle.length = 0;

    tab.hide();

    expect(lifecycle).toEqual(["base-hide"]);
    expect(internals.pathStatusElements.size).toBe(0);
  });

  it("does not resurrect a hidden surface after an awaited save", async () => {
    const { DEFAULT_SETTINGS } = await import("../src/settings-model");
    const { SettingTab } = await import("../src/settings");
    let releaseSave!: () => void;
    const save = vi.fn(() => new Promise<void>((resolve) => { releaseSave = resolve; }));
    const plugin = settingsPlugin(DEFAULT_SETTINGS, save);
    const tab = new SettingTab({} as never, plugin as never);

    const pending = tab.setControlValue("extractImages", false);
    tab.hide();
    lifecycle.length = 0;
    releaseSave();
    await pending;

    expect(lifecycle).not.toContain("base-update");
  });

  it("preserves the changed model when persistence fails so Retry can save it", async () => {
    const { DEFAULT_SETTINGS } = await import("../src/settings-model");
    const { SettingTab } = await import("../src/settings");
    const save = vi.fn().mockRejectedValue(new Error("disk full"));
    const plugin = settingsPlugin(DEFAULT_SETTINGS, save);
    const tab = new SettingTab({} as never, plugin as never);

    await expect(tab.setControlValue("extractImages", false)).rejects.toThrow("disk full");

    expect(plugin.settings.extractImages).toBe(false);
    expect(save).toHaveBeenCalledOnce();
  });

  it("does not reset the custom tabbed settings page after a successful control save", async () => {
    const { DEFAULT_SETTINGS } = await import("../src/settings-model");
    const { SettingTab } = await import("../src/settings");
    const plugin = settingsPlugin(DEFAULT_SETTINGS);
    const tab = new SettingTab({} as never, plugin as never);
    lifecycle.length = 0;

    await tab.setControlValue("extractImages", false);

    expect(lifecycle).not.toContain("base-update");
  });

  it("renders persistence recovery on the custom tabbed surface after a failed save", async () => {
    const { DEFAULT_SETTINGS } = await import("../src/settings-model");
    const { SettingTab } = await import("../src/settings");
    const save = vi.fn().mockRejectedValue(new Error("disk full"));
    const plugin = settingsPlugin(DEFAULT_SETTINGS, save);
    const tab = new SettingTab({} as never, plugin as never);
    lifecycle.length = 0;

    await expect(tab.setControlValue("extractImages", false)).rejects.toThrow("disk full");

    expect(lifecycle).not.toContain("base-update");
    expect(tab.containerEl.children).not.toHaveLength(0);
  });

  it("updates a connected path status row without replacing the current page", async () => {
    const { DEFAULT_SETTINGS } = await import("../src/settings-model");
    const { SettingTab } = await import("../src/settings");
    const plugin = settingsPlugin(DEFAULT_SETTINGS);
    const tab = new SettingTab({} as never, plugin as never);
    const internals = tab as unknown as {
      configurePathStatus(setting: FakeSetting): void;
      pathStatusElements: Set<FakeElement>;
      refreshPathStatus(): void;
    };
    internals.configurePathStatus(new FakeSetting(new FakeElement()));
    const statusElement = [...internals.pathStatusElements][0];
    const initialText = statusElement.textContent;
    plugin.settings.docwenConnectionMode = "manual";
    plugin.settings.docwenCliPath = "C:\\not-docwen.exe";
    plugin.resetDocWenRuntime();

    internals.refreshPathStatus();

    expect(statusElement.textContent).not.toBe(initialText);
    expect(statusElement.classList.add).toHaveBeenCalledWith("docwen-settings-status-error");
  });

  it("recognizes a nested settings page as current through the host tab owner", async () => {
    const { DEFAULT_SETTINGS } = await import("../src/settings-model");
    const { SettingTab } = await import("../src/settings");
    const tab = new SettingTab({} as never, settingsPlugin(DEFAULT_SETTINGS) as never);
    tab.containerEl.isConnected = false;
    const internals = tab as unknown as {
      setting: { activeTab: unknown };
      isCurrentSurface(generation: number): boolean;
    };
    internals.setting = { activeTab: tab };

    expect(internals.isCurrentSurface(0)).toBe(true);
  });

  it("exposes loading, error, and retry states for runtime numbering schemes", async () => {
    const { DEFAULT_SETTINGS } = await import("../src/settings-model");
    const { SettingTab } = await import("../src/settings");
    let rejectFirst!: (error: Error) => void;
    const plugin = settingsPlugin(DEFAULT_SETTINGS);
    plugin.fetchNumberingSchemes = vi.fn()
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectFirst = reject; }))
      .mockResolvedValueOnce([{ id: "legal", name: "Legal" }]);
    const tab = new SettingTab({} as never, plugin as never);
    const setting = new FakeSetting(new FakeElement());
    const cleanup = (tab as unknown as {
      configureNumberingScheme(row: FakeSetting, key: "docToMdAddNumbering"): () => void;
    }).configureNumberingScheme(setting, "docToMdAddNumbering");
    const dropdown = dropdowns.at(-1)!;
    const retry = buttons.at(-1)!;

    expect(dropdown.disabled).toBe(true);
    expect(setting.descEl.textContent).toContain("Loading numbering schemes");
    expect(setting.settingEl.attributes.get("aria-busy")).toBe("true");

    rejectFirst(new Error("CLI unavailable"));
    await vi.waitFor(() => expect(retry.buttonEl.hidden).toBe(false));
    expect(dropdown.disabled).toBe(false);
    expect(setting.descEl.textContent).toContain("Failed to load numbering schemes");
    expect(setting.settingEl.attributes.get("aria-busy")).toBe("false");

    retry.click?.();
    await vi.waitFor(() => expect(dropdown.options.get("legal")).toBe("Legal"));
    expect(retry.buttonEl.hidden).toBe(true);
    expect(dropdown.disabled).toBe(false);
    cleanup();
  });

  it("keeps an unavailable saved numbering scheme visible without saving until user choice", async () => {
    const { DEFAULT_SETTINGS } = await import("../src/settings-model");
    const { SettingTab } = await import("../src/settings");
    const save = vi.fn().mockResolvedValue(undefined);
    const plugin = settingsPlugin({
      ...DEFAULT_SETTINGS,
      docToMdAddNumbering: "unavailable-custom",
    }, save);
    plugin.fetchNumberingSchemes = vi.fn()
      .mockRejectedValueOnce(new Error("CLI unavailable"))
      .mockResolvedValueOnce([
        { id: "unavailable-custom", name: "Available again" },
        { id: "unavailable-custom", name: "Duplicate ignored" },
        { id: "legal", name: "Legal" },
      ]);
    const tab = new SettingTab({} as never, plugin as never);
    const setting = new FakeSetting(new FakeElement());
    const cleanup = (tab as unknown as {
      configureNumberingScheme(row: FakeSetting, key: "docToMdAddNumbering"): () => void;
    }).configureNumberingScheme(setting, "docToMdAddNumbering");
    const dropdown = dropdowns.at(-1)!;
    const retry = buttons.at(-1)!;

    expect(dropdown.options.get("unavailable-custom")).toContain("unavailable-custom");
    expect(dropdown.value).toBe("unavailable-custom");
    expect(save).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(retry.buttonEl.hidden).toBe(false));
    expect(dropdown.options.get("unavailable-custom")).toContain("unavailable-custom");
    expect(save).not.toHaveBeenCalled();

    retry.click?.();
    await vi.waitFor(() => expect(dropdown.options.get("unavailable-custom")).toBe("Available again"));
    expect([...dropdown.options.keys()]).toEqual(["default", "none", "unavailable-custom", "legal"]);
    expect(save).not.toHaveBeenCalled();

    await dropdown.choose("default");
    await dropdown.choose("none");
    await dropdown.choose("legal");
    expect(save).toHaveBeenCalledTimes(3);
    expect(plugin.settings.docToMdAddNumbering).toBe("legal");
    cleanup();
  });

  it("keeps an orphaned scheme visible after a successful empty response", async () => {
    const { DEFAULT_SETTINGS } = await import("../src/settings-model");
    const { SettingTab } = await import("../src/settings");
    const save = vi.fn().mockResolvedValue(undefined);
    const plugin = settingsPlugin({
      ...DEFAULT_SETTINGS,
      mdToDocAddNumbering: "orphaned-id",
    }, save);
    plugin.fetchNumberingSchemes = vi.fn().mockResolvedValue([]);
    const tab = new SettingTab({} as never, plugin as never);
    const setting = new FakeSetting(new FakeElement());
    const cleanup = (tab as unknown as {
      configureNumberingScheme(row: FakeSetting, key: "mdToDocAddNumbering"): () => void;
    }).configureNumberingScheme(setting, "mdToDocAddNumbering");
    const dropdown = dropdowns.at(-1)!;

    await vi.waitFor(() => expect(dropdown.disabled).toBe(false));
    expect(dropdown.options.get("orphaned-id")).toContain("orphaned-id");
    expect([...dropdown.options.keys()]).toEqual(["default", "none", "orphaned-id"]);
    expect(save).not.toHaveBeenCalled();
    cleanup();
  });
});

function settingsPlugin(defaults: Record<string, unknown>, saveSettings = vi.fn().mockResolvedValue(undefined)) {
  let connectionStatus: Record<string, unknown> = { state: "unchecked" };
  return {
    settings: { ...defaults },
    fetchNumberingSchemes: vi.fn().mockResolvedValue([]),
    getSettingsSaveState: vi.fn(() => "saved"),
    retrySettingsSave: vi.fn().mockResolvedValue(undefined),
    runDoctorCheck: vi.fn().mockResolvedValue(undefined),
    getDocWenConnectionStatus: vi.fn(() => connectionStatus),
    resetDocWenRuntime: vi.fn(() => { connectionStatus = { state: "unchecked" }; }),
    checkDocWenConnectionSilently: vi.fn(async () => {
      connectionStatus = {
        state: "connected",
        mode: String(defaults.docwenConnectionMode ?? "automatic"),
        productVersion: "0.9.0",
      };
    }),
    saveSettings,
  };
}

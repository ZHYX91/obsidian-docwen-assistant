/**
 * DocWen Assistant - Obsidian Plugin
 *
 * Launch DocWen converter from Obsidian and pass the current file path.
 * Uses Machine Protocol v2 for content operations and the public local GUI
 * control command for launch/open so window access is not gated by conversion negotiation.
 */

import { Plugin, TFile, type Command } from "obsidian";
import { SettingTab } from "./settings";
import {
  CURRENT_SETTINGS_SCHEMA_VERSION,
  createSettingsSnapshot,
  loadSettingsData,
  SettingsSchemaIncompatibleError,
  type PersistedPluginSettings,
  type PluginSettings,
  type SettingsCompatibility,
} from "./settings-model";
import { t, type Translations } from "./i18n";
import { ActionRunner } from "./actions/action-runner";
import { ExportActions } from "./actions/export-actions";
import { GuiActions } from "./actions/gui-actions";
import { NumberingActions } from "./actions/numbering-actions";
import { ProofreadActions } from "./actions/proofread-actions";
import { registerCommands } from "./app/register-commands";
import { registerFileMenu } from "./app/register-file-menu";
import { showNotice } from "./host/notices";
import { openPluginSettings } from "./host/settings-navigation";
import {
  getDocWenLanguage,
  initializePluginI18n,
} from "./host-language";
import { resolveAbsoluteFilePath } from "./host/vault-files";
import { ProofreadView, PROOFREAD_VIEW_TYPE } from "./proofread-view";
import {
  DocWenMachineClient,
  DocWenCapabilityService,
  DocWenClient,
  DocWenGuiControlClient,
  resolveDocWenLaunchTarget,
  type DocWenConnectionStatus,
  type FileCapability,
  type NumberingSchemeItem,
} from "./docwen";
import { OperationCoordinator } from "./runtime/operation-coordinator";
import { OperationStatus } from "./operation-status";
import { RuntimeDisposer } from "./runtime/disposer";
import { SettingsSaveCoordinator, type SettingsSaveState } from "./runtime/settings-save";
import { DocWenConnectionMonitor } from "./docwen/connection-monitor";

/**
 * DocWen Assistant Plugin
 * Main plugin class for launching and communicating with DocWen converter
 */
export default class DocWenPlugin extends Plugin {
  settings!: PluginSettings;
  private docwen!: DocWenClient;
  private guiControl!: DocWenGuiControlClient;
  private exportActions!: ExportActions;
  private guiActions!: GuiActions;
  private numberingActions!: NumberingActions;
  private proofreadActions!: ProofreadActions;
  private capabilities!: DocWenCapabilityService;
  private operations!: OperationCoordinator;
  private actionRunner!: ActionRunner;
  private operationStatus: OperationStatus | null = null;
  private runtimeEpoch = 0;
  private settingsSaves!: SettingsSaveCoordinator<PersistedPluginSettings>;
  private settingsCompatibility: SettingsCompatibility = {
    status: "compatible",
    currentSchemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
    storedSchemaVersion: 0,
  };
  private ribbonIconEl: HTMLElement | null = null;
  private readonly localizedCommands: Array<{ command: Command; key: keyof Translations }> = [];
  private runtimeDisposer = new RuntimeDisposer();
  private connectionMonitor!: DocWenConnectionMonitor;
  private guiConnectionMonitor!: DocWenConnectionMonitor;

  private getDocwenLangCode(): string {
    return getDocWenLanguage(this.settings.language);
  }

  private resolveCliExecutable() {
    return resolveDocWenLaunchTarget(
      this.settings.docwenConnectionMode,
      this.settings.docwenCliPath,
    );
  }
  /** Public wrapper for settings.ts — delegates to adapter */
  public async fetchNumberingSchemes(signal?: AbortSignal): Promise<NumberingSchemeItem[] | null> {
    return this.numberingActions.schemes(signal);
  }

  private async runForActiveFile(action: (file: TFile) => Promise<void>): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) return;
    await action(activeFile);
  }

  private async exportCurrentFileToDocx(): Promise<void> {
    await this.runForActiveFile((file) => this.exportActions.toDocx(file));
  }

  private async exportCurrentFileToXlsx(): Promise<void> {
    await this.runForActiveFile((file) => this.exportActions.toXlsx(file));
  }

  private async exportCurrentFileToMarkdown(): Promise<void> {
    await this.runForActiveFile((file) => this.exportActions.toMarkdown(file));
  }

  private activeFileSupports(predicate: (capability: FileCapability) => boolean): boolean {
    const file = this.app.workspace.getActiveFile();
    if (!file) return false;
    const filePath = resolveAbsoluteFilePath(this.app.vault, file);
    if (!filePath) return false;
    const cached = this.capabilities.peek(filePath);
    // Keep an invocation path while discovery is pending or failed so the
    // shared Action boundary can present the typed failure. Once discovery
    // succeeds, command availability comes only from Core capabilities.
    return !cached || cached instanceof Error || predicate(cached);
  }
  /**
   * Run doctor check using new subcommand format
   */
  public async runDoctorCheck(): Promise<void> {
    await this.actionRunner.run({ key: "doctor", kind: "doctor" }, "noticeDoctorFailed", async ({ signal }) => {
      await this.checkGuiConnectionSilently(signal);
      const report = await this.connectionMonitor.check(signal);
      showNotice(t("noticeDoctorSuccess", { version: report.productVersion }), 8000);
    });
  }

  public getDocWenConnectionStatus(): DocWenConnectionStatus {
    return this.connectionMonitor.getStatus();
  }

  public getGuiConnectionStatus(): DocWenConnectionStatus {
    return this.guiConnectionMonitor.getStatus();
  }

  public async openDocWenApplication(): Promise<void> {
    await this.actionRunner.run({ key: "gui-settings", kind: "gui-control" }, "noticeLaunchFailed", async ({ signal }) => {
      await this.guiControl.open(undefined, signal);
      await this.guiConnectionMonitor.check(signal);
    });
  }

  private async checkGuiConnectionSilently(signal?: AbortSignal): Promise<void> {
    try { await this.guiConnectionMonitor.check(signal); } catch { /* Shown independently in settings. */ }
  }

  public resetDocWenRuntime(): void {
    this.operations?.cancelAll();
    this.connectionMonitor.reset();
    this.guiConnectionMonitor?.reset();
    this.capabilities.reset();
  }

  public async checkDocWenConnectionSilently(): Promise<void> {
    const guiCheck = this.getGuiConnectionStatus().state === "unchecked"
      ? this.checkGuiConnectionSilently() : Promise.resolve();
    if (this.connectionMonitor.getStatus().state !== "unchecked") { await guiCheck; return; }
    try {
      await this.connectionMonitor.check();
    } catch {
      // The settings status row presents the typed failure without a popup.
    }
    await guiCheck;
  }

  /**
   * Plugin load lifecycle hook
   */
  async onload() {
    const epoch = ++this.runtimeEpoch;
    this.runtimeDisposer = new RuntimeDisposer();
    try {
    this.settingsSaves = new SettingsSaveCoordinator((snapshot) => this.saveData(snapshot));
    // Load settings
    await this.loadSettings();
    if (epoch !== this.runtimeEpoch) return;
    initializePluginI18n(this.settings.language);

    // Content operations use one Machine v2 boundary. GUI opening is a
    // separate local control surface so protocol negotiation cannot hide the app.
    this.docwen = new DocWenClient(
      new DocWenMachineClient(
        () => this.resolveCliExecutable(),
        () => this.getDocwenLangCode(),
      ),
    );
    this.guiControl = new DocWenGuiControlClient(
      () => this.resolveCliExecutable(),
    );
    this.guiConnectionMonitor = new DocWenConnectionMonitor(
      () => this.settings.docwenConnectionMode,
      async (signal) => {
        const report = await this.guiControl.status(signal);
        return { allOk: true, productVersion: report.productVersion, checks: [] };
      },
    );
    this.connectionMonitor = new DocWenConnectionMonitor(
      () => this.settings.docwenConnectionMode,
      (signal) => this.docwen.doctor(signal),
    );
    this.runtimeDisposer.add(() => this.docwen.dispose());
    this.capabilities = new DocWenCapabilityService(this.docwen);
    this.runtimeDisposer.add(() => this.resetDocWenRuntime());
    this.operations = new OperationCoordinator();
    this.runtimeDisposer.add(() => this.operations.dispose());
    this.registerEvent(this.app.workspace.on("quit", (tasks) => {
      const pending = this.operations.hasPendingWork;
      const settling = this.operations.shutdown();
      this.onunload();
      if (pending) tasks.addPromise(settling.then((settled) => {
        if (!settled) console.warn("[DocWen Assistant] Host quit cleanup deadline exceeded.");
      }));
    }));
    this.actionRunner = new ActionRunner(
      this.app,
      this.operations,
      () => { openPluginSettings(this.app, this.manifest.id); },
    );
    const operationStatus = new OperationStatus(this.addStatusBarItem(), this.operations);
    this.operationStatus = operationStatus;
    this.runtimeDisposer.add(() => {
      operationStatus.dispose();
      if (this.operationStatus === operationStatus) this.operationStatus = null;
    });
    const preloadCapabilities = (file: TFile | null): void => {
      if (!file) return;
      const filePath = resolveAbsoluteFilePath(this.app.vault, file);
      if (filePath) void this.capabilities.preload(filePath);
    };
    this.registerEvent(this.app.workspace.on("file-open", preloadCapabilities));
    this.registerEvent(this.app.vault.on("modify", (file) => {
      const modifiedFile = file instanceof TFile ? file : null;
      const filePath = modifiedFile
        ? resolveAbsoluteFilePath(this.app.vault, modifiedFile)
        : null;
      if (filePath) {
        this.capabilities.invalidate(filePath);
        preloadCapabilities(modifiedFile);
      }
    }));
    preloadCapabilities(this.app.workspace.getActiveFile());
    this.exportActions = new ExportActions(
      this.app,
      this.docwen,
      this.capabilities,
      () => this.settings,
      this.actionRunner,
    );
    this.numberingActions = new NumberingActions(
      this.app,
      this.docwen,
      this.capabilities,
      this.actionRunner,
    );
    this.guiActions = new GuiActions(
      this.guiControl,
      this.actionRunner,
    );
    this.proofreadActions = new ProofreadActions(
      this.app,
      this.docwen,
      this.capabilities,
      () => this.settings,
      this.actionRunner,
    );

    // Add Ribbon Icon (left sidebar icon)
    const ribbonIconEl = this.addRibbonIcon(
      "file-text",
      t("ribbonTooltip"),
      (_evt: MouseEvent) => {
        void this.launchOrSendFile();
      }
    );

    // Add CSS class for custom styling
    ribbonIconEl.addClass("docwen-ribbon-class");
    this.ribbonIconEl = ribbonIconEl;

    // Add settings tab
    this.addSettingTab(new SettingTab(this.app, this));

    // Register proofreading sidebar view
    this.runtimeDisposer.add(() => this.app.workspace.detachLeavesOfType(PROOFREAD_VIEW_TYPE));
    this.registerView(
      PROOFREAD_VIEW_TYPE,
      (leaf) => new ProofreadView(
        leaf,
        () => this.proofreadActions.runActive(),
        this.operations,
      ),
    );

    registerCommands({
      app: this.app,
      addLocalizedCommand: (key, command) => this.addLocalizedCommand(key, command),
      launchOrSendFile: () => this.launchOrSendFile(),
      activeFileSupports: (predicate) => this.activeFileSupports(predicate),
      capabilities: this.capabilities,
      exportCurrentFileToDocx: () => this.exportCurrentFileToDocx(),
      exportCurrentFileToXlsx: () => this.exportCurrentFileToXlsx(),
      exportCurrentFileToMarkdown: () => this.exportCurrentFileToMarkdown(),
      numberingActions: this.numberingActions,
      runDoctorCheck: () => this.runDoctorCheck(),
      proofreadActions: this.proofreadActions,
      operations: this.operations,
    });

    // Register file-menu (right-click) context menu
    registerFileMenu(this, {
      runner: this.actionRunner,
      exports: this.exportActions,
      gui: this.guiActions,
      numbering: this.numberingActions,
      proofread: this.proofreadActions,
      capabilities: this.capabilities,
      presentCapabilityFailure: (error) =>
        this.actionRunner.presentFailure("noticeCapabilityFailed", error),
    });

    } catch (error) {
      this.runtimeDisposer.dispose();
      throw error;
    }
  }

  /**
   * Plugin unload lifecycle hook
   */
  onunload() {
    ++this.runtimeEpoch;
    this.runtimeDisposer.dispose();
  }

  /**
   * Load plugin settings from storage
   */
  async loadSettings() {
    const stored: unknown = await this.loadData();
    const loaded = loadSettingsData(stored);
    this.settings = loaded.settings;
    this.settingsCompatibility = loaded.compatibility;
    if (loaded.migration !== null) {
      void this.settingsSaves.save(loaded.migration).catch(() => undefined);
    }
  }

  /**
   * Save plugin settings to storage
   */
  async saveSettings() {
    if (this.settingsCompatibility.status === "incompatible") {
      throw new SettingsSchemaIncompatibleError(this.settingsCompatibility);
    }
    initializePluginI18n(this.settings.language);
    this.refreshLocalizedChrome();
    await this.settingsSaves.save(createSettingsSnapshot(this.settings));
  }

  private addLocalizedCommand(
    key: keyof Translations,
    command: Omit<Command, "name">,
  ): Command {
    const registered = this.addCommand({ ...command, name: t(key) });
    registered.name = `DocWen: ${t(key)}`;
    this.localizedCommands.push({ command: registered, key });
    return registered;
  }

  private refreshLocalizedChrome(): void {
    const ribbonTitle = t("ribbonTooltip");
    this.ribbonIconEl?.setAttribute("aria-label", ribbonTitle);
    this.ribbonIconEl?.setAttribute("data-tooltip-position", "right");
    this.ribbonIconEl?.setAttribute("title", ribbonTitle);
    for (const item of this.localizedCommands) item.command.name = `DocWen: ${t(item.key)}`;
    this.operationStatus?.refresh();
  }

  getSettingsSaveState(): SettingsSaveState {
    if (this.settingsCompatibility.status === "incompatible") return "blocked";
    return this.settingsSaves.getState();
  }

  getSettingsCompatibility(): SettingsCompatibility {
    return this.settingsCompatibility;
  }

  retrySettingsSave(): Promise<void> {
    return this.settingsSaves.retry();
  }

  /** Open the active file, or start/activate DocWen when there is no active file. */
  async launchOrSendFile(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    const filePath = activeFile ? resolveAbsoluteFilePath(this.app.vault, activeFile) : null;
    if (filePath) {
      await this.guiActions.open(filePath);
      return;
    }
    await this.guiActions.open();
  }
}

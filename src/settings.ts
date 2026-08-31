import { App, PluginSettingTab, Setting, type SettingDefinition, type SettingDefinitionItem } from "obsidian";
import { t } from "./i18n";
import { showNotice } from "./host/notices";
import DocWenPlugin from "./main";
import { setSettingValue } from "./settings-model";
import {
  getSettingsPages,
  type SettingsControlKey,
  type SettingsPageDefinition,
  type SettingsPageId,
} from "./settings-definitions";
import {
  configureDocWenDownloadSetting,
  configureDocWenLocationSetting,
  getDocWenConnectionDisplay,
  getDocWenPathStatus,
  pickDocWenCliPath,
  type DocWenLocationKind,
  type DocWenPathStatus,
} from "./settings-docwen-location";
import { configureNumberingSchemeSetting } from "./settings-numbering-scheme";
import {
  assertSettingsWritable,
  describeSettingsSchemaCompatibility,
  isSettingsReadOnly,
  renderSettingsSchemaCompatibility,
} from "./settings-schema-compatibility";
import { SettingsTabs } from "./settings-tabs";
import { renderUsageList } from "./settings-usage";

export class SettingTab extends PluginSettingTab {
  plugin: DocWenPlugin;
  private pathStatusElements = new Set<HTMLElement>();
  private pageCleanups: (() => void)[] = [];
  private activePageId: SettingsPageId = "general";
  private tabs: SettingsTabs | null = null;
  private surfaceGeneration = 0;

  constructor(app: App, plugin: DocWenPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  // Intentionally empty: non-empty declarative definitions bypass the custom
  // five-tab display() surface and degrade the established settings experience.
  override getSettingDefinitions(): SettingDefinitionItem[] {
    return [];
  }

  override display(): void {
    this.activePageId = this.tabs?.activePageId ?? this.activePageId;
    this.destroyPageSurface();
    this.containerEl.empty();
    renderSettingsSchemaCompatibility(this.containerEl, this.plugin.getSettingsCompatibility());
    const pages = this.getSettingsPages();
    this.tabs = new SettingsTabs({
      ariaLabel: t("settingsTitle"),
      containerEl: this.containerEl,
      initialPageId: this.activePageId,
      pages,
      renderPage: (containerEl, page) => this.renderPage(containerEl, page),
    });
  }

  private getSettingsPages(): SettingsPageDefinition[] {
    return getSettingsPages({
      settings: this.plugin.settings,
      renderCliPath: (setting) => configureDocWenLocationSetting(
        setting,
        this.plugin.settings.docwenCliPath,
        (kind) => void this.selectDocWenLocation(kind),
        isSettingsReadOnly(this.plugin.getSettingsCompatibility()),
      ),
      renderDocWenDownload: configureDocWenDownloadSetting,
      renderCliStatus: (setting) => this.configurePathStatus(setting),
      renderPersistenceStatus: (setting) => this.configurePersistenceStatus(setting),
      isPersistencePending: () => ["pending", "blocked"].includes(this.plugin.getSettingsSaveState()),
      renderNumberingScheme: (setting, key) => this.configureNumberingScheme(setting, key),
      renderHelp: (setting) => {
        setting.setClass("docwen-settings-help");
        setting.settingEl.setAttribute("role", "note");
        setting.settingEl.setAttribute("aria-label", t("settingsUsageTitle"));
        setting.nameEl.empty();
        renderUsageList(setting.descEl, t("settingsUsageList"));
      },
      runDoctor: () => void this.runDoctorFromSettings(),
    });
  }

  override getControlValue(key: string): unknown {
    if (!(key in this.plugin.settings)) return undefined;
    return this.plugin.settings[key as SettingsControlKey];
  }

  override async setControlValue(key: string, value: unknown): Promise<void> {
    if (!(key in this.plugin.settings)) throw new Error(`Unsupported setting: ${key}`);
    assertSettingsWritable(this.plugin.getSettingsCompatibility());
    const settingKey = key as SettingsControlKey;
    setSettingValue(this.plugin.settings, settingKey, value);
    if (settingKey === "docwenConnectionMode") this.plugin.resetDocWenRuntime();
    const generation = this.surfaceGeneration;
    try {
      await this.plugin.saveSettings();
    } catch (error) {
      if (this.isCurrentSurface(generation)) this.refreshSettingsUi();
      throw error;
    }
  }

  override hide(): void {
    super.hide();
    this.activePageId = this.tabs?.activePageId ?? this.activePageId;
    this.destroyPageSurface();
    this.tabs = null;
  }

  private renderPage(containerEl: HTMLElement, page: SettingsPageDefinition): void {
    this.destroyPageSurface();
    ++this.surfaceGeneration;
    page.items.forEach((item, index) => this.renderDefinition(containerEl, item, index));
  }

  private renderDefinition(
    containerEl: HTMLElement,
    item: SettingDefinition<SettingsControlKey>,
    index: number,
  ): void {
    if (!evaluate(item.visible, true)) return;
    const setting = new Setting(containerEl).setName(item.name);
    if (item.desc !== undefined) setting.setDesc(item.desc);

    if ("render" in item && item.render) {
      const cleanup = item.render(setting, undefined as never);
      if (cleanup) this.pageCleanups.push(cleanup);
      return;
    }
    if ("action" in item && item.action) {
      this.configureAction(
        setting,
        item.action,
        index,
        isSettingsReadOnly(this.plugin.getSettingsCompatibility()) || evaluate(item.disabled, false),
      );
      return;
    }
    if ("control" in item && item.control) {
      const { control } = item;
      const disabled = isSettingsReadOnly(this.plugin.getSettingsCompatibility())
        || evaluate(control.disabled, false);
      const value = this.getControlValue(control.key) ?? control.defaultValue;
      if (control.type === "toggle") {
        setting.addToggle((toggle) => toggle
          .setValue(Boolean(value))
          .setDisabled(disabled)
          .onChange((nextValue) => void this.changeControlValue(control.key, nextValue)));
        return;
      }
      if (control.type === "dropdown") {
        setting.addDropdown((dropdown) => dropdown
          .addOptions(control.options)
          .setValue(typeof value === "string" ? value : "")
          .setDisabled(disabled)
          .onChange((nextValue) => void this.changeControlValue(control.key, nextValue)));
        return;
      }
      throw new Error(`Unsupported custom settings control: ${control.type}`);
    }
  }

  private configureAction(
    setting: Setting,
    action: (el: HTMLElement, index: number) => void,
    index: number,
    disabled: boolean,
  ): void {
    setting.setClass("docwen-settings-action");
    setting.settingEl.setAttribute("role", "button");
    setting.settingEl.setAttribute("aria-disabled", String(disabled));
    setting.settingEl.tabIndex = disabled ? -1 : 0;
    const run = () => {
      if (!disabled) action(setting.settingEl, index);
    };
    setting.settingEl.addEventListener("click", run);
    setting.settingEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      run();
    });
  }

  private async changeControlValue(key: SettingsControlKey, value: unknown): Promise<void> {
    try {
      await this.setControlValue(key, value);
    } catch {
      // setControlValue already re-renders the recovery state on the live surface.
      return;
    }
    if (!this.containerEl.isConnected) return;
    if (key === "language") {
      this.display();
    } else if (key === "docwenConnectionMode") {
      this.tabs?.renderActivePage();
    } else if (key === "extractImages" || key === "enableOcr") {
      this.tabs?.renderActivePage();
    }
  }

  private destroyPageSurface(): void {
    ++this.surfaceGeneration;
    for (const cleanup of this.pageCleanups.splice(0)) cleanup();
    this.pathStatusElements.clear();
  }

  private configurePersistenceStatus(setting: Setting): void {
    const state = this.plugin.getSettingsSaveState();
    setting.setName(t("settingsPersistence"));
    setting.setDesc(state === "blocked"
      ? describeSettingsSchemaCompatibility(this.plugin.getSettingsCompatibility())
      : state === "pending"
        ? t("settingsChangesPending")
        : t("settingsChangesSaved"));
    if (state === "pending") {
      setting.addButton((button) => button
        .setButtonText(t("settingsRetry"))
        .onClick(() => {
          const generation = this.surfaceGeneration;
          void this.plugin.retrySettingsSave().finally(() => {
            if (this.isCurrentSurface(generation)) this.refreshSettingsUi();
          });
        }));
    }
  }

  private configurePathStatus(setting: Setting): void {
    const status = this.currentConnectionDisplay();
    setting.setName(t("settingsCliPathStatus")).setDesc(status.message);
    setting.descEl.addClass("docwen-cli-path-status");
    setting.descEl.addClass(`docwen-settings-status-${status.state}`);
    setting.descEl.setAttribute("role", "status");
    setting.descEl.setAttribute("aria-live", "polite");
    this.pathStatusElements.add(setting.descEl);
    if (
      this.plugin.getDocWenConnectionStatus().state === "unchecked"
      && (
        this.plugin.settings.docwenConnectionMode === "automatic"
        || getDocWenPathStatus(this.plugin.settings.docwenCliPath).state === "valid"
      )
    ) {
      const generation = this.surfaceGeneration;
      const pending = this.plugin.checkDocWenConnectionSilently();
      this.refreshPathStatus();
      void pending.finally(() => {
        if (this.isCurrentSurface(generation)) this.refreshPathStatus();
      });
    }
  }

  private refreshPathStatus(): void {
    const status = this.currentConnectionDisplay();
    for (const element of this.pathStatusElements) {
      if (!element.isConnected) {
        this.pathStatusElements.delete(element);
        continue;
      }
      element.textContent = status.message;
      element.classList.remove(
        "docwen-settings-status-valid",
        "docwen-settings-status-error",
        "docwen-settings-status-empty",
      );
      element.classList.add(`docwen-settings-status-${status.state}`);
    }
  }

  private currentConnectionDisplay(): DocWenPathStatus {
    return getDocWenConnectionDisplay(
      this.plugin.settings.docwenConnectionMode,
      this.plugin.settings.docwenCliPath,
      this.plugin.getDocWenConnectionStatus(),
    );
  }

  private refreshSettingsUi(): void {
    if (!this.containerEl.isConnected) return;
    if (this.tabs) {
      this.tabs.renderActivePage();
      return;
    }
    this.display();
  }

  private configureNumberingScheme(
    setting: Setting,
    key: "docToMdAddNumbering" | "mdToDocAddNumbering",
  ): () => void {
    const generation = this.surfaceGeneration;
    return configureNumberingSchemeSetting(setting, {
      getValue: () => this.plugin.settings[key],
      isCurrent: () => this.isCurrentSurface(generation),
      loadSchemes: (signal) => this.plugin.fetchNumberingSchemes(signal),
      setValue: (value) => this.setControlValue(key, value),
      readOnly: isSettingsReadOnly(this.plugin.getSettingsCompatibility()),
    });
  }

  private async selectDocWenLocation(kind: DocWenLocationKind): Promise<void> {
    assertSettingsWritable(this.plugin.getSettingsCompatibility());
    const generation = this.surfaceGeneration;
    const cliPath = await pickDocWenCliPath(kind);
    if (!cliPath) return;
    this.plugin.settings.docwenCliPath = cliPath;
    this.plugin.resetDocWenRuntime();
    try {
      await this.plugin.saveSettings();
    } catch {
      if (this.isCurrentSurface(generation)) {
        this.refreshPathStatus();
        this.refreshSettingsUi();
      }
      return;
    }
    if (this.isCurrentSurface(generation)) this.refreshPathStatus();
    showNotice(t("noticePathUpdated"));
    await this.plugin.runDoctorCheck();
    if (this.isCurrentSurface(generation)) this.refreshPathStatus();
  }

  private async runDoctorFromSettings(): Promise<void> {
    const generation = this.surfaceGeneration;
    await this.plugin.runDoctorCheck();
    if (this.isCurrentSurface(generation)) this.refreshPathStatus();
  }

  private isCurrentSurface(generation: number): boolean {
    const hostSetting = (this as unknown as {
      setting?: { activeTab?: unknown };
    }).setting;
    return this.surfaceGeneration === generation
      && (this.containerEl.isConnected || hostSetting?.activeTab === this);
  }

}

function evaluate(value: boolean | (() => boolean) | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return typeof value === "function" ? value() : value;
}

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
  getDocWenPathStatus,
  pickDocWenCliPath,
  type DocWenLocationKind,
  type DocWenPathStatus,
} from "./settings-docwen-location";
import { configureNumberingSchemeSetting } from "./settings-numbering-scheme";
import { renderSettingsGuide, renderSettingsSupport } from "./settings-guide";
import { configureNumberSetting } from "./settings-number-control";
import {
  assertSettingsWritable,
  isSettingsReadOnly,
  renderSettingsSchemaCompatibility,
} from "./settings-schema-compatibility";
import { SettingsTabs } from "./settings-tabs";
import { preserveSettingsView } from "./settings-view-state";
import { configureConnectionActions, connectionDisplay } from "./settings-connection";

export class SettingTab extends PluginSettingTab {
  plugin: DocWenPlugin;
  private pathStatusElements = new Set<HTMLElement>();
  private pageCleanups: (() => void)[] = [];
  private updateHeadingNumberingFormat?: () => void;
  private activePageId: SettingsPageId = "general";
  private tabs: SettingsTabs | null = null;
  private saveFeedback: HTMLElement | null = null;
  private readonly expandedHelp = new Set<string>();
  private surfaceGeneration = 0;

  constructor(app: App, plugin: DocWenPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  // Intentionally empty: non-empty declarative definitions bypass the custom
  // four-tab display() surface and degrade the established settings experience.
  override getSettingDefinitions(): SettingDefinitionItem[] {
    return [];
  }

  override display(): void {
    preserveSettingsView(this.containerEl, () => {
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
      renderNumberingScheme: (setting, key) => this.configureNumberingScheme(setting, key),
      renderGuide: (setting, title, content) => renderSettingsGuide(
        setting, title, content, this.expandedHelp,
      ),
      renderSupport: renderSettingsSupport,
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
    if (settingKey === "mdToDocAddNumbering") this.updateHeadingNumberingFormat?.();
    if (settingKey === "docwenConnectionMode") this.plugin.resetDocWenRuntime();
    try {
      const saving = this.plugin.saveSettings();
      // saveSettings applies the chosen language before persisting the snapshot.
      // The currently effective model drives all controls even when writing fails.
      if (this.tabs) {
        if (settingKey === "language") this.display();
        else if (settingKey === "docwenConnectionMode" || settingKey === "extractImages" || settingKey === "enableOcr") {
          this.tabs.renderActivePage();
        }
      }
      await saving;
    } finally {
      this.refreshSaveFeedback();
    }
  }

  override hide(): void {
    super.hide();
    this.activePageId = this.tabs?.activePageId ?? this.activePageId;
    this.destroyPageSurface();
    this.expandedHelp.clear();
    this.tabs = null;
  }

  private renderPage(containerEl: HTMLElement, page: SettingsPageDefinition): void {
    this.destroyPageSurface();
    ++this.surfaceGeneration;
    this.saveFeedback = containerEl.createDiv({ attr: { role: "status" } });
    this.refreshSaveFeedback();
    page.items.forEach((item, index) => this.renderDefinition(containerEl, item, index, page.id));
  }

  private renderDefinition(
    containerEl: HTMLElement,
    item: SettingDefinition<SettingsControlKey>,
    index: number,
    pageId: SettingsPageId,
  ): void {
    if (!evaluate(item.visible, true)) return;
    const setting = new Setting(containerEl).setName(item.name);
    setting.settingEl.setAttribute("data-docwen-setting-key", `${pageId}:${index}`);
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
      const isDisabled = () => isSettingsReadOnly(this.plugin.getSettingsCompatibility())
        || evaluate(control.disabled, false);
      const value = this.getControlValue(control.key) ?? control.defaultValue;
      if (control.type === "toggle") {
        setting.addToggle((toggle) => toggle
          .setValue(Boolean(value))
          .setDisabled(isDisabled())
          .onChange((nextValue) => void this.changeControlValue(control.key, nextValue)));
        return;
      }
      if (control.type === "dropdown") {
        setting.addDropdown((dropdown) => {
          dropdown.addOptions(control.options)
            .setValue(typeof value === "string" ? value : "")
            .setDisabled(isDisabled())
            .onChange((nextValue) => void this.changeControlValue(control.key, nextValue));
          if (control.key === "headingNumberingRenderMode") {
            this.updateHeadingNumberingFormat = () => { dropdown.setDisabled(isDisabled()); };
          }
        });
        return;
      }
      if (control.type === "number") {
        configureNumberSetting(setting, control, value, isDisabled(), (nextValue) => {
          void this.changeControlValue(control.key, nextValue);
        });
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
    setting.addButton((button) => button
      .setButtonText(t("settingsCheckConnection"))
      .setDisabled(disabled)
      .onClick(() => {
        if (!disabled) action(setting.settingEl, index);
      }));
  }

  private async changeControlValue(key: SettingsControlKey, value: unknown): Promise<void> {
    try {
      await this.setControlValue(key, value);
    } catch {
      // The save coordinator retains the pending snapshot for the visible retry.
    }
  }

  private destroyPageSurface(): void {
    ++this.surfaceGeneration;
    this.updateHeadingNumberingFormat = undefined;
    for (const cleanup of this.pageCleanups.splice(0)) cleanup();
    this.pathStatusElements.clear();
    this.saveFeedback = null;
  }

  private refreshSaveFeedback(): void {
    const region = this.saveFeedback;
    if (!region) return;
    const state = this.plugin.getSettingsSaveState();
    if (state !== "pending") {
      if (state !== "saving" && region.children.length) {
        const hadFocus = region.ownerDocument.activeElement && region.contains(region.ownerDocument.activeElement);
        region.empty();
        if (hadFocus) region.parentElement?.focus({ preventScroll: true });
      }
      return;
    }
    if (region.children.length) return;
    new Setting(region)
      .setName(t("settingsPersistence"))
      .setDesc(t("settingsChangesPending"))
      .addButton((button) => button.setButtonText(t("settingsRetry")).onClick(async () => {
        if (region !== this.saveFeedback || this.plugin.getSettingsSaveState() !== "pending") return;
        button.setDisabled(true);
        try {
          await this.plugin.retrySettingsSave();
        } catch {
          // A failed retry remains available on the currently displayed page.
        } finally {
          if (region === this.saveFeedback) button.setDisabled(false);
          this.refreshSaveFeedback();
        }
      }));
  }

  private configurePathStatus(setting: Setting): void {
    const status = this.currentConnectionDisplay();
    setting.setName(t("settingsCliPathStatus")).setDesc(status.message);
    setting.descEl.addClass("docwen-cli-path-status");
    setting.descEl.addClass(`docwen-settings-status-${status.state}`);
    setting.descEl.setAttribute("role", "status");
    setting.descEl.setAttribute("aria-live", "polite");
    this.pathStatusElements.add(setting.descEl);
    const generation = this.surfaceGeneration;
    this.pageCleanups.push(configureConnectionActions(setting, this.plugin, () => {
      if (this.isCurrentSurface(generation)) this.refreshPathStatus();
    }));
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
    return connectionDisplay(this.plugin);
  }

  private refreshSettingsUi(): void {
    if (!this.containerEl.isConnected) return;
    if (this.tabs) {
      this.tabs.renderActivePage();
      return;
    }
    this.display();
  }

  private configureNumberingScheme(setting: Setting, key: "docToMdAddNumbering" | "mdToDocAddNumbering"): () => void {
    const generation = this.surfaceGeneration;
    return configureNumberingSchemeSetting(setting, {
      getValue: () => this.plugin.settings[key],
      isCurrent: () => this.isCurrentSurface(generation),
      loadSchemes: (signal) => this.plugin.fetchNumberingSchemes(signal),
      setValue: (value) => this.changeControlValue(key, value),
      readOnly: isSettingsReadOnly(this.plugin.getSettingsCompatibility()),
    });
  }

  private async selectDocWenLocation(kind: DocWenLocationKind): Promise<void> {
    assertSettingsWritable(this.plugin.getSettingsCompatibility());
    let generation = this.surfaceGeneration;
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
    } finally {
      this.refreshSaveFeedback();
    }
    if (this.isCurrentSurface(generation)) {
      this.refreshSettingsUi();
      generation = this.surfaceGeneration;
    }
    showNotice(t("noticePathUpdated"));
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

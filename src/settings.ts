/**
 * DocWen Assistant - Settings Module
 * 
 * Plugin settings interface and settings tab UI
 */

import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import DocWenPlugin from "./main";
import { t } from "./i18n";
import * as fs from "fs";
import * as path from "path";

/**
 * Plugin settings interface
 */
export interface PluginSettings {
  /** Path to the DocWen executable */
  executablePath: string;
  cliExecutablePath: string;
  /** Extract images when converting to Markdown */
  extractImages: boolean;
  /** Enable OCR when converting to Markdown */
  enableOcr: boolean;
  docToMdCleanNumbering: "default" | "remove" | "keep";
  docToMdAddNumbering: "default" | "none" | string;
  mdToDocCleanNumbering: "default" | "remove" | "keep";
  mdToDocAddNumbering: "default" | "none" | string;
}

/**
 * Default settings values
 */
export const DEFAULT_SETTINGS: PluginSettings = {
  executablePath: "",
  cliExecutablePath: "",
  extractImages: true,
  enableOcr: false,
  docToMdCleanNumbering: "default",
  docToMdAddNumbering: "default",
  mdToDocCleanNumbering: "default",
  mdToDocAddNumbering: "default",
};

/**
 * Settings tab for the plugin
 */
export class SettingTab extends PluginSettingTab {
  plugin: DocWenPlugin;

  constructor(app: App, plugin: DocWenPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  private normalizePath(p: string): string {
    return p.trim().replace(/^['"]|['"]$/g, "");
  }

  private detectCliPathFromGui(guiPath: string): string | null {
    const normalized = this.normalizePath(guiPath);
    if (!normalized) return null;
    if (!fs.existsSync(normalized)) return null;
    const stats = fs.statSync(normalized);
    if (!stats.isFile()) return null;
    const candidate = path.join(path.dirname(normalized), "DocWenCLI.exe");
    if (!fs.existsSync(candidate)) return null;
    const cstats = fs.statSync(candidate);
    if (!cstats.isFile()) return null;
    return candidate;
  }

  private detectGuiPathFromCli(cliPath: string): string | null {
    const normalized = this.normalizePath(cliPath);
    if (!normalized) return null;
    if (!fs.existsSync(normalized)) return null;
    const stats = fs.statSync(normalized);
    if (!stats.isFile()) return null;
    const candidate = path.join(path.dirname(normalized), "DocWen.exe");
    if (!fs.existsSync(candidate)) return null;
    const cstats = fs.statSync(candidate);
    if (!cstats.isFile()) return null;
    return candidate;
  }

  private getElectronDialog(): any | null {
    try {
      const electron = require("electron");
      const dialog = electron?.remote?.dialog ?? electron?.dialog ?? null;
      if (dialog) return dialog;
    } catch {}

    try {
      const remote = require("@electron/remote");
      const dialog = remote?.dialog ?? null;
      if (dialog) return dialog;
    } catch {}

    return null;
  }

  /**
   * Render the settings UI
   */
  display(): void {
    const { containerEl } = this;

    // Clear container to prevent duplicate rendering
    containerEl.empty();

    containerEl.createEl("h2", { text: t("settingsTitle") });

    // GUI executable path setting with text input and browse button
    new Setting(containerEl)
      .setName(t("settingsGuiPath"))
      .setDesc(t("settingsGuiPathDesc"))
      .addText((text) => {
        text
          .setPlaceholder(t("settingsGuiPathPlaceholder"))
          .setValue(this.plugin.settings.executablePath)
          .onChange(async (value) => {
            this.plugin.settings.executablePath = value;
            await this.plugin.saveSettings();
            this.validatePath(value);
          });
        
        // Set text box width
        text.inputEl.style.width = "100%";
      })
      .addButton((button) =>
        button
          .setButtonText(t("settingsBrowse"))
          .setTooltip(t("settingsGuiPath"))
          .onClick(async () => {
            const dialog = this.getElectronDialog();
            if (!dialog?.showOpenDialog) {
              new Notice(t("noticeLaunchFailed", { error: "dialog_unavailable" }));
              return;
            }
            
            const result = await dialog.showOpenDialog({
              title: t("settingsGuiPath"),
              filters: [
                { name: "Executable", extensions: ["exe"] },
                { name: "All Files", extensions: ["*"] },
              ],
              properties: ["openFile"],
            });

            if (!result.canceled && result.filePaths.length > 0) {
              const selectedPath = result.filePaths[0];
              // Smart field assignment: detect if user picked CLI instead of GUI
              const basename = path.basename(selectedPath).toLowerCase();
              if (basename === "docwencli.exe") {
                // User picked CLI exe in the GUI field — assign to CLI field instead
                this.plugin.settings.cliExecutablePath = selectedPath;
                // Try to auto-detect GUI from CLI
                const detected = this.detectGuiPathFromCli(selectedPath);
                if (detected) {
                  this.plugin.settings.executablePath = detected;
                }
              } else {
                this.plugin.settings.executablePath = selectedPath;
                // Try to auto-detect CLI from GUI
                if (!this.plugin.settings.cliExecutablePath) {
                  const detected = this.detectCliPathFromGui(selectedPath);
                  if (detected) {
                    this.plugin.settings.cliExecutablePath = detected;
                  }
                }
              }
              await this.plugin.saveSettings();
              
              // Refresh display to update text box
              this.display();
              
              new Notice(t("noticePathUpdated"));
            }
          })
      );

    new Setting(containerEl)
      .setName(t("settingsCliPath"))
      .setDesc(t("settingsCliPathDesc"))
      .addText((text) => {
        text
          .setPlaceholder(t("settingsCliPathPlaceholder"))
          .setValue(this.plugin.settings.cliExecutablePath)
          .onChange(async (value) => {
            this.plugin.settings.cliExecutablePath = value;
            await this.plugin.saveSettings();
            this.validateCliPath(value);
          });

        text.inputEl.style.width = "100%";
      })
      .addButton((button) =>
        button
          .setButtonText(t("settingsBrowse"))
          .setTooltip(t("settingsCliPath"))
          .onClick(async () => {
            const dialog = this.getElectronDialog();
            if (!dialog?.showOpenDialog) {
              new Notice(t("noticeLaunchFailed", { error: "dialog_unavailable" }));
              return;
            }

            const result = await dialog.showOpenDialog({
              title: t("settingsCliPath"),
              filters: [
                { name: "Executable", extensions: ["exe"] },
                { name: "All Files", extensions: ["*"] },
              ],
              properties: ["openFile"],
            });

            if (!result.canceled && result.filePaths.length > 0) {
              const selectedPath = result.filePaths[0];
              // Smart field assignment: detect if user picked GUI instead of CLI
              const basename = path.basename(selectedPath).toLowerCase();
              if (basename === "docwen.exe") {
                // User picked GUI exe in the CLI field — assign to GUI field instead
                this.plugin.settings.executablePath = selectedPath;
                // Try to auto-detect CLI from GUI
                const detected = this.detectCliPathFromGui(selectedPath);
                if (detected) {
                  this.plugin.settings.cliExecutablePath = detected;
                }
              } else {
                this.plugin.settings.cliExecutablePath = selectedPath;
                // Try to auto-detect GUI from CLI
                if (!this.plugin.settings.executablePath) {
                  const detected = this.detectGuiPathFromCli(selectedPath);
                  if (detected) {
                    this.plugin.settings.executablePath = detected;
                  }
                }
              }
              await this.plugin.saveSettings();

              this.display();
              new Notice(t("noticePathUpdated"));
            }
          })
      );

    // Path status display
    {
      const configured = this.normalizePath(this.plugin.settings.executablePath || "");
      const detected = configured ? null : this.detectGuiPathFromCli(this.plugin.settings.cliExecutablePath || "");
      const statusDesc = configured
        ? this.validatePath(configured)
        : detected
          ? `${t("settingsPathValid")}: ${detected} ${t("settingsAutoDetectedSuffix")}`
          : t("settingsPathNotSet");
      const statusSetting = new Setting(containerEl).setName(t("settingsPathStatus")).setDesc(statusDesc);
      if (configured) {
        statusSetting.descEl.style.color = fs.existsSync(configured) ? "var(--text-success)" : "var(--text-error)";
      } else if (detected) {
        statusSetting.descEl.style.color = "var(--text-success)";
      } else {
        statusSetting.descEl.style.color = "var(--text-muted)";
      }
    }

    {
      const configured = this.normalizePath(this.plugin.settings.cliExecutablePath || "");
      const detected = configured ? null : this.detectCliPathFromGui(this.plugin.settings.executablePath || "");
      const statusDesc = configured
        ? this.validateCliPath(configured)
        : detected
          ? `${t("settingsPathValid")}: ${detected} ${t("settingsAutoDetectedSuffix")}`
          : t("settingsCliPathNotSet");
      const statusSetting = new Setting(containerEl)
        .setName(t("settingsCliPathStatus"))
        .setDesc(statusDesc);

      if (configured) {
        statusSetting.descEl.style.color = fs.existsSync(configured) ? "var(--text-success)" : "var(--text-error)";
      } else if (detected) {
        statusSetting.descEl.style.color = "var(--text-success)";
      } else {
        statusSetting.descEl.style.color = "var(--text-muted)";
      }
    }

    // Export to Markdown options
    containerEl.createEl("h3", { text: t("settingsExportMdTitle") });

    new Setting(containerEl)
      .setName(t("settingsExtractImages"))
      .setDesc(t("settingsExtractImagesDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.extractImages)
          .onChange(async (value) => {
            this.plugin.settings.extractImages = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settingsEnableOcr"))
      .setDesc(t("settingsEnableOcrDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableOcr)
          .onChange(async (value) => {
            this.plugin.settings.enableOcr = value;
            await this.plugin.saveSettings();
          })
      );

    let docToMdAddDropdown: any = null;
    let mdToDocAddDropdown: any = null;
    const schemesPromise = (this.plugin as any).fetchNumberingSchemes?.();

    const cleanOptions: Record<string, string> = {
      default: t("settingsNumberingDefault"),
      remove: t("settingsNumberingRemove"),
      keep: t("settingsNumberingKeep"),
    };

    new Setting(containerEl)
      .setName(t("settingsCleanNumbering"))
      .setDesc(t("settingsCleanNumberingDesc"))
      .addDropdown((dropdown) => {
        dropdown.addOptions(cleanOptions);
        dropdown.setValue(this.plugin.settings.docToMdCleanNumbering);
        dropdown.onChange(async (value) => {
          this.plugin.settings.docToMdCleanNumbering = value as any;
          await this.plugin.saveSettings();
        });
      });

    const docToMdAddSetting = new Setting(containerEl)
      .setName(t("settingsAddNumbering"))
      .setDesc(t("settingsAddNumberingDesc"))
      .addDropdown((dropdown) => {
        docToMdAddDropdown = dropdown;
        dropdown.addOption("default", t("settingsNumberingDefault"));
        dropdown.addOption("none", t("settingsNumberingNone"));
        dropdown.setValue(this.plugin.settings.docToMdAddNumbering);
        dropdown.onChange(async (value) => {
          this.plugin.settings.docToMdAddNumbering = value;
          await this.plugin.saveSettings();
        });
      });

    containerEl.createEl("h3", { text: t("settingsExportDocTitle") });

    new Setting(containerEl)
      .setName(t("settingsCleanNumbering"))
      .setDesc(t("settingsCleanNumberingDesc"))
      .addDropdown((dropdown) => {
        dropdown.addOptions(cleanOptions);
        dropdown.setValue(this.plugin.settings.mdToDocCleanNumbering);
        dropdown.onChange(async (value) => {
          this.plugin.settings.mdToDocCleanNumbering = value as any;
          await this.plugin.saveSettings();
        });
      });

    const mdToDocAddSetting = new Setting(containerEl)
      .setName(t("settingsAddNumbering"))
      .setDesc(t("settingsAddNumberingDesc"))
      .addDropdown((dropdown) => {
        mdToDocAddDropdown = dropdown;
        dropdown.addOption("default", t("settingsNumberingDefault"));
        dropdown.addOption("none", t("settingsNumberingNone"));
        dropdown.setValue(this.plugin.settings.mdToDocAddNumbering);
        dropdown.onChange(async (value) => {
          this.plugin.settings.mdToDocAddNumbering = value;
          await this.plugin.saveSettings();
        });
      });

    if (schemesPromise && typeof schemesPromise.then === "function") {
      schemesPromise
        .then((schemes: any[] | null) => {
          if (!schemes || !Array.isArray(schemes) || schemes.length === 0) {
            docToMdAddSetting.setDesc(`${t("settingsAddNumberingDesc")} ${t("settingsNumberingSchemeError")}`);
            mdToDocAddSetting.setDesc(`${t("settingsAddNumberingDesc")} ${t("settingsNumberingSchemeError")}`);
            return;
          }

          const applySchemes = (dropdown: any, currentValue: string) => {
            if (!dropdown?.selectEl) return;
            dropdown.selectEl.innerHTML = "";
            dropdown.addOption("default", t("settingsNumberingDefault"));
            dropdown.addOption("none", t("settingsNumberingNone"));
            for (const s of schemes) {
              const id = String(s?.id || "").trim();
              const name = String(s?.name || "").trim();
              if (!id || !name) continue;
              dropdown.addOption(id, name);
            }
            dropdown.setValue(currentValue);
          };

          applySchemes(docToMdAddDropdown, this.plugin.settings.docToMdAddNumbering);
          applySchemes(mdToDocAddDropdown, this.plugin.settings.mdToDocAddNumbering);
        })
        .catch(() => {
          docToMdAddSetting.setDesc(`${t("settingsAddNumberingDesc")} ${t("settingsNumberingSchemeError")}`);
          mdToDocAddSetting.setDesc(`${t("settingsAddNumberingDesc")} ${t("settingsNumberingSchemeError")}`);
        });
    }

    // Usage instructions
    containerEl.createEl("h3", { text: t("settingsUsageTitle") });
    
    const usageDiv = containerEl.createDiv();
    usageDiv.innerHTML = t("settingsUsageList");
  }

  /**
   * Validate the executable path
   * @param pathStr - Path string to validate
   * @returns Status description string
   */
  validatePath(pathStr: string): string {
    if (!pathStr) {
      return t("settingsPathNotSet");
    }

    const normalizedPath = pathStr.trim().replace(/^['"]|['"]$/g, "");
    
    if (fs.existsSync(normalizedPath)) {
      const stats = fs.statSync(normalizedPath);
      if (stats.isFile()) {
        const ext = path.extname(normalizedPath).toLowerCase();
        if (ext === ".exe" || ext === "") {
          return `${t("settingsPathValid")}: ${normalizedPath}`;
        } else {
          return t("settingsPathNotExe");
        }
      } else {
        return t("settingsPathNotFile");
      }
    } else {
      return t("settingsPathInvalid");
    }
  }

  validateCliPath(pathStr: string): string {
    if (!pathStr) {
      return t("settingsCliPathNotSet");
    }

    const normalizedPath = pathStr.trim().replace(/^['"]|['"]$/g, "");

    if (fs.existsSync(normalizedPath)) {
      const stats = fs.statSync(normalizedPath);
      if (stats.isFile()) {
        const ext = path.extname(normalizedPath).toLowerCase();
        if (ext === ".exe" || ext === "") {
          return `${t("settingsPathValid")}: ${normalizedPath}`;
        } else {
          return t("settingsPathNotExe");
        }
      } else {
        return t("settingsPathNotFile");
      }
    } else {
      return t("settingsPathInvalid");
    }
  }
}

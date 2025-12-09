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
}

/**
 * Default settings values
 */
export const DEFAULT_SETTINGS: PluginSettings = {
  executablePath: "",
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

  /**
   * Render the settings UI
   */
  display(): void {
    const { containerEl } = this;

    // Clear container to prevent duplicate rendering
    containerEl.empty();

    containerEl.createEl("h2", { text: t("settingsTitle") });

    // Executable path setting with text input and browse button
    new Setting(containerEl)
      .setName(t("settingsExePath"))
      .setDesc(t("settingsExePathDesc"))
      .addText((text) => {
        text
          .setPlaceholder(t("settingsExePathPlaceholder"))
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
          .setTooltip(t("settingsExePath"))
          .onClick(async () => {
            // Use Electron's dialog module
            const { dialog } = require("electron").remote || require("@electron/remote");
            
            const result = await dialog.showOpenDialog({
              title: t("settingsExePath"),
              filters: [
                { name: "Executable", extensions: ["exe"] },
                { name: "All Files", extensions: ["*"] },
              ],
              properties: ["openFile"],
            });

            if (!result.canceled && result.filePaths.length > 0) {
              const selectedPath = result.filePaths[0];
              this.plugin.settings.executablePath = selectedPath;
              await this.plugin.saveSettings();
              
              // Refresh display to update text box
              this.display();
              
              new Notice(t("noticePathUpdated"));
            }
          })
      );

    // Path status display
    if (this.plugin.settings.executablePath) {
      const statusDesc = this.validatePath(this.plugin.settings.executablePath);
      const statusSetting = new Setting(containerEl)
        .setName(t("settingsPathStatus"))
        .setDesc(statusDesc);
      
      // Style based on status
      if (fs.existsSync(this.plugin.settings.executablePath.trim().replace(/^['"]|['"]$/g, ""))) {
        statusSetting.descEl.style.color = "var(--text-success)";
      } else {
        statusSetting.descEl.style.color = "var(--text-error)";
      }
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
}

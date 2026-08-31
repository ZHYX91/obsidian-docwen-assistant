import { Setting } from "obsidian";
import { t } from "./i18n";
import {
  SettingsSchemaIncompatibleError,
  type SettingsCompatibility,
} from "./settings-model";

export function renderSettingsSchemaCompatibility(
  containerEl: HTMLElement,
  compatibility: SettingsCompatibility,
): void {
  if (!isSettingsReadOnly(compatibility)) return;
  const setting = new Setting(containerEl)
    .setName(t("settingsSchemaReadOnlyTitle"))
    .setDesc(describeSettingsSchemaCompatibility(compatibility))
    .setClass("docwen-settings-schema-warning");
  setting.settingEl.setAttribute("role", "alert");
  setting.settingEl.setAttribute("aria-live", "assertive");
}

export function describeSettingsSchemaCompatibility(
  compatibility: SettingsCompatibility,
): string {
  if (compatibility.status === "compatible") return t("settingsChangesSaved");
  return t("settingsSchemaReadOnlyDesc", {
    current: String(compatibility.currentSchemaVersion),
    stored: compatibility.storedSchemaVersion === null
      ? "?"
      : String(compatibility.storedSchemaVersion),
  });
}

export function isSettingsReadOnly(compatibility: SettingsCompatibility): boolean {
  return compatibility.status === "incompatible";
}

export function assertSettingsWritable(compatibility: SettingsCompatibility): void {
  if (compatibility.status === "incompatible") {
    throw new SettingsSchemaIncompatibleError(compatibility);
  }
}

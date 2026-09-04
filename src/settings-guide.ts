import { setIcon, type Setting } from "obsidian";

export function renderSettingsGuide(setting: Setting, title: string, body: string): void {
  setting.setClass("docwen-settings-help");
  setting.settingEl.setAttribute("role", "note");
  setting.settingEl.setAttribute("aria-label", title);
  setting.settingEl.empty();
  const heading = setting.settingEl.createDiv({ cls: "docwen-settings-help-heading" });
  const icon = heading.createSpan({
    cls: "docwen-settings-help-icon",
    attr: { "aria-hidden": "true" },
  });
  setIcon(icon, "info");
  heading.createEl("strong", { text: title });
  setting.settingEl.createDiv({ cls: "docwen-settings-help-body", text: body });
}

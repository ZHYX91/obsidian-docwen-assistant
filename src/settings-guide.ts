import { setIcon, type Setting } from "obsidian";
import { getCurrentLocale, t } from "./i18n";

const guideLocales: Readonly<Record<string, string>> = {
  "zh-cn": "zh-CN", "zh-tw": "zh-TW", ja: "ja-JP", ko: "ko-KR",
  de: "de-DE", fr: "fr-FR", es: "es-ES", pt: "pt-BR", ru: "ru-RU", vi: "vi-VN", ar: "ar",
};

export function renderSettingsSupport(setting: Setting): void {
  setting.setClass("docwen-settings-support");
  const locale = guideLocales[getCurrentLocale()];
  const repository = "https://github.com/ZHYX91/obsidian-docwen-assistant";
  for (const [label, href] of [
    [t("settingsUserGuide"), `${repository}/blob/main/${locale ? `docs/i18n/README.${locale}.md` : "README.md"}`],
    [t("settingsReportIssue"), `${repository}/issues/new/choose`],
  ]) {
    setting.controlEl.createEl("a", { text: label, attr: { href, target: "_blank", rel: "noopener noreferrer" } });
  }
}

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

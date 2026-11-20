import { setIcon, type Setting } from "obsidian";
import { getCurrentLocale, t } from "./i18n";
import type { SettingsGuideContent } from "./settings-definitions";

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

/**
 * General/Markdown/Proofread guidance is a short visible description, not a
 * giant help card. The Word tutorial is the only collapsible guide here.
 */
export function renderSettingsGuide(
  setting: Setting, title: string, content: SettingsGuideContent, opened: Set<string>,
): void | (() => void) {
  if (typeof content === "string") {
    setting.setClass("docwen-settings-help-brief");
    setting.settingEl.empty();
    setting.settingEl.createEl("p", { cls: "setting-item-description", text: content });
    return;
  }
  setting.setClass("docwen-settings-help");
  setting.settingEl.empty();
  const details = setting.settingEl.createEl("details", { cls: "docwen-settings-help-disclosure" });
  details.open = opened.has("word");
  const summary = details.createEl("summary");
  const label = summary.createSpan({ cls: "docwen-settings-help-label" });
  label.createSpan({ text: title });
  const icon = label.createSpan({ cls: "docwen-settings-help-icon", attr: { "aria-hidden": "true" } });
  setIcon(icon, "book-open");
  const steps = details.createEl("dl", { cls: "docwen-settings-help-body" });
  for (const step of content) {
    steps.createEl("dt", { text: step.title });
    steps.createEl("dd", { text: step.text });
  }
  return () => {
    if (details.open) opened.add("word"); else opened.delete("word");
  };
}

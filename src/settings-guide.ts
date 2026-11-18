import type { Setting } from "obsidian";
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

/**
 * General/Markdown/Proofread guidance is a short visible description, not a
 * giant help card. The Word tutorial is the only collapsible guide here.
 */
export function renderSettingsGuide(
  setting: Setting, title: string, body: string,
  wordGuide = false, opened: Set<string> = new Set(),
): void {
  if (!wordGuide) {
    setting.setClass("docwen-settings-help-brief");
    setting.setName(title);
    setting.setDesc(body);
    return;
  }
  setting.setClass("docwen-settings-help");
  setting.settingEl.empty();
  const details = setting.settingEl.createEl("details", { cls: "docwen-settings-help-disclosure" });
  details.open = opened.has("word");
  details.createEl("summary", { text: title });
  details.createEl("p", { cls: "docwen-settings-help-body", text: body });
  details.addEventListener("toggle", () => {
    if (details.open) opened.add("word"); else opened.delete("word");
  });
}

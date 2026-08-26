import { getLanguage } from "obsidian";

import { initI18n } from "./i18n";
import type { PluginLanguage } from "./settings-model";

export type ResolvedPluginLocale = Exclude<PluginLanguage, "auto">;

const CLI_LOCALES: Readonly<Record<ResolvedPluginLocale, string>> = {
  en: "en_US",
  "zh-CN": "zh_CN",
  "zh-TW": "zh_TW",
  de: "de_DE",
  fr: "fr_FR",
  ru: "ru_RU",
  "pt-BR": "pt_BR",
  ja: "ja_JP",
  ko: "ko_KR",
  es: "es_ES",
  vi: "vi_VN",
};

/**
 * Uses Obsidian's configured interface language as the only host-language
 * source. Locale aliases and unsupported-language fallback remain inside i18n.
 */
export function initializePluginI18n(language: PluginLanguage): void {
  initI18n(resolvePluginLocale(language));
}

export function getDocWenLanguage(language: PluginLanguage): string {
  return CLI_LOCALES[resolvePluginLocale(language)];
}

export function resolvePluginLocale(
  language: PluginLanguage,
  obsidianLanguage?: string,
): ResolvedPluginLocale {
  if (language !== "auto") return language;
  return resolveObsidianLanguage(obsidianLanguage ?? getLanguage());
}

export function resolveObsidianLanguage(locale: string): ResolvedPluginLocale {
  const language = locale.trim().toLowerCase();
  if (language === "zh-hant" || language.startsWith("zh-hant-")) {
    return "zh-TW";
  }
  if (language === "zh-hans" || language.startsWith("zh-hans-")) {
    return "zh-CN";
  }
  if (
    language === "zh" ||
    language === "zh-cn" ||
    language.startsWith("zh-cn")
  ) {
    return "zh-CN";
  }

  if (
    language === "zh-tw" ||
    language === "zh-hk" ||
    language === "zh-mo" ||
    language.startsWith("zh-tw") ||
    language.startsWith("zh-hk") ||
    language.startsWith("zh-mo")
  ) {
    return "zh-TW";
  }

  const languageBase = language.split("-")[0];
  const supportedLocales: Record<string, ResolvedPluginLocale> = {
    de: "de",
    en: "en",
    es: "es",
    fr: "fr",
    ja: "ja",
    ko: "ko",
    pt: "pt-BR",
    ru: "ru",
    vi: "vi",
  };

  return supportedLocales[languageBase] ?? "en";
}

/** Runtime locale selection and translation lookup. */
import { translations } from "./i18n/catalogs";
import type { Translations } from "./i18n/types";

// Language aliases mapping
const languageAliases: Record<string, string> = {
  "zh": "zh-cn",
  "zh-hans": "zh-cn",
  "zh-hant": "zh-tw",
  "en-us": "en",
  "en-gb": "en",
  "de-de": "de",
  "fr-fr": "fr",
  "ru-ru": "ru",
  "pt-br": "pt",
  "ja-jp": "ja",
  "ko-kr": "ko",
  "es-es": "es",
  "es-mx": "es",
  "vi-vn": "vi",
};

// Current locale cache
let currentLocale: string = "en";
let i18nValidated = false;

function validateI18nTables(): void {
  if (i18nValidated) return;
  i18nValidated = true;

  const baseKeys = Object.keys(translations["en"]) as Array<keyof Translations>;
  for (const [locale, table] of Object.entries(translations)) {
    for (const k of baseKeys) {
      if (!(k in table)) {
        console.warn(`[i18n] Missing key "${String(k)}" in locale "${locale}"`);
      }
    }
  }

  for (const [alias, target] of Object.entries(languageAliases)) {
    if (!translations[target]) {
      console.warn(`[i18n] Alias "${alias}" points to missing locale "${target}"`);
    }
  }
}

/**
 * Initialize i18n with the given locale
 * @param locale - The locale code (e.g., "zh-cn", "en", "de")
 */
export function initI18n(locale: string): void {
  validateI18nTables();
  const normalizedLocale = locale.toLowerCase();

  // Check direct match
  if (translations[normalizedLocale]) {
    currentLocale = normalizedLocale;
    return;
  }

  // Check aliases
  if (languageAliases[normalizedLocale]) {
    currentLocale = languageAliases[normalizedLocale];
    return;
  }

  // Try base language (e.g., "zh-cn" -> "zh")
  const baseLocale = normalizedLocale.split("-")[0];
  if (translations[baseLocale]) {
    currentLocale = baseLocale;
    return;
  }

  if (languageAliases[baseLocale]) {
    currentLocale = languageAliases[baseLocale];
    return;
  }

  // Default to English
  currentLocale = "en";
}

/**
 * Get a translation string by key
 * @param key - The translation key
 * @param params - Optional parameters for string interpolation
 * @returns The translated string
 */
export function t(key: keyof Translations, params?: Record<string, string>): string {
  const translation = translations[currentLocale]?.[key] || translations["en"][key] || key;

  if (!params) {
    return translation;
  }

  // Replace placeholders like {filename} with actual values
  return translation.replace(/\{(\w+)\}/g, (match, paramKey) => {
    return params[paramKey] !== undefined ? params[paramKey] : match;
  });
}

/**
 * Get the current locale
 * @returns The current locale code
 */
export function getCurrentLocale(): string {
  return currentLocale;
}

/**
 * Get all supported locales
 * @returns Array of supported locale codes
 */
export function getSupportedLocales(): string[] {
  return Object.keys(translations);
}


export type { Translations } from "./i18n/types";

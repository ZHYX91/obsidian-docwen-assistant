/** Stable plugin-language values and autonym labels shared by settings paths. */

import type { PluginLanguage } from "./settings-model";

export const LANGUAGE_AUTONYMS: ReadonlyArray<{
  readonly value: Exclude<PluginLanguage, "auto">;
  readonly label: string;
}> = [
  { value: "en", label: "English" },
  { value: "zh-CN", label: "简体中文" },
  { value: "zh-TW", label: "繁體中文" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "ru", label: "Русский" },
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "es", label: "Español" },
  { value: "vi", label: "Tiếng Việt" },
];

export function languageDropdownOptions(autoLabel: string): Record<PluginLanguage, string> {
  return Object.fromEntries([
    ["auto", autoLabel],
    ...LANGUAGE_AUTONYMS.map(({ value, label }) => [value, label]),
  ]) as Record<PluginLanguage, string>;
}

export type CleanNumberingMode = "default" | "remove" | "keep";
export type AddNumberingMode = string;
export type DocWenConnectionMode = "automatic" | "manual";
export type PluginLanguage =
  | "auto"
  | "en"
  | "zh-CN"
  | "zh-TW"
  | "de"
  | "fr"
  | "ru"
  | "pt-BR"
  | "ja"
  | "ko"
  | "es"
  | "vi";

export interface PluginSettings {
  language: PluginLanguage;
  docwenConnectionMode: DocWenConnectionMode;
  docwenCliPath: string;
  extractImages: boolean;
  enableOcr: boolean;
  ocrLanguage: "auto" | "chinese" | "chinese_cht" | "english" | "japanese" | "korean" | "latin" | "cyrillic";
  imageMode: "file" | "base64" | "embed" | "omit";
  imageLinkStyle: "wiki_embed" | "wiki_link" | "markdown_embed" | "markdown_link";
  tableMergeStrategy: "fill" | "empty" | "marker" | "replicate";
  ocrPlacement: "image_md" | "main_md";
  headingMergeMode: "punct_required" | "always" | "never";
  headingNumberingRenderMode: "default" | "text" | "word_native";
  docToMdCleanNumbering: CleanNumberingMode;
  docToMdAddNumbering: AddNumberingMode;
  mdToDocCleanNumbering: CleanNumberingMode;
  mdToDocAddNumbering: AddNumberingMode;
  proofreadOnConvert: boolean;
  proofreadTypo: boolean;
  proofreadSymbol: boolean;
  proofreadPunct: boolean;
  proofreadSensitive: boolean;
}

export type SettingsControlKey = keyof PluginSettings;

export const DEFAULT_SETTINGS: PluginSettings = {
  language: "auto",
  docwenConnectionMode: "automatic",
  docwenCliPath: "",
  extractImages: true,
  enableOcr: false,
  ocrLanguage: "auto",
  imageMode: "file",
  imageLinkStyle: "wiki_embed",
  tableMergeStrategy: "fill",
  ocrPlacement: "image_md",
  headingMergeMode: "punct_required",
  headingNumberingRenderMode: "default",
  docToMdCleanNumbering: "default",
  docToMdAddNumbering: "default",
  mdToDocCleanNumbering: "default",
  mdToDocAddNumbering: "default",
  proofreadOnConvert: true,
  proofreadTypo: true,
  proofreadSymbol: true,
  proofreadPunct: true,
  proofreadSensitive: true,
};

/** Keep only settings owned by the current schema; all unrecognized fields are ignored. */
export function normalizeSettings(
  value: unknown,
  platform: NodeJS.Platform = process.platform,
): PluginSettings {
  const input =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const normalized = {
    ...DEFAULT_SETTINGS,
    docwenConnectionMode: platform === "win32" ? "automatic" : "manual",
  } satisfies PluginSettings;
  const output = normalized as unknown as Record<string, unknown>;
  for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
    const candidate = input[key];
    if (typeof candidate === typeof defaultValue && isSettingValue(key as SettingsControlKey, candidate)) {
      output[key] = candidate;
    }
  }
  // Settings written before automatic Store discovery existed contain only a
  // path. Preserve that working configuration instead of silently switching
  // an existing user to the execution alias.
  if (
    !["automatic", "manual"].includes(String(input.docwenConnectionMode))
    && typeof input.docwenCliPath === "string"
    && input.docwenCliPath.trim().length > 0
  ) {
    normalized.docwenConnectionMode = "manual";
  }
  if (platform !== "win32") normalized.docwenConnectionMode = "manual";
  return normalized;
}

export function setSettingValue(
  settings: PluginSettings,
  key: SettingsControlKey,
  value: unknown,
): void {
  if (!isSettingValue(key, value)) throw new Error(`Invalid value for setting: ${key}`);
  (settings as unknown as Record<string, unknown>)[key] = value;
}

function isSettingValue(key: SettingsControlKey, value: unknown): boolean {
  const defaultValue = DEFAULT_SETTINGS[key];
  if (typeof value !== typeof defaultValue) return false;
  if (typeof defaultValue === "boolean") return true;
  if (typeof value !== "string") return false;
  switch (key) {
    case "docwenConnectionMode":
      return ["automatic", "manual"].includes(value);
    case "language":
      return ["auto", "en", "zh-CN", "zh-TW", "de", "fr", "ru", "pt-BR", "ja", "ko", "es", "vi"].includes(value);
    case "ocrLanguage":
      return ["auto", "chinese", "chinese_cht", "english", "japanese", "korean", "latin", "cyrillic"].includes(value);
    case "imageMode":
      return ["file", "base64", "embed", "omit"].includes(value);
    case "imageLinkStyle":
      return ["wiki_embed", "wiki_link", "markdown_embed", "markdown_link"].includes(value);
    case "tableMergeStrategy":
      return ["fill", "empty", "marker", "replicate"].includes(value);
    case "ocrPlacement":
      return ["image_md", "main_md"].includes(value);
    case "headingMergeMode":
      return ["punct_required", "always", "never"].includes(value);
    case "headingNumberingRenderMode":
      return ["default", "text", "word_native"].includes(value);
    case "docToMdCleanNumbering":
    case "mdToDocCleanNumbering":
      return ["default", "remove", "keep"].includes(value);
    default:
      return true;
  }
}

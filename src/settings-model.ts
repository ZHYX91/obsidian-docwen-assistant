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
  tableMergeStrategy: "fill" | "empty" | "marker";
  ocrPlacement: "image_md" | "main_md";
  renderDpi: number;
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

export const CURRENT_SETTINGS_SCHEMA_VERSION = 2 as const;

export interface PersistedPluginSettings extends PluginSettings {
  schemaVersion: typeof CURRENT_SETTINGS_SCHEMA_VERSION;
}

export type SettingsCompatibility =
  | {
      readonly status: "compatible";
      readonly currentSchemaVersion: typeof CURRENT_SETTINGS_SCHEMA_VERSION;
      readonly storedSchemaVersion: 0 | 1 | typeof CURRENT_SETTINGS_SCHEMA_VERSION;
    }
  | {
      readonly status: "incompatible";
      readonly currentSchemaVersion: typeof CURRENT_SETTINGS_SCHEMA_VERSION;
      readonly storedSchemaVersion: number | null;
      readonly reason: "future-schema" | "invalid-schema";
    };

export interface SettingsLoadResult {
  readonly settings: PluginSettings;
  readonly compatibility: SettingsCompatibility;
  readonly migration: PersistedPluginSettings | null;
}

export class SettingsSchemaIncompatibleError extends Error {
  readonly code = "settings_schema_incompatible";

  constructor(readonly compatibility: Extract<SettingsCompatibility, { status: "incompatible" }>) {
    super("The stored settings schema is incompatible and read-only.");
    this.name = "SettingsSchemaIncompatibleError";
  }
}

export const DEFAULT_SETTINGS: Readonly<PluginSettings> = Object.freeze({
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
  renderDpi: 200,
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
});

/**
 * Normalize current-schema values without mutating the input. This function is
 * intentionally schema-agnostic so future data can be presented read-only
 * without ever being rewritten by the current plugin.
 */
export function normalizeSettings(
  value: unknown,
  platform: NodeJS.Platform = process.platform,
): PluginSettings {
  const input =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const normalized = cloneDefaultSettings();
  normalized.docwenConnectionMode = platform === "win32" ? "automatic" : "manual";
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
  if (input.tableMergeStrategy === "replicate") normalized.tableMergeStrategy = "fill";
  return normalized;
}

/** Resolve persisted data into a runtime view and an optional safe migration. */
export function loadSettingsData(
  value: unknown,
  platform: NodeJS.Platform = process.platform,
): SettingsLoadResult {
  const input = asRecord(value);
  const hasSchemaVersion = input !== null
    && Object.prototype.hasOwnProperty.call(input, "schemaVersion");
  const storedSchemaVersion = hasSchemaVersion ? input.schemaVersion : undefined;
  const settings = normalizeSettings(input ?? {}, platform);

  if (hasSchemaVersion && !isValidSchemaVersion(storedSchemaVersion)) {
    return {
      settings,
      compatibility: {
        status: "incompatible",
        currentSchemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
        storedSchemaVersion: typeof storedSchemaVersion === "number" && Number.isFinite(storedSchemaVersion)
          ? storedSchemaVersion
          : null,
        reason: "invalid-schema",
      },
      migration: null,
    };
  }

  if (
    typeof storedSchemaVersion === "number"
    && storedSchemaVersion > CURRENT_SETTINGS_SCHEMA_VERSION
  ) {
    return {
      settings,
      compatibility: {
        status: "incompatible",
        currentSchemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
        storedSchemaVersion,
        reason: "future-schema",
      },
      migration: null,
    };
  }

  const snapshot = createSettingsSnapshot(settings);
  const canonical = input !== null && JSON.stringify(input) === JSON.stringify(snapshot);
  return {
    settings,
    compatibility: {
      status: "compatible",
      currentSchemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
      storedSchemaVersion: hasSchemaVersion ? storedSchemaVersion as 1 | 2 : 0,
    },
    migration: canonical ? null : snapshot,
  };
}

/** Create an owned deep copy suitable for persistence. */
export function createSettingsSnapshot(settings: PluginSettings): PersistedPluginSettings {
  return {
    schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
    ...structuredClone(settings),
  };
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
  if (typeof defaultValue === "number") {
    return key === "renderDpi"
      && typeof value === "number"
      && Number.isInteger(value)
      && value >= 72
      && value <= 600;
  }
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
      return ["fill", "empty", "marker"].includes(value);
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function cloneDefaultSettings(): PluginSettings {
  return structuredClone(DEFAULT_SETTINGS);
}

function isValidSchemaVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

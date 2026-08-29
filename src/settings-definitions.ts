import type { Setting, SettingDefinition } from "obsidian";
import { t } from "./i18n";
import { languageDropdownOptions } from "./language-options";
import type { PluginSettings, SettingsControlKey } from "./settings-model";
export type { SettingsControlKey } from "./settings-model";
type NumberingAddKey = "docToMdAddNumbering" | "mdToDocAddNumbering";

export type SettingsPageId = "general" | "markdown" | "word" | "proofread" | "usage";

/** Shared page model consumed by the current top-tab settings surface. */
export interface SettingsPageDefinition {
  readonly id: SettingsPageId;
  readonly name: string;
  readonly items: SettingDefinition<SettingsControlKey>[];
}

export interface SettingsPageContext {
  readonly settings: PluginSettings;
  readonly renderCliPath: (setting: Setting) => void;
  readonly renderDocWenDownload: (setting: Setting) => void;
  readonly renderCliStatus: (setting: Setting) => void;
  readonly renderPersistenceStatus: (setting: Setting) => void;
  readonly isPersistencePending: () => boolean;
  readonly renderNumberingScheme: (setting: Setting, key: NumberingAddKey) => void | (() => void);
  readonly renderHelp: (setting: Setting) => void;
  readonly runDoctor: () => void;
}

export function getSettingsPages(
  context: SettingsPageContext,
  platform: NodeJS.Platform = process.platform,
): SettingsPageDefinition[] {
  return [
    {
      id: "general",
      name: t("settingsGeneralTitle"),
      items: [
        dropdown("language", t("settingsLanguage"), t("settingsLanguageDesc"), languageDropdownOptions(t("settingsLanguageAuto"))),
        dropdown(
          "docwenConnectionMode",
          t("settingsConnectionMode"),
          t("settingsConnectionModeDesc"),
          platform === "win32"
            ? {
                automatic: t("settingsConnectionAutomatic"),
                manual: t("settingsConnectionManual"),
              }
            : { manual: t("settingsConnectionManual") },
        ),
        { name: t("settingsCliPathStatus"), render: context.renderCliStatus },
        { name: t("settingsDownloadDocWen"), desc: t("settingsDownloadDocWenDesc"), render: context.renderDocWenDownload },
        {
          name: t("settingsCliPath"),
          desc: t("settingsCliPathDesc"),
          render: context.renderCliPath,
          visible: () => context.settings.docwenConnectionMode === "manual",
        },
        { name: t("commandDoctor"), desc: t("settingsDoctorDesc"), action: context.runDoctor },
        {
          name: t("settingsPersistence"),
          render: context.renderPersistenceStatus,
          visible: context.isPersistencePending,
        },
      ],
    },
    {
      id: "markdown",
      name: t("settingsExportMdTitle"),
      items: [
        toggle("extractImages", t("settingsExtractImages"), t("settingsExtractImagesDesc")),
        dropdown("imageMode", t("settingsImageMode"), t("settingsImageModeDesc"), {
          file: t("settingsImageModeFile"),
          base64: t("settingsImageModeBase64"),
          embed: t("settingsImageModeEmbed"),
          omit: t("settingsImageModeOmit"),
        }, () => !context.settings.extractImages),
        dropdown("imageLinkStyle", t("settingsImageLinkStyle"), t("settingsImageLinkStyleDesc"), {
          wiki_embed: t("settingsImageLinkStyleWikiEmbed"),
          wiki_link: t("settingsImageLinkStyleWikiLink"),
          markdown_embed: t("settingsImageLinkStyleMarkdownEmbed"),
          markdown_link: t("settingsImageLinkStyleMarkdownLink"),
        }),
        toggle("enableOcr", t("settingsEnableOcr"), t("settingsEnableOcrDesc")),
        dropdown("ocrLanguage", t("settingsOcrLanguage"), t("settingsOcrLanguageDesc"), {
          auto: t("settingsOcrLanguageAuto"),
          chinese: t("settingsOcrLanguageChinese"),
          chinese_cht: t("settingsOcrLanguageChineseCht"),
          english: t("settingsOcrLanguageEnglish"),
          japanese: t("settingsOcrLanguageJapanese"),
          korean: t("settingsOcrLanguageKorean"),
          latin: t("settingsOcrLanguageLatin"),
          cyrillic: t("settingsOcrLanguageCyrillic"),
        }, () => !context.settings.enableOcr),
        dropdown("ocrPlacement", t("settingsOcrPlacement"), t("settingsOcrPlacementDesc"), {
          image_md: t("settingsOcrPlacementImageMd"),
          main_md: t("settingsOcrPlacementMainMd"),
        }, () => !context.settings.enableOcr),
        dropdown("tableMergeStrategy", t("settingsTableMergeStrategy"), t("settingsTableMergeStrategyDesc"), {
          fill: t("settingsTableMergeStrategyFill"),
          empty: t("settingsTableMergeStrategyEmpty"),
          marker: t("settingsTableMergeStrategyMarker"),
          replicate: t("settingsTableMergeStrategyReplicate"),
        }),
        cleanNumbering("docToMdCleanNumbering"),
        numberingScheme(context, "docToMdAddNumbering"),
      ],
    },
    {
      id: "word",
      name: t("settingsExportDocTitle"),
      items: [
        dropdown("headingMergeMode", t("settingsHeadingMergeMode"), t("settingsHeadingMergeModeDesc"), {
          punct_required: t("settingsHeadingMergeModePunctRequired"),
          always: t("settingsHeadingMergeModeAlways"),
          never: t("settingsHeadingMergeModeNever"),
        }),
      ],
    },
    {
      id: "proofread",
      name: t("settingsProofreadTitle"),
      items: [
        toggle("proofreadOnConvert", t("settingsProofreadOnConvert"), t("settingsProofreadOnConvertDesc")),
        toggle("proofreadTypo", t("settingsProofreadTypo"), t("settingsProofreadTypoDesc")),
        toggle("proofreadSymbol", t("settingsProofreadSymbol"), t("settingsProofreadSymbolDesc")),
        toggle("proofreadPunct", t("settingsProofreadPunct"), t("settingsProofreadPunctDesc")),
        toggle("proofreadSensitive", t("settingsProofreadSensitive"), t("settingsProofreadSensitiveDesc")),
      ],
    },
    {
      id: "usage",
      name: t("settingsUsageTitle"),
      items: [{ name: t("settingsUsageTitle"), render: context.renderHelp }],
    },
  ];
}

function toggle(
  key: SettingsControlKey,
  name: string,
  desc: string,
): SettingDefinition<SettingsControlKey> {
  return { name, desc, control: { type: "toggle", key } };
}

function dropdown(
  key: SettingsControlKey,
  name: string,
  desc: string,
  options: Record<string, string>,
  disabled?: () => boolean,
): SettingDefinition<SettingsControlKey> {
  return { name, desc, control: { type: "dropdown", key, options, disabled } };
}

function cleanNumbering(
  key: "docToMdCleanNumbering" | "mdToDocCleanNumbering",
): SettingDefinition<SettingsControlKey> {
  return dropdown(key, t("settingsCleanNumbering"), t("settingsCleanNumberingDesc"), {
    default: t("settingsNumberingDefault"),
    remove: t("settingsNumberingRemove"),
    keep: t("settingsNumberingKeep"),
  });
}

function numberingScheme(
  context: SettingsPageContext,
  key: NumberingAddKey,
): SettingDefinition<SettingsControlKey> {
  return {
    name: t("settingsAddNumbering"),
    desc: t("settingsAddNumberingDesc"),
    render: (setting) => context.renderNumberingScheme(setting, key),
  };
}

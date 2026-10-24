import { buildConversionMachineOptions, type ConvertRequest, type ProofreadCheck, type TemplateItem } from "../docwen/client";
import { t, type Translations } from "../i18n";

export interface ExportSummaryRow {
  readonly label: string;
  readonly value: string;
}

/** Project the same capability-filtered request that conversion will send. */
export function buildExportSummary(
  request: ConvertRequest,
  mediaType: string,
  checks: readonly ProofreadCheck[] | null,
  template?: Pick<TemplateItem, "id" | "name" | "origin">,
): ExportSummaryRow[] {
  // Resource bindings are validated by the client, not displayed as settings.
  const options = buildConversionMachineOptions({ ...request, markdownResourceBindings: undefined }, mediaType);
  const rows: ExportSummaryRow[] = [
    { label: t("exportReviewSource"), value: request.sourceInput?.logicalPath ?? request.inputs[0].logicalPath },
    { label: t("exportReviewTarget"), value: request.target.toUpperCase() },
    { label: t("exportReviewDestination"), value: request.outputDirectory },
  ];
  const add = (key: string, label: keyof Translations, value?: string) => {
    if (options[key] !== undefined) rows.push({ label: t(label), value: value ?? optionText(options[key]) });
  };
  const templateLabel = template && template.id === request.template
    ? `${template.name} · ${t(template.origin === "builtin" ? "pickerTemplateBuiltin" : "pickerTemplateCustom")}`
    : undefined;
  add("template_name", "exportReviewTemplate", templateLabel);
  if (request.optimization) rows.push({ label: t("exportReviewOptimization"), value: request.optimization });
  add("remove_numbering", "settingsCleanNumbering", t(options.remove_numbering ? "settingsNumberingRemove" : "settingsNumberingKeep"));
  add("add_numbering", "settingsAddNumbering", options.add_numbering ? optionText(options.numbering_scheme ?? t("settingsNumberingDefault")) : t("settingsNumberingNone"));
  add("heading_numbering_render_mode", "settingsHeadingNumberingRenderMode", t(options.heading_numbering_render_mode === "word_native" ? "settingsHeadingNumberingRenderModeWordNative" : "settingsHeadingNumberingRenderModeText"));
  const enabled = (value: unknown) => t(value ? "exportReviewEnabled" : "exportReviewDisabled");
  for (const key of ["preserve_resources", "to_md_keep_images"]) add(key, "settingsExtractImages", enabled(options[key]));
  for (const key of ["recognize_text", "to_md_enable_ocr"]) add(key, "settingsEnableOcr", enabled(options[key]));
  const choice = (key: string, label: keyof Translations, labels: Record<string, keyof Translations>) => {
    const value = optionText(options[key]);
    add(key, label, labels[value] ? t(labels[value]) : value);
  };
  choice("heading_merge_mode", "settingsHeadingMergeMode", { punct_required: "settingsHeadingMergeModePunctRequired", always: "settingsHeadingMergeModeAlways", never: "settingsHeadingMergeModeNever" });
  choice("ocr_language", "settingsOcrLanguage", {
    auto: "settingsOcrLanguageAuto", chinese: "settingsOcrLanguageChinese", chinese_cht: "settingsOcrLanguageChineseCht",
    english: "settingsOcrLanguageEnglish", japanese: "settingsOcrLanguageJapanese", korean: "settingsOcrLanguageKorean",
    latin: "settingsOcrLanguageLatin", cyrillic: "settingsOcrLanguageCyrillic",
  });
  choice("image_mode", "settingsImageMode", { file: "settingsImageModeFile", base64: "settingsImageModeBase64", embed: "settingsImageModeEmbed", omit: "settingsImageModeOmit" });
  choice("image_link_style", "settingsImageLinkStyle", { wiki_embed: "settingsImageLinkStyleWikiEmbed", wiki_link: "settingsImageLinkStyleWikiLink", markdown_embed: "settingsImageLinkStyleMarkdownEmbed", markdown_link: "settingsImageLinkStyleMarkdownLink" });
  choice("ocr_placement", "settingsOcrPlacement", { image_md: "settingsOcrPlacementImageMd", main_md: "settingsOcrPlacementMainMd" });
  choice("table_merge_strategy", "settingsTableMergeStrategy", { fill: "settingsTableMergeStrategyFill", empty: "settingsTableMergeStrategyEmpty", marker: "settingsTableMergeStrategyMarker" });
  add("render_dpi", "settingsRenderDpi");
  if (checks !== null) {
    const labels: Array<[ProofreadCheck, keyof Translations]> = [
      ["typo", "settingsProofreadTypo"], ["symbol", "settingsProofreadSymbol"],
      ["punct", "settingsProofreadPunct"], ["sensitive", "settingsProofreadSensitive"],
    ];
    const active = labels.filter(([key]) => checks.includes("all") || checks.includes(key));
    rows.push({ label: t("settingsProofreadOnConvert"), value: active.length ? active.map(([, key]) => t(key)).join(" · ") : t("exportReviewDisabled") });
  }
  return rows;
}

function optionText(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : "";
}

import type { ConvertOptions, ProofreadCheck } from "../docwen";
import type { PluginSettings } from "../settings-model";

export function buildMarkdownExportOptions(settings: PluginSettings): ConvertOptions {
  return {
    target: "md",
    extractImages: settings.extractImages,
    imageMode: settings.imageMode,
    imageLinkStyle: settings.imageLinkStyle,
    tableMergeStrategy: settings.tableMergeStrategy,
    enableOcr: settings.enableOcr,
    ocrLanguage: settings.ocrLanguage,
    ocrPlacement: settings.ocrPlacement,
    renderDpi: settings.renderDpi,
  };
}

export function buildHeadingMergeOptions(
  settings: PluginSettings,
): Pick<ConvertOptions, "headingMergeMode"> {
  return settings.headingMergeMode === "punct_required"
    ? {}
    : { headingMergeMode: settings.headingMergeMode };
}

export function buildNumberingOptions(
  settings: PluginSettings,
  cleanMode: string,
  addMode: string,
): Partial<ConvertOptions> {
  return {
    cleanNumbering: cleanMode === "default" ? undefined : cleanMode as "remove" | "keep",
    addNumbering: addMode === "default" ? undefined : addMode,
    headingNumberingRenderMode:
      addMode !== "default" && addMode !== "none" && settings.headingNumberingRenderMode !== "default"
        ? settings.headingNumberingRenderMode
        : undefined,
  };
}

export function buildProofreadChecks(settings: PluginSettings): ProofreadCheck[] {
  const checks: ProofreadCheck[] = [];
  if (settings.proofreadTypo) checks.push("typo");
  if (settings.proofreadSymbol) checks.push("symbol");
  if (settings.proofreadPunct) checks.push("punct");
  if (settings.proofreadSensitive) checks.push("sensitive");
  if (checks.length === 0) return ["none"];
  if (checks.length === 4) return ["all"];
  return checks;
}

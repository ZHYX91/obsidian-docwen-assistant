import type { ConvertRequest, ProofreadCheck } from "./client";
import { LocalCliError } from "./errors";
import { CONVERSION_MEDIA_TYPES } from "./formats";
import { isJsonObject, type JsonObject } from "./machine-framing";

export function buildConversionMachineOptions(request: ConvertRequest, inputMediaType: string): JsonObject {
  const options: JsonObject = {};
  const supported = request.supportedOptions ? new Set(request.supportedOptions) : null;
  const accepts = (name: string) => supported === null || supported.has(name);
  const setOption = (name: string, value: unknown) => {
    if (value !== undefined && accepts(name)) options[name] = value;
  };

  if (request.checks !== undefined) {
    const capability = request.selectedCapability;
    const advertised = capability?.options_schema.properties;
    const candidate = isJsonObject(advertised) ? advertised.proofread : undefined;
    const schema = isJsonObject(candidate) ? candidate : {};
    const properties = isJsonObject(schema.properties) ? schema.properties : {};
    const proofread = proofreadOptions(request.checks);
    if (
      request.target !== "docx" || inputMediaType !== CONVERSION_MEDIA_TYPES.md
      || capability?.capability_id !== "convert.markdown_source.to_docx"
      || !accepts("proofread") || schema.type !== "object" || schema.additionalProperties !== false
      || Object.keys(proofread).length !== 4
      || Object.keys(proofread).some((key) => !isJsonObject(properties[key]) || properties[key].type !== "boolean")
    ) {
      throw new LocalCliError("cli_document_proofread_unavailable", "This DocWen capability does not support document proofreading.");
    }
    options.proofread = proofread;
  }

  setOption("template_name", request.template);
  setOption("markdown_extensions", request.markdownExtensions);
  if (request.markdownResourceBindings !== undefined) {
    if (!accepts("markdown_resource_bindings")) {
      throw new LocalCliError("cli_input_invalid", "This DocWen capability cannot bind authored Markdown resources.");
    }
    setOption("markdown_resource_bindings", request.markdownResourceBindings);
  }
  if (request.target === "md") {
    const isWorkbook = inputMediaType === CONVERSION_MEDIA_TYPES.xlsx;
    const resourceOption = preferredSupportedOption(
      supported,
      ["preserve_resources", "to_md_keep_images"],
      isWorkbook ? "to_md_keep_images" : "preserve_resources",
    );
    const ocrOption = preferredSupportedOption(
      supported,
      ["recognize_text", "to_md_enable_ocr"],
      isWorkbook ? "to_md_enable_ocr" : "recognize_text",
    );
    if (resourceOption) setOption(resourceOption, request.extractImages);
    if (ocrOption) setOption(ocrOption, request.enableOcr);
    setOption("ocr_language", request.ocrLanguage);
    const isFixedLayout = [
      "application/pdf",
      "application/vnd.ofd",
      "application/vnd.ms-xpsdocument",
    ].includes(inputMediaType);
    if (!isFixedLayout || request.imageMode === "file") setOption("image_mode", request.imageMode);
    setOption("image_link_style", request.imageLinkStyle);
    setOption("ocr_placement", request.ocrPlacement);
    setOption("table_merge_strategy", request.tableMergeStrategy === "replicate" ? "fill" : request.tableMergeStrategy);
    setOption("render_dpi", request.renderDpi);
  }
  if (request.cleanNumbering) setOption("remove_numbering", request.cleanNumbering === "remove");
  if (request.addNumbering) {
    setOption("add_numbering", request.addNumbering !== "none");
    if (request.addNumbering !== "none") setOption("numbering_scheme", request.addNumbering);
  }
  setOption("heading_merge_mode", request.headingMergeMode);
  setOption("heading_numbering_render_mode", request.headingNumberingRenderMode);
  return options;
}

function preferredSupportedOption(
  supported: ReadonlySet<string> | null,
  candidates: readonly string[],
  fallback: string,
): string | null {
  if (supported === null) return fallback;
  return candidates.find((candidate) => supported.has(candidate)) ?? null;
}

export function proofreadOptions(checks: readonly ProofreadCheck[]): JsonObject {
  if (checks.length === 0) return {};
  if (checks.includes("none")) {
    return {
      enable_symbol_pairing: false,
      enable_symbol_correction: false,
      enable_typos_rule: false,
      enable_sensitive_word: false,
    };
  }
  const enabled = new Set(checks);
  if (enabled.has("all")) for (const check of ["punct", "typo", "symbol", "sensitive"] as const) enabled.add(check);
  return {
    enable_symbol_pairing: enabled.has("punct"),
    enable_symbol_correction: enabled.has("symbol"),
    enable_typos_rule: enabled.has("typo"),
    enable_sensitive_word: enabled.has("sensitive"),
  };
}

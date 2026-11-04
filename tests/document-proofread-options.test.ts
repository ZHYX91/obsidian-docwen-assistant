import { describe, expect, it } from "vitest";
import { buildConversionMachineOptions, type ConvertRequest } from "../src/docwen/client";
import { getErrorMessage } from "../src/actions/action-errors";
import { LocalCliError } from "../src/docwen/errors";
import { initI18n } from "../src/i18n";
import { buildExportSummary } from "../src/actions/export-summary";

const flags = ["enable_symbol_pairing", "enable_symbol_correction", "enable_typos_rule", "enable_sensitive_word"] as const;
function request(): ConvertRequest {
  return {
    target: "docx", inputs: [{ path: "/isolated/note.md", logicalPath: "note.md", role: "source", kind: "document", mediaType: "text/markdown" }], outputDirectory: "/exports",
    checks: ["all"], supportedOptions: ["proofread"],
    selectedCapability: {
      capability_id: "convert.markdown_source.to_docx",
      options_schema: { properties: { proofread: { type: "object", additionalProperties: false,
        properties: Object.fromEntries(flags.map((flag) => [flag, { type: "boolean" }])) } } },
    } as unknown as ConvertRequest["selectedCapability"],
  };
}

describe("Word conversion proofreading contract", () => {
  it.each([
    { checks: ["all"], values: [true, true, true, true] },
    { checks: ["none"], values: [false, false, false, false] },
    { checks: ["punct", "typo"], values: [true, false, true, false] },
    { checks: ["symbol", "sensitive"], values: [false, true, false, true] },
  ] as const)("sends an explicit boolean for every rule: $checks", ({ checks, values }) => {
    const input = { ...request(), checks };
    expect(buildConversionMachineOptions(input, "text/markdown")).toEqual({
      proofread: Object.fromEntries(flags.map((flag, i) => [flag, values[i]])),
    });
    const rows = buildExportSummary(input, "text/markdown");
    expect(rows.at(-1)?.value).toBeTruthy();
  });

  it("omits proofreading when disabled, including on an old backend", () => {
    const input = { ...request(), checks: undefined, selectedCapability: undefined, supportedOptions: [] };
    expect(buildConversionMachineOptions(input, "text/markdown")).toEqual({});
  });

  it.each(["missing", "partial", "wrong-type", "open-object", "resolved", "spreadsheet", "other-source", "empty-checks", "filtered"])("rejects unsupported or malformed proofreading before planning: %s", (mode) => {
    const input = request();
    let mediaType = "text/markdown";
    if (mode === "missing") input.selectedCapability = undefined;
    if (mode === "resolved") input.selectedCapability!.capability_id = "convert.markdown.to_docx";
    if (mode === "spreadsheet") input.target = "xlsx";
    if (mode === "other-source") mediaType = "application/pdf";
    if (mode === "empty-checks") input.checks = [];
    if (mode === "filtered") input.supportedOptions = [];
    if (["partial", "wrong-type", "open-object"].includes(mode)) {
      const schema = input.selectedCapability!.options_schema.properties as Record<string, Record<string, unknown>>;
      if (mode === "partial") schema.proofread.properties = {};
      if (mode === "wrong-type") schema.proofread.type = "boolean";
      if (mode === "open-object") schema.proofread.additionalProperties = true;
    }
    expect(() => buildConversionMachineOptions(input, mediaType)).toThrowError(expect.objectContaining({ code: "cli_document_proofread_unavailable" }));
  });

  it.each(["en", "zh-cn", "zh-tw"])("provides actionable upgrade or disable guidance (%s)", (locale) => {
    initI18n(locale);
    const message = getErrorMessage(new LocalCliError("cli_document_proofread_unavailable", "private details"));
    expect(message).toContain("DocWen");
    expect(message).toContain("Assistant");
    expect(message).not.toContain("private details");
    expect(message).toMatch(/Upgrade|升级|升級/);
  });
});

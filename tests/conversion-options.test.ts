import { describe, expect, it } from "vitest";

import {
  buildMarkdownExportOptions,
  buildProofreadChecks,
} from "../src/actions/conversion-options";
import { buildConversionMachineOptions, type ConvertRequest } from "../src/docwen/client";
import { DEFAULT_SETTINGS } from "../src/settings-model";

const DOCX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

describe("capability-specific conversion options", () => {
  it("uses canonical OCR fields and omits route-unsupported settings", () => {
    const options = buildConversionMachineOptions(request({
      target: "md",
      extractImages: false,
      enableOcr: true,
      ocrLanguage: "japanese",
      imageMode: "base64",
      imageLinkStyle: "markdown_embed",
      ocrPlacement: "main_md",
      tableMergeStrategy: "empty",
      renderDpi: 300,
      cleanNumbering: "remove",
      addNumbering: "legal",
      supportedOptions: [
        "recognize_text",
        "preserve_resources",
        "ocr_language",
        "image_mode",
        "ocr_placement",
        "image_link_style",
        "table_merge_strategy",
      ],
    }), DOCX_MEDIA_TYPE);

    expect(options).toEqual({
      preserve_resources: false,
      recognize_text: true,
      ocr_language: "japanese",
      image_mode: "base64",
      image_link_style: "markdown_embed",
      ocr_placement: "main_md",
      table_merge_strategy: "empty",
    });
    expect(options).not.toHaveProperty("to_md_keep_images");
    expect(options).not.toHaveProperty("to_md_enable_ocr");
    expect(options).not.toHaveProperty("remove_numbering");
    expect(options).not.toHaveProperty("render_dpi");
  });

  it("keeps the legacy boolean field names only for a route that advertises them", () => {
    const options = buildConversionMachineOptions(request({
      target: "md",
      extractImages: true,
      enableOcr: false,
      supportedOptions: ["to_md_keep_images", "to_md_enable_ocr"],
    }), XLSX_MEDIA_TYPE);

    expect(options).toEqual({
      to_md_keep_images: true,
      to_md_enable_ocr: false,
    });
  });

  it("applies render DPI only to advertised fixed-layout routes and lets their file-only image mode default", () => {
    const options = buildConversionMachineOptions(request({
      target: "md",
      extractImages: true,
      enableOcr: true,
      imageMode: "base64",
      renderDpi: 400,
      supportedOptions: [
        "recognize_text",
        "preserve_resources",
        "image_mode",
        "render_dpi",
      ],
    }), "application/pdf");

    expect(options).toEqual({
      preserve_resources: true,
      recognize_text: true,
      render_dpi: 400,
    });
  });

  it("sends document numbering only when the selected route advertises it", () => {
    const options = buildConversionMachineOptions(request({
      target: "md",
      cleanNumbering: "remove",
      addNumbering: "legal",
      supportedOptions: ["remove_numbering", "add_numbering", "numbering_scheme"],
    }), DOCX_MEDIA_TYPE);

    expect(options).toEqual({
      remove_numbering: true,
      add_numbering: true,
      numbering_scheme: "legal",
    });
  });
});

describe("proofreading check selection", () => {
  it("can request only typo checks without punctuation pairing or symbol correction", () => {
    expect(buildProofreadChecks({
      ...DEFAULT_SETTINGS,
      proofreadTypo: true,
      proofreadSymbol: false,
      proofreadPunct: false,
      proofreadSensitive: false,
    })).toEqual(["typo"]);
  });

  it("includes the fixed-layout DPI in Markdown task preferences", () => {
    expect(buildMarkdownExportOptions({
      ...DEFAULT_SETTINGS,
      renderDpi: 300,
    })).toMatchObject({ renderDpi: 300 });
  });
});

function request(options: Partial<ConvertRequest>): ConvertRequest {
  return {
    target: "md",
    inputs: [],
    outputPath: "D:\\Vault\\output.md",
    ...options,
  };
}

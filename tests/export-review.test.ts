import { beforeEach, describe, expect, it, vi } from "vitest";
import { useObsidianDom } from "./helpers/obsidian-dom";
import { initI18n, t } from "../src/i18n";
import { buildExportSummary } from "../src/actions/export-summary";
import type { ConvertRequest } from "../src/docwen";

const state = vi.hoisted(() => ({ modal: null as { close(): void; contentEl: HTMLElement } | null }));
vi.mock("obsidian", () => ({
  Modal: class Modal {
    readonly contentEl = document.createElement("div");
    readonly titleEl = document.createElement("h2");
    open(): void {
      document.body.append(this.titleEl, this.contentEl);
      state.modal = this;
      (this as { onOpen?: () => void }).onOpen?.();
    }
    close(): void {
      (this as { onClose?: () => void }).onClose?.();
      this.titleEl.remove();
      this.contentEl.remove();
    }
  },
}));
useObsidianDom();
beforeEach(() => { initI18n("en"); state.modal = null; });

function request(overrides: Partial<ConvertRequest> = {}): ConvertRequest {
  return {
    target: "docx", outputDirectory: "/exports",
    inputs: [{ path: "/temporary/input.md", logicalPath: "Notes/Example.md", kind: "document", role: "source", mediaType: "text/markdown" }],
    ...overrides,
  };
}

describe("export summary", () => {
  it("shows only settings accepted by the actual conversion route", () => {
    const rows = buildExportSummary(request({
      template: "Letter", cleanNumbering: "remove", addNumbering: "scheme.not.supported",
      supportedOptions: ["template_name", "remove_numbering"],
      markdownResourceBindings: { authored_sha256: "a".repeat(64), images: [{ authored_token: "private token", logical_path: "private-image.png" }] },
    }), "text/markdown", ["none"]);
    expect(rows).toContainEqual({ label: t("exportReviewTemplate"), value: "Letter" });
    expect(rows).toContainEqual({ label: t("settingsCleanNumbering"), value: t("settingsNumberingRemove") });
    expect(rows.some((row) => row.label === t("settingsAddNumbering"))).toBe(false);
    expect(JSON.stringify(rows)).not.toMatch(/private|temporary|scheme.not.supported/u);
  });

  it("uses the same option aliases and normalization as spreadsheet conversion", () => {
    const rows = buildExportSummary(request({ target: "md", extractImages: true, enableOcr: false, tableMergeStrategy: "replicate", supportedOptions: ["to_md_keep_images", "to_md_enable_ocr", "table_merge_strategy"] }), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", null);
    expect(rows).toContainEqual({ label: t("settingsExtractImages"), value: t("exportReviewEnabled") });
    expect(rows).toContainEqual({ label: t("settingsEnableOcr"), value: t("exportReviewDisabled") });
    expect(rows).toContainEqual({ label: t("settingsTableMergeStrategy"), value: t("settingsTableMergeStrategyFill") });
    expect(rows.some((row) => row.label === t("settingsProofreadOnConvert"))).toBe(false);
  });

  it("shows individual advisory checks without treating them as conversion options", () => {
    const rows = buildExportSummary(request(), "text/markdown", ["typo", "punct"]);
    expect(rows.at(-1)?.value).toBe(`${t("settingsProofreadTypo")} · ${t("settingsProofreadPunct")}`);
    expect(buildExportSummary(request(), "text/markdown", ["all"]).at(-1)?.value).toContain(t("settingsProofreadSensitive"));
  });
});

describe("export review ownership", () => {
  it("renders paths as text and exports only after explicit selection", async () => {
    const { confirmExport } = await import("../src/host/export-review");
    const pending = confirmExport({} as never, [{ label: "Source", value: "<img src=x>" }], new AbortController().signal);
    expect(document.querySelector("dd")?.textContent).toBe("<img src=x>");
    expect(document.querySelector("img")).toBeNull();
    document.querySelector<HTMLButtonElement>(".mod-cta")!.click();
    await expect(pending).resolves.toBe(true);
    expect(document.querySelector("dl")).toBeNull();
  });

  it.each(["abort", "close", "cancel"])("does not approve a stale review after %s", async (event) => {
    const { confirmExport } = await import("../src/host/export-review");
    const controller = new AbortController();
    const pending = confirmExport({} as never, [], controller.signal);
    const approve = document.querySelector<HTMLButtonElement>(".mod-cta")!;
    if (event === "abort") controller.abort();
    else if (event === "close") state.modal!.close();
    else document.querySelector<HTMLButtonElement>("button")!.click();
    approve.click();
    await expect(pending).resolves.toBe(false);
  });

  it("does not open an already cancelled review and preserves Arabic direction", async () => {
    const { confirmExport } = await import("../src/host/export-review");
    await expect(confirmExport({} as never, [], AbortSignal.abort())).resolves.toBe(false);
    expect(state.modal).toBeNull();
    initI18n("ar");
    const pending = confirmExport({} as never, [], new AbortController().signal);
    expect(state.modal!.contentEl.dir).toBe("rtl");
    state.modal!.close();
    await expect(pending).resolves.toBe(false);
  });
});

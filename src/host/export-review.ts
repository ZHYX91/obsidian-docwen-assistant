import { type App, Modal } from "obsidian";
import type { ExportSummaryRow } from "../actions/export-summary";
import { getCurrentLocale, t } from "../i18n";

export function confirmExport(app: App, rows: readonly ExportSummaryRow[], signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => new ExportReviewModal(app, rows, signal, resolve).open());
}

class ExportReviewModal extends Modal {
  private settled = false;
  private readonly onAbort = () => this.finish(false);

  constructor(app: App, private readonly rows: readonly ExportSummaryRow[], private readonly signal: AbortSignal, private readonly resolve: (accepted: boolean) => void) {
    super(app);
  }

  override onOpen(): void {
    this.signal.addEventListener("abort", this.onAbort, { once: true });
    if (this.signal.aborted) { this.finish(false); return; }
    this.titleEl.setText(t("exportReviewTitle"));
    this.contentEl.setAttribute("lang", getCurrentLocale());
    this.contentEl.setAttribute("dir", getCurrentLocale() === "ar" ? "rtl" : "ltr");
    const summary = this.contentEl.createEl("dl", { cls: "docwen-export-summary" });
    for (const row of this.rows) {
      summary.createEl("dt", { text: row.label });
      summary.createEl("dd", { text: row.value });
    }
    this.contentEl.createEl("p", { text: t("exportReviewInherited"), cls: "setting-item-description" });
    const buttons = this.contentEl.createDiv({ cls: "modal-button-container" });
    buttons.createEl("button", { text: t("operationCancel"), attr: { type: "button" } })
      .addEventListener("click", () => this.finish(false));
    buttons.createEl("button", { text: t("exportReviewStart"), cls: "mod-cta", attr: { type: "button" } })
      .addEventListener("click", () => this.finish(true));
  }

  override onClose(): void {
    this.signal.removeEventListener("abort", this.onAbort);
    this.contentEl.empty();
    if (!this.settled) { this.settled = true; this.resolve(false); }
  }

  private finish(accepted: boolean): void {
    if (this.settled) return;
    this.settled = true;
    this.resolve(accepted && !this.signal.aborted);
    this.close();
  }
}

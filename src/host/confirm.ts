import { type App, Modal } from "obsidian";

import { DOCWEN_PRODUCT_NAME } from "../docwen/links";
import { getCurrentLocale, t } from "../i18n";

export interface DetectedFormatDetails {
  sourceName: string;
  declaredFormat: string;
  detectedFormat: string;
}

export function confirmDetectedFormat(
  app: App,
  signal: AbortSignal,
  details: DetectedFormatDetails,
): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    new ConfirmationModal(app, signal, { ...details }, resolve).open();
  });
}

class ConfirmationModal extends Modal {
  private settled = false;
  private readonly onAbort = () => this.finish(false);

  constructor(
    app: App,
    private readonly signal: AbortSignal,
    private readonly details: DetectedFormatDetails,
    private readonly resolve: (accepted: boolean) => void,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.signal.addEventListener("abort", this.onAbort, { once: true });
    if (this.signal.aborted) {
      this.finish(false);
      return;
    }
    this.titleEl.setText(DOCWEN_PRODUCT_NAME);
    this.contentEl.setAttribute("lang", getCurrentLocale());
    this.contentEl.setAttribute("dir", getCurrentLocale() === "ar" ? "rtl" : "ltr");
    this.contentEl.createEl("p", { text: t("dialogDetectedFormat") });
    const summary = this.contentEl.createEl("dl", { cls: "docwen-export-summary" });
    const rows = [
      [t("exportReviewSource"), this.details.sourceName],
      [t("dialogDeclaredFormat"), this.details.declaredFormat.toUpperCase() || t("dialogFormatUnknown")],
      [t("dialogActualFormat"), this.details.detectedFormat.toUpperCase()],
    ];
    for (const [label, value] of rows) {
      summary.createEl("dt", { text: label });
      summary.createEl("dd", { text: value });
    }
    this.contentEl.createEl("p", {
      text: t("dialogReadDetectedFormat", { format: this.details.detectedFormat.toUpperCase() }),
    });
    const controls = this.contentEl.createDiv({ cls: "modal-button-container" });
    controls.createEl("button", { text: t("operationCancel"), attr: { type: "button" } })
      .addEventListener("click", () => this.finish(false));
    controls.createEl("button", { text: t("dialogContinue"), cls: "mod-cta", attr: { type: "button" } })
      .addEventListener("click", () => this.finish(true));
  }

  override onClose(): void {
    this.signal.removeEventListener("abort", this.onAbort);
    this.contentEl.empty();
    if (!this.settled) {
      this.settled = true;
      this.resolve(false);
    }
  }

  private finish(accepted: boolean): void {
    if (this.settled) return;
    this.settled = true;
    this.resolve(accepted && !this.signal.aborted);
    this.close();
  }
}

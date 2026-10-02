import { type App, Modal } from "obsidian";

import { DOCWEN_PRODUCT_NAME } from "../docwen/links";
import { t } from "../i18n";

export function confirmDetectedFormat(
  app: App,
  signal: AbortSignal,
): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    new ConfirmationModal(app, signal, resolve).open();
  });
}

class ConfirmationModal extends Modal {
  private settled = false;
  private readonly onAbort = () => this.finish(false);

  constructor(
    app: App,
    private readonly signal: AbortSignal,
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
    this.contentEl.createEl("p", { text: t("dialogDetectedFormat") });
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

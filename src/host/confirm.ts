import { type App, Modal } from "obsidian";

export function confirmDetectedFormat(
  app: App,
  message: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    new ConfirmationModal(app, message, resolve).open();
  });
}

class ConfirmationModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private readonly message: string,
    private readonly resolve: (accepted: boolean) => void,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.titleEl.setText("DocWen");
    this.contentEl.createEl("p", { text: this.message });
    const controls = this.contentEl.createDiv({ cls: "modal-button-container" });
    controls.createEl("button", { text: "Cancel", attr: { type: "button" } })
      .addEventListener("click", () => this.finish(false));
    controls.createEl("button", { text: "Continue", cls: "mod-cta", attr: { type: "button" } })
      .addEventListener("click", () => this.finish(true));
  }

  override onClose(): void {
    this.contentEl.empty();
    if (!this.settled) {
      this.settled = true;
      this.resolve(false);
    }
  }

  private finish(accepted: boolean): void {
    if (this.settled) return;
    this.settled = true;
    this.resolve(accepted);
    this.close();
  }
}

import { applyInterfaceLocale } from "./host/interface-locale";
import { t, type Translations } from "./i18n";
import {
  OperationCoordinator,
  type OperationKind,
  type OperationSnapshot,
} from "./runtime/operation-coordinator";

const OPERATION_LABELS: Record<OperationKind, keyof Translations> = {
  proofread: "operationProofread",
  export: "operationExport",
  numbering: "operationNumbering",
  doctor: "operationDoctor",
  "gui-control": "operationGuiControl",
  "choose-action": "contextMenuChooseAction",
};

/** Renders safe operation categories only; internal keys and Vault paths never enter the DOM. */
export class OperationStatus {
  private readonly unsubscribe: () => void;
  private readonly label: HTMLElement;
  private button: HTMLButtonElement | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly operations: OperationCoordinator,
  ) {
    applyInterfaceLocale(root);
    root.addClass("docwen-operation-status");
    // Mount before work starts so assistive technology can observe text changes.
    this.label = root.createSpan({ cls: "docwen-operation-status-label", attr: { role: "status", "aria-atomic": "true" } });
    this.unsubscribe = operations.subscribe((snapshot) => this.render(snapshot));
  }

  dispose(): void {
    this.unsubscribe();
    this.button = null;
    this.root.empty();
  }

  refresh(): void {
    applyInterfaceLocale(this.root);
    this.render(this.operations.getSnapshot());
  }

  private render({ operations }: OperationSnapshot): void {
    if (operations.length === 0) {
      this.button?.remove();
      this.button = null;
      this.label.textContent = "";
      return;
    }
    const only = operations.length === 1 ? operations[0] : null;
    const category = only ? t(OPERATION_LABELS[only.kind]) : null;
    const cancelling = operations.every(({ state }) => state === "cancelling");
    let status = t("operationCancelling");
    if (category === null && !cancelling) status = t("operationMultiple", { count: String(operations.length) });
    if (category !== null && !cancelling) status = t("operationRunning", { operation: category });
    if (this.label.textContent !== status) this.label.textContent = status;
    if (!this.button) {
      const button = this.root.createEl("button", { cls: "docwen-operation-cancel", attr: { type: "button" } });
      this.button = button;
      button.addEventListener("click", () => {
        if (this.button !== button || button.disabled) return;
        const active = this.operations.getSnapshot().operations;
        if (active.length === 1) this.operations.cancelGeneration(active[0].generation);
        else this.operations.cancelAll();
      });
    }
    const action = cancelling ? t("operationCancelling") : only ? t("operationCancel") : t("operationCancelAll");
    if (this.button.textContent !== action) this.button.textContent = action;
    this.button.setAttribute("aria-label", !cancelling && category ? `${action}: ${category}` : action);
    this.button.disabled = cancelling;
  }
}

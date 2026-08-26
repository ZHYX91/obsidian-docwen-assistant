import { t, type Translations } from "./i18n";
import {
  OperationCoordinator,
  type OperationItem,
  type OperationKind,
  type OperationSnapshot,
} from "./runtime/operation-coordinator";

const OPERATION_LABELS: Record<OperationKind, keyof Translations> = {
  proofread: "operationProofread",
  export: "operationExport",
  numbering: "operationNumbering",
  doctor: "operationDoctor",
  "gui-control": "operationGuiControl",
};

/** Renders safe operation categories only; internal keys and Vault paths never enter the DOM. */
export class OperationStatus {
  private readonly unsubscribe: () => void;

  constructor(
    private readonly root: HTMLElement,
    private readonly operations: OperationCoordinator,
  ) {
    root.addClass("docwen-operation-status");
    this.unsubscribe = operations.subscribe((snapshot) => this.render(snapshot));
  }

  dispose(): void {
    this.unsubscribe();
    this.root.empty();
  }

  refresh(): void {
    this.render(this.operations.getSnapshot());
  }

  private render(snapshot: OperationSnapshot): void {
    this.root.empty();
    const active = snapshot.operations;
    if (active.length === 0) return;
    if (active.length === 1) {
      this.renderSingle(active[0]);
      return;
    }

    this.root.createSpan({
      cls: "docwen-operation-status-label",
      text: t("operationMultiple", { count: String(active.length) }),
      attr: { role: "status", "aria-live": "polite", "aria-busy": "true" },
    });
    const allCancelling = active.every(({ state }) => state === "cancelling");
    const button = this.root.createEl("button", {
      cls: "docwen-operation-cancel",
      text: allCancelling ? t("operationCancelling") : t("operationCancelAll"),
      attr: {
        type: "button",
        "aria-label": allCancelling ? t("operationCancelling") : t("operationCancelAll"),
        ...(allCancelling ? { disabled: "" } : {}),
      },
    });
    if (!allCancelling) button.addEventListener("click", () => this.operations.cancelAll());
  }

  private renderSingle(operation: OperationItem): void {
    const label = t(OPERATION_LABELS[operation.kind]);
    this.root.createSpan({
      cls: "docwen-operation-status-label",
      text: operation.state === "cancelling"
        ? t("operationCancelling")
        : t("operationRunning", { operation: label }),
      attr: { role: "status", "aria-live": "polite", "aria-busy": "true" },
    });
    const cancelling = operation.state === "cancelling";
    const button = this.root.createEl("button", {
      cls: "docwen-operation-cancel",
      text: cancelling ? t("operationCancelling") : t("operationCancel"),
      attr: {
        type: "button",
        "aria-label": cancelling
          ? t("operationCancelling")
          : `${t("operationCancel")}: ${label}`,
        ...(cancelling ? { disabled: "" } : {}),
      },
    });
    if (!cancelling) {
      button.addEventListener("click", () => this.operations.cancelGeneration(operation.generation));
    }
  }
}

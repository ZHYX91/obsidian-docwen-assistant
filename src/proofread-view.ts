/**
 * DocWen Proofreading Sidebar View
 *
 * Displays proofreading results in a side panel with:
 * - Refresh button to re-run proofreading
 * - Sort toggle (by line number / by rule type)
 * - Clickable issue list that navigates to the source location
 */

import { ItemView, MarkdownView, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import { t } from "./i18n";
import type { ProofreadIssue } from "./docwen";
import {
  type OperationCoordinator,
  type OperationItem,
  type OperationSnapshot,
} from "./runtime/operation-coordinator";

export const PROOFREAD_VIEW_TYPE = "docwen-proofread-view";

type SortMode = "line" | "rule";

export class ProofreadView extends ItemView {
  private issues: ProofreadIssue[] = [];
  private sortMode: SortMode = "line";
  private fileName = "";
  private vaultPath = "";
  private activeOperation: OperationItem | null = null;
  private unsubscribeOperations: (() => void) | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly refresh: () => Promise<void>,
    private readonly operations: OperationCoordinator,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return PROOFREAD_VIEW_TYPE;
  }

  getDisplayText(): string {
    return t("proofreadViewTitle");
  }

  getIcon(): string {
    return "check-circle";
  }

  async onOpen(): Promise<void> {
    this.unsubscribeOperations?.();
    this.unsubscribeOperations = this.operations.subscribe((snapshot) => {
      this.updateOperation(snapshot);
    });
  }

  async onClose(): Promise<void> {
    const generation = this.activeOperation?.generation;
    this.unsubscribeOperations?.();
    this.unsubscribeOperations = null;
    this.activeOperation = null;
    if (generation !== undefined) this.operations.cancelGeneration(generation);
  }

  updateResults(issues: ProofreadIssue[], fileName: string, vaultPath?: string): void {
    this.issues = issues;
    this.fileName = fileName;
    this.vaultPath = vaultPath ?? "";
    this.render();
  }

  private updateOperation(snapshot: OperationSnapshot): void {
    this.activeOperation = [...snapshot.operations]
      .reverse()
      .find(({ kind }) => kind === "proofread") ?? null;
    this.render();
  }

  private getSortedIssues(): ProofreadIssue[] {
    const sorted = [...this.issues];
    if (this.sortMode === "rule") {
      sorted.sort((a, b) => a.rule_key.localeCompare(b.rule_key) || a.range.start.offset - b.range.start.offset);
    } else {
      sorted.sort((a, b) => a.range.start.offset - b.range.start.offset);
    }
    return sorted;
  }

  private render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();

    // Toolbar
    const toolbar = container.createDiv({ cls: "docwen-proofread-toolbar" });

    const refreshBtn = toolbar.createEl("button", { cls: "docwen-proofread-btn", attr: { "aria-label": t("proofreadRefresh") } });
    setIcon(refreshBtn, "refresh-cw");
    if (this.activeOperation) refreshBtn.setAttribute("disabled", "");
    else refreshBtn.addEventListener("click", () => {
      void this.refresh();
    });

    const sortBtn = toolbar.createEl("button", {
      cls: "docwen-proofread-btn",
      attr: { "aria-label": this.sortMode === "line" ? t("proofreadSortByRule") : t("proofreadSortByLine") },
    });
    setIcon(sortBtn, this.sortMode === "line" ? "arrow-down-narrow-wide" : "list-ordered");
    sortBtn.addEventListener("click", () => {
      this.sortMode = this.sortMode === "line" ? "rule" : "line";
      this.render();
    });

    // Status / file name
    if (this.fileName) {
      toolbar.createSpan({ cls: "docwen-proofread-filename", text: this.fileName });
    }

    if (this.activeOperation) {
      const cancelling = this.activeOperation.state === "cancelling";
      const cancelButton = toolbar.createEl("button", {
        cls: "docwen-proofread-cancel",
        text: cancelling ? t("operationCancelling") : t("operationCancel"),
        attr: {
          type: "button",
          "aria-label": cancelling ? t("operationCancelling") : t("operationCancel"),
          ...(cancelling ? { disabled: "" } : {}),
        },
      });
      if (!cancelling) {
        const generation = this.activeOperation.generation;
        cancelButton.addEventListener("click", () => this.operations.cancelGeneration(generation));
      }
    }

    // Content
    if (this.activeOperation) {
      const cancelling = this.activeOperation.state === "cancelling";
      container.createDiv({
        cls: "docwen-proofread-status",
        text: cancelling
          ? t("operationCancelling")
          : t("operationRunning", { operation: t("operationProofread") }),
        attr: {
          role: "status",
          "aria-live": "polite",
          "aria-busy": "true",
        },
      });
      return;
    }

    if (!this.fileName) {
      container.createDiv({ cls: "docwen-proofread-status", text: t("proofreadOpenMdFile") });
      return;
    }

    if (this.issues.length === 0) {
      container.createDiv({ cls: "docwen-proofread-status", text: t("proofreadNoIssues") });
      return;
    }

    // Issue list
    const list = container.createDiv({ cls: "docwen-proofread-list" });
    const sorted = this.getSortedIssues();

    for (const issue of sorted) {
      const displayLine = issue.range.start.line + 1;
      const item = list.createEl("button", {
        cls: "docwen-proofread-item",
        attr: {
          type: "button",
          "aria-label": `L${displayLine} ${issue.rule_key}: ${issue.error_text}`,
        },
      });
      item.addEventListener("click", () => {
        this.navigateToIssue(issue);
      });

      const header = item.createDiv({ cls: "docwen-proofread-item-header" });
      header.createSpan({ cls: "docwen-proofread-line", text: `L${displayLine}` });
      header.createSpan({ cls: "docwen-proofread-rule", text: issue.rule_key });

      const body = item.createDiv({ cls: "docwen-proofread-item-body" });
      body.createSpan({ cls: "docwen-proofread-error", text: issue.error_text });
      if (issue.suggestion) {
        body.createSpan({ cls: "docwen-proofread-arrow", text: " → " });
        body.createSpan({ cls: "docwen-proofread-suggestion", text: issue.suggestion });
      }
    }
  }

  private navigateToIssue(issue: ProofreadIssue): void {
    const file = this.vaultPath
      ? this.app.vault.getAbstractFileByPath(this.vaultPath)
      : this.app.workspace.getActiveFile();
    if (!file) return;

    const leaf = this.app.workspace.getLeaf(false);
    if (!leaf) return;

    if (!(file instanceof TFile)) return;

    void leaf.openFile(file).then(() => {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) return;
      const editor = view.editor;

      const start = issue.range.start;
      const end = issue.range.end;
      const from = {
        line: start.line,
        ch: unicodeColumnToUtf16Column(editor.getLine(start.line), start.column),
      };
      const to = {
        line: end.line,
        ch: unicodeColumnToUtf16Column(editor.getLine(end.line), end.column),
      };
      editor.setSelection(from, to);
      editor.scrollIntoView({ from, to }, true);
    });
  }
}

export function unicodeColumnToUtf16Column(line: string, unicodeColumn: number): number {
  return Array.from(line).slice(0, unicodeColumn).join("").length;
}

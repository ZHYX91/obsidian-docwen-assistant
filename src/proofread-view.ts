/**
 * DocWen Proofreading Sidebar View
 *
 * Displays proofreading results in a side panel with:
 * - Refresh button to re-run proofreading
 * - Sort toggle (by line number / by rule type)
 * - Clickable issue list that navigates to the source location
 */

import { ItemView, MarkdownView, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import { createHash } from "node:crypto";
import { t } from "./i18n";
import type { Translations } from "./i18n/types";
import type { ProofreadIssue } from "./docwen";
import { isSameOpenMarkdownTarget, locateOpenMarkdownTarget } from "./host/open-markdown-target";
import {
  type OperationCoordinator,
  type OperationItem,
  type OperationSnapshot,
} from "./runtime/operation-coordinator";

export const PROOFREAD_VIEW_TYPE = "docwen-proofread-view";

type SortMode = "line" | "rule";

const RULE_LABELS: Readonly<Record<string, keyof Translations>> = {
  typo: "settingsProofreadTypo",
  symbol_correct: "settingsProofreadSymbol",
  symbol_pair: "settingsProofreadPunct",
  sensitive: "settingsProofreadSensitive",
};

export class ProofreadView extends ItemView {
  private issues: ProofreadIssue[] = [];
  private sortMode: SortMode = "line";
  private fileName = "";
  private vaultPath = "";
  private sourceSha256 = "";
  private resultsRevision = 0;
  private stale = false;
  private activeOperation: OperationItem | null = null;
  private cancelled = false;
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
    (this.containerEl.children[1] as HTMLElement).addClass("docwen-proofread-root");
    this.unsubscribeOperations?.();
    this.unsubscribeOperations = this.operations.subscribe((snapshot) => {
      this.updateOperation(snapshot);
    });
  }

  async onClose(): Promise<void> {
    this.resultsRevision += 1;
    const generation = this.activeOperation?.generation;
    this.unsubscribeOperations?.();
    this.unsubscribeOperations = null;
    this.activeOperation = null;
    (this.containerEl.children[1] as HTMLElement).removeClass("docwen-proofread-root");
    if (generation !== undefined) this.operations.cancelGeneration(generation);
  }

  updateResults(issues: ProofreadIssue[], fileName: string, vaultPath: string, sourceSha256: string): void {
    this.resultsRevision += 1;
    this.cancelled = false;
    this.stale = false;
    this.issues = issues;
    this.fileName = fileName;
    this.vaultPath = vaultPath;
    this.sourceSha256 = sourceSha256;
    this.render();
  }

  private updateOperation(snapshot: OperationSnapshot): void {
    const previousOperation = this.activeOperation;
    this.activeOperation = [...snapshot.operations]
      .reverse()
      .find(({ kind }) => kind === "proofread") ?? null;
    if (this.activeOperation && this.activeOperation.generation !== previousOperation?.generation) {
      this.resultsRevision += 1;
    }
    if (this.activeOperation) this.cancelled = false;
    else if (previousOperation?.state === "cancelling") this.cancelled = true;
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
    container.addClass("docwen-proofread-root");
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
      toolbar.createSpan({
        cls: "docwen-proofread-filename",
        text: this.fileName,
        attr: { title: this.fileName },
      });
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

    if (this.cancelled) {
      container.createDiv({
        cls: "docwen-proofread-status",
        text: t("proofreadCancelled"),
        attr: { role: "status", "aria-live": "polite" },
      });
      return;
    }

    if (!this.fileName) {
      container.createDiv({
        cls: "docwen-proofread-status",
        text: t("proofreadOpenMdFile"),
        attr: { role: "status" },
      });
      return;
    }

    if (this.stale) {
      container.createDiv({
        cls: "docwen-proofread-status",
        text: t("proofreadSourceChanged"),
        attr: { role: "status", "aria-live": "polite" },
      });
      return;
    }

    if (this.issues.length === 0) {
      container.createDiv({ cls: "docwen-proofread-status", text: t("proofreadNoIssues") });
      return;
    }

    // Issue list
    const list = container.createDiv({ cls: "docwen-proofread-list" });
    const sorted = this.getSortedIssues();
    const revision = this.resultsRevision;

    for (const issue of sorted) {
      const displayLine = issue.range.start.line + 1;
      const ruleLabel = issue.rule_key === "symbol_pair"
        ? t("proofreadUnmatchedSymbol")
        : t(RULE_LABELS[issue.rule_key] ?? "proofreadViewTitle");
      const suggestion = issue.fix?.replacement;
      const correction = suggestion !== undefined ? ` → ${suggestion}` : "";
      const item = list.createEl("button", {
        cls: "docwen-proofread-item",
        attr: {
          type: "button",
          "aria-label": `L${displayLine} ${ruleLabel}: ${issue.error_text}${correction}`,
        },
      });
      item.addEventListener("click", () => {
        void this.navigateToIssue(issue, revision);
      });

      const header = item.createDiv({ cls: "docwen-proofread-item-header" });
      header.createSpan({ cls: "docwen-proofread-line", text: `L${displayLine}` });
      header.createSpan({ cls: "docwen-proofread-rule", text: ruleLabel });

      const body = item.createDiv({ cls: "docwen-proofread-item-body" });
      body.createSpan({ cls: "docwen-proofread-error", text: issue.error_text });
      if (suggestion !== undefined) {
        body.createSpan({ cls: "docwen-proofread-arrow", text: " → " });
        body.createSpan({ cls: "docwen-proofread-suggestion", text: suggestion });
      }
    }
  }

  private async navigateToIssue(issue: ProofreadIssue, revision: number): Promise<void> {
    const sourceSha256 = this.sourceSha256;
    const vaultPath = this.vaultPath;
    const isCurrent = (): boolean => revision === this.resultsRevision && !this.activeOperation;
    const invalidate = (): void => {
      if (!isCurrent()) return;
      this.stale = true;
      this.render();
    };
    if (!isCurrent() || this.stale) return;
    try {
      const file = this.app.vault.getAbstractFileByPath(vaultPath);
      if (!(file instanceof TFile) || !/^[a-f0-9]{64}$/u.test(sourceSha256)) {
        invalidate();
        return;
      }
      const target = locateOpenMarkdownTarget(this.app.workspace, vaultPath);
      if (target.kind === "ambiguous"
        || (target.kind === "open" && !matchesSource(target.target.editor.getValue(), sourceSha256))) {
        invalidate();
        return;
      }
      const leaf = target.kind === "open" ? target.target.leaf : this.app.workspace.getLeaf(false);
      if (!leaf) return;
      await leaf.openFile(file);
      if (!isCurrent()) return;
      const view = leaf.view;
      if (!(view instanceof MarkdownView) || view.file !== file || file.path !== vaultPath
        || this.app.vault.getAbstractFileByPath(vaultPath) !== file
        || (target.kind === "open" && !isSameOpenMarkdownTarget(this.app.workspace, vaultPath, target.target))
        || !isSameOpenMarkdownTarget(this.app.workspace, vaultPath, { leaf, view, editor: view.editor })
        || !matchesSource(view.editor.getValue(), sourceSha256)) {
        invalidate();
        return;
      }
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
    } catch {
      invalidate();
    }
  }
}

function matchesSource(content: string, sourceSha256: string): boolean {
  return createHash("sha256").update(content, "utf8").digest("hex") === sourceSha256;
}

export function unicodeColumnToUtf16Column(line: string, unicodeColumn: number): number {
  return Array.from(line).slice(0, unicodeColumn).join("").length;
}

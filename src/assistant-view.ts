/**
 * DocWen Assistant sidebar with explicit GUI/file/proofreading actions and a
 * source-bound proofreading report. Opening the view never starts an action.
 */

import { CONVERSION_MEDIA_TYPES, mediaTypeForPath } from "./docwen/formats";
import { ItemView, type TFile, WorkspaceLeaf, setIcon } from "obsidian";
import { selectProofreadIssue } from "./host/proofread-navigation";
import { getCurrentLocale, t } from "./i18n";
import { preserveViewState } from "./settings-view-state";
import { AssistantExports, type AssistantExportActions } from "./assistant-exports";
import type { Translations } from "./i18n/types";
import type { ProofreadIssue } from "./docwen";
import { showNotice } from "./host/notices";
import { resolveAbsoluteFilePath } from "./host/vault-files";
import {
  type OperationCoordinator,
  type OperationItem,
  type OperationLease,
  type OperationSnapshot,
} from "./runtime/operation-coordinator";

// Stable workspace identity for this sidebar and its report.
export const ASSISTANT_VIEW_TYPE = "docwen-proofread-view";

export interface AssistantViewActions extends AssistantExportActions {
  openGui(): Promise<void>;
  openCurrentFile(): Promise<void>;
  proofreadCurrentFile(view: AssistantView): Promise<void>;
}

type SortMode = "line" | "rule";
type AssistantTab = "proofread" | "actions";
let nextViewId = 0;
const ISSUE_BATCH_SIZE = 200;

const RULE_LABELS: Readonly<Record<string, keyof Translations>> = {
  typo: "settingsProofreadTypo",
  symbol_correct: "settingsProofreadSymbol",
  symbol_pair: "settingsProofreadPunct",
  sensitive: "settingsProofreadSensitive",
};

export class AssistantView extends ItemView {
  private static readonly leafOpenings = new WeakMap<WorkspaceLeaf, { count: number; view: AssistantView }>();

  /** A pending host load may open one view on this leaf, even between two awaits. */
  static captureLeafOpening(leaf: WorkspaceLeaf): () => boolean {
    const initial = leaf.view;
    if (initial instanceof AssistantView) {
      const isOpen = initial.captureLifetime();
      if (isOpen()) return () => leaf.view === initial && isOpen();
    }
    const before = AssistantView.leafOpenings.get(leaf);
    return () => {
      const opened = AssistantView.leafOpenings.get(leaf);
      if (opened === before) return true;
      return opened !== undefined && opened.count === (before?.count ?? 0) + 1
        && leaf.view === opened.view && opened.view.sidebarOpen;
    };
  }

  private issues: ProofreadIssue[] = [];
  private issueIndices = new Map<ProofreadIssue, number>();
  private sortedIssuesCache: { revision: number; mode: SortMode; issues: ProofreadIssue[] } | null = null;
  private sortMode: SortMode = "line";
  private fileName = "";
  private vaultPath = "";
  private sourceSha256 = "";
  private resultsRevision = 0;
  private navigationSequence = 0;
  private visibleIssueCount = ISSUE_BATCH_SIZE;
  private stale = false;
  private activeOperation: OperationItem | null = null;
  private cancelled = false;
  private unsubscribeOperations: (() => void) | null = null;
  // Keep lifecycle state separate from the host View.open() method.
  private sidebarOpen = false;
  private lifecycle = 0;
  private ownedTask: { generation: number; path: string } | null = null;
  private renderedLocale: string | null = null;
  private openFileButton: HTMLButtonElement | null = null;
  private proofreadButton: HTMLButtonElement | null = null;
  private refreshButton: HTMLButtonElement | null = null;
  private readonly viewId = ++nextViewId;
  private activeTab: AssistantTab = "proofread";
  private readonly tabs = new Map<AssistantTab, HTMLButtonElement>();
  private readonly panels = new Map<AssistantTab, HTMLElement>();
  private readonly fileContexts: HTMLElement[] = [];
  private readonly exports: AssistantExports;
  private readonly panelScroll = new Map<AssistantTab, { top: number; left: number; listTop: number }>();

  constructor(
    leaf: WorkspaceLeaf,
    private readonly refresh: (vaultPath: string, view: AssistantView) => Promise<void>,
    private readonly operations: OperationCoordinator,
    private readonly actions: AssistantViewActions,
  ) {
    super(leaf);
    this.exports = new AssistantExports(actions, () => this.currentLocalFile(), refresh => this.refreshActiveFile(refresh));
  }

  getState(): { activeTab: AssistantTab } {
    return { activeTab: this.activeTab };
  }

  async setState(state: unknown): Promise<void> {
    const tab = state && typeof state === "object" && "activeTab" in state ? state.activeTab : null;
    this.selectTab(tab === "actions" ? "actions" : "proofread");
  }

  selectTab(tab: AssistantTab, focus = false): void {
    const changed = this.activeTab !== tab;
    if (changed) this.savePanelScroll();
    this.activeTab = tab;
    for (const [id, button] of this.tabs) {
      const selected = id === tab;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
      const panel = this.panels.get(id);
      if (panel) panel.hidden = !selected;
    }
    if (changed) {
      const panel = this.panels.get(tab);
      const scroll = this.panelScroll.get(tab);
      if (panel && scroll) {
        panel.scrollTop = scroll.top;
        panel.scrollLeft = scroll.left;
        const list = panel.querySelector<HTMLElement>(".docwen-proofread-list");
        if (list) list.scrollTop = scroll.listTop;
      }
    }
    this.refreshActiveFile();
    if (focus) {
      const button = this.tabs.get(tab);
      button?.focus({ preventScroll: true });
      button?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }
    if (changed) this.app.workspace.requestSaveLayout?.();
  }

  private savePanelScroll(): void {
    const panel = this.panels.get(this.activeTab);
    if (panel && !panel.hidden) this.panelScroll.set(this.activeTab, {
      top: panel.scrollTop, left: panel.scrollLeft,
      listTop: panel.querySelector<HTMLElement>(".docwen-proofread-list")?.scrollTop ?? 0,
    });
  }

  getViewType(): string {
    return ASSISTANT_VIEW_TYPE;
  }

  getDisplayText(): string {
    return t("sidebarTitle");
  }

  getIcon(): string {
    return "file-text";
  }

  async onOpen(): Promise<void> {
    const count = (AssistantView.leafOpenings.get(this.leaf)?.count ?? 0) + 1;
    AssistantView.leafOpenings.set(this.leaf, { count, view: this });
    this.sidebarOpen = true;
    this.lifecycle += 1;
    (this.containerEl.children[1] as HTMLElement).addClass("docwen-proofread-root");
    this.render();
    this.unsubscribeOperations?.();
    this.unsubscribeOperations = this.operations.subscribe((snapshot) => {
      this.updateOperation(snapshot);
    });
  }

  async onClose(): Promise<void> {
    this.sidebarOpen = false;
    this.lifecycle += 1;
    this.resultsRevision += 1;
    const task = this.ownedTask;
    this.ownedTask = null;
    this.cancelled = false;
    this.unsubscribeOperations?.();
    this.unsubscribeOperations = null;
    this.activeOperation = null;
    this.openFileButton = null;
    this.proofreadButton = null;
    this.refreshButton = null;
    this.exports.dispose();
    this.tabs.clear();
    this.panels.clear();
    this.fileContexts.length = 0;
    (this.containerEl.children[1] as HTMLElement).removeClass("docwen-proofread-root");
    if (task) this.operations.cancelGeneration(task.generation);
  }

  /** Bind publication and cancellation to this exact open view lifetime. */
  ownOperation(lease: OperationLease, path: string): () => boolean {
    const isOpen = this.captureLifetime();
    if (!isOpen()) {
      this.operations.cancelGeneration(lease.generation);
      return () => false;
    }
    if (!lease.isCurrent()) return () => false;
    this.selectTab("proofread", this.activeTab !== "proofread");
    this.ownedTask = { generation: lease.generation, path };
    this.updateOperation(this.operations.getSnapshot());
    return () => isOpen() && this.ownedTask?.generation === lease.generation && lease.isCurrent();
  }

  /** Scope late host cleanup to the runtime that constructed this view. */
  belongsToRuntime(operations: OperationCoordinator): boolean {
    return this.operations === operations;
  }

  captureLifetime(): () => boolean {
    const lifecycle = this.lifecycle;
    return () => this.sidebarOpen && this.lifecycle === lifecycle;
  }

  /** Refresh existing reports when the plugin's effective interface language changes. */
  refreshLocale(): void {
    if (this.sidebarOpen && this.renderedLocale !== getCurrentLocale()) this.render();
  }

  /** File changes update only the action controls; the report, focus and scroll stay intact. */
  refreshActiveFile(refreshExports = false): void {
    if (!this.sidebarOpen) return;
    // Public host contract: non-FileView focus retains the most recently active file.
    // Read it afresh; file changes and closure must never reuse a cached TFile.
    const localFile = this.currentLocalFile();
    const isMarkdown = localFile !== null && mediaTypeForPath(localFile.path) === CONVERSION_MEDIA_TYPES.md;
    if (this.openFileButton) this.openFileButton.disabled = !localFile;
    if (this.proofreadButton) this.proofreadButton.disabled = !isMarkdown || this.activeOperation !== null;
    if (this.refreshButton) this.refreshButton.disabled = this.activeOperation !== null || (!this.vaultPath && !isMarkdown);
    for (const context of this.fileContexts) {
      const name = context.querySelector<HTMLElement>(".docwen-assistant-filename");
      const path = context.querySelector<HTMLElement>(".docwen-assistant-filepath");
      if (name) name.setText(localFile ? t("sidebarCurrentFile", { filename: localFile.name }) : t("sidebarNoFile"));
      if (path) path.setText(localFile?.path ?? "");
    }
    this.exports.refresh(localFile, this.activeTab === "actions", refreshExports);
  }

  private currentLocalFile(): TFile | null {
    const file = this.app.workspace.getActiveFile();
    return file && resolveAbsoluteFilePath(this.app.vault, file) ? file : null;
  }

  updateResults(issues: ProofreadIssue[], fileName: string, vaultPath: string, sourceSha256: string): void {
    this.resultsRevision += 1;
    this.visibleIssueCount = ISSUE_BATCH_SIZE;
    this.cancelled = false;
    this.stale = false;
    this.issues = issues;
    this.issueIndices = new Map(issues.map((issue, index) => [issue, index]));
    this.sortedIssuesCache = null;
    this.fileName = fileName;
    this.vaultPath = vaultPath;
    this.sourceSha256 = sourceSha256;
    this.render();
  }

  private updateOperation(snapshot: OperationSnapshot): void {
    const previousOperation = this.activeOperation;
    const nextOperation = [...snapshot.operations]
      .reverse()
      .find(({ generation }) => generation === this.ownedTask?.generation) ?? null;
    if (nextOperation?.generation === previousOperation?.generation
      && nextOperation?.kind === previousOperation?.kind
      && nextOperation?.state === previousOperation?.state) return;
    this.activeOperation = nextOperation;
    if (this.activeOperation && this.activeOperation.generation !== previousOperation?.generation) {
      this.resultsRevision += 1;
    }
    if (this.activeOperation) this.cancelled = false;
    else if (previousOperation?.state === "cancelling") this.cancelled = true;

    // Transfer focus only while a control in this panel is losing its action.
    // Work finishing later must leave focus in the editor or another tab alone.
    const panel = this.panels.get("proofread");
    const focused = panel?.ownerDocument.activeElement;
    const key = panel && !panel.hidden && focused && panel.contains(focused)
      ? focused.getAttribute("data-docwen-view-key") : null;
    this.render();
    if (nextOperation?.state === "running" && (key === "refresh" || key === "proofread-current-file")) {
      this.panels.get("proofread")?.querySelector<HTMLElement>(".docwen-proofread-cancel")?.focus({ preventScroll: true });
    } else if (key === "cancel" && nextOperation?.state !== "running") {
      this.tabs.get("proofread")?.focus({ preventScroll: true });
    }
  }

  private getSortedIssues(): ProofreadIssue[] {
    if (this.sortedIssuesCache?.revision === this.resultsRevision && this.sortedIssuesCache.mode === this.sortMode) {
      return this.sortedIssuesCache.issues;
    }
    const sorted = [...this.issues];
    if (this.sortMode === "rule") {
      sorted.sort((a, b) => a.rule_key.localeCompare(b.rule_key) || a.range.start.offset - b.range.start.offset);
    } else {
      sorted.sort((a, b) => a.range.start.offset - b.range.start.offset);
    }
    this.sortedIssuesCache = { revision: this.resultsRevision, mode: this.sortMode, issues: sorted };
    return sorted;
  }

  private render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    this.savePanelScroll();
    preserveViewState(container, () => this.renderContent(container), "data-docwen-view-key", "data-docwen-scroll-key");
  }

  private renderContent(container: HTMLElement): void {
    this.renderedLocale = getCurrentLocale();
    container.addClass("docwen-proofread-root");
    container.setAttribute("lang", this.renderedLocale);
    container.setAttribute("dir", this.renderedLocale === "ar" ? "rtl" : "ltr");
    container.empty();

    this.tabs.clear();
    this.panels.clear();
    this.fileContexts.length = 0;
    const tabList = container.createDiv({
      cls: "docwen-assistant-tabs",
      attr: { role: "tablist", "aria-label": t("sidebarTitle"), "aria-orientation": "horizontal" },
    });
    const isOpen = this.captureLifetime();
    for (const id of ["proofread", "actions"] as const) {
      const tabId = `docwen-assistant-${this.viewId}-tab-${id}`;
      const panelId = `docwen-assistant-${this.viewId}-panel-${id}`;
      const button = tabList.createEl("button", {
        cls: "docwen-assistant-tab", text: t(id === "proofread" ? "sidebarProofreadTab" : "sidebarActionsTab"),
        attr: { type: "button", role: "tab", id: tabId, "aria-controls": panelId, "data-docwen-view-key": `tab-${id}` },
      });
      const panel = container.createDiv({
        cls: "docwen-assistant-panel",
        attr: { role: "tabpanel", id: panelId, "aria-labelledby": tabId, "data-docwen-scroll-key": `panel-${id}` },
      });
      this.tabs.set(id, button);
      this.panels.set(id, panel);
      const select = (target: AssistantTab): void => {
        if (isOpen() && button.isConnected) this.selectTab(target, true);
      };
      button.addEventListener("click", () => select(id));
      button.addEventListener("keydown", (event) => {
        let target: AssistantTab;
        if (event.key === "Home") target = "proofread";
        else if (event.key === "End") target = "actions";
        else if (event.key === "ArrowLeft" || event.key === "ArrowRight") target = id === "proofread" ? "actions" : "proofread";
        else return;
        event.preventDefault();
        select(target);
      });
    }
    const proofread = this.panels.get("proofread")!;
    this.renderFileContext(proofread);
    this.proofreadButton = this.actionButton(proofread, "commandProofread", "proofread-current-file", () => this.actions.proofreadCurrentFile(this));
    this.renderReport(proofread);
    this.renderActions(this.panels.get("actions")!);
    this.selectTab(this.activeTab);
  }

  private renderReport(container: HTMLElement): void {

    const showStatus = (text: string, path?: string): void => {
      const status = container.createDiv({ cls: "docwen-proofread-status", text, attr: { role: "status" } });
      if (path) {
        status.createEl("br");
        status.createEl("bdi", { text: path });
      }
    };
    if (this.cancelled) showStatus(t("proofreadCancelled"), this.ownedTask?.path);

    // Report toolbar
    const toolbar = container.createDiv({ cls: "docwen-proofread-toolbar" });

    const reportPath = this.vaultPath;
    const refreshLabel = reportPath ? t("proofreadRefreshReport", { file: reportPath }) : t("proofreadRefresh");
    const refreshBtn = toolbar.createEl("button", {
      cls: "docwen-proofread-btn",
      attr: { type: "button", "aria-label": refreshLabel, title: refreshLabel, "data-docwen-view-key": "refresh" },
    });
    this.refreshButton = refreshBtn;
    setIcon(refreshBtn, "refresh-cw");
    if (this.activeOperation) refreshBtn.setAttribute("disabled", "");
    else refreshBtn.addEventListener("click", () => {
      if (refreshBtn.isConnected) void this.refresh(reportPath, this);
    });

    const sortBtn = toolbar.createEl("button", {
      cls: "docwen-proofread-btn",
      attr: {
        type: "button",
        "aria-label": this.sortMode === "line" ? t("proofreadSortByRule") : t("proofreadSortByLine"),
        "data-docwen-view-key": "sort",
      },
    });
    setIcon(sortBtn, this.sortMode === "line" ? "arrow-down-narrow-wide" : "list-ordered");
    sortBtn.addEventListener("click", () => {
      this.sortMode = this.sortMode === "line" ? "rule" : "line";
      this.render();
    });

    if (this.fileName && !this.activeOperation) {
      toolbar.createSpan({
        cls: "docwen-proofread-filename",
        text: t("proofreadReportFile", { file: this.fileName }),
        attr: { title: this.vaultPath },
      });
    }

    if (this.activeOperation) {
      const cancelling = this.activeOperation.state === "cancelling";
      const cancelButton = toolbar.createEl("button", {
        cls: "docwen-proofread-cancel",
        text: cancelling ? t("operationCancelling") : t("operationCancel"),
        attr: {
          type: "button",
          "data-docwen-view-key": "cancel",
          "aria-label": cancelling ? t("operationCancelling") : t("operationCancel"),
          ...(cancelling ? { disabled: "" } : {}),
        },
      });
      if (!cancelling) {
        const generation = this.activeOperation.generation;
        cancelButton.addEventListener("click", () => this.operations.cancelGeneration(generation));
      }
    }

    if (this.activeOperation) {
      return showStatus(this.activeOperation.state === "cancelling"
        ? t("operationCancelling")
        : t("operationRunning", { operation: t("operationProofread") }), this.ownedTask?.path);
    }
    if (!this.fileName) {
      if (!this.cancelled) showStatus(t("proofreadOpenMdFile"));
      return;
    }
    if (this.stale) return showStatus(t("proofreadSourceChanged"));
    if (this.issues.length === 0) return showStatus(t("proofreadNoIssues"));

    // Issue list
    const shown = Math.min(this.visibleIssueCount, this.issues.length);
    const count = container.createDiv({
      cls: "docwen-proofread-count",
      text: t("proofreadIssueCount", { shown: String(shown), total: String(this.issues.length) }),
      attr: { role: "status", "aria-live": "polite" },
    });
    const list = container.createDiv({ cls: "docwen-proofread-list", attr: { "data-docwen-scroll-key": "issues" } });
    const sorted = this.getSortedIssues();
    const revision = this.resultsRevision;
    this.appendIssues(list, sorted, revision, 0, shown);
    this.appendLoadMore(list, count, sorted, revision, shown);
  }

  private renderActions(container: HTMLElement): void {
    this.renderFileContext(container);
    const header = container.createDiv({ cls: "docwen-assistant-section-header" });
    header.createEl("h3", { cls: "docwen-assistant-section-title", text: t("sidebarExportTitle") });
    const refresh = header.createEl("button", {
      cls: "docwen-proofread-btn",
      attr: { type: "button", "aria-label": t("sidebarRefreshExports"), title: t("sidebarRefreshExports"), "data-docwen-view-key": "refresh-exports" },
    });
    setIcon(refresh, "refresh-cw");
    const isOpen = this.captureLifetime();
    refresh.addEventListener("click", () => {
      if (isOpen() && refresh.isConnected && this.activeTab === "actions") this.exports.reload();
    });
    this.exports.mount(container.createDiv({ cls: "docwen-assistant-actions" }), refresh);
    container.createEl("h3", { cls: "docwen-assistant-section-title", text: t("contextMenuSubmenuTitle") });
    const group = container.createDiv({
      cls: "docwen-assistant-actions",
      attr: { role: "group", "aria-label": t("sidebarTitle") },
    });
    this.actionButton(group, "sidebarOpenGui", "open-gui", () => this.actions.openGui());
    this.openFileButton = this.actionButton(group, "commandLaunchWithFile", "open-current-file", () => this.actions.openCurrentFile());
  }

  private renderFileContext(container: HTMLElement): void {
    const context = container.createDiv({ cls: "docwen-assistant-file-context", attr: { role: "status", "aria-live": "polite" } });
    context.createDiv({ cls: "docwen-assistant-filename" });
    context.createDiv({ cls: "docwen-assistant-filepath" });
    this.fileContexts.push(context);
  }

  private actionButton(container: HTMLElement, key: keyof Translations, identity: string, action: () => Promise<void>): HTMLButtonElement {
    const isOpen = this.captureLifetime();
    const element = container.createEl("button", {
      cls: "docwen-assistant-action", text: t(key),
      attr: { type: "button", "data-docwen-view-key": identity },
    });
    element.addEventListener("click", () => {
      if (!isOpen() || !element.isConnected) return;
      this.refreshActiveFile();
      if (!element.disabled) void action();
    });
    return element;
  }

  private appendIssues(list: HTMLElement, sorted: readonly ProofreadIssue[], revision: number, from: number, to: number): HTMLButtonElement | undefined {
    let first: HTMLButtonElement | undefined;
    for (const issue of sorted.slice(from, to)) {
      const line = t("proofreadLineNumber", { line: String(issue.range.start.line + 1) });
      const column = t("proofreadColumnNumber", { column: String(issue.range.start.column + 1) });
      const location = `${line} · ${column}`;
      const ruleLabel = issue.rule_key === "symbol_pair"
        ? t("proofreadUnmatchedSymbol")
        : t(RULE_LABELS[issue.rule_key] ?? "proofreadViewTitle");
      const suggestion = issue.fix?.replacement;
      const correction = suggestion !== undefined ? ` → ${suggestion}` : "";
      const item = list.createEl("button", {
        cls: "docwen-proofread-item",
        attr: {
          type: "button",
          "data-docwen-view-key": `issue:${revision}:${this.issueIndices.get(issue)}`,
          "aria-label": `${location} ${ruleLabel}: ${issue.error_text}${correction}`,
        },
      });
      first ??= item;
      item.addEventListener("click", () => {
        void this.navigateToIssue(issue, revision);
      });

      const header = item.createDiv({ cls: "docwen-proofread-item-header" });
      header.createSpan({ cls: "docwen-proofread-line", text: location });
      header.createSpan({ cls: "docwen-proofread-rule", text: ruleLabel });

      const body = item.createDiv({ cls: "docwen-proofread-item-body" });
      body.createSpan({ cls: "docwen-proofread-error", text: issue.error_text });
      if (suggestion !== undefined) {
        body.createSpan({ cls: "docwen-proofread-arrow", text: " → " });
        body.createSpan({ cls: "docwen-proofread-suggestion", text: suggestion });
      }
    }
    return first;
  }

  private appendLoadMore(list: HTMLElement, count: HTMLElement, sorted: readonly ProofreadIssue[], revision: number, shown: number): void {
    if (shown < sorted.length) {
      const loadMore = list.createEl("button", {
        cls: "docwen-proofread-more",
        text: t("proofreadLoadMore", { count: String(Math.min(ISSUE_BATCH_SIZE, sorted.length - shown)) }),
        attr: { type: "button", "data-docwen-view-key": "load-more" },
      });
      const isOpen = this.captureLifetime();
      loadMore.addEventListener("click", () => {
        if (!isOpen() || revision !== this.resultsRevision || !loadMore.isConnected || this.activeOperation || this.stale) return;
        const moveFocus = list.ownerDocument.activeElement === loadMore;
        const top = list.scrollTop;
        const left = list.scrollLeft;
        const nextShown = Math.min(shown + ISSUE_BATCH_SIZE, sorted.length);
        loadMore.remove();
        const first = this.appendIssues(list, sorted, revision, shown, nextShown);
        this.visibleIssueCount = nextShown;
        count.setText(t("proofreadIssueCount", { shown: String(nextShown), total: String(sorted.length) }));
        this.appendLoadMore(list, count, sorted, revision, nextShown);
        if (moveFocus) first?.focus({ preventScroll: true });
        list.scrollTop = top;
        list.scrollLeft = left;
      });
    }
  }

  private async navigateToIssue(issue: ProofreadIssue, revision: number): Promise<void> {
    if (revision !== this.resultsRevision || this.activeOperation || this.stale) return;
    const sequence = ++this.navigationSequence;
    const isCurrent = (): boolean => sequence === this.navigationSequence && revision === this.resultsRevision && !this.activeOperation;
    let result;
    try {
      result = await selectProofreadIssue(this.app, this.vaultPath, this.sourceSha256, issue, isCurrent);
    } catch {
      result = "stale";
    }
    if (!isCurrent()) return;
    if (result === "needs-editor") showNotice(t("proofreadLocationNeedsEditor"));
    if (result === "stale") {
      this.stale = true;
      this.render();
    }
  }
}

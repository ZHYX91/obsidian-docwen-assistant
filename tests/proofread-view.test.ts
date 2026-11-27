import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { MarkdownView, TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { createAssistantViewActions, useObsidianDom } from "./helpers/obsidian-dom";
import type { EditorPosition } from "obsidian";

useObsidianDom();

vi.mock("../src/host/notices", () => ({ showNotice: vi.fn() }));
vi.mock("obsidian", async () => import("./helpers/obsidian-dom"));

describe("AssistantView", () => {
  it("opens through the host view lifecycle without shadowing its open method", async () => {
    const { AssistantView } = await import("../src/assistant-view");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    const view = new AssistantView({} as never, async () => {}, new OperationCoordinator(), createAssistantViewActions());
    const hostView = view as unknown as { open(): Promise<void> };
    await hostView.open();
    expect(view.captureLifetime()()).toBe(true);
    expect(findByClass(view.containerEl.children[1] as HTMLElement,
      "docwen-proofread-toolbar")).toBeDefined();
    await view.onClose();
    expect(view.captureLifetime()()).toBe(false);
  });

  it("passes the displayed source path when refreshing a detached view", async () => {
    const { AssistantView } = await import("../src/assistant-view");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    const refresh = vi.fn().mockResolvedValue(undefined);
    const view = new AssistantView({} as never, refresh, new OperationCoordinator(), createAssistantViewActions());
    view.updateResults([], "Source.md", "Notes/Source.md", digest("source"));
    const content = view.containerEl.children[1] as HTMLElement;
    findByClass(content, "docwen-proofread-btn")?.click();
    expect(refresh).toHaveBeenCalledWith("Notes/Source.md", view);
  });

  it("cancels only its owned proofread generation when the view closes", async () => {
    const { AssistantView } = await import("../src/assistant-view");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    const operations = new OperationCoordinator();
    const proofread = operations.begin({ key: "proofread", kind: "proofread" });
    const exportLease = operations.begin({ key: "export", kind: "export" });
    const view = new AssistantView({} as never, async () => undefined, operations, createAssistantViewActions());
    await view.onOpen();
    view.ownOperation(proofread, "Proofread.md");
    expect((view.containerEl.children[1] as HTMLElement).classList)
      .toContain("docwen-proofread-root");
    await view.onClose();
    view.ownOperation(proofread, "Proofread.md");
    expect((view.containerEl.children[1] as HTMLElement).classList)
      .not.toContain("docwen-proofread-root");
    expect(proofread.signal.aborted).toBe(true);
    expect(exportLease.signal.aborted).toBe(false);
  });

  it("shows a keyboard-operable cancel control until the lease finishes", async () => {
    const { AssistantView } = await import("../src/assistant-view");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    const operations = new OperationCoordinator();
    const view = new AssistantView({} as never, async () => undefined, operations, createAssistantViewActions());
    await view.onOpen();
    const lease = operations.begin({ key: "proofread", kind: "proofread" });
    view.ownOperation(lease, "Proofread.md");

    let content = view.containerEl.children[1] as HTMLElement;
    let cancel = findByClass(content, "docwen-proofread-cancel");
    expect(cancel?.tagName.toLowerCase()).toBe("button");
    expect(cancel?.getAttribute("type")).toBe("button");
    expect(cancel?.hasAttribute("disabled")).toBe(false);
    cancel?.click();

    expect(lease.signal.aborted).toBe(true);
    content = view.containerEl.children[1] as HTMLElement;
    cancel = findByClass(content, "docwen-proofread-cancel");
    expect(cancel?.getAttribute("type")).toBe("button");
    expect(cancel?.hasAttribute("disabled")).toBe(true);
    expect(operations.getSnapshot().operations[0].state).toBe("cancelling");

    lease.finish();
    expect(findByClass(
      view.containerEl.children[1] as HTMLElement,
      "docwen-proofread-cancel",
    )).toBeUndefined();
  });

  it("renders issues as native keyboard-operable buttons", async () => {
    const { AssistantView } = await import("../src/assistant-view");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    const view = new AssistantView({} as never, async () => undefined, new OperationCoordinator(), createAssistantViewActions());
    view.updateResults([{
      range: {
        start: { offset: 0, line: 0, column: 0 },
        end: { offset: 3, line: 0, column: 3 },
      },
      matched_text: "bad",
      rule_key: "typo",
      error_text: "bad",
      suggestion: "good",
      fix: { kind: "replace_text", replacement: "good", applicable: true },
      error_type: "spacing",
      source: "fixture",
      }], "Proofread.md", "Proofread.md", digest("bad"));

    const content = (view.containerEl.children[1] as HTMLElement);
    const issue = findByClass(content, "docwen-proofread-item");
    expect(issue?.tagName.toLowerCase()).toBe("button");
    expect(issue?.getAttribute("type")).toBe("button");
    expect(issue?.getAttribute("aria-label")).toBe("Line 1 · Column 1 Typo check: bad → good");
    const filename = findByClass(content, "docwen-proofread-filename");
    expect(filename?.textContent).toBe("Report: Proofread.md");
    expect(filename?.getAttribute("title")).toBe("Proofread.md");
  });

  it("keeps cancellation distinct from previous successful results until a new result arrives", async () => {
    const { AssistantView } = await import("../src/assistant-view");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    const operations = new OperationCoordinator();
    const view = new AssistantView({} as never, async () => undefined, operations, createAssistantViewActions());
    await view.onOpen();
    view.updateResults([], "Proofread.md", "Proofread.md", digest(""));
    const lease = operations.begin({ key: "proofread", kind: "proofread" });
    view.ownOperation(lease, "Proofread.md");
    operations.cancelGeneration(lease.generation);
    lease.finish();
    const content = view.containerEl.children[1] as HTMLElement;
    expect(findByClass(content, "docwen-proofread-status")?.textContent)
      .toContain("Proofreading cancelled.");
    const unrelated = operations.begin({ key: "export", kind: "export" });
    unrelated.finish();
    expect(findByClass(content, "docwen-proofread-status")?.textContent)
      .toContain("Proofreading cancelled.");
    const retry = operations.begin({ key: "proofread", kind: "proofread" });
    view.ownOperation(retry, "Proofread.md");
    view.updateResults([], "Proofread.md", "Proofread.md", digest(""));
    retry.finish();
    expect(findByClass(content, "docwen-proofread-status")?.textContent).toBe("No issues found");
  });

  it("keeps controls reachable in short sidebars while long issue content scrolls and wraps", () => {
    const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

    expect(css).toMatch(/\.docwen-proofread-root\s*\{[^}]*display:\s*flex;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s);
    expect(css).toMatch(/\.docwen-assistant-panel\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/s);
    expect(css).toMatch(/\.docwen-proofread-list\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*120px;[^}]*overflow-y:\s*auto;/s);
    expect(css).toMatch(/button\.docwen-proofread-item\s*\{[^}]*height:\s*auto;[^}]*overflow-wrap:\s*anywhere;[^}]*white-space:\s*normal;/s);
    expect(css).toMatch(/@media \(pointer:\s*coarse\)\s*\{\s*\.docwen-proofread-btn\s*\{[^}]*min-inline-size:\s*44px;[^}]*min-block-size:\s*44px;/s);
    expect(css).toMatch(/@media \(pointer:\s*coarse\)[\s\S]*?\.docwen-proofread-list\s*\{\s*--docwen-issue-min-height:\s*44px;/u);
    expect(css).toMatch(/button\.docwen-proofread-more\s*\{[^}]*min-height:\s*max\(var\(--input-height\), var\(--docwen-issue-min-height, 0px\)\);/u);
    expect(css).not.toMatch(/\.docwen-proofread-error\s*\{[^}]*text-decoration:/s);
  });

  it("localizes unmatched-symbol diagnostics without offering their explanation as replacement text", async () => {
    const { AssistantView } = await import("../src/assistant-view");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    const { initI18n } = await import("../src/i18n");
    initI18n("zh-cn");
    try {
      const view = new AssistantView({} as never, async () => undefined, new OperationCoordinator(), createAssistantViewActions());
      view.updateResults([{
        range: { start: { offset: 0, line: 0, column: 0 }, end: { offset: 1, line: 0, column: 1 } },
        matched_text: "（", error_text: "（", rule_key: "symbol_pair",
        suggestion: "Unmatched Symbol", error_type: "symbol", source: "pairing",
      }], "中文.md", "中文.md", digest("（"));
      const content = view.containerEl.children[1] as HTMLElement;
      expect(findByClass(content, "docwen-proofread-rule")?.textContent).toBe("符号缺少配对");
      expect(findByClass(content, "docwen-proofread-item")?.getAttribute("aria-label"))
        .toBe("第 1 行 · 第 1 列 符号缺少配对: （");
      expect(findByClass(content, "docwen-proofread-suggestion")).toBeUndefined();
    } finally {
      initI18n("en");
    }
  });

  it("converts Unicode code-point columns to Obsidian UTF-16 columns", async () => {
    const { unicodeColumnToUtf16Column } = await import("../src/host/proofread-navigation");

    expect(unicodeColumnToUtf16Column("A😀é", 0)).toBe(0);
    expect(unicodeColumnToUtf16Column("A😀é", 2)).toBe(3);
    expect(unicodeColumnToUtf16Column("A😀é", 4)).toBe(5);
  });

  it("navigates the unchanged report source with Unicode-aware columns", async () => {
    const f = await navigationFixture();
    f.clickIssue();
    await vi.waitFor(() => expect(f.editor.setSelection).toHaveBeenCalledWith(
      { line: 0, ch: 3 }, { line: 0, ch: 6 },
    ));
    expect(f.editor.scrollIntoView).toHaveBeenCalledOnce();
  });

  it.each(["resolves", "rejects"])("keeps the latest issue selected when an earlier tab reveal %s late", async (outcome) => {
    const f = await navigationFixture();
    const reports = [0, 1].map((column) => ({
      range: { start: { offset: column, line: 0, column }, end: { offset: column + 1, line: 0, column: column + 1 } },
      matched_text: column === 0 ? "A" : "😀", error_text: "issue", rule_key: "typo", suggestion: "", error_type: "typo", source: "fixture",
    }));
    f.view.updateResults(reports, "Proofread.md", "Proofread.md", digest(f.content.value));
    const [first, second] = f.root.querySelectorAll<HTMLButtonElement>(".docwen-proofread-item");
    let finish!: () => void;
    f.revealLeaf.mockImplementationOnce(() => new Promise<void>((resolve, reject) => {
      finish = outcome === "resolves" ? resolve : () => reject(new Error("obsolete open"));
    }));
    first.click();
    second.click();
    await vi.waitFor(() => expect(f.editor.setSelection).toHaveBeenCalledWith({ line: 0, ch: 1 }, { line: 0, ch: 3 }));
    finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(f.editor.setSelection).toHaveBeenCalledTimes(1);
    expect(f.root.querySelectorAll(".docwen-proofread-item")).toHaveLength(2);
  });

  it("selects the second identical symbol after an emoji and puts focus in the note", async () => {
    const f = await navigationFixture();
    f.content.value = "😀甲（乙（";
    const issues = [2, 4].map((column) => ({
      range: { start: { line: 0, column, offset: column }, end: { line: 0, column: column + 1, offset: column + 1 } },
      matched_text: "（", error_text: "（", rule_key: "symbol_pair", suggestion: "", error_type: "symbol", source: "pairing",
    }));
    f.view.updateResults(issues, "Proofread.md", "Proofread.md", digest(f.content.value));
    const second = f.root.querySelectorAll<HTMLButtonElement>(".docwen-proofread-item")[1];
    expect(second.getAttribute("aria-label")).toContain("Line 1 · Column 5");
    second.focus();
    second.click();
    await vi.waitFor(() => expect(document.activeElement).toBe(f.field));
    expect([f.field.selectionStart, f.field.selectionEnd]).toEqual([5, 6]);
    expect(f.field.value.slice(f.field.selectionStart, f.field.selectionEnd)).toBe("（");
    expect(f.content.value).toBe("😀甲（乙（");
  });

  it.each([
    { endLine: 0, endColumn: 500, matched: "bad" },
    { endLine: 2, endColumn: 5, matched: "bad" },
    { endLine: 0, endColumn: 5, matched: "BAD" },
  ])("refuses an unverified selection %o", async ({ endLine, endColumn, matched }) => {
    const f = await navigationFixture();
    f.view.updateResults([{
      range: { start: { line: 0, column: 2, offset: 2 }, end: { line: endLine, column: endColumn, offset: 500 } },
      matched_text: matched, error_text: matched, rule_key: "typo", suggestion: "", error_type: "typo", source: "typo",
    }], "Proofread.md", "Proofread.md", digest(f.content.value));
    f.clickIssue();
    await vi.waitFor(() => expect(f.root.querySelector(".docwen-proofread-status")?.textContent).toContain("Refresh"));
    expect(f.editor.focus).not.toHaveBeenCalled();
    expect(f.editor.setSelection).not.toHaveBeenCalled();
  });

  it("opens a closed native note in editing view", async () => {
    const f = await navigationFixture();
    f.leaves.length = 0;
    let finish!: () => void;
    f.openFile.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    f.clickIssue();
    f.clickIssue();
    expect(f.openFile).toHaveBeenCalledOnce();
    f.leaves.push(f.leaf);
    finish();
    await vi.waitFor(() => expect(f.editor.setSelection).toHaveBeenCalledOnce());
    expect(f.openFile).toHaveBeenCalledWith(f.currentFile.value, { active: true, state: { mode: "source" } });
  });

  it("shares a pending reading-view switch and selects only the latest issue in the replacement editor", async () => {
    const f = await navigationFixture();
    const oldEditor = { ...f.editor, getValue: () => "inactive editor", setSelection: vi.fn() };
    Object.assign(f.leaf.view, { editor: oldEditor });
    f.getMode.mockReturnValue("preview");
    const issues = [0, 1].map((column) => ({
      range: { start: { line: 0, column, offset: column }, end: { line: 0, column: column + 1, offset: column + 1 } },
      matched_text: column ? "😀" : "A", error_text: column ? "😀" : "A", rule_key: "typo",
      suggestion: "", error_type: "typo", source: "typo",
    }));
    f.view.updateResults(issues, "Proofread.md", "Proofread.md", digest(f.content.value));
    let finish!: () => void;
    f.leaf.setViewState.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    const [first, second] = f.root.querySelectorAll<HTMLButtonElement>(".docwen-proofread-item");
    first.click();
    await vi.waitFor(() => expect(f.leaf.setViewState).toHaveBeenCalledOnce());
    f.getMode.mockReturnValue("source");
    f.leaf.view = Object.assign(new MarkdownView({} as never), { ...f.leaf.view, editor: f.editor });
    second.click();
    await Promise.resolve();
    expect(f.editor.setSelection).not.toHaveBeenCalled();
    expect(f.leaf.setViewState).toHaveBeenCalledWith({
      type: "markdown", pinned: true, state: { file: "Proofread.md", mode: "source", source: false },
    });
    finish();
    await vi.waitFor(() => expect(f.editor.setSelection).toHaveBeenCalledOnce());
    expect(f.editor.setSelection).toHaveBeenCalledWith({ line: 0, ch: 1 }, { line: 0, ch: 3 });
    expect(f.leaf.setViewState).toHaveBeenCalledOnce();
    expect(oldEditor.setSelection).not.toHaveBeenCalled();
  });

  it("rechecks the source after switching out of reading view", async () => {
    const f = await navigationFixture();
    f.getMode.mockReturnValue("preview");
    f.leaf.setViewState.mockImplementationOnce(async () => {
      f.content.value += "changed";
      f.getMode.mockReturnValue("source");
    });
    f.clickIssue();
    await vi.waitFor(() => expect(f.root.querySelector(".docwen-proofread-status")?.textContent).toContain("Refresh"));
    expect(f.editor.focus).not.toHaveBeenCalled();
  });

  it("matches a multiline report across CRLF and LF editor representations", async () => {
    const f = await navigationFixture();
    f.content.value = "😀甲\n乙";
    f.view.updateResults([{
      range: { start: { line: 0, column: 1, offset: 1 }, end: { line: 1, column: 1, offset: 5 } },
      matched_text: "甲\r\n乙", error_text: "甲\r\n乙", rule_key: "typo", suggestion: "", error_type: "typo", source: "typo",
    }], "Proofread.md", "Proofread.md", digest(f.content.value));
    f.clickIssue();
    await vi.waitFor(() => expect(f.editor.setSelection).toHaveBeenCalledOnce());
    expect(f.field.value.slice(f.field.selectionStart, f.field.selectionEnd)).toBe("甲\n乙");
  });

  it("rejects edited content even when the reported substring is unchanged", async () => {
    const f = await navigationFixture();
    f.content.value += " changed after proofreading";
    f.clickIssue();
    expect(f.revealLeaf).not.toHaveBeenCalled();
    expect(f.editor.setSelection).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(findByClass(f.root, "docwen-proofread-status")?.textContent)
      .toBe("The note or editor has changed. Refresh proofreading before locating an issue."));
    expect(findByClass(f.root, "docwen-proofread-item")).toBeUndefined();
    f.publishCurrent();
    f.clickIssue();
    await vi.waitFor(() => expect(f.editor.setSelection).toHaveBeenCalledOnce());
  });

  it.each(["content", "file", "ambiguous", "view"])("rechecks %s after revealing the document tab", async (change) => {
    const f = await navigationFixture();
    let resume!: () => void;
    f.revealLeaf.mockImplementationOnce(() => new Promise<void>((resolve) => { resume = resolve; }));
    f.clickIssue();
    if (change === "content") f.content.value = "prefix " + f.content.value;
    else if (change === "file") f.currentFile.value = Object.assign(new TFile(), { path: "Proofread.md" });
    else if (change === "ambiguous") f.leaves.push({ ...f.leaf });
    else f.leaf.view = Object.assign(new MarkdownView({} as never), { ...f.leaf.view });
    resume();
    await vi.waitFor(() => expect(findByClass(f.root, "docwen-proofread-status")?.textContent)
      .toBe("The note or editor has changed. Refresh proofreading before locating an issue."));
    expect(f.editor.setSelection).not.toHaveBeenCalled();
  });

  it.each(["new-report", "close", "operation"])("does not navigate an obsolete callback after %s", async (change) => {
    const f = await navigationFixture();
    let resume!: () => void;
    f.revealLeaf.mockImplementationOnce(() => new Promise<void>((resolve) => { resume = resolve; }));
    f.clickIssue();
    if (change === "new-report") f.publishCurrent();
    else if (change === "close") await f.view.onClose();
    else {
      const lease = f.operations.begin({ key: "proofread", kind: "proofread" });
      f.view.ownOperation(lease, "Proofread.md");
      lease.finish();
    }
    resume();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(f.editor.setSelection).not.toHaveBeenCalled();
  });

  it.each(["txt", "docx", "markdown"])("keeps a .%s report readable when no Markdown editor is open", async extension => {
    const f = await navigationFixture("Source." + extension);
    f.leaves.length = 0;
    f.clickIssue();
    expect(f.openFile).not.toHaveBeenCalled();
    expect(findByClass(f.root, "docwen-proofread-item")).toBeDefined();
    const { showNotice } = await import("../src/host/notices");
    await vi.waitFor(() => expect(showNotice).toHaveBeenCalledWith(
      "Open this file in a Markdown editor to locate this issue.",
    ));
  });

  it("locates a compatible note in its existing Markdown editor", async () => {
    const f = await navigationFixture("Source.txt");
    f.clickIssue();
    await vi.waitFor(() => expect(f.editor.setSelection).toHaveBeenCalledOnce());
    expect(f.revealLeaf).toHaveBeenCalledWith(f.leaf);
    expect(f.openFile).not.toHaveBeenCalled();
  });

  it("contains file-open failure and asks to refresh instead of using another editor", async () => {
    const f = await navigationFixture();
    f.leaves.length = 0;
    f.openFile.mockRejectedValueOnce(new Error("host file open failed"));
    f.clickIssue();
    await vi.waitFor(() => expect(findByClass(f.root, "docwen-proofread-status")?.textContent)
      .toBe("The note or editor has changed. Refresh proofreading before locating an issue."));
    expect(f.editor.setSelection).not.toHaveBeenCalled();
  });

  it.each(["\n", "\r\n", "\r"])("selects the reported line when an editor uses %j", async (eol) => {
    const f = await navigationFixture();
    f.content.value = ["heading", "A😀bad"].join(eol);
    f.view.updateResults([{
      range: { start: { offset: 10, line: 1, column: 2 }, end: { offset: 13, line: 1, column: 5 } },
      matched_text: "bad", error_text: "bad", rule_key: "typo", suggestion: "good",
      error_type: "typo", source: "fixture",
    }], "Proofread.md", "Proofread.md", digest("heading\nA😀bad"));
    f.clickIssue();
    await vi.waitFor(() => expect(f.editor.setSelection).toHaveBeenCalledWith({ line: 1, ch: 3 }, { line: 1, ch: 6 }));
  });

  it("ignores a detached issue button after a newer report replaces it", async () => {
    const f = await navigationFixture();
    const oldClick = findByClass(f.root, "docwen-proofread-item");
    f.publishCurrent();
    oldClick?.click();
    expect(f.revealLeaf).not.toHaveBeenCalled();
    expect(f.editor.setSelection).not.toHaveBeenCalled();
  });
});

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function navigationFixture(path = "Proofread.md") {
  const { AssistantView } = await import("../src/assistant-view");
  const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
  const operations = new OperationCoordinator();
  const view = new AssistantView({} as never, async () => undefined, operations, createAssistantViewActions());
  const content = { value: "A😀bad" };
  const currentFile = { value: Object.assign(new TFile(), { path }) };
  const field = document.body.appendChild(document.createElement("textarea"));
  const normalized = () => content.value.replace(/\r\n?/gu, "\n");
  const offset = (position: EditorPosition): number => normalized().split("\n")
    .slice(0, position.line).reduce((sum, line) => sum + line.length + 1, position.ch);
  const editor = {
    getValue: () => content.value,
    lineCount: () => normalized().split("\n").length,
    getLine: (index: number) => normalized().split("\n")[index],
    getRange: (from: EditorPosition, to: EditorPosition) => normalized().slice(offset(from), offset(to)),
    focus: vi.fn(() => field.focus()),
    setSelection: vi.fn((from: EditorPosition, to: EditorPosition) => {
      field.value = normalized();
      field.setSelectionRange(offset(from), offset(to));
    }),
    scrollIntoView: vi.fn(),
  };
  const openFile = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const revealLeaf = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const getMode = vi.fn<() => "source" | "preview">(() => "source");
  const leaf = {
    view: Object.assign(new MarkdownView({} as never), { file: currentFile.value, editor, getMode, getViewData: normalized }),
    getViewState: () => ({ type: "markdown", pinned: true, state: { file: path, mode: getMode(), source: false } }),
    setViewState: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    openFile,
  };
  const leaves = [leaf];
  Object.assign(view.app.vault, { getAbstractFileByPath: () => currentFile.value });
  Object.assign(view.app.workspace, { getLeavesOfType: () => leaves, getLeaf: () => leaf, revealLeaf });
  await view.onOpen();
  const publishCurrent = () => view.updateResults([{
    range: { start: { offset: 2, line: 0, column: 2 }, end: { offset: 5, line: 0, column: 5 } },
    matched_text: "bad", error_text: "bad", rule_key: "typo", suggestion: "good",
    error_type: "typo", source: "fixture",
  }], path, path, digest(content.value));
  publishCurrent();
  const root = view.containerEl.children[1] as HTMLElement;
  const clickIssue = () => {
    const item = findByClass(root, "docwen-proofread-item");
    expect(item).toBeDefined();
    item?.click();
  };
  return { view, operations, content, currentFile, editor, leaf, leaves, root, openFile, revealLeaf, getMode, field, publishCurrent, clickIssue };
}

function findByClass(root: HTMLElement, className: string): HTMLElement | undefined {
  return root.querySelector<HTMLElement>(`.${className}`) ?? undefined;
}

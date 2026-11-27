import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { MarkdownView, TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { createAssistantViewActions, useObsidianDom } from "./helpers/obsidian-dom";

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
    view.ownOperation(proofread);
    expect((view.containerEl.children[1] as HTMLElement).classList)
      .toContain("docwen-proofread-root");
    await view.onClose();
    view.ownOperation(proofread);
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
    view.ownOperation(lease);

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
    expect(issue?.getAttribute("aria-label")).toBe("Line 1 Typo check: bad → good");
    const filename = findByClass(content, "docwen-proofread-filename");
    expect(filename?.textContent).toBe("Proofread.md");
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
    view.ownOperation(lease);
    operations.cancelGeneration(lease.generation);
    lease.finish();
    const content = view.containerEl.children[1] as HTMLElement;
    expect(findByClass(content, "docwen-proofread-status")?.textContent)
      .toBe("Proofreading cancelled. Run it again to update the results.");
    const unrelated = operations.begin({ key: "export", kind: "export" });
    unrelated.finish();
    expect(findByClass(content, "docwen-proofread-status")?.textContent)
      .toBe("Proofreading cancelled. Run it again to update the results.");
    const retry = operations.begin({ key: "proofread", kind: "proofread" });
    view.ownOperation(retry);
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
        .toBe("第 1 行 符号缺少配对: （");
      expect(findByClass(content, "docwen-proofread-suggestion")).toBeUndefined();
    } finally {
      initI18n("en");
    }
  });

  it("converts Unicode code-point columns to Obsidian UTF-16 columns", async () => {
    const { unicodeColumnToUtf16Column } = await import("../src/assistant-view");

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

  it.each(["resolves", "rejects"])("keeps the latest issue selected when an earlier file open %s late", async (outcome) => {
    const f = await navigationFixture();
    const reports = [0, 1].map((column) => ({
      range: { start: { offset: column, line: 0, column }, end: { offset: column + 1, line: 0, column: column + 1 } },
      matched_text: column === 0 ? "A" : "😀", error_text: "issue", rule_key: "typo", suggestion: "", error_type: "typo", source: "fixture",
    }));
    f.view.updateResults(reports, "Proofread.md", "Proofread.md", digest(f.content.value));
    const [first, second] = f.root.querySelectorAll<HTMLButtonElement>(".docwen-proofread-item");
    let finish!: () => void;
    f.openFile.mockImplementationOnce(() => new Promise<void>((resolve, reject) => {
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

  it("rejects edited content even when the reported substring is unchanged", async () => {
    const f = await navigationFixture();
    f.content.value += " changed after proofreading";
    f.clickIssue();
    expect(f.openFile).not.toHaveBeenCalled();
    expect(f.editor.setSelection).not.toHaveBeenCalled();
    expect(findByClass(f.root, "docwen-proofread-status")?.textContent)
      .toBe("The note or editor has changed. Refresh proofreading before locating an issue.");
    expect(findByClass(f.root, "docwen-proofread-item")).toBeUndefined();
    f.publishCurrent();
    f.clickIssue();
    await vi.waitFor(() => expect(f.editor.setSelection).toHaveBeenCalledOnce());
  });

  it.each(["content", "file", "ambiguous", "view"])("rechecks %s after asynchronous file opening", async (change) => {
    const f = await navigationFixture();
    let resume!: () => void;
    f.openFile.mockImplementationOnce(() => new Promise<void>((resolve) => { resume = resolve; }));
    f.clickIssue();
    if (change === "content") f.content.value = "prefix " + f.content.value;
    else if (change === "file") f.currentFile.value = Object.assign(new TFile(), { path: "Proofread.md" });
    else if (change === "ambiguous") f.leaves.push({ ...f.leaf });
    else f.leaf.view = Object.assign(new MarkdownView({} as never), { file: f.currentFile.value, editor: f.editor });
    resume();
    await vi.waitFor(() => expect(findByClass(f.root, "docwen-proofread-status")?.textContent)
      .toBe("The note or editor has changed. Refresh proofreading before locating an issue."));
    expect(f.editor.setSelection).not.toHaveBeenCalled();
  });

  it.each(["new-report", "close", "operation"])("does not navigate an obsolete callback after %s", async (change) => {
    const f = await navigationFixture();
    let resume!: () => void;
    f.openFile.mockImplementationOnce(() => new Promise<void>((resolve) => { resume = resolve; }));
    f.clickIssue();
    if (change === "new-report") f.publishCurrent();
    else if (change === "close") await f.view.onClose();
    else {
      const lease = f.operations.begin({ key: "proofread", kind: "proofread" });
      f.view.ownOperation(lease);
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
    expect((await import("../src/host/notices")).showNotice).toHaveBeenCalledWith(
      "Open this file in a Markdown editor to locate this issue.",
    );
  });

  it("locates a compatible note in its existing Markdown editor", async () => {
    const f = await navigationFixture("Source.txt");
    const revealLeaf = vi.fn().mockResolvedValue(undefined);
    Object.assign(f.view.app.workspace, { revealLeaf });
    f.clickIssue();
    await vi.waitFor(() => expect(f.editor.setSelection).toHaveBeenCalledOnce());
    expect(revealLeaf).toHaveBeenCalledWith(f.leaf);
    expect(f.openFile).not.toHaveBeenCalled();
  });

  it("contains file-open failure and asks to refresh instead of using another editor", async () => {
    const f = await navigationFixture();
    f.openFile.mockRejectedValueOnce(new Error("host file open failed"));
    f.clickIssue();
    await vi.waitFor(() => expect(findByClass(f.root, "docwen-proofread-status")?.textContent)
      .toBe("The note or editor has changed. Refresh proofreading before locating an issue."));
    expect(f.editor.setSelection).not.toHaveBeenCalled();
  });

  it.each(["\n", "\r\n", "\r"])("selects the reported line when an editor uses %j", async (eol) => {
    const f = await navigationFixture();
    f.content.value = ["heading", "A😀bad"].join(eol);
    f.editor.getLine = () => "A😀bad";
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
    expect(f.openFile).not.toHaveBeenCalled();
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
  const editor = {
    getValue: () => content.value,
    getLine: () => content.value,
    setSelection: vi.fn(),
    scrollIntoView: vi.fn(),
  };
  const openFile = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const leaf = { view: Object.assign(new MarkdownView({} as never), { file: currentFile.value, editor }), openFile };
  const leaves = [leaf];
  Object.assign(view.app.vault, { getAbstractFileByPath: () => currentFile.value });
  Object.assign(view.app.workspace, { getLeavesOfType: () => leaves, getLeaf: () => leaf });
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
  return { view, operations, content, currentFile, editor, leaf, leaves, root, openFile, publishCurrent, clickIssue };
}

function findByClass(root: HTMLElement, className: string): HTMLElement | undefined {
  return root.querySelector<HTMLElement>(`.${className}`) ?? undefined;
}

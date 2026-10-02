import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { MarkdownView, TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";

class FakeElement {
  readonly children: Array<{ tag: string; element: FakeElement; options: Record<string, unknown> }> = [];
  readonly classes = new Set<string>();
  readonly listeners = new Map<string, () => void>();
  empty(): void { this.children.length = 0; }
  addClass(className: string): void { this.classes.add(className); }
  removeClass(className: string): void { this.classes.delete(className); }
  createDiv(options: Record<string, unknown> = {}): FakeElement { return this.append("div", options); }
  createEl(tag: string, options: Record<string, unknown> = {}): FakeElement { return this.append(tag, options); }
  createSpan(options: Record<string, unknown> = {}): FakeElement { return this.append("span", options); }
  addEventListener(name: string, listener: () => void): void { this.listeners.set(name, listener); }
  setAttribute(): void {}
  private append(tag: string, options: Record<string, unknown>): FakeElement {
    const element = new FakeElement();
    this.children.push({ tag, element, options });
    return element;
  }
}

vi.mock("obsidian", () => ({
  ItemView: class ItemView {
    readonly app = { vault: {}, workspace: {} };
    readonly containerEl = { children: [new FakeElement(), new FakeElement()] };
    constructor(_leaf: unknown) {}
  },
  MarkdownView: class MarkdownView {},
  TFile: class TFile {},
  WorkspaceLeaf: class WorkspaceLeaf {},
  setIcon: vi.fn(),
}));

describe("ProofreadView", () => {
  it("cancels only the observed proofread generation when the view closes", async () => {
    const { ProofreadView } = await import("../src/proofread-view");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    const operations = new OperationCoordinator();
    const proofread = operations.begin({ key: "proofread", kind: "proofread" });
    const exportLease = operations.begin({ key: "export", kind: "export" });
    const view = new ProofreadView({} as never, async () => undefined, operations);
    await view.onOpen();
    expect((view.containerEl.children[1] as unknown as FakeElement).classes)
      .toContain("docwen-proofread-root");
    await view.onClose();
    expect((view.containerEl.children[1] as unknown as FakeElement).classes)
      .not.toContain("docwen-proofread-root");
    expect(proofread.signal.aborted).toBe(true);
    expect(exportLease.signal.aborted).toBe(false);
  });

  it("shows a keyboard-operable cancel control until the lease finishes", async () => {
    const { ProofreadView } = await import("../src/proofread-view");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    const operations = new OperationCoordinator();
    const view = new ProofreadView({} as never, async () => undefined, operations);
    await view.onOpen();
    const lease = operations.begin({ key: "proofread", kind: "proofread" });

    let content = view.containerEl.children[1] as unknown as FakeElement;
    let cancel = findByClass(content, "docwen-proofread-cancel");
    expect(cancel?.tag).toBe("button");
    expect(cancel?.options).toMatchObject({ attr: { type: "button" } });
    cancel?.element.listeners.get("click")?.();

    expect(lease.signal.aborted).toBe(true);
    content = view.containerEl.children[1] as unknown as FakeElement;
    cancel = findByClass(content, "docwen-proofread-cancel");
    expect(cancel?.options).toMatchObject({ attr: { type: "button", disabled: "" } });
    expect(operations.getSnapshot().operations[0].state).toBe("cancelling");

    lease.finish();
    expect(findByClass(
      view.containerEl.children[1] as unknown as FakeElement,
      "docwen-proofread-cancel",
    )).toBeUndefined();
  });

  it("renders issues as native keyboard-operable buttons", async () => {
    const { ProofreadView } = await import("../src/proofread-view");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    const view = new ProofreadView({} as never, async () => undefined, new OperationCoordinator());
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

    const content = (view.containerEl.children[1] as unknown as FakeElement);
    const list = content.children.find(({ options }) => options.cls === "docwen-proofread-list")?.element;
    const issue = list?.children[0];
    expect(issue?.tag).toBe("button");
    expect(issue?.options).toMatchObject({
      cls: "docwen-proofread-item",
      attr: { type: "button", "aria-label": "L1 Typo check: bad → good" },
    });
    expect(findByClass(content, "docwen-proofread-filename")?.options).toMatchObject({
      text: "Proofread.md",
      attr: { title: "Proofread.md" },
    });
  });

  it("keeps cancellation distinct from previous successful results until a new result arrives", async () => {
    const { ProofreadView } = await import("../src/proofread-view");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    const operations = new OperationCoordinator();
    const view = new ProofreadView({} as never, async () => undefined, operations);
    await view.onOpen();
    view.updateResults([], "Proofread.md", "Proofread.md", digest(""));
    const lease = operations.begin({ key: "proofread", kind: "proofread" });
    operations.cancelGeneration(lease.generation);
    lease.finish();
    const content = view.containerEl.children[1] as unknown as FakeElement;
    expect(findByClass(content, "docwen-proofread-status")?.options.text)
      .toBe("Proofreading cancelled. Run it again to update the results.");
    const unrelated = operations.begin({ key: "export", kind: "export" });
    unrelated.finish();
    expect(findByClass(content, "docwen-proofread-status")?.options.text)
      .toBe("Proofreading cancelled. Run it again to update the results.");
    const retry = operations.begin({ key: "proofread", kind: "proofread" });
    view.updateResults([], "Proofread.md", "Proofread.md", digest(""));
    retry.finish();
    expect(findByClass(content, "docwen-proofread-status")?.options.text).toBe("No issues found");
  });

  it("keeps controls visible while long issue content scrolls and wraps", () => {
    const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

    expect(css).toMatch(/\.docwen-proofread-root\s*\{[^}]*display:\s*flex;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s);
    expect(css).toMatch(/\.docwen-proofread-list\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/s);
    expect(css).toMatch(/button\.docwen-proofread-item\s*\{[^}]*height:\s*auto;[^}]*overflow-wrap:\s*anywhere;[^}]*white-space:\s*normal;/s);
    expect(css).not.toMatch(/\.docwen-proofread-error\s*\{[^}]*text-decoration:/s);
  });

  it("localizes unmatched-symbol diagnostics without offering their explanation as replacement text", async () => {
    const { ProofreadView } = await import("../src/proofread-view");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    const { initI18n } = await import("../src/i18n");
    initI18n("zh-cn");
    try {
      const view = new ProofreadView({} as never, async () => undefined, new OperationCoordinator());
      view.updateResults([{
        range: { start: { offset: 0, line: 0, column: 0 }, end: { offset: 1, line: 0, column: 1 } },
        matched_text: "（", error_text: "（", rule_key: "symbol_pair",
        suggestion: "Unmatched Symbol", error_type: "symbol", source: "pairing",
      }], "中文.md", "中文.md", digest("（"));
      const content = view.containerEl.children[1] as unknown as FakeElement;
      expect(findByClass(content, "docwen-proofread-rule")?.options.text).toBe("符号缺少配对");
      expect(findByClass(content, "docwen-proofread-item")?.options.attr).toMatchObject({
        "aria-label": "L1 符号缺少配对: （",
      });
      expect(findByClass(content, "docwen-proofread-suggestion")).toBeUndefined();
    } finally {
      initI18n("en");
    }
  });

  it("converts Unicode code-point columns to Obsidian UTF-16 columns", async () => {
    const { unicodeColumnToUtf16Column } = await import("../src/proofread-view");

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

  it("rejects edited content even when the reported substring is unchanged", async () => {
    const f = await navigationFixture();
    f.content.value += " changed after proofreading";
    f.clickIssue();
    expect(f.openFile).not.toHaveBeenCalled();
    expect(f.editor.setSelection).not.toHaveBeenCalled();
    expect(findByClass(f.root, "docwen-proofread-status")?.options.text)
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
    await vi.waitFor(() => expect(findByClass(f.root, "docwen-proofread-status")?.options.text)
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
    else f.operations.begin({ key: "proofread", kind: "proofread" }).finish();
    resume();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(f.editor.setSelection).not.toHaveBeenCalled();
  });

  it("contains file-open failure and asks to refresh instead of using another editor", async () => {
    const f = await navigationFixture();
    f.openFile.mockRejectedValueOnce(new Error("host file open failed"));
    f.clickIssue();
    await vi.waitFor(() => expect(findByClass(f.root, "docwen-proofread-status")?.options.text)
      .toBe("The note or editor has changed. Refresh proofreading before locating an issue."));
    expect(f.editor.setSelection).not.toHaveBeenCalled();
  });

  it("ignores a detached issue button after a newer report replaces it", async () => {
    const f = await navigationFixture();
    const oldClick = findByClass(f.root, "docwen-proofread-item")?.element.listeners.get("click");
    f.publishCurrent();
    oldClick?.();
    expect(f.openFile).not.toHaveBeenCalled();
    expect(f.editor.setSelection).not.toHaveBeenCalled();
  });
});

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function navigationFixture() {
  const { ProofreadView } = await import("../src/proofread-view");
  const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
  const operations = new OperationCoordinator();
  const view = new ProofreadView({} as never, async () => undefined, operations);
  const content = { value: "A😀bad" };
  const currentFile = { value: Object.assign(new TFile(), { path: "Proofread.md" }) };
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
  }], "Proofread.md", "Proofread.md", digest(content.value));
  publishCurrent();
  const root = view.containerEl.children[1] as unknown as FakeElement;
  const clickIssue = () => {
    const item = findByClass(root, "docwen-proofread-item");
    expect(item).toBeDefined();
    item?.element.listeners.get("click")?.();
  };
  return { view, operations, content, currentFile, editor, leaf, leaves, root, openFile, publishCurrent, clickIssue };
}

function findByClass(
  root: FakeElement,
  className: string,
): { tag: string; element: FakeElement; options: Record<string, unknown> } | undefined {
  for (const child of root.children) {
    if (String(child.options.cls ?? "").split(" ").includes(className)) return child;
    const nested = findByClass(child.element, className);
    if (nested) return nested;
  }
  return undefined;
}

import { readFileSync } from "node:fs";
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
      rule_key: "spacing",
      error_text: "bad",
      suggestion: "good",
      error_type: "spacing",
      source: "fixture",
      }], "Proofread.md", "Proofread.md");

    const content = (view.containerEl.children[1] as unknown as FakeElement);
    const list = content.children.find(({ options }) => options.cls === "docwen-proofread-list")?.element;
    const issue = list?.children[0];
    expect(issue?.tag).toBe("button");
    expect(issue?.options).toMatchObject({
      cls: "docwen-proofread-item",
      attr: { type: "button", "aria-label": "L1 spacing: bad → good" },
    });
    expect(findByClass(content, "docwen-proofread-filename")?.options).toMatchObject({
      text: "Proofread.md",
      attr: { title: "Proofread.md" },
    });
  });

  it("keeps controls visible while long issue content scrolls and wraps", () => {
    const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

    expect(css).toMatch(/\.docwen-proofread-root\s*\{[^}]*display:\s*flex;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s);
    expect(css).toMatch(/\.docwen-proofread-list\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/s);
    expect(css).toMatch(/button\.docwen-proofread-item\s*\{[^}]*height:\s*auto;[^}]*overflow-wrap:\s*anywhere;[^}]*white-space:\s*normal;/s);
    expect(css).not.toMatch(/\.docwen-proofread-error\s*\{[^}]*text-decoration:/s);
  });

  it("converts Unicode code-point columns to Obsidian UTF-16 columns", async () => {
    const { unicodeColumnToUtf16Column } = await import("../src/proofread-view");

    expect(unicodeColumnToUtf16Column("A😀é", 0)).toBe(0);
    expect(unicodeColumnToUtf16Column("A😀é", 2)).toBe(3);
    expect(unicodeColumnToUtf16Column("A😀é", 4)).toBe(5);
  });
});

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

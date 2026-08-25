import { describe, expect, it } from "vitest";

import { OperationStatus } from "../src/operation-status";
import { OperationCoordinator } from "../src/runtime/operation-coordinator";
import { translations } from "../src/i18n/catalogs";

class FakeElement {
  readonly children: Array<{ tag: string; element: FakeElement; options: Record<string, unknown> }> = [];
  readonly listeners = new Map<string, () => void>();
  readonly attributes = new Map<string, string>();

  empty(): void { this.children.length = 0; }
  createEl(tag: string, options: Record<string, unknown> = {}): FakeElement {
    const element = new FakeElement();
    this.children.push({ tag, element, options });
    return element;
  }
  createSpan(options: Record<string, unknown> = {}): FakeElement { return this.createEl("span", options); }
  addEventListener(name: string, listener: () => void): void { this.listeners.set(name, listener); }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  removeAttribute(name: string): void { this.attributes.delete(name); }
  addClass(): void {}
}

describe("OperationStatus", () => {
  it("shows one safe operation and cancels its exact generation", () => {
    const root = new FakeElement();
    const operations = new OperationCoordinator();
    const status = new OperationStatus(root as never, operations);
    const lease = operations.begin({ key: "export:D:\\Vault\\private.md", kind: "export" });

    expect(allText(root)).toContain("Export");
    expect(allText(root)).not.toContain("private.md");
    const button = findTag(root, "button");
    button?.element.listeners.get("click")?.();

    expect(lease.signal.aborted).toBe(true);
    expect(allText(root)).toContain("Cancelling");
    status.dispose();
  });

  it("offers cancel all for multiple operations and remains visible while cancelling", () => {
    const root = new FakeElement();
    const operations = new OperationCoordinator();
    const status = new OperationStatus(root as never, operations);
    const proofread = operations.begin({ key: "proofread", kind: "proofread" });
    const doctor = operations.begin({ key: "doctor", kind: "doctor" });

    expect(allText(root)).toContain("2");
    expect(allText(root)).toContain("Cancel all");
    findTag(root, "button")?.element.listeners.get("click")?.();
    expect(proofread.signal.aborted).toBe(true);
    expect(doctor.signal.aborted).toBe(true);
    expect(root.children.length).toBeGreaterThan(0);

    proofread.finish();
    doctor.finish();
    expect(root.children).toHaveLength(0);
    status.dispose();
  });

  it("ships complete cancellation labels in all eleven locales", () => {
    expect(Object.keys(translations)).toHaveLength(11);
    for (const table of Object.values(translations)) {
      expect(table.operationProofread).not.toBe("");
      expect(table.operationExport).not.toBe("");
      expect(table.operationNumbering).not.toBe("");
      expect(table.operationDoctor).not.toBe("");
      expect(table.operationGuiControl).not.toBe("");
      expect(table.operationRunning).toContain("{operation}");
      expect(table.operationMultiple).toContain("{count}");
      expect(table.operationCancel).not.toBe("");
      expect(table.operationCancelAll).not.toBe("");
      expect(table.operationCancelling).not.toBe("");
    }
  });
});

function allText(root: FakeElement): string {
  return root.children
    .map(({ element, options }) => `${String(options.text ?? "")} ${allText(element)}`)
    .join(" ");
}

function findTag(
  root: FakeElement,
  tag: string,
): { tag: string; element: FakeElement; options: Record<string, unknown> } | undefined {
  for (const child of root.children) {
    if (child.tag === tag) return child;
    const nested = findTag(child.element, tag);
    if (nested) return nested;
  }
  return undefined;
}

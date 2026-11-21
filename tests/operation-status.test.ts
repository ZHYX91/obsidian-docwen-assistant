import { describe, expect, it } from "vitest";
import { OperationStatus } from "../src/operation-status";
import { OperationCoordinator } from "../src/runtime/operation-coordinator";
import { translations } from "../src/i18n/catalogs";
import { useObsidianDom } from "./helpers/obsidian-dom";

useObsidianDom();

function fixture() {
  const root = document.body.appendChild(document.createElement("div"));
  const operations = new OperationCoordinator();
  const status = new OperationStatus(root, operations);
  return { root, operations, status };
}

describe("OperationStatus", () => {
  it("announces safe operation categories and preserves keyboard focus as work changes", () => {
    const { root, operations, status } = fixture();
    const label = root.querySelector('[role="status"]')!;
    expect(label.textContent).toBe("");
    const lease = operations.begin({ key: "export:private.md", kind: "export" });
    const cancel = root.querySelector("button")!;
    expect(label.textContent).toContain("Export");
    expect(label.getAttribute("aria-busy")).not.toBe("true");
    expect(root.textContent).not.toContain("private.md");
    cancel.focus();
    const doctor = operations.begin({ key: "doctor", kind: "doctor" });
    expect(document.activeElement).toBe(cancel);
    expect(root.querySelector('[role="status"]')).toBe(label);
    expect(label.textContent).toContain("2");
    expect(cancel.textContent).toBe("Cancel all");
    doctor.finish();
    status.refresh();
    expect(document.activeElement).toBe(cancel);
    cancel.click();
    expect(lease.signal.aborted).toBe(true);
    expect(label.textContent).toContain("Cancelling");
    expect(cancel.disabled).toBe(true);
    lease.finish();
    expect(root.querySelector("button")).toBeNull();
    status.dispose();
  });

  it("cancels the operations represented at activation and leaves subsequent work running", () => {
    const { root, operations } = fixture();
    const first = operations.begin({ key: "first", kind: "proofread" });
    const second = operations.begin({ key: "second", kind: "export" });
    const cancel = root.querySelector("button")!;
    let later: ReturnType<OperationCoordinator["begin"]> | undefined;
    first.signal.addEventListener("abort", () => { later = operations.begin({ key: "later", kind: "doctor" }); });
    cancel.click();
    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(true);
    expect(later?.signal.aborted).toBe(false);
    first.finish(); second.finish(); later?.finish();
    const next = operations.begin({ key: "another", kind: "numbering" });
    cancel.click();
    expect(next.signal.aborted).toBe(false);
  });

  it("ships complete cancellation labels in all twelve locales", () => {
    expect(Object.keys(translations)).toHaveLength(12);
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

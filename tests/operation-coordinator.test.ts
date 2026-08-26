import { describe, expect, it, vi } from "vitest";

import { OperationCoordinator } from "../src/runtime/operation-coordinator";

describe("OperationCoordinator", () => {
  it("makes repeated operations latest-run-wins", () => {
    const owner = new OperationCoordinator();
    const first = owner.begin({ key: "proofread", kind: "proofread" });
    const second = owner.begin({ key: "proofread", kind: "proofread" });

    expect(first.signal.aborted).toBe(true);
    expect(first.isCurrent()).toBe(false);
    expect(second.signal.aborted).toBe(false);
    expect(second.isCurrent()).toBe(true);
    expect(owner.getSnapshot()).toEqual({
      operations: [
        { generation: first.generation, kind: "proofread", state: "cancelling" },
        { generation: second.generation, kind: "proofread", state: "running" },
      ],
    });

    first.finish();
    expect(second.isCurrent()).toBe(true);
    expect(owner.getSnapshot().operations).toEqual([
      { generation: second.generation, kind: "proofread", state: "running" },
    ]);
  });

  it("retains cancelling state until the exact lease finishes", () => {
    const owner = new OperationCoordinator();
    const lease = owner.begin({ key: "export:D:\\Vault\\secret.md", kind: "export" });

    expect(owner.cancelGeneration(lease.generation)).toBe(true);
    expect(lease.signal.aborted).toBe(true);
    expect(owner.getSnapshot()).toEqual({
      operations: [{ generation: lease.generation, kind: "export", state: "cancelling" }],
    });
    expect(JSON.stringify(owner.getSnapshot())).not.toContain("secret.md");

    lease.finish();
    expect(owner.getSnapshot().operations).toEqual([]);
  });

  it("cancels all operations and isolates subscription failures", () => {
    const owner = new OperationCoordinator();
    const healthy = vi.fn();
    owner.subscribe(() => { throw new Error("listener failed"); });
    const unsubscribe = owner.subscribe(healthy);
    const first = owner.begin({ key: "doctor", kind: "doctor" });
    const second = owner.begin({ key: "gui", kind: "gui-control" });

    expect(owner.cancelAll()).toBe(2);
    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(true);
    expect(owner.getSnapshot().operations.every(({ state }) => state === "cancelling")).toBe(true);
    expect(healthy).toHaveBeenCalled();

    unsubscribe();
    const calls = healthy.mock.calls.length;
    first.finish();
    second.finish();
    expect(healthy).toHaveBeenCalledTimes(calls);
  });

  it("aborts every pending lease on dispose and is idempotent", () => {
    const owner = new OperationCoordinator();
    const first = owner.begin({ key: "one", kind: "doctor" });
    const second = owner.begin({ key: "two", kind: "numbering" });

    owner.dispose();
    owner.dispose();

    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(true);
    expect(owner.getSnapshot().operations).toEqual([]);
    expect(() => owner.begin({ key: "three", kind: "export" })).toThrow(/unloading/u);
  });
});

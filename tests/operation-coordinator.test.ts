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

  it("holds host quit until both superseded and current operations finish cleanup", async () => {
    const owner = new OperationCoordinator();
    const first = owner.begin({ key: "same", kind: "numbering" });
    const second = owner.begin({ key: "same", kind: "numbering" });
    expect(owner.hasPendingWork).toBe(true);
    const finished = vi.fn();
    const quitting = owner.shutdown().then(finished);
    expect(second.signal.aborted).toBe(true);
    expect(() => owner.begin({ key: "late", kind: "export" })).toThrow(/unloading/u);
    second.finish();
    await Promise.resolve();
    expect(finished).not.toHaveBeenCalled();
    first.finish();
    first.finish();
    await quitting;
    expect(finished).toHaveBeenCalledWith(true);
    expect(owner.hasPendingWork).toBe(false);
    await expect(owner.shutdown()).resolves.toBe(true);
  });

  it("waits for pending cleanup even when plugin disposal happened before quit", async () => {
    const owner = new OperationCoordinator();
    const lease = owner.begin({ key: "export", kind: "export" });
    owner.dispose();
    const finished = vi.fn();
    const quitting = owner.shutdown().then(finished);
    await Promise.resolve();
    expect(finished).not.toHaveBeenCalled();
    lease.finish();
    await quitting;
    expect(finished).toHaveBeenCalledWith(true);
  });

  it("bounds host exit when an external operation cannot settle", async () => {
    const owner = new OperationCoordinator();
    const lease = owner.begin({ key: "external-dialog", kind: "export" });
    await expect(owner.shutdown(1)).resolves.toBe(false);
    expect(owner.hasPendingWork).toBe(true);
    lease.finish();
    await expect(owner.shutdown()).resolves.toBe(true);
  });

  it("keeps shutdown deadlines and cleanup independent of renderer timers", async () => {
    const schedule = vi.spyOn(globalThis, "setTimeout").mockImplementation(() => {
      throw new Error("Renderer scheduling is unavailable");
    });
    const cancel = vi.spyOn(globalThis, "clearTimeout").mockImplementation(() => {
      throw new Error("Renderer cancellation is unavailable");
    });
    try {
      const timedOut = new OperationCoordinator();
      const pending = timedOut.begin({ key: "external-dialog", kind: "export" });
      await expect(timedOut.shutdown(1)).resolves.toBe(false);
      pending.finish();

      const settled = new OperationCoordinator();
      const finishing = settled.begin({ key: "cleanup", kind: "export" });
      const quitting = settled.shutdown();
      finishing.finish();
      await expect(quitting).resolves.toBe(true);
      expect(schedule).not.toHaveBeenCalled();
      expect(cancel).not.toHaveBeenCalled();
    } finally {
      schedule.mockRestore();
      cancel.mockRestore();
    }
  });
});

import { describe, expect, it, vi } from "vitest";

import { DocWenProcessCoordinator } from "../src/docwen/process-coordinator";
import { LocalCliError } from "../src/docwen/errors";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("DocWen Store process coordination", () => {
  it("rejects queued and future starts after unconfirmed process cleanup", async () => {
    const coordinator = new DocWenProcessCoordinator();
    const failed = deferred();
    const error = new LocalCliError("cli_cleanup_failed", "Process exit is unconfirmed.", { cleanupState: "unconfirmed" });
    const active = coordinator.run(async () => { await failed.promise; throw error; }, [], 1000);
    const launch = vi.fn(async () => undefined);
    const queued = coordinator.run(launch, [], 1000);
    const queuedSecond = coordinator.run(launch, [], 1000);
    const results = Promise.allSettled([active, queued, queuedSecond]);
    failed.resolve();
    expect(await results).toEqual([
      { status: "rejected", reason: error },
      { status: "rejected", reason: error },
      { status: "rejected", reason: error },
    ]);
    await expect(coordinator.run(launch, [], 1000)).rejects.toBe(error);
    expect(launch).not.toHaveBeenCalled();
  });

  it("queues discovery and capability preload until GUI activation closes", async () => {
    const coordinator = new DocWenProcessCoordinator();
    const closed = deferred();
    const events: string[] = [];
    const gui = coordinator.run(async () => { events.push("gui"); await closed.promise; events.push("closed"); }, [], 1000);
    const doctor = coordinator.run(async () => { events.push("doctor"); }, [], 1000);
    const preload = coordinator.run(async () => { events.push("preload"); }, [], 1000);
    await Promise.resolve();
    expect(events).toEqual(["gui"]);
    closed.resolve();
    await Promise.all([gui, doctor, preload]);
    expect(events).toEqual(["gui", "closed", "doctor", "preload"]);
  });

  it("removes an aborted queued startup without blocking the next caller", async () => {
    const coordinator = new DocWenProcessCoordinator();
    const closed = deferred();
    const active = coordinator.run(() => closed.promise, [], 1000);
    const shutdown = new AbortController();
    const launch = vi.fn(async () => undefined);
    const pending = coordinator.run(launch, [shutdown.signal], 1000);
    const rejected = expect(pending).rejects.toMatchObject({ code: "cli_cancelled" });
    shutdown.abort();
    await rejected;
    closed.resolve();
    await active;
    await coordinator.run(async () => undefined, [], 1000);
    expect(launch).not.toHaveBeenCalled();
  });

  it("bounds a queued startup and releases the lane after operation failure", async () => {
    const coordinator = new DocWenProcessCoordinator();
    const closed = deferred();
    const active = coordinator.run(() => closed.promise, [], 1000);
    const launch = vi.fn(async () => undefined);
    await expect(coordinator.run(launch, [], 10)).rejects.toMatchObject({ code: "cli_timeout" });
    closed.resolve();
    await active;
    await expect(coordinator.run(async () => { throw new Error("failure"); }, [], 1000)).rejects.toThrow("failure");
    await coordinator.run(async () => undefined, [], 1000);
    expect(launch).not.toHaveBeenCalled();
  });
});

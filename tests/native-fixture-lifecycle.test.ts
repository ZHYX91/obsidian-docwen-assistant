import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { describe, expect, it } from "vitest";
import { spawnFixtureSentinel, trackFixtureChild, withFixtureCleanup } from "../scripts/native-fixture-lifecycle.mjs";

describe("native topology fixture lifecycle", () => {
  it("cleans an early-exited real child repeatedly without missing its close event", async () => {
    const early = trackFixtureChild(spawn(process.execPath, ["-e", "process.exit(7)"], { stdio: "ignore" }));
    await early.closed;
    expect(() => early.assertRunning()).toThrow("exited before the case completed");
    const first = early.stop();
    expect(early.stop()).toBe(first);
    await first;
  });

  it("keeps the unrelated sentinel alive across a case longer than its former five-second lifetime", async () => {
    const sentinel = spawnFixtureSentinel();
    await withFixtureCleanup(
      async () => {
        await delay(5200);
        sentinel.assertRunning();
        expect(sentinel.child.exitCode).toBeNull();
        expect(sentinel.child.signalCode).toBeNull();
      },
      () => sentinel.stop(),
    );
    await sentinel.closed;
    await sentinel.stop();
  }, 10000);

  it("preserves the exact failing case after its real child already exited", async () => {
    const early = trackFixtureChild(spawn(process.execPath, ["-e", "process.exit(0)"], { stdio: "ignore" }));
    await early.closed;
    const primary = new Error("Case stop: escaped heartbeat assertion failed");
    await expect(
      withFixtureCleanup(
        () => {
          throw primary;
        },
        () => early.stop(),
      ),
    ).rejects.toBe(primary);
  });

  it("keeps the case as cause and both errors when cleanup also fails", async () => {
    const sentinel = spawnFixtureSentinel();
    const primary = new Error("Case guardian-crash: original assertion");
    const cleanup = new Error("Injected directory cleanup failure");
    const failure = await withFixtureCleanup(
      () => {
        throw primary;
      },
      async () => {
        await sentinel.stop();
        throw cleanup;
      },
    ).catch((error) => error);
    expect(failure).toBeInstanceOf(AggregateError);
    expect(failure.cause).toBe(primary);
    expect(failure.errors).toEqual([primary, cleanup]);
  });

  it("bounds a missing close event and keeps failed cleanup idempotent", async () => {
    const stalled = trackFixtureChild(
      Object.assign(new EventEmitter(), {
        exitCode: null,
        signalCode: null,
        kill: () => false,
      }),
      { label: "Injected stalled fixture", timeoutMs: 10 },
    );
    const stopping = stalled.stop();
    expect(stalled.stop()).toBe(stopping);
    await expect(stopping).rejects.toThrow("Injected stalled fixture cleanup exceeded 10ms");
  });
});

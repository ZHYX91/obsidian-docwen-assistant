import { describe, expect, it, vi } from "vitest";

import { DocWenConnectionMonitor } from "../src/docwen/connection-monitor";
import type { HealthReport } from "../src/docwen/client";
import { LocalCliError } from "../src/docwen/errors";

describe("DocWen connection monitor", () => {
  it("records the verified product version and connection source", async () => {
    const monitor = new DocWenConnectionMonitor(
      () => "automatic",
      vi.fn().mockResolvedValue({ allOk: true, productVersion: "0.9.2", checks: [] }),
    );

    await monitor.check();

    expect(monitor.getStatus()).toEqual({
      state: "connected",
      mode: "automatic",
      productVersion: "0.9.2",
    });
  });

  it("keeps typed setup and health failures for the settings UI", async () => {
    const aliasMissing = new DocWenConnectionMonitor(
      () => "automatic",
      vi.fn().mockRejectedValue(new LocalCliError("cli_alias_not_found", "missing")),
    );
    await expect(aliasMissing.check()).rejects.toMatchObject({ code: "cli_alias_not_found" });
    expect(aliasMissing.getStatus()).toMatchObject({ state: "error", code: "cli_alias_not_found" });

    const unhealthy = new DocWenConnectionMonitor(
      () => "manual",
      vi.fn().mockResolvedValue({ allOk: false, productVersion: "0.9.0", checks: [] }),
    );
    await expect(unhealthy.check()).rejects.toMatchObject({ code: "cli_health_failed" });
    expect(unhealthy.getStatus()).toMatchObject({ state: "error", mode: "manual" });
  });

  it("invalidates an in-flight result when the connection setting changes", async () => {
    let release!: (value: { allOk: true; productVersion: string; checks: [] }) => void;
    let requestSignal: AbortSignal | undefined;
    const monitor = new DocWenConnectionMonitor(
      () => "automatic",
      (signal) => {
        requestSignal = signal;
        return new Promise((resolve) => { release = resolve; });
      },
    );
    const pending = monitor.check();
    monitor.reset();
    expect(requestSignal?.aborted).toBe(true);
    release({ allOk: true, productVersion: "0.9.0", checks: [] });
    await expect(pending).rejects.toMatchObject({ code: "cli_cancelled" });

    expect(monitor.getStatus()).toEqual({ state: "unchecked" });
  });

  it("de-duplicates concurrent checks", async () => {
    let release!: (value: HealthReport) => void;
    const checkHealth = vi.fn(() => new Promise<HealthReport>((resolve) => { release = resolve; }));
    const monitor = new DocWenConnectionMonitor(() => "automatic", checkHealth);

    const first = monitor.check();
    const second = monitor.check();

    expect(second).toBe(first);
    expect(checkHealth).toHaveBeenCalledOnce();
    release({ allOk: true, productVersion: "0.9.0", checks: [] });
    await expect(first).resolves.toMatchObject({ productVersion: "0.9.0" });
  });

  it("retries after a failed check and replaces the error state", async () => {
    const checkHealth = vi.fn()
      .mockRejectedValueOnce(new LocalCliError("cli_alias_not_found", "missing"))
      .mockResolvedValueOnce({ allOk: true, productVersion: "0.9.3", checks: [] });
    const monitor = new DocWenConnectionMonitor(() => "automatic", checkHealth);

    await expect(monitor.check()).rejects.toMatchObject({ code: "cli_alias_not_found" });
    expect(monitor.getStatus()).toMatchObject({ state: "error" });
    await expect(monitor.check()).resolves.toMatchObject({ productVersion: "0.9.3" });
    expect(monitor.getStatus()).toEqual({
      state: "connected",
      mode: "automatic",
      productVersion: "0.9.3",
    });
  });

  it("cancels an active check during disposal without retaining an error", async () => {
    let requestSignal: AbortSignal | undefined;
    const monitor = new DocWenConnectionMonitor(
      () => "automatic",
      (signal) => {
        requestSignal = signal;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(new LocalCliError("cli_cancelled", "cancelled")));
        });
      },
    );

    const pending = monitor.check();
    monitor.dispose();

    expect(requestSignal?.aborted).toBe(true);
    await expect(pending).rejects.toMatchObject({ code: "cli_cancelled" });
    expect(monitor.getStatus()).toEqual({ state: "unchecked" });
  });

  it("does not let an old completion clear a replacement check", async () => {
    const releases: Array<(value: { allOk: true; productVersion: string; checks: [] }) => void> = [];
    const checkHealth = vi.fn(() => new Promise<{ allOk: true; productVersion: string; checks: [] }>(
      (resolve) => releases.push(resolve),
    ));
    const monitor = new DocWenConnectionMonitor(() => "automatic", checkHealth);

    const old = monitor.check();
    monitor.reset();
    const replacement = monitor.check();
    releases[0]?.({ allOk: true, productVersion: "0.9.1", checks: [] });
    await expect(old).rejects.toMatchObject({ code: "cli_cancelled" });
    const sharedReplacement = monitor.check();

    expect(sharedReplacement).toBe(replacement);
    expect(checkHealth).toHaveBeenCalledTimes(2);
    releases[1]?.({ allOk: true, productVersion: "0.9.2", checks: [] });
    await expect(replacement).resolves.toMatchObject({ productVersion: "0.9.2" });
  });
});

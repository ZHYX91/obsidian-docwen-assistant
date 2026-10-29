import { describe, expect, it } from "vitest";
import { DocWenClient } from "../src/docwen/client";
import type { DocWenMachineClient } from "../src/docwen/machine-client";
import { DocWenConnectionMonitor } from "../src/docwen/connection-monitor";

describe("Machine health contract", () => {
  it.each([true, false])("projects formal per-check fields with all_ok=%s", async (allOk) => {
    const client = new DocWenClient({ queryWithProductVersion: async () => ({
      productVersion: "0.21.0", result: { all_ok: allOk, checks: [{
        id: "config.load", kind: "config", label: "Config",
        status: allOk ? "ok" : "fail", reason: allOk ? null : "config_load_failed",
      }] },
    }) } as unknown as DocWenMachineClient);
    const report = await client.doctor();
    expect(report).toEqual({ allOk, productVersion: "0.21.0", checks: [{
      id: "config.load", status: allOk ? "ok" : "error", message: allOk ? undefined : "config_load_failed",
    }] });
    const monitor = new DocWenConnectionMonitor(() => "automatic", () => client.doctor());
    if (allOk) {
      await monitor.check();
      expect(monitor.getStatus().state).toBe("connected");
    } else await expect(monitor.check()).rejects.toMatchObject({ code: "cli_health_failed" });
  });

  it.each([{ ok: true }, { status: "ok", reason: 1 }, { status: "unknown", reason: null }])("rejects malformed health check %j", async (check) => {
    const client = new DocWenClient({ queryWithProductVersion: async () => ({
      productVersion: "0.21.0", result: { all_ok: true, checks: [{ id: "config.load", ...check }] },
    }) } as unknown as DocWenMachineClient);
    await expect(client.doctor()).rejects.toMatchObject({ code: "cli_invalid_envelope" });
  });
});

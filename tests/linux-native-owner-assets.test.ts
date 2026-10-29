import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const effects = vi.hoisted(() => ({ image: vi.fn(), spawn: vi.fn() }));
vi.mock("node:fs", async (original) => ({
  ...await original<typeof import("node:fs")>(),
  mkdtempSync: effects.image,
}));
vi.mock("node:child_process", () => ({ spawn: effects.spawn }));

import { linuxOwnerPayload } from "../src/docwen/linux-native-owner";
import { DocWenMachineClient } from "../src/docwen/machine-client";

const host = {
  platform: Object.getOwnPropertyDescriptor(process, "platform")!,
  arch: Object.getOwnPropertyDescriptor(process, "arch")!,
};
afterEach(() => {
  Object.defineProperty(process, "platform", host.platform);
  Object.defineProperty(process, "arch", host.arch);
  vi.clearAllMocks();
});

describe("architecture-bound Linux Machine assets", () => {
  it.each([
    ["x64", 62, 81352, "c393a16413522e530da56a4ef3feebd006388401ec8c9b4d739c565474bc7b86"],
    ["arm64", 183, 158416, "493d8a957616ab5b459e7f64f05446878a00cae85b96e22e08f9d8f5412cee3a"],
  ] as const)("selects the exact %s static native payload", (arch, machine, size, sha256) => {
    const payload = linuxOwnerPayload(arch);
    expect(payload.length).toBe(size);
    expect(payload.subarray(0, 6).toString("hex")).toBe("7f454c460201");
    expect(payload.readUInt16LE(18)).toBe(machine);
    expect(createHash("sha256").update(payload).digest("hex")).toBe(sha256);
  });

  it.each(["arm", "ia32", "s390x", "riscv64", "__proto__", "constructor"])(
    "rejects Linux %s through the actual client before image writes or business spawn",
    async (arch) => {
      Object.defineProperty(process, "platform", { value: "linux", configurable: true });
      Object.defineProperty(process, "arch", { value: arch, configurable: true });
      const client = new DocWenMachineClient(() => "/unused/DocWenCLI", () => "en_US");
      try {
        await expect(client.query("health/check", {})).rejects.toMatchObject({
          code: "cli_platform_unsupported", details: { platform: "linux", arch },
        });
        expect(effects.image).not.toHaveBeenCalled();
        expect(effects.spawn).not.toHaveBeenCalled();
      } finally {
        await client.dispose();
      }
    },
  );
});

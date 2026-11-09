import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { diagnosticDetails } from "../src/actions/diagnostic-details";
import { WindowsMachineOwnerStore, verifyWindowsMachineOwnerImage, windowsMachineOwnerDetails, spawnWindowsOwnedMachineProcess } from "../src/docwen/windows-machine-owner";
import { WINDOWS_X64_MACHINE_OWNER_BASE64, WINDOWS_X64_MACHINE_OWNER_SHA256, WINDOWS_X64_MACHINE_OWNER_BYTES } from "../src/docwen/windows-machine-owner-x64";

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: spawnMock }));
afterEach(() => vi.clearAllMocks());

describe("Windows helper diagnostic identity", () => {
  it("matches the embedded image, adapted source and pinned build record", async () => {
    const record = JSON.parse(await readFile("native/WINDOWS-BUILD.json", "utf8"));
    expect(record.binarySha256).toBe(WINDOWS_X64_MACHINE_OWNER_SHA256);
    expect(record.binaryBytes).toBe(WINDOWS_X64_MACHINE_OWNER_BYTES);
    expect(createHash("sha256").update(await readFile("native/windows-job.c")).digest("hex")).toBe(record.sourceSha256);
    expect(createHash("sha256").update(await readFile("native/windows-job.def")).digest("hex")).toBe(record.defSha256);
    expect(() => verifyWindowsMachineOwnerImage(Buffer.from(WINDOWS_X64_MACHINE_OWNER_BASE64, "base64"))).not.toThrow();
  });

  it("retains only bounded identity, observed phase and system code", () => {
    const details = windowsMachineOwnerDetails("owner_spawn", Object.assign(new Error("C:\\private\\secret"), { code: "EACCES" }));
    expect(diagnosticDetails(details)).toEqual(details);
    expect(details).toMatchObject({ phase: "owner_spawn", systemCode: "EACCES", helperName: "windows-x64.exe" });
    expect(JSON.stringify(details)).not.toContain("private");
    expect(windowsMachineOwnerDetails("owner_spawn", { code: "private document" })).not.toHaveProperty("systemCode");
    expect(diagnosticDetails({ helperName: "C:\\private.exe", helperExpectedSha256: "secret", helperExpectedBytes: Infinity, phase: "secret", primaryPhase: {} })).toEqual({});
    const getter = vi.fn(() => "private");
    diagnosticDetails(Object.defineProperty({}, "helperExpectedSha256", { get: getter }));
    expect(getter).not.toHaveBeenCalled();
  });

  it("fails closed with a verification phase when the helper disappears", async () => {
    const store = new WindowsMachineOwnerStore(async () => ({ root: "/unused-test-root", executable: "/unused-test-root/windows-x64.exe" }),
      async () => { throw Object.assign(new Error("private path"), { code: "ENOENT" }); });
    await expect(store.acquire()).rejects.toMatchObject({ code: "cli_integrity_error", details: { phase: "owner_verify", systemCode: "ENOENT" } });
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("reports a synchronous helper launch failure without retrying or exposing the path", async () => {
    spawnMock.mockImplementationOnce(() => { throw Object.assign(new Error("C:\\private\\helper.exe"), { code: "EPERM" }); });
    const store = new WindowsMachineOwnerStore(async () => ({ root: "/unused-test-root", executable: "/unused-test-root/windows-x64.exe" }), async () => undefined);
    await expect(spawnWindowsOwnedMachineProcess({ executable: "/DocWenCLI", cwd: "/", mode: "manual" }, store))
      .rejects.toMatchObject({ code: "cli_spawn_failed", details: { phase: "owner_spawn", systemCode: "EPERM" } });
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });
});

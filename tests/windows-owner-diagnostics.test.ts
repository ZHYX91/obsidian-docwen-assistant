import { afterEach, describe, expect, it, vi } from "vitest";
import { diagnosticDetails } from "../src/actions/diagnostic-details";
import { windowsMachineOwnerDetails, spawnWindowsOwnedMachineProcess } from "../src/docwen/windows-machine-owner";

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: spawnMock }));

afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

describe("Windows CLI supervisor diagnostics", () => {
  it("retains only the component, observed phase and bounded system code", () => {
    const details = windowsMachineOwnerDetails("owner_spawn", Object.assign(new Error("C:\\private\\secret"), { code: "EACCES" }));
    expect(diagnosticDetails(details)).toEqual(details);
    expect(details).toMatchObject({ phase: "owner_spawn", systemCode: "EACCES", ownerComponent: "DocWenCLI" });
    expect(JSON.stringify(details)).not.toContain("private");
    expect(windowsMachineOwnerDetails("owner_spawn", { code: "private document" })).not.toHaveProperty("systemCode");
    expect(diagnosticDetails({ ownerComponent: "C:\\private.exe", phase: "secret", primaryPhase: {} })).toEqual({});
    const getter = vi.fn(() => "private");
    diagnosticDetails(Object.defineProperty({}, "ownerComponent", { get: getter }));
    expect(getter).not.toHaveBeenCalled();
  });

  it("launches the installed CLI with a parent lifetime and no helper environment", async () => {
    const child = {};
    spawnMock.mockReturnValueOnce(child);
    await expect(spawnWindowsOwnedMachineProcess({ executable: "C:\\DocWen\\DocWenCLI.exe", cwd: "C:\\DocWen", mode: "manual" })).resolves.toBe(child);
    expect(spawnMock).toHaveBeenCalledWith("C:\\DocWen\\DocWenCLI.exe", ["serve", "--stdio", "--managed", "--parent-pid", String(process.pid)], expect.objectContaining({ shell: false, windowsHide: true }));
    expect(spawnMock.mock.calls[0][2].env).not.toHaveProperty("DOCWEN_ASSISTANT_JOB_TARGET");
  });

  it("refuses an arbitrary executable marked as automatic", async () => {
    vi.stubEnv("LOCALAPPDATA", "C:\\Users\\Tester\\AppData\\Local");
    await expect(spawnWindowsOwnedMachineProcess({ executable: "C:\\private\\other.exe", cwd: "C:\\Temp", mode: "automatic" })).rejects.toMatchObject({ code: "cli_alias_not_found" });
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("does not launch work cancelled before spawn", async () => {
    await expect(spawnWindowsOwnedMachineProcess({ executable: "C:\\DocWen\\DocWenCLI.exe", cwd: "C:\\DocWen", mode: "manual" }, () => { throw new Error("cancelled"); })).rejects.toThrow("cancelled");
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("reports synchronous CLI launch failure without exposing the path", async () => {
    spawnMock.mockImplementationOnce(() => { throw Object.assign(new Error("C:\\private\\DocWenCLI.exe"), { code: "EPERM" }); });
    await expect(spawnWindowsOwnedMachineProcess({ executable: "C:\\DocWen\\DocWenCLI.exe", cwd: "C:\\DocWen", mode: "manual" }))
      .rejects.toMatchObject({ code: "cli_spawn_failed", details: { phase: "owner_spawn", systemCode: "EPERM" } });
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });
});

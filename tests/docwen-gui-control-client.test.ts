import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: spawnMock }));

import { DocWenGuiControlClient } from "../src/docwen/gui-control-client";

class FakeChild extends EventEmitter {
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  killed = false;

  constructor(private readonly closeCode: number | null = 0, private readonly autoClose = true) {
    super();
    if (autoClose) queueMicrotask(() => this.emit("close", closeCode));
  }

  kill(): boolean {
    this.killed = true;
    queueMicrotask(() => this.emit("close", null));
    return true;
  }
}

describe("DocWenGuiControlClient", () => {
  beforeEach(() => {
    spawnMock.mockReset();
    spawnMock.mockImplementation(() => new FakeChild());
  });

  it("opens the GUI through the public CLI control command without Machine negotiation", async () => {
    const target = {
      executable: "C:\\DocWen\\DocWenCLI.exe",
      cwd: "C:\\DocWen",
      mode: "manual" as const,
    };
    const client = new DocWenGuiControlClient(() => target);

    await expect(client.open("C:\\Vault\\note.md")).resolves.toBeUndefined();

    expect(spawnMock).toHaveBeenCalledWith(
      target.executable,
      ["gui", "open", "--json", "--quiet", "--timeout", "10", "C:\\Vault\\note.md"],
      expect.objectContaining({
        cwd: target.cwd,
        shell: false,
        windowsHide: true,
      }),
    );
    expect(spawnMock.mock.calls[0][1]).not.toContain("serve");
  });

  it("opens or activates DocWen without requiring a file", async () => {
    const client = new DocWenGuiControlClient(() => ({
      executable: "C:\\DocWen\\DocWenCLI.exe",
      cwd: "C:\\DocWen",
      mode: "manual",
    }));

    await client.open();

    expect(spawnMock.mock.calls[0][1]).toEqual([
      "gui",
      "open",
      "--json",
      "--quiet",
      "--timeout",
      "10",
    ]);
  });

  it("preserves a typed failure when GUI control exits unsuccessfully", async () => {
    spawnMock.mockImplementation(() => new FakeChild(7));
    const client = new DocWenGuiControlClient(() => ({
      executable: "C:\\DocWen\\DocWenCLI.exe",
      cwd: "C:\\DocWen",
      mode: "manual",
    }));

    await expect(client.open()).rejects.toMatchObject({
      code: "cli_gui_control_failed",
      details: { exitCode: 7 },
    });
  });

  it("maps a missing automatic alias to the setup error", async () => {
    spawnMock.mockImplementation(() => {
      const child = new FakeChild(0, false);
      queueMicrotask(() => {
        const error = Object.assign(new Error("missing"), { code: "ENOENT" });
        child.emit("error", error);
      });
      return child;
    });
    const client = new DocWenGuiControlClient(() => ({
      executable: "C:\\Users\\Tester\\AppData\\Local\\Microsoft\\WindowsApps\\docwen.exe",
      cwd: "C:\\Temp",
      mode: "automatic",
    }));

    await expect(client.open()).rejects.toMatchObject({ code: "cli_alias_not_found" });
  });

  it("cancels only the short-lived GUI control process", async () => {
    const child = new FakeChild(0, false);
    spawnMock.mockReturnValue(child);
    const controller = new AbortController();
    const client = new DocWenGuiControlClient(() => ({
      executable: "C:\\DocWen\\DocWenCLI.exe",
      cwd: "C:\\DocWen",
      mode: "manual",
    }));

    const pending = client.open(undefined, controller.signal);
    controller.abort();

    await expect(pending).rejects.toMatchObject({ code: "cli_cancelled" });
    expect(child.killed).toBe(true);
  });
});

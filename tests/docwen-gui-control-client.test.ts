import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: spawnMock }));
vi.mock("node:timers", () => ({
  setTimeout: (callback: () => void, delay: number) => globalThis.setTimeout(callback, delay),
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(timer),
}));

import { DocWenGuiControlClient } from "../src/docwen/gui-control-client";

class FakeChild extends EventEmitter {
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  killed = false;

  constructor(
    private readonly closeCode: number | null = 0,
    private readonly autoClose = true,
    private readonly stdoutPayload = JSON.stringify({
      protocol_version: 3,
      product_version: "0.13.0",
      success: true,
      command: "gui open",
      data: { accepted: true },
      error: null,
      warnings: [],
      meta: {},
    }),
  ) {
    super();
    if (autoClose) {
      queueMicrotask(() => {
        if (stdoutPayload) this.stdout.write(stdoutPayload);
        this.emit("close", closeCode);
      });
    }
  }

  kill(): boolean {
    this.killed = true;
    queueMicrotask(() => this.emit("close", null));
    return true;
  }
}

describe("DocWenGuiControlClient", () => {
  afterEach(() => vi.useRealTimers());
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

  it("rejects a successful exit with an invalid CLI envelope", async () => {
    spawnMock.mockImplementation(() => new FakeChild(0, true, "{not-json"));
    const client = new DocWenGuiControlClient(() => ({
      executable: "C:\\DocWen\\DocWenCLI.exe",
      cwd: "C:\\DocWen",
      mode: "manual",
    }));

    await expect(client.open()).rejects.toMatchObject({ code: "cli_invalid_response" });
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

  it("checks application control without opening a window or negotiating Machine", async () => {
    spawnMock.mockImplementation(() => new FakeChild(0, true, JSON.stringify({
      protocol_version: 3, product_version: "0.13.0", command: "gui status", success: true,
      data: { running: false, available: true }, error: null,
    })));
    const client = new DocWenGuiControlClient(() => "C:\\DocWen\\DocWenCLI.exe");
    await expect(client.status()).resolves.toEqual({ productVersion: "0.13.0", running: false });
    expect(spawnMock.mock.calls[0][1]).toContain("status");
    expect(spawnMock.mock.calls[0][1]).not.toContain("open");
  });

  it("bounds combined output and waits for the CLI to close", async () => {
    const child = new FakeChild(0, false);
    spawnMock.mockReturnValue(child);
    const pending = new DocWenGuiControlClient(() => "C:\\DocWen\\DocWenCLI.exe").open();
    const failure = expect(pending).rejects.toMatchObject({ code: "cli_output_limit" });
    child.stdout.write(Buffer.alloc(128 * 1024));
    child.stderr.write(Buffer.alloc(129 * 1024));
    await failure;
    expect(child.killed).toBe(true);
  });

  it("times out a stuck CLI and escalates only its own process", async () => {
    vi.useFakeTimers();
    const child = new FakeChild(0, false);
    const signals: string[] = [];
    child.kill = (signal?: string) => {
      signals.push(signal ?? "SIGTERM");
      if (signal === "SIGKILL") queueMicrotask(() => child.emit("close", null));
      return true;
    };
    spawnMock.mockReturnValue(child);
    const pending = new DocWenGuiControlClient(() => "C:\\DocWen\\DocWenCLI.exe").open();
    const failure = expect(pending).rejects.toMatchObject({ code: "cli_timeout" });
    await vi.advanceTimersByTimeAsync(15_500);
    await failure;
    expect(signals).toEqual(["SIGTERM", "SIGKILL"]);
  });

  it("reports a cleanup failure when the CLI never closes", async () => {
    vi.useFakeTimers();
    const child = new FakeChild(0, false);
    child.kill = () => true;
    spawnMock.mockReturnValue(child);
    const abort = new AbortController();
    const pending = new DocWenGuiControlClient(() => "C:\\DocWen\\DocWenCLI.exe").open(undefined, abort.signal);
    const failure = expect(pending).rejects.toMatchObject({
      code: "cli_cleanup_failed", details: { primaryCode: "cli_cancelled" },
    });
    abort.abort();
    await vi.advanceTimersByTimeAsync(1000);
    await failure;
  });
});

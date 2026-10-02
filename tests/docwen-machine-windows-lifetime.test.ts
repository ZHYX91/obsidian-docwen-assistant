import { spawn, type ChildProcess } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DocWenMachineClient } from "../src/docwen/machine-client";

const roots: string[] = [];
const controls: ChildProcess[] = [];

beforeEach(() => {
  vi.stubGlobal("window", { setTimeout, clearTimeout });
});

afterEach(async () => {
  for (const control of controls.splice(0)) killProcess(control.pid);
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe.skipIf(process.platform !== "win32")("DocWenMachineClient Windows lifetime ownership", () => {
  it("cleans an independent-stdio descendant after the direct root exits normally", async () => {
    const fixture = await createRootExitFixture();
    const sentinel = startSentinel();
    const client = new DocWenMachineClient(() => fixture.executable, () => "en_US");
    let helperPid = 0;

    try {
      await expect(client.query("health/check", {}, undefined, 5_000)).resolves.toMatchObject({
        all_ok: true,
      });
      helperPid = Number((await waitForEvent(fixture.trace, "helper_started")).helperPid);
      expect(Number.isSafeInteger(helperPid) && helperPid > 0).toBe(true);
      await waitForPidExit(helperPid);
      expectProcessLive(requiredPid(sentinel));
    } finally {
      client.dispose();
      killProcess(helperPid);
    }
  }, 10_000);
});

async function createRootExitFixture(): Promise<{ executable: string; trace: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "docwen-windows-owner-red-"));
  roots.push(root);
  const executable = path.join(root, "DocWenCLI.exe");
  const script = path.join(root, "serve");
  const trace = path.join(root, "trace.jsonl");
  await copyFile(process.execPath, executable);
  await writeFile(script, fixtureSource(), "utf8");
  vi.stubEnv("DOCWEN_DATA_DIR", root);
  return { executable, trace };
}

function fixtureSource(): string {
  return String.raw`
const { spawn } = require("node:child_process");
const { appendFileSync } = require("node:fs");
const path = require("node:path");
const trace = path.join(process.env.DOCWEN_DATA_DIR, "trace.jsonl");
let buffer = Buffer.alloc(0);
function record(event, extra = {}) {
  appendFileSync(trace, JSON.stringify({ event, pid: process.pid, ...extra }) + "\n", "utf8");
}
function send(id, result) {
  const body = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id, result }), "utf8");
  process.stdout.write("Content-Length: " + body.length + "\r\n\r\n");
  process.stdout.write(body);
}
function handle(message) {
  if (message.method === "initialize") {
    send(message.id, {
      protocol: { name: "docwen.machine", major: 2, minor: 0 },
      artifact_bundle_schema: "docwen.artifact_bundle.v3",
      server: { name: "DocWen", version: "0.13.0" },
      methods: [],
      features: { progress: true, cancellation: true },
      max_concurrent_tasks: 1,
    });
  } else if (message.method === "health/check") {
    send(message.id, { all_ok: true, checks: [] });
  }
}
process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const end = buffer.indexOf("\r\n\r\n");
    if (end < 0) return;
    const match = /^Content-Length: ([1-9][0-9]*)\r\n\r\n$/.exec(
      buffer.subarray(0, end + 4).toString("ascii"),
    );
    if (!match) process.exit(21);
    const length = Number(match[1]);
    const frameEnd = end + 4 + length;
    if (buffer.length < frameEnd) return;
    const message = JSON.parse(buffer.subarray(end + 4, frameEnd).toString("utf8"));
    buffer = buffer.subarray(frameEnd);
    handle(message);
  }
});
process.stdin.on("end", () => {
  const helper = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], {
    detached: true,
    stdio: "ignore",
  });
  helper.unref();
  record("helper_started", { helperPid: helper.pid });
  record("root_exit");
  process.exit(0);
});
setInterval(() => undefined, 1000);
`;
}

function startSentinel(): ChildProcess {
  const child = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  controls.push(child);
  return child;
}

async function waitForEvent(
  filename: string,
  event: string,
  timeoutMs = 2_000,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const rows = (await readFile(filename, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      const row = rows.find((candidate) => candidate.event === event);
      if (row) return row;
    } catch (error) {
      if (!isErrno(error, "ENOENT")) throw error;
    }
    await delay(20);
  }
  throw new Error("Timed out waiting for controlled Windows fixture event: " + event);
}

async function waitForPidExit(pid: number, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!pidAlive(pid)) return;
    await delay(20);
  }
  throw new Error("Owned Windows descendant remained live after the Machine session settled.");
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !isErrno(error, "ESRCH");
  }
}

function expectProcessLive(pid: number): void {
  if (!pidAlive(pid)) throw new Error("Expected unrelated Windows sentinel to remain live.");
}

function requiredPid(child: ChildProcess): number {
  if (typeof child.pid !== "number") throw new Error("Windows sentinel did not expose a PID.");
  return child.pid;
}

function killProcess(pid: number | undefined): void {
  if (typeof pid !== "number" || pid <= 0 || !pidAlive(pid)) return;
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // The controlled process already exited.
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isErrno(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

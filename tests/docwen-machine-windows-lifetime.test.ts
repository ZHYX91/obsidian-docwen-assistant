import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocalCliError } from "../src/docwen/errors";
import { DocWenMachineClient, type MachineTaskRequest } from "../src/docwen/machine-client";
import {
  spawnWindowsOwnedMachineProcess,
  verifyWindowsMachineOwnerImage,
  WindowsMachineOwnerStore,
} from "../src/docwen/windows-machine-owner";

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
    const fixture = await createNodeFixture("root-exit");
    const sentinel = startSentinel();
    const client = new DocWenMachineClient(() => fixture.executable, () => "en_US");
    let helperPid = 0;

    try {
      await expect(client.query("health/check", {}, undefined, 5_000)).resolves.toMatchObject({
        all_ok: true,
      });
      helperPid = numberField(await waitForEvent(fixture.trace, "helper_started"), "helperPid");
      await waitForPidExit(helperPid);
      expectProcessLive(requiredPid(sentinel));
    } finally {
      client.dispose();
      killProcess(helperPid);
    }
  }, 10_000);

  it("terminates an owned root and independent-stdio descendant on timeout without touching a sentinel", async () => {
    const fixture = await createNodeFixture("timeout");
    const sentinel = startSentinel();
    const client = new DocWenMachineClient(() => fixture.executable, () => "en_US");
    let helperPid = 0;
    let rootPid = 0;

    try {
      const pending = client.query("health/check", {}, undefined, 450);
      rootPid = numberField(await waitForEvent(fixture.trace, "root_started"), "pid");
      helperPid = numberField(await waitForEvent(fixture.trace, "helper_started"), "helperPid");
      await expect(pending).rejects.toMatchObject({ code: "cli_timeout" });
      await waitForPidExit(rootPid);
      await waitForPidExit(helperPid);
      expectProcessLive(requiredPid(sentinel));
    } finally {
      client.dispose();
      killProcess(rootPid);
      killProcess(helperPid);
    }
  }, 10_000);

  it("bounds accepted-task cancellation through the held Job owner", async () => {
    const fixture = await createNodeFixture("cancel");
    const sentinel = startSentinel();
    const controller = new AbortController();
    const client = new DocWenMachineClient(() => fixture.executable, () => "en_US");
    const staging = path.join(fixture.root, "staging");
    const input = path.join(fixture.root, "input.md");
    await mkdir(staging);
    const bytes = Buffer.from("# input\n", "utf8");
    await writeFile(input, bytes);
    let helperPid = 0;
    let rootPid = 0;

    try {
      const pending = client.runTask(taskRequest(staging, input, bytes), controller.signal, 8_000);
      await waitForEvent(fixture.trace, "task_accepted");
      rootPid = numberField(await waitForEvent(fixture.trace, "root_started"), "pid");
      helperPid = numberField(await waitForEvent(fixture.trace, "helper_started"), "helperPid");
      controller.abort();
      await waitForEvent(fixture.trace, "cancel_seen");
      await expect(pending).rejects.toMatchObject({ code: "cli_cancelled" });
      await waitForPidExit(rootPid);
      await waitForPidExit(helperPid);
      expectProcessLive(requiredPid(sentinel));
    } finally {
      client.dispose();
      killProcess(rootPid);
      killProcess(helperPid);
    }
  }, 12_000);

  it("cleans owned processes during plugin unload", async () => {
    const fixture = await createNodeFixture("unload");
    const sentinel = startSentinel();
    const client = new DocWenMachineClient(() => fixture.executable, () => "en_US");
    let helperPid = 0;
    let rootPid = 0;

    try {
      const pending = client.query("health/check", {}, undefined, 8_000);
      await waitForEvent(fixture.trace, "health_seen");
      rootPid = numberField(await waitForEvent(fixture.trace, "root_started"), "pid");
      helperPid = numberField(await waitForEvent(fixture.trace, "helper_started"), "helperPid");
      client.dispose();
      await expect(pending).rejects.toMatchObject({ code: "cli_cancelled" });
      await waitForPidExit(rootPid);
      await waitForPidExit(helperPid);
      expectProcessLive(requiredPid(sentinel));
    } finally {
      client.dispose();
      killProcess(rootPid);
      killProcess(helperPid);
    }
  }, 10_000);

  it("preserves a real closed-pipe protocol failure and still releases the Job owner", async () => {
    const fixture = await createBrokenPipeFixture();
    const sentinel = startSentinel();
    const client = new DocWenMachineClient(() => fixture.executable, () => "en_US");
    let rootPid = 0;

    try {
      const pending = client.query("health/check", {}, undefined, 8_000);
      const closed = await waitForEvent(fixture.trace, "stdin_closed");
      rootPid = numberField(closed, "pid");
      await expect(pending).rejects.toMatchObject({ code: "cli_protocol_error" });
      await waitForPidExit(rootPid);
      expectProcessLive(requiredPid(sentinel));
    } finally {
      client.dispose();
      killProcess(rootPid);
    }
  }, 15_000);

  it("fails closed before target launch when owner creation fails", async () => {
    const fixture = await createNodeFixture("marker");
    const marker = path.join(fixture.root, "target-started.txt");
    vi.stubEnv("DOCWEN_LOG_DIR", marker);
    const owner = new WindowsMachineOwnerStore(async () => {
      throw new LocalCliError("cli_integrity_error", "synthetic owner creation failure");
    });

    await expect(spawnWindowsOwnedMachineProcess({
      executable: fixture.executable,
      cwd: fixture.root,
      mode: "manual",
    }, owner)).rejects.toMatchObject({ code: "cli_integrity_error" });
    await expect(readFile(marker, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    owner.dispose();
  });

  it("rejects a corrupted embedded-owner identity", () => {
    expect(() => verifyWindowsMachineOwnerImage(Buffer.alloc(4_608)))
      .toThrowError(/digest check/u);
  });
});

type FixtureMode = "root-exit" | "timeout" | "cancel" | "unload" | "marker";

async function createNodeFixture(mode: FixtureMode): Promise<{ root: string; executable: string; trace: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "docwen-windows-owner-"));
  roots.push(root);
  const executable = path.join(root, "DocWenCLI.exe");
  const script = path.join(root, "serve");
  const trace = path.join(root, "trace.jsonl");
  await copyFile(process.execPath, executable);
  await writeFile(script, fixtureSource(mode), "utf8");
  vi.stubEnv("DOCWEN_DATA_DIR", root);
  return { root, executable, trace };
}

async function createBrokenPipeFixture(): Promise<{ root: string; executable: string; trace: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "docwen-windows-pipe-"));
  roots.push(root);
  const executable = path.join(root, "DocWenCLI.exe");
  compileWindowsFixture(path.join(process.cwd(), "tests/fixtures/windows-machine-broken-pipe.c"), executable);
  const trace = path.join(root, "trace.jsonl");
  vi.stubEnv("DOCWEN_DATA_DIR", root);
  return { root, executable, trace };
}

function compileWindowsFixture(source: string, executable: string): void {
  const vswhere = path.join(
    process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
    "Microsoft Visual Studio",
    "Installer",
    "vswhere.exe",
  );
  const discovery = spawnSync(vswhere, [
    "-latest",
    "-products",
    "*",
    "-requires",
    "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
    "-property",
    "installationPath",
  ], { encoding: "utf8", shell: false, timeout: 10_000 });
  if (discovery.status !== 0 || !discovery.stdout.trim()) {
    throw new Error("Visual Studio C++ build tools are required for the Windows pipe fixture.");
  }
  const vcvars = path.join(discovery.stdout.trim(), "VC", "Auxiliary", "Build", "vcvars64.bat");
  const command = 'call "' + vcvars + '" >nul && cl /nologo /O2 /W3 "'
    + source + '" /Fe:"' + executable + '"';
  const compile = spawnSync("cmd.exe", ["/d", "/s", "/c", command], {
    encoding: "utf8",
    shell: false,
    timeout: 60_000,
  });
  if (compile.status !== 0) {
    throw new Error("Windows pipe fixture compilation failed:\n" + compile.stdout + "\n" + compile.stderr);
  }
}

function taskRequest(staging: string, input: string, bytes: Buffer): MachineTaskRequest {
  return {
    capability_id: "transform.markdown.to_docx",
    inputs: [{
      input_id: "input.1",
      locator: { kind: "local_path", path: input },
      kind: "document",
      role: "source",
      logical_path: "input.md",
      media_type: "text/markdown",
      size_bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    }],
    output: { staging_root: { kind: "local_path", path: staging }, staging_policy: "require_empty" },
    options: {},
  };
}

function fixtureSource(mode: FixtureMode): string {
  return String.raw`
const { spawn } = require("node:child_process");
const { appendFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const mode = ${JSON.stringify(mode)};
const root = process.env.DOCWEN_DATA_DIR;
const trace = path.join(root, "trace.jsonl");
let buffer = Buffer.alloc(0);
let helper = null;
function record(event, extra = {}) {
  appendFileSync(trace, JSON.stringify({ event, pid: process.pid, ...extra }) + "\n", "utf8");
}
function helperOnce() {
  if (helper) return helper;
  helper = spawn(process.execPath, ["-e", "process.on('SIGTERM',()=>{});setInterval(() => undefined, 1000)"], {
    detached: true,
    stdio: "ignore",
  });
  helper.unref();
  record("helper_started", { helperPid: helper.pid });
  return helper;
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
    record("health_seen");
    if (mode === "root-exit") send(message.id, { all_ok: true, checks: [] });
    else if (mode === "marker") {
      writeFileSync(process.env.DOCWEN_LOG_DIR, "started\n", "utf8");
      send(message.id, { all_ok: true, checks: [] });
    } else {
      helperOnce();
    }
  } else if (message.method === "task/plan") {
    send(message.id, {
      plan_id: "plan.1",
      capability_id: "transform.markdown.to_docx",
      effective_options: {},
      output_shape: { cardinality: "one", artifact_kinds: ["document"], relation_types: [], atomic_bundle: true },
      limitations: [],
    });
  } else if (message.method === "task/execute") {
    send(message.id, { task_id: "task.1", state: "accepted" });
    record("task_accepted");
    helperOnce();
  } else if (message.method === "task/cancel") {
    record("cancel_seen");
  }
}
record("root_started");
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
  if (mode === "root-exit") helperOnce();
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
  timeoutMs = 3_000,
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

async function waitForPidExit(pid: number, timeoutMs = 3_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!pidAlive(pid)) return;
    await delay(20);
  }
  throw new Error("Owned Windows process remained live after the Machine session settled: " + pid);
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

function numberField(value: Record<string, unknown>, key: string): number {
  const field = value[key];
  if (typeof field !== "number" || !Number.isSafeInteger(field) || field <= 0) {
    throw new Error("Controlled Windows fixture did not record " + key + ".");
  }
  return field;
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

import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DocWenMachineClient, type MachineTaskRequest } from "../src/docwen/machine-client";
import { encodeMachineFrame, MachineFrameDecoder } from "../src/docwen/machine-framing";

const roots: string[] = [];
const WAIT_EXPIRED = Symbol("wait_expired");

beforeEach(() => {
  vi.stubGlobal("window", { setTimeout, clearTimeout });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe.skipIf(process.platform !== "linux")("DocWenMachineClient Linux process ownership", () => {
  it("executes generated helper and worker sources with LF JSONL and CRLF framing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "docwen-machine-source-check-"));
    roots.push(root);

    const helperTrace = path.join(root, "helper.jsonl");
    const helperReady = path.join(root, "helper-ready.txt");
    const helper = spawn(
      process.execPath,
      ["-e", helperFixtureSource(), helperTrace, helperReady, "resistant", String(process.pid)],
      { stdio: "ignore" },
    );
    const helperClosed = waitForChildClose(helper);
    try {
      await waitForFile(helperReady);
      expect(await readFile(helperReady, "utf8")).toBe("ready\n");
      expect(helper.kill("SIGTERM")).toBe(true);
      await waitForTraceEvent(helperTrace, "helper_term");
      await waitForTraceEvent(helperTrace, "helper_root_stat_checked");
      const helperText = await readFile(helperTrace, "utf8");
      expect(helperText.endsWith("\n")).toBe(true);
      expect(await readTraceEvents(helperTrace)).toEqual([
        "helper_handler_ready",
        "helper_term",
        "helper_root_stat_checked",
      ]);
    } finally {
      if (typeof helper.pid === "number") {
        try {
          process.kill(helper.pid, "SIGKILL");
        } catch {
          // The helper may already be gone.
        }
      }
      await helperClosed;
    }

    const workerTrace = path.join(root, "worker.jsonl");
    const workerClosedFile = path.join(root, "worker-stdin-closed.txt");
    const worker = spawn(
      process.execPath,
      ["-e", workerFixtureSource(), "query", workerClosedFile, workerTrace],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    const workerClosed = waitForChildClose(worker);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    worker.stdout?.on("data", (chunk: Buffer) => stdout.push(Buffer.from(chunk)));
    worker.stderr?.on("data", (chunk: Buffer) => stderr.push(Buffer.from(chunk)));
    worker.stdin?.on("error", () => undefined);
    worker.stdin?.end(encodeMachineFrame({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {},
    }));

    expect(await workerClosed).toBe(0);
    expect(Buffer.concat(stderr).toString("utf8")).toBe("");
    expect(await readFile(workerClosedFile, "utf8")).toBe("closed\n");
    const workerText = await readFile(workerTrace, "utf8");
    expect(workerText.endsWith("\n")).toBe(true);
    expect(await readTraceEvents(workerTrace)).toEqual(["worker_started", "worker_fd_closed"]);

    const output = Buffer.concat(stdout);
    expect(output.includes(Buffer.from("\r\n\r\n", "ascii"))).toBe(true);
    const messages = new MachineFrameDecoder().feed(output);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocol: { name: "docwen.machine", major: 2, minor: 0 },
      },
    });
    expect(parsePidText("101\n202\t303 ")).toEqual([101, 202, 303]);
  }, 5_000);

  it.each(["success-query", "success-task"] as const)(
    "cleans surviving owned descendants before a successful %s session releases ownership",
    async (mode) => {
      const fixture = await createFixture(mode, "resistant");
      const staging = path.join(fixture.root, "success-staging");
      const input = path.join(fixture.root, "success-input.md");
      await mkdir(staging);
      await writeFile(input, "# input\n", "utf8");
      const sentinel = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], {
        detached: true,
        stdio: "ignore",
      });
      sentinel.unref();
      if (typeof sentinel.pid !== "number") throw new Error("Sentinel process did not start");
      await expectProcessLive(sentinel.pid);

      const client = new DocWenMachineClient(() => fixture.executable, () => "en_US");
      let pids: number[] = [];
      try {
        const operation: Promise<unknown> = mode === "success-query"
          ? client.query("health/check", {}, undefined, 8_000)
          : client.runTask(realTaskRequest(staging, input), undefined, 8_000);
        pids = await waitForPids(fixture.pidFile);
        if (mode === "success-query") {
          await expect(operation).resolves.toMatchObject({ all_ok: true });
        } else {
          await expect(operation).resolves.toMatchObject({
            taskId: "task.1",
            bundle: { artifacts: [expect.objectContaining({ logical_path: "output.md" })] },
          });
        }

        expect(await readTraceEvents(fixture.rootTraceFile)).toContain("root_normal_exit");
        const helperEvents = await readTraceEvents(fixture.helperTraceFile);
        expect(helperEvents).toContain("helper_term");
        expect(helperEvents).toContain("helper_observed_root_gone");
        expect(helperEvents).not.toContain("helper_exit");
        for (const pid of pids) await expectProcessNotLive(pid);
        await expectProcessLive(sentinel.pid);
      } finally {
        client.dispose();
        killRemaining(pids);
        killUnrelated(sentinel);
      }
    },
    12_000,
  );

  it("terminates a detached process group after the root exits while a descendant resists SIGTERM", async () => {
    const fixture = await createFixture("timeout", "resistant");
    const client = new DocWenMachineClient(() => fixture.executable, () => "en_US");
    let pids: number[] = [];

    try {
      await expect(client.query("health/check", {}, undefined, 500)).rejects.toMatchObject({
        code: "cli_timeout",
      });
      pids = await waitForPids(fixture.pidFile);
      expect(pids).toHaveLength(3);
      await assertResistantTerminationEvidence(fixture);
      for (const pid of pids) await expectProcessNotLive(pid);
    } finally {
      client.dispose();
      killRemaining(pids);
    }
  }, 10_000);

  it.each(["query", "task", "cancel"] as const)(
    "handles a real server closing its only pipe read fd before a %s write",
    async (phase) => {
      const fixture = await createFixture(phase, "resistant");
      const staging = path.join(fixture.root, "staging");
      const input = path.join(fixture.root, "input.md");
      await mkdir(staging);
      await writeFile(input, "# input\n", "utf8");

      const uncaught: unknown[] = [];
      const monitor = (error: unknown): void => {
        uncaught.push(error);
      };
      process.on("uncaughtExceptionMonitor", monitor);
      const controller = new AbortController();
      const client = new DocWenMachineClient(() => fixture.executable, () => "en_US");
      let pids: number[] = [];
      let unrelated: ChildProcess | null = null;

      try {
        if (phase === "task") {
          unrelated = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], {
            detached: true,
            stdio: "ignore",
          });
          unrelated.unref();
          if (typeof unrelated.pid !== "number") throw new Error("Unrelated control process did not start");
          await expectProcessLive(unrelated.pid);
        }

        const operation: Promise<unknown> = phase === "query"
          ? client.query("health/check", {}, controller.signal, 8_000)
          : client.runTask(realTaskRequest(staging, input), controller.signal, 8_000);
        const failure = operation.then(
          () => new Error("Machine operation unexpectedly resolved."),
          (error: unknown) => error,
        );

        pids = await waitForPids(fixture.pidFile);
        await waitForFile(fixture.closedFile);
        await waitForTraceEvent(fixture.workerTraceFile, "worker_fd_closed");
        if (phase === "cancel") {
          controller.abort();
          // Shorter than CANCELLATION_GRACE_MS: cleanup must start from the
          // closed-pipe write failure, not from the two-second cancellation timer.
          await waitForTraceEvent(fixture.helperTraceFile, "helper_term", 1_500);
          expect(await readTraceEvents(fixture.workerTraceFile)).not.toContain("task_cancel_seen");
        }

        const error = await Promise.race([
          failure,
          delay(4_000).then(() => WAIT_EXPIRED),
        ]);
        if (error === WAIT_EXPIRED) throw new Error(`Machine ${phase} failure did not settle within the test bound.`);
        expect(error).toMatchObject({ code: phase === "cancel" ? "cli_cancelled" : "cli_protocol_error" });
        expect(uncaught).toEqual([]);
        expect(await readdir(staging)).toEqual([]);
        await assertResistantTerminationEvidence(fixture);
        for (const pid of pids) await expectProcessNotLive(pid);
        if (unrelated?.pid) await expectProcessLive(unrelated.pid);
      } finally {
        process.removeListener("uncaughtExceptionMonitor", monitor);
        client.dispose();
        killRemaining(pids);
        killUnrelated(unrelated);
      }
    },
    12_000,
  );

  it("cleans a resistant independent-stdio descendant during plugin unload after the root exits", async () => {
    const fixture = await createFixture("unload", "resistant");
    const client = new DocWenMachineClient(() => fixture.executable, () => "en_US");
    let pids: number[] = [];

    try {
      const pending = client.query("health/check", {}, undefined, 8_000);
      pids = await waitForPids(fixture.pidFile);
      await waitForTraceEvent(fixture.workerTraceFile, "health_seen");
      client.dispose();
      await waitForTraceEvent(fixture.helperTraceFile, "helper_term", 1_500);
      await expect(pending).rejects.toMatchObject({ code: "cli_cancelled" });
      await assertResistantTerminationEvidence(fixture);
      for (const pid of pids) await expectProcessNotLive(pid);
    } finally {
      client.dispose();
      killRemaining(pids);
    }
  }, 8_000);

  it("lets a cooperative independent-stdio descendant exit on the first termination signal", async () => {
    const fixture = await createFixture("unload", "cooperative");
    const client = new DocWenMachineClient(() => fixture.executable, () => "en_US");
    let pids: number[] = [];

    try {
      const pending = client.query("health/check", {}, undefined, 8_000);
      pids = await waitForPids(fixture.pidFile);
      await waitForTraceEvent(fixture.workerTraceFile, "health_seen");
      client.dispose();
      await expect(pending).rejects.toMatchObject({ code: "cli_cancelled" });
      expect(await readTraceEvents(fixture.rootTraceFile)).toContain("root_term");
      const helperEvents = await readTraceEvents(fixture.helperTraceFile);
      expect(helperEvents).toContain("helper_term");
      expect(helperEvents).toContain("helper_exit");
      for (const pid of pids) await expectProcessNotLive(pid);
    } finally {
      client.dispose();
      killRemaining(pids);
    }
  }, 8_000);
});

type FixtureMode =
  | "timeout"
  | "query"
  | "task"
  | "cancel"
  | "unload"
  | "success-query"
  | "success-task";
type HelperBehavior = "resistant" | "cooperative";

type Fixture = {
  root: string;
  executable: string;
  pidFile: string;
  closedFile: string;
  rootTraceFile: string;
  helperTraceFile: string;
  workerTraceFile: string;
};

async function createFixture(mode: FixtureMode, helperBehavior: HelperBehavior): Promise<Fixture> {
  const root = await mkdtemp(path.join(tmpdir(), "docwen-machine-linux-"));
  roots.push(root);
  const executable = path.join(root, "docwen-machine-fixture");
  const pidFile = path.join(root, "pids.txt");
  const closedFile = path.join(root, "stdin-closed.txt");
  const readyFile = path.join(root, "helper-ready.txt");
  const rootTraceFile = path.join(root, "root-trace.jsonl");
  const helperTraceFile = path.join(root, "helper-trace.jsonl");
  const workerTraceFile = path.join(root, "worker-trace.jsonl");
  await writeFile(
    executable,
    fixtureServer({
      pidFile,
      closedFile,
      readyFile,
      rootTraceFile,
      helperTraceFile,
      workerTraceFile,
      mode,
      helperBehavior,
    }),
    "utf8",
  );
  await chmod(executable, 0o755);
  return { root, executable, pidFile, closedFile, rootTraceFile, helperTraceFile, workerTraceFile };
}

function realTaskRequest(staging: string, input: string): MachineTaskRequest {
  const bytes = Buffer.from("# input\n", "utf8");
  return {
    capability_id: "transform.markdown.heading_numbering",
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

function helperFixtureSource(): string {
  return String.raw`
const { appendFileSync, readFileSync, writeFileSync } = require("node:fs");
const [traceFile, readyFile, behavior, rootPidText] = process.argv.slice(1);
const rootPid = Number(rootPidText);
let rootStatChecked = false;
function record(event) {
  appendFileSync(traceFile, JSON.stringify({ event, pid: process.pid }) + "\n", "utf8");
}
function rootIsGone() {
  try {
    const raw = readFileSync("/proc/" + rootPid + "/stat", "utf8");
    const closingParen = raw.lastIndexOf(")");
    if (closingParen < 0) return false;
    const state = raw.slice(closingParen + 1).trim().split(/\s+/u)[0];
    if (!rootStatChecked) {
      rootStatChecked = true;
      record("helper_root_stat_checked");
    }
    return state === "Z" || state === "X" || state === "x";
  } catch (error) {
    return error && (error.code === "ENOENT" || error.code === "ESRCH");
  }
}
process.on("SIGTERM", () => {
  record("helper_term");
  if (behavior === "cooperative") {
    record("helper_exit");
    process.exit(0);
  }
  const timer = setInterval(() => {
    if (rootIsGone()) {
      clearInterval(timer);
      record("helper_observed_root_gone");
    }
  }, 5);
});
record("helper_handler_ready");
writeFileSync(readyFile, "ready\n", "utf8");
setInterval(() => undefined, 1000);
`;
}

function workerFixtureSource(): string {
  return String.raw`
const { createHash } = require("node:crypto");
const { appendFileSync, closeSync, readSync, writeFileSync, writeSync } = require("node:fs");
const path = require("node:path");
const [mode, closedFile, traceFile] = process.argv.slice(1);
let buffered = Buffer.alloc(0);
function record(event) {
  appendFileSync(traceFile, JSON.stringify({ event, pid: process.pid }) + "\n", "utf8");
}
function readMessage() {
  while (true) {
    const headerEnd = buffered.indexOf("\r\n\r\n");
    if (headerEnd >= 0) {
      const header = buffered.subarray(0, headerEnd + 4).toString("ascii");
      const match = /^Content-Length: ([1-9][0-9]*)\r\n\r\n$/.exec(header);
      if (!match) process.exit(20);
      const length = Number(match[1]);
      const frameEnd = headerEnd + 4 + length;
      if (buffered.length >= frameEnd) {
        const message = JSON.parse(buffered.subarray(headerEnd + 4, frameEnd).toString("utf8"));
        buffered = buffered.subarray(frameEnd);
        return message;
      }
    }
    const chunk = Buffer.allocUnsafe(8192);
    let bytesRead;
    try {
      bytesRead = readSync(0, chunk, 0, chunk.length, null);
    } catch (error) {
      if (error && error.code === "EINTR") continue;
      throw error;
    }
    if (bytesRead === 0) process.exit(0);
    buffered = Buffer.concat([buffered, chunk.subarray(0, bytesRead)]);
  }
}
function waitForInputClose() {
  const chunk = Buffer.allocUnsafe(256);
  while (true) {
    let bytesRead;
    try {
      bytesRead = readSync(0, chunk, 0, chunk.length, null);
    } catch (error) {
      if (error && error.code === "EINTR") continue;
      throw error;
    }
    if (bytesRead === 0) process.exit(0);
  }
}
function sendMessage(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  writeSync(1, Buffer.concat([
    Buffer.from("Content-Length: " + body.length + "\r\n\r\n", "ascii"),
    body,
  ]));
}
function send(id, result) {
  sendMessage({ jsonrpc: "2.0", id, result });
}
function notify(method, params) {
  sendMessage({ jsonrpc: "2.0", method, params });
}
function closeInput() {
  closeSync(0);
  writeFileSync(closedFile, "closed\n", "utf8");
  record("worker_fd_closed");
}
record("worker_started");
const initialize = readMessage();
const initialized = {
  protocol: { name: "docwen.machine", major: 2, minor: 0 },
  artifact_bundle_schema: "docwen.artifact_bundle.v3",
  server: { name: "DocWen", version: "0.13.0" },
  methods: [],
  features: { progress: true, cancellation: true },
  max_concurrent_tasks: 1,
};
if (mode === "query") {
  closeInput();
  send(initialize.id, initialized);
  process.exit(0);
}
send(initialize.id, initialized);

const second = readMessage();
if (mode === "timeout" || mode === "unload") {
  if (second.method !== "health/check") process.exit(21);
  record("health_seen");
  setInterval(() => undefined, 1000);
} else if (mode === "success-query") {
  if (second.method !== "health/check") process.exit(21);
  send(second.id, { all_ok: true, checks: [] });
  waitForInputClose();
} else {
  if (second.method !== "task/plan") process.exit(22);
  if (mode === "task") {
    closeInput();
    send(second.id, { plan_id: "plan.1" });
    process.exit(0);
  }
  const request = second.params;
  send(second.id, { plan_id: "plan.1" });
  const execute = readMessage();
  if (execute.method !== "task/execute") process.exit(23);
  if (mode === "cancel") {
    closeInput();
    send(execute.id, { task_id: "task.1", state: "accepted" });
    process.exit(0);
  }
  if (mode === "success-task") {
    send(execute.id, { task_id: "task.1", state: "accepted" });
    const staging = request.output.staging_root.path;
    const outputPath = path.join(staging, "output.md");
    const bytes = Buffer.from("# output\n", "utf8");
    writeFileSync(outputPath, bytes);
    notify("task/completed", {
      task_id: "task.1",
      bundle: {
        schema: "docwen.artifact_bundle.v3",
        bundle_id: "bundle.1",
        task_id: "task.1",
        producer: {
          name: "DocWen",
          product_version: "0.13.0",
          machine_protocol: "docwen.machine.v2",
        },
        layout_schema: "docwen.artifact_layout.v1",
        artifacts: [{
          artifact_id: "artifact.1",
          kind: "document",
          locator: "output.md",
          logical_path: "output.md",
          suggested_name: "output.md",
          media_type: "text/markdown",
          size_bytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        }],
        entries: [{ artifact_id: "artifact.1", role: "primary", ordinal: 0, preferred: true }],
        relations: [],
      },
      diagnostics: [],
      metrics: { duration_ms: 1, input_bytes: 1, output_bytes: bytes.length },
      sequence: 1,
    });
    waitForInputClose();
  }
}
`;
}

function fixtureServer(options: {
  pidFile: string;
  closedFile: string;
  readyFile: string;
  rootTraceFile: string;
  helperTraceFile: string;
  workerTraceFile: string;
  mode: FixtureMode;
  helperBehavior: HelperBehavior;
}): string {
  const helperSource = helperFixtureSource();
  const workerSource = workerFixtureSource();

  return `#!/usr/bin/env node
import { spawn } from "node:child_process";
import { appendFileSync, closeSync, existsSync, writeFileSync } from "node:fs";

const options = ${JSON.stringify(options)};
const helperSource = ${JSON.stringify(helperSource)};
const workerSource = ${JSON.stringify(workerSource)};

function record(event) {
  appendFileSync(options.rootTraceFile, JSON.stringify({ event, pid: process.pid }) + "\\n", "utf8");
}
process.on("SIGTERM", () => {
  record("root_term");
  process.exit(0);
});
record("root_handler_ready");

const helper = spawn(
  process.execPath,
  ["-e", helperSource, options.helperTraceFile, options.readyFile, options.helperBehavior, String(process.pid)],
  { stdio: "ignore" },
);

function startWorker() {
  const worker = spawn(
    process.execPath,
    ["-e", workerSource, options.mode, options.closedFile, options.workerTraceFile],
    { stdio: [0, 1, 2] },
  );
  if (options.mode === "success-query" || options.mode === "success-task") {
    worker.once("close", (code) => {
      record("root_normal_exit");
      process.exit(code === 0 ? 0 : 25);
    });
  }
  closeSync(0);
  writeFileSync(
    options.pidFile,
    String(process.pid) + "\\n" + String(helper.pid) + "\\n" + String(worker.pid) + "\\n",
    "utf8",
  );
  record("worker_spawned");
}

if (existsSync(options.readyFile)) {
  startWorker();
} else {
  const deadline = Date.now() + 2000;
  const timer = setInterval(() => {
    if (existsSync(options.readyFile)) {
      clearInterval(timer);
      startWorker();
    } else if (Date.now() >= deadline) {
      clearInterval(timer);
      record("helper_ready_timeout");
      process.exit(24);
    }
  }, 5);
}
setInterval(() => undefined, 1000);
`;
}

async function assertResistantTerminationEvidence(fixture: Fixture): Promise<void> {
  const rootEvents = await readTraceEvents(fixture.rootTraceFile);
  const helperEvents = await readTraceEvents(fixture.helperTraceFile);
  expect(rootEvents).toContain("root_handler_ready");
  expect(rootEvents).toContain("root_term");
  expect(helperEvents).toContain("helper_handler_ready");
  expect(helperEvents).toContain("helper_term");
  expect(helperEvents).toContain("helper_observed_root_gone");
  expect(helperEvents).not.toContain("helper_exit");
}

function parsePidText(value: string): number[] {
  return value
    .trim()
    .split(/\s+/u)
    .map(Number)
    .filter((pid) => Number.isSafeInteger(pid) && pid > 0);
}

async function waitForPids(pidFile: string): Promise<number[]> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    try {
      const pids = parsePidText(await readFile(pidFile, "utf8"));
      if (pids.length === 3) return pids;
    } catch {
      // The fixture may still be starting.
    }
    await delay(20);
  }
  throw new Error("Linux Machine fixture did not record its complete process group");
}

async function waitForFile(filename: string): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    try {
      await readFile(filename);
      return;
    } catch (error) {
      if (!isErrno(error, "ENOENT")) throw error;
    }
    await delay(20);
  }
  throw new Error("Linux Machine worker did not close its fd 0 in time");
}

async function waitForTraceEvent(traceFile: string, expected: string, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await readTraceEvents(traceFile)).includes(expected)) return;
    await delay(20);
  }
  throw new Error(`Linux Machine fixture did not record ${expected} in time`);
}

async function readTraceEvents(traceFile: string): Promise<string[]> {
  try {
    return (await readFile(traceFile, "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { event: string })
      .map((entry) => entry.event);
  } catch (error) {
    if (isErrno(error, "ENOENT")) return [];
    throw error;
  }
}

function waitForChildClose(child: ChildProcess): Promise<number | null> {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
}

async function expectProcessLive(pid: number): Promise<void> {
  const state = await linuxProcessState(pid);
  if (state === null || state === "Z" || state === "X" || state === "x") {
    throw new Error(`Expected unrelated process ${pid} to remain live`);
  }
}

async function expectProcessNotLive(pid: number): Promise<void> {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    const state = await linuxProcessState(pid);
    if (state === null || state === "Z" || state === "X" || state === "x") return;
    await delay(20);
  }
  throw new Error(`Process ${pid} survived Machine session termination`);
}

async function linuxProcessState(pid: number): Promise<string | null> {
  try {
    const raw = await readFile(`/proc/${pid}/stat`, "utf8");
    const closingParen = raw.lastIndexOf(")");
    if (closingParen < 0) throw new Error("Malformed Linux process stat");
    return raw.slice(closingParen + 1).trim().split(/\s+/u)[0] ?? null;
  } catch (error) {
    if (isErrno(error, "ENOENT") || isErrno(error, "ESRCH")) return null;
    throw error;
  }
}

function killRemaining(pids: readonly number[]): void {
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // The expected path already terminated every live member.
    }
  }
}

function killUnrelated(child: ChildProcess | null): void {
  const pid = child?.pid;
  if (typeof pid !== "number") return;
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // The control process is already gone.
    }
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isErrno(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

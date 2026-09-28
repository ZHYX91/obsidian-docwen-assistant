import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DocWenMachineClient, type MachineTaskRequest } from "../src/docwen/machine-client";

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
  it("terminates a detached process group even when the root exits and its descendant resists SIGTERM", async () => {
    const fixture = await createFixture("timeout", "resistant");
    const client = new DocWenMachineClient(() => fixture.executable, () => "en_US");
    let pids: number[] = [];

    try {
      await expect(client.query("health/check", {}, undefined, 500)).rejects.toMatchObject({
        code: "cli_timeout",
      });
      pids = await waitForPids(fixture.pidFile);
      expect(pids).toHaveLength(2);
      const events = await readTraceEvents(fixture.traceFile);
      expect(events).toContain("root_term");
      expect(events).toContain("helper_term");
      for (const pid of pids) await expectProcessNotLive(pid);
    } finally {
      client.dispose();
      killRemaining(pids);
    }
  }, 10_000);

  it.each(["query", "task", "cancel"] as const)(
    "handles a real server closing fd 0 before a %s write and removes a resistant descendant",
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

      try {
        const operation: Promise<unknown> = phase === "query"
          ? client.query("health/check", {}, controller.signal, 8_000)
          : client.runTask(realTaskRequest(staging, input), controller.signal, 8_000);
        const failure = operation.then(
          () => new Error("Machine operation unexpectedly resolved."),
          (error: unknown) => error,
        );

        pids = await waitForPids(fixture.pidFile);
        await waitForFile(fixture.closedFile);
        await waitForTraceEvent(fixture.traceFile, "helper_handler_ready");
        if (phase === "cancel") {
          controller.abort();
          // This is deliberately shorter than CANCELLATION_GRACE_MS. Seeing SIGTERM here
          // proves the closed-pipe write error started cleanup instead of the 2 s timer.
          await waitForTraceEvent(fixture.traceFile, "helper_term", 1_500);
          expect(await readTraceEvents(fixture.traceFile)).not.toContain("task_cancel_seen");
        }

        const error = await Promise.race([
          failure,
          delay(4_000).then(() => WAIT_EXPIRED),
        ]);
        if (error === WAIT_EXPIRED) throw new Error(`Machine ${phase} failure did not settle within the test bound.`);
        expect(error).toMatchObject({ code: phase === "cancel" ? "cli_cancelled" : "cli_protocol_error" });
        expect(uncaught).toEqual([]);
        expect(await readdir(staging)).toEqual([]);
        const events = await readTraceEvents(fixture.traceFile);
        expect(events).toContain("root_term");
        expect(events).toContain("helper_term");
        for (const pid of pids) await expectProcessNotLive(pid);
      } finally {
        process.removeListener("uncaughtExceptionMonitor", monitor);
        client.dispose();
        killRemaining(pids);
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
      await waitForTraceEvent(fixture.traceFile, "health_seen");
      client.dispose();
      await waitForTraceEvent(fixture.traceFile, "helper_term", 1_500);
      await expect(pending).rejects.toMatchObject({ code: "cli_cancelled" });
      const events = await readTraceEvents(fixture.traceFile);
      expect(events).toContain("root_term");
      expect(events).toContain("helper_term");
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
      await waitForTraceEvent(fixture.traceFile, "health_seen");
      client.dispose();
      await expect(pending).rejects.toMatchObject({ code: "cli_cancelled" });
      const events = await readTraceEvents(fixture.traceFile);
      expect(events).toContain("root_term");
      expect(events).toContain("helper_term");
      expect(events).toContain("helper_exit");
      for (const pid of pids) await expectProcessNotLive(pid);
    } finally {
      client.dispose();
      killRemaining(pids);
    }
  }, 8_000);
});

type FixtureMode = "timeout" | "query" | "task" | "cancel" | "unload";
type HelperBehavior = "resistant" | "cooperative";

async function createFixture(mode: FixtureMode, helperBehavior: HelperBehavior) {
  const root = await mkdtemp(path.join(tmpdir(), "docwen-machine-linux-"));
  roots.push(root);
  const executable = path.join(root, "docwen-machine-fixture");
  const pidFile = path.join(root, "pids.txt");
  const closedFile = path.join(root, "stdin-closed.txt");
  const readyFile = path.join(root, "helper-ready.txt");
  const traceFile = path.join(root, "trace.jsonl");
  await writeFile(
    executable,
    fixtureServer(pidFile, closedFile, readyFile, traceFile, mode, helperBehavior),
    "utf8",
  );
  await chmod(executable, 0o755);
  return { root, executable, pidFile, closedFile, readyFile, traceFile };
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

function fixtureServer(
  pidFile: string,
  closedFile: string,
  readyFile: string,
  traceFile: string,
  mode: FixtureMode,
  helperBehavior: HelperBehavior,
): string {
  const helperSource = `
const { appendFileSync, writeFileSync } = require("node:fs");
const [traceFile, readyFile, behavior] = process.argv.slice(1);
function record(event) {
  appendFileSync(traceFile, JSON.stringify({ event, pid: process.pid }) + "\\n", "utf8");
}
process.on("SIGTERM", () => {
  record("helper_term");
  if (behavior === "cooperative") {
    record("helper_exit");
    process.exit(0);
  }
});
record("helper_handler_ready");
writeFileSync(readyFile, "ready\\n", "utf8");
setInterval(() => undefined, 1000);
`;

  return `#!/usr/bin/env node
import { spawn } from "node:child_process";
import { appendFileSync, closeSync, existsSync, writeFileSync } from "node:fs";

const pidFile = ${JSON.stringify(pidFile)};
const closedFile = ${JSON.stringify(closedFile)};
const readyFile = ${JSON.stringify(readyFile)};
const traceFile = ${JSON.stringify(traceFile)};
const mode = ${JSON.stringify(mode)};
const helperBehavior = ${JSON.stringify(helperBehavior)};
const helperSource = ${JSON.stringify(helperSource)};

function record(event) {
  appendFileSync(traceFile, JSON.stringify({ event, pid: process.pid }) + "\\n", "utf8");
}
process.on("SIGTERM", () => {
  record("root_term");
  process.exit(0);
});
record("root_handler_ready");

const descendant = spawn(
  process.execPath,
  ["-e", helperSource, traceFile, readyFile, helperBehavior],
  { stdio: "ignore" },
);
writeFileSync(pidFile, String(process.pid) + "\\n" + String(descendant.pid) + "\\n", "utf8");
setInterval(() => undefined, 1000);

let buffered = Buffer.alloc(0);
let inputClosing = false;
process.stdin.on("data", (chunk) => {
  buffered = Buffer.concat([buffered, Buffer.from(chunk)]);
  while (true) {
    const headerEnd = buffered.indexOf("\\r\\n\\r\\n");
    if (headerEnd < 0) return;
    const header = buffered.subarray(0, headerEnd + 4).toString("ascii");
    const match = /^Content-Length: ([1-9][0-9]*)\\r\\n\\r\\n$/.exec(header);
    if (!match) process.exit(20);
    const length = Number(match[1]);
    const frameEnd = headerEnd + 4 + length;
    if (buffered.length < frameEnd) return;
    const message = JSON.parse(buffered.subarray(headerEnd + 4, frameEnd).toString("utf8"));
    buffered = buffered.subarray(frameEnd);
    handle(message);
  }
});
process.stdin.resume();

function handle(message) {
  if (message.method === "initialize") {
    afterHelperReady(() => {
      const initialized = {
        protocol: { name: "docwen.machine", major: 2, minor: 0 },
        artifact_bundle_schema: "docwen.artifact_bundle.v3",
        server: { name: "DocWen", version: "0.13.0" },
        methods: [],
        features: { progress: true, cancellation: true },
        max_concurrent_tasks: 1,
      };
      if (mode === "query") closeInput(() => reply(message.id, initialized));
      else reply(message.id, initialized);
    });
    return;
  }
  if (message.method === "health/check") {
    record("health_seen");
    return;
  }
  if (message.method === "task/plan") {
    if (mode === "task") closeInput(() => reply(message.id, { plan_id: "plan.1" }));
    else reply(message.id, { plan_id: "plan.1" });
    return;
  }
  if (message.method === "task/execute") {
    reply(message.id, { task_id: "task.1", state: "accepted" });
    if (mode === "cancel") setTimeout(() => closeInput(() => undefined), 50);
    return;
  }
  if (message.method === "task/cancel") record("task_cancel_seen");
}

function afterHelperReady(callback) {
  if (existsSync(readyFile)) {
    callback();
    return;
  }
  const deadline = Date.now() + 2000;
  const timer = setInterval(() => {
    if (existsSync(readyFile)) {
      clearInterval(timer);
      callback();
    } else if (Date.now() >= deadline) {
      clearInterval(timer);
      process.exit(24);
    }
  }, 5);
}

function closeInput(afterClose) {
  if (inputClosing) return;
  inputClosing = true;
  process.stdin.pause();
  process.stdin.on("error", () => {});
  closeSync(0);
  writeFileSync(closedFile, "closed\\n", "utf8");
  record("stdin_closed");
  afterClose();
}

function reply(id, result) {
  const body = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id, result }), "utf8");
  process.stdout.write(Buffer.from("Content-Length: " + body.length + "\\r\\n\\r\\n", "ascii"));
  process.stdout.write(body);
}
`;
}

async function waitForPids(pidFile: string): Promise<number[]> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    try {
      const pids = (await readFile(pidFile, "utf8"))
        .trim()
        .split(/\s+/u)
        .map(Number)
        .filter((pid) => Number.isSafeInteger(pid) && pid > 0);
      if (pids.length === 2) return pids;
    } catch {
      // The server may still be starting.
    }
    await delay(20);
  }
  throw new Error("Linux Machine fixture did not record its process group");
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
  throw new Error("Linux Machine fixture did not close fd 0 in time");
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

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isErrno(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

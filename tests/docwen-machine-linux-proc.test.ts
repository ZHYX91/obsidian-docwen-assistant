import { spawn, type ChildProcess } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const procFault = vi.hoisted(() => ({
  changedStartTimePid: null as number | null,
  changedStatAfter: null as string | null,
  changedStatBefore: null as string | null,
  deniedStatPid: null as number | null,
  enumerationCode: null as string | null,
  namespacePidDelta: 0,
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  const actualReadFile = actual.readFile as unknown as (
    target: unknown,
    ...args: unknown[]
  ) => Promise<unknown>;
  const actualReaddir = actual.readdir as unknown as (
    target: unknown,
    ...args: unknown[]
  ) => Promise<unknown>;
  return {
    ...actual,
    readFile: async (target: unknown, ...args: unknown[]) => {
      if (
        procFault.deniedStatPid !== null
        && target === `/proc/${procFault.deniedStatPid}/stat`
      ) {
        throw Object.assign(new Error("synthetic proc stat denial"), { code: "EACCES" });
      }
      const value = await actualReadFile(target, ...args);
      if (typeof value !== "string") return value;
      if (target === "/proc/self/stat" && procFault.namespacePidDelta !== 0) {
        return value.replace(/^\d+/u, String(process.pid + procFault.namespacePidDelta));
      }
      if (
        procFault.changedStartTimePid !== null
        && target === `/proc/${procFault.changedStartTimePid}/stat`
      ) {
        const closingParen = value.lastIndexOf(")");
        const fields = value.slice(closingParen + 1).trim().split(/\s+/u);
        procFault.changedStatBefore = value;
        fields[19] = String(BigInt(fields[19] ?? "0") + 1n);
        const changed = `${value.slice(0, closingParen + 1)} ${fields.join(" ")}`;
        procFault.changedStatAfter = changed;
        return changed;
      }
      return value;
    },
    readdir: async (target: unknown, ...args: unknown[]) => {
      if (target === "/proc" && procFault.enumerationCode) {
        throw Object.assign(new Error("synthetic proc enumeration denial"), {
          code: procFault.enumerationCode,
        });
      }
      return actualReaddir(target, ...args);
    },
  };
});

import { DocWenMachineClient } from "../src/docwen/machine-client";

const roots: string[] = [];
const spawned: ChildProcess[] = [];

beforeEach(() => {
  procFault.changedStartTimePid = null;
  procFault.changedStatAfter = null;
  procFault.changedStatBefore = null;
  procFault.deniedStatPid = null;
  procFault.enumerationCode = null;
  procFault.namespacePidDelta = 0;
});

afterEach(() => {
  procFault.changedStartTimePid = null;
  procFault.changedStatAfter = null;
  procFault.changedStatBefore = null;
  procFault.deniedStatPid = null;
  procFault.enumerationCode = null;
  procFault.namespacePidDelta = 0;
  vi.restoreAllMocks();
  for (const child of spawned.splice(0)) killDetached(child);
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe.skipIf(process.platform !== "linux")("Linux process-group evidence failures", () => {
  it("still cleans the owned group when an unrelated proc stat is unreadable, but does not claim complete proof", async () => {
    const fixture = createHeldMachine();
    const sentinel = startSentinel();
    const client = new DocWenMachineClient(() => fixture.executable, () => "en_US");
    let pids: number[] = [];

    try {
      const pending = client.query("health/check", {}, undefined, 1_000);
      pids = await waitForPids(fixture.pidFile);
      procFault.deniedStatPid = requiredPid(sentinel);
      const error = await rejected(pending);

      expectUnconfirmedCleanup(error, "EACCES", "cli_timeout");
      expect(readEvents(fixture.rootTrace)).toContain("root_term");
      expect(readEvents(fixture.helperTrace)).toContain("helper_term");
      for (const pid of pids) await expectProcessNotLive(pid);
      expectProcessLive(requiredPid(sentinel));
    } finally {
      client.dispose();
      killPids(pids);
    }
  }, 8_000);

  it("signals the verified group but refuses a blind force-kill when a known surviving member becomes unreadable", async () => {
    const fixture = createHeldMachine();
    const sentinel = startSentinel();
    const client = new DocWenMachineClient(() => fixture.executable, () => "en_US");
    let pids: number[] = [];

    try {
      const pending = client.query("health/check", {}, undefined, 1_000);
      pids = await waitForPids(fixture.pidFile);
      const helperPid = pids[1];
      procFault.deniedStatPid = helperPid;
      const error = await rejected(pending);

      expectUnconfirmedCleanup(error, "EACCES", "cli_timeout");
      expect(readEvents(fixture.rootTrace)).toContain("root_term");
      expect(readEvents(fixture.helperTrace)).toContain("helper_term");
      await expectProcessNotLive(pids[0]);
      expectProcessLive(helperPid);
      expectProcessLive(requiredPid(sentinel));
    } finally {
      client.dispose();
      killPids(pids);
    }
  }, 8_000);

  it("does not re-own a reused pid when only starttime changes under the same pid, pgid and sid", async () => {
    const fixture = createHeldMachine();
    const sentinel = startSentinel();
    const client = new DocWenMachineClient(() => fixture.executable, () => "en_US");
    let pids: number[] = [];
    let interceptedForceSignals = 0;

    try {
      const pending = client.query("health/check", {}, undefined, 1_000);
      pids = await waitForPids(fixture.pidFile);
      const groupId = pids[0];
      const helperPid = pids[1];
      await waitForEvent(fixture.helperTrace, "helper_term", 2_500);

      const realKill = process.kill.bind(process);
      vi.spyOn(process, "kill").mockImplementation(((pid: number, signal?: NodeJS.Signals | number) => {
        if (pid === -groupId && signal === "SIGKILL") {
          interceptedForceSignals += 1;
          return true;
        }
        return realKill(pid, signal);
      }) as typeof process.kill);
      procFault.changedStartTimePid = helperPid;

      const error = await rejected(pending);

      expectUnconfirmedOwnership(error, "identity_changed", "cli_timeout");
      expect(interceptedForceSignals).toBe(0);
      expect(procFault.changedStatBefore).not.toBeNull();
      expect(procFault.changedStatAfter).not.toBeNull();
      const before = statIdentity(procFault.changedStatBefore!);
      const after = statIdentity(procFault.changedStatAfter!);
      expect({
        pid: after.pid,
        processGroup: after.processGroup,
        session: after.session,
      }).toEqual({
        pid: before.pid,
        processGroup: before.processGroup,
        session: before.session,
      });
      expect(after.startTime).not.toBe(before.startTime);
      await expectProcessNotLive(pids[0]);
      expectProcessLive(helperPid);
      expectProcessLive(requiredPid(sentinel));
    } finally {
      client.dispose();
      killPids(pids);
    }
  }, 8_000);

  it("treats a procfs pid-namespace mismatch as unconfirmed instead of numeric proof", async () => {
    const fixture = createHeldMachine();
    const sentinel = startSentinel();
    const client = new DocWenMachineClient(() => fixture.executable, () => "en_US");
    let pids: number[] = [];

    try {
      const pending = client.query("health/check", {}, undefined, 1_000);
      pids = await waitForPids(fixture.pidFile);
      procFault.namespacePidDelta = 100_000;
      const error = await rejected(pending);

      expectUnconfirmedOwnership(error, "proc_namespace_mismatch", "cli_timeout");
      expect(readEvents(fixture.rootTrace)).not.toContain("root_term");
      expect(readEvents(fixture.helperTrace)).not.toContain("helper_term");
      for (const pid of pids) expectProcessLive(pid);
      expectProcessLive(requiredPid(sentinel));
    } finally {
      client.dispose();
      killPids(pids);
    }
  }, 8_000);

  it("falls back to verified known descendants when proc enumeration fails and still reports incomplete proof", async () => {
    const fixture = createHeldMachine();
    const sentinel = startSentinel();
    const client = new DocWenMachineClient(() => fixture.executable, () => "en_US");
    let pids: number[] = [];

    try {
      const pending = client.query("health/check", {}, undefined, 1_000);
      pids = await waitForPids(fixture.pidFile);
      procFault.enumerationCode = "EACCES";
      const error = await rejected(pending);

      expectUnconfirmedCleanup(error, "EACCES", "cli_timeout");
      expect(readEvents(fixture.rootTrace)).toContain("root_term");
      expect(readEvents(fixture.helperTrace)).toContain("helper_term");
      for (const pid of pids) await expectProcessNotLive(pid);
      expectProcessLive(requiredPid(sentinel));
    } finally {
      client.dispose();
      killPids(pids);
    }
  }, 8_000);
});

function createHeldMachine(): {
  executable: string;
  pidFile: string;
  rootTrace: string;
  helperTrace: string;
} {
  const root = mkdtempSync(path.join(tmpdir(), "docwen-proc-evidence-"));
  roots.push(root);
  const executable = path.join(root, "docwen-machine-fixture");
  const pidFile = path.join(root, "pids.txt");
  const rootTrace = path.join(root, "root.jsonl");
  const helperTrace = path.join(root, "helper.jsonl");
  writeFileSync(executable, heldMachineSource(pidFile, rootTrace, helperTrace), "utf8");
  chmodSync(executable, 0o755);
  return { executable, pidFile, rootTrace, helperTrace };
}

function heldMachineSource(pidFile: string, rootTrace: string, helperTrace: string): string {
  const helperSource = String.raw`
const { appendFileSync } = require("node:fs");
const trace = process.argv[1];
function record(event) {
  appendFileSync(trace, JSON.stringify({ event, pid: process.pid }) + "\n", "utf8");
}
process.on("SIGTERM", () => record("helper_term"));
record("helper_ready");
setInterval(() => undefined, 1000);
`;

  return `#!/usr/bin/env node
import { spawn } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";

const pidFile = ${JSON.stringify(pidFile)};
const rootTrace = ${JSON.stringify(rootTrace)};
const helperTrace = ${JSON.stringify(helperTrace)};
const helperSource = ${JSON.stringify(helperSource)};

function record(event) {
  appendFileSync(rootTrace, JSON.stringify({ event, pid: process.pid }) + "\\n", "utf8");
}
process.on("SIGTERM", () => {
  record("root_term");
  process.exit(0);
});
record("root_ready");

const helper = spawn(process.execPath, ["-e", helperSource, helperTrace], { stdio: "ignore" });
writeFileSync(pidFile, String(process.pid) + "\\n" + String(helper.pid) + "\\n", "utf8");

let buffered = Buffer.alloc(0);
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
    if (message.method === "initialize") {
      reply(message.id, {
        protocol: { name: "docwen.machine", major: 2, minor: 0 },
        artifact_bundle_schema: "docwen.artifact_bundle.v3",
        server: { name: "DocWen", version: "0.13.0" },
        methods: [],
        features: { progress: true, cancellation: true },
        max_concurrent_tasks: 1,
      });
    } else if (message.method === "health/check") {
      record("health_seen");
    }
  }
});
process.stdin.resume();
setInterval(() => undefined, 1000);

function reply(id, result) {
  const body = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id, result }), "utf8");
  process.stdout.write(Buffer.from("Content-Length: " + body.length + "\\r\\n\\r\\n", "ascii"));
  process.stdout.write(body);
}
`;
}

function startSentinel(): ChildProcess {
  const child = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  spawned.push(child);
  return child;
}

function requiredPid(child: ChildProcess): number {
  if (typeof child.pid !== "number") throw new Error("Child process did not expose a pid");
  return child.pid;
}

async function rejected(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected operation to reject");
}

function expectUnconfirmedCleanup(error: unknown, systemCode: string, primaryCode: string): void {
  expect(error).toMatchObject({
    code: "cli_cleanup_failed",
    details: {
      cleanupState: "unconfirmed",
      systemCode,
      primaryCode,
    },
  });
  const details = (error as { details: { unconfirmedEvidenceCount?: number } }).details;
  expect(details.unconfirmedEvidenceCount).toBeGreaterThan(0);
}

function expectUnconfirmedOwnership(error: unknown, ownershipIssue: string, primaryCode: string): void {
  expect(error).toMatchObject({
    code: "cli_cleanup_failed",
    details: {
      cleanupState: "unconfirmed",
      ownershipIssue,
      ownershipState: "unconfirmed",
      primaryCode,
    },
  });
}

function statIdentity(raw: string): {
  pid: number;
  processGroup: number;
  session: number;
  startTime: string;
} {
  const openingParen = raw.indexOf("(");
  const closingParen = raw.lastIndexOf(")");
  const fields = raw.slice(closingParen + 1).trim().split(/\s+/u);
  return {
    pid: Number(raw.slice(0, openingParen).trim()),
    processGroup: Number(fields[2]),
    session: Number(fields[3]),
    startTime: fields[19] ?? "",
  };
}

async function waitForEvent(filename: string, expected: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (readEvents(filename).includes(expected)) return;
    await delay(20);
  }
  throw new Error(`Machine fixture did not record ${expected} in time`);
}

async function waitForPids(pidFile: string): Promise<number[]> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    try {
      const pids = readFileSync(pidFile, "utf8")
        .trim()
        .split(/\s+/u)
        .map(Number)
        .filter((pid) => Number.isSafeInteger(pid) && pid > 0);
      if (pids.length === 2) return pids;
    } catch {
      // Fixture startup is still in progress.
    }
    await delay(20);
  }
  throw new Error("Machine fixture did not record root/helper pids");
}

function readEvents(filename: string): string[] {
  try {
    return readFileSync(filename, "utf8")
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

function expectProcessLive(pid: number): void {
  const state = linuxProcessState(pid);
  if (state === null || state === "Z" || state === "X" || state === "x") {
    throw new Error(`Expected process ${pid} to remain live`);
  }
}

async function expectProcessNotLive(pid: number): Promise<void> {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    const state = linuxProcessState(pid);
    if (state === null || state === "Z" || state === "X" || state === "x") return;
    await delay(20);
  }
  throw new Error(`Process ${pid} remained live`);
}

function linuxProcessState(pid: number): string | null {
  try {
    const raw = readFileSync(`/proc/${pid}/stat`, "utf8");
    const closingParen = raw.lastIndexOf(")");
    if (closingParen < 0) throw new Error("Malformed proc stat");
    return raw.slice(closingParen + 1).trim().split(/\s+/u)[0] ?? null;
  } catch (error) {
    if (isErrno(error, "ENOENT") || isErrno(error, "ESRCH")) return null;
    throw error;
  }
}

function killPids(pids: readonly number[]): void {
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Expected cleanup may already have removed the process.
    }
  }
}

function killDetached(child: ChildProcess): void {
  const pid = child.pid;
  if (typeof pid !== "number") return;
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Sentinel already exited.
    }
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isErrno(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

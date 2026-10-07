import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const procFault = vi.hoisted(() => ({
  hiddenChildrenParentPid: null as number | null,
  unreadableUnknownTaskPid: null as number | null,
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
        procFault.hiddenChildrenParentPid !== null
        && typeof target === "string"
        && target.startsWith(`/proc/${procFault.hiddenChildrenParentPid}/task/`)
        && target.endsWith("/children")
      ) {
        throw Object.assign(new Error("synthetic unavailable task children"), { code: "ENOENT" });
      }
      return actualReadFile(target, ...args);
    },
    readdir: async (target: unknown, ...args: unknown[]) => {
      if (
        procFault.unreadableUnknownTaskPid !== null
        && target === `/proc/${procFault.unreadableUnknownTaskPid}/task`
      ) {
        throw Object.assign(new Error("synthetic unknown task read denial"), { code: "EACCES" });
      }
      return actualReaddir(target, ...args);
    },
  };
});

import { DocWenMachineClient } from "../src/docwen/machine-client";

const HELPER_C_SOURCE = "#define _GNU_SOURCE\n#include <fcntl.h>\n#include <pthread.h>\n#include <signal.h>\n#include <stdatomic.h>\n#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <sys/syscall.h>\n#include <unistd.h>\n\nstatic const char *heartbeat_file;\nstatic const char *release_file;\nstatic const char *signal_file;\nstatic const char *tid_file;\nstatic atomic_int worker_ready = 0;\n\nstatic void append_line(const char *path, const char *line) {\n  int fd = open(path, O_WRONLY | O_CREAT | O_APPEND, 0600);\n  if (fd < 0) return;\n  size_t length = strlen(line);\n  (void)write(fd, line, length);\n  (void)close(fd);\n}\n\nstatic void write_number(const char *path, long value) {\n  int fd = open(path, O_WRONLY | O_CREAT | O_TRUNC, 0600);\n  if (fd < 0) _exit(91);\n  char buffer[64];\n  int length = snprintf(buffer, sizeof(buffer), \"%ld\\n\", value);\n  if (length <= 0 || write(fd, buffer, (size_t)length) != length) _exit(92);\n  (void)close(fd);\n}\n\nstatic void on_term(int signo) {\n  (void)signo;\n  append_line(signal_file, \"term\\n\");\n}\n\nstatic void *heartbeat_main(void *unused) {\n  (void)unused;\n  write_number(tid_file, (long)syscall(SYS_gettid));\n  atomic_store(&worker_ready, 1);\n  while (access(release_file, F_OK) != 0) {\n    append_line(heartbeat_file, \"h\\n\");\n    usleep(50000);\n  }\n  return NULL;\n}\n\nint main(int argc, char **argv) {\n  if (argc != 7) return 90;\n  heartbeat_file = argv[1];\n  release_file = argv[2];\n  signal_file = argv[3];\n  tid_file = argv[4];\n  const char *pid_file = argv[5];\n  const char *ready_file = argv[6];\n\n  signal(SIGTERM, on_term);\n  pthread_t worker;\n  if (pthread_create(&worker, NULL, heartbeat_main, NULL) != 0) return 31;\n  while (!atomic_load(&worker_ready)) usleep(1000);\n  write_number(pid_file, (long)getpid());\n  append_line(ready_file, \"ready\\n\");\n  pthread_exit(NULL);\n}\n";
const nativeFixtureAvailable = process.platform === "linux"
  && spawnSync("cc", ["--version"], { stdio: "ignore" }).status === 0
  && existsSync("/proc/self/stat");

const roots: string[] = [];
const controls: ChildProcess[] = [];

beforeEach(() => {
  procFault.hiddenChildrenParentPid = null;
  procFault.unreadableUnknownTaskPid = null;
});

afterEach(() => {
  procFault.hiddenChildrenParentPid = null;
  procFault.unreadableUnknownTaskPid = null;
  for (const child of controls.splice(0)) killDetached(child);
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe.skipIf(!nativeFixtureAvailable)("Linux unknown pthread group members", () => {
  it("rejects success while an unknown zombie leader still has a live same-group task", async () => {
    const fixture = createFixture();
    const sentinel = startSentinel();
    const client = new DocWenMachineClient(() => fixture.machineExecutable, () => "en_US");
    let ids: FixtureIds | null = null;

    try {
      const pending = client.query("health/check", {}, undefined, 5_000);
      ids = await waitForFixtureIds(fixture);
      procFault.hiddenChildrenParentPid = ids.rootPid;
      writeFileSync(fixture.initializeReleaseFile, "release\n", "utf8");
      await waitForFileText(fixture.healthFile, "health");
      await assertUnknownZombieLeaderWithLiveWorker(ids);
      await assertHeartbeatAdvances(fixture.heartbeatFile);
      expectProcessLive(requiredPid(sentinel));

      writeFileSync(fixture.healthReleaseFile, "release\n", "utf8");
      await expect(pending).rejects.toMatchObject({
        code: "cli_cleanup_failed",
        details: {
          cleanupState: "unconfirmed",
          ownershipIssue: "unknown_group_member",
          ownershipState: "unconfirmed",
        },
      });

      expect(readText(fixture.signalFile)).toBe("");
      expectProcessLive(ids.helperWorkerTid);
      await assertHeartbeatAdvances(fixture.heartbeatFile);
      expectProcessLive(requiredPid(sentinel));
    } finally {
      client.dispose();
      if (ids) killPids([ids.helperPid, ids.helperWorkerTid]);
    }
  }, 12_000);

  it("allows success after every task of the unknown helper has really exited", async () => {
    const fixture = createFixture();
    const sentinel = startSentinel();
    const client = new DocWenMachineClient(() => fixture.machineExecutable, () => "en_US");
    let ids: FixtureIds | null = null;

    try {
      const pending = client.query("health/check", {}, undefined, 5_000);
      ids = await waitForFixtureIds(fixture);
      procFault.hiddenChildrenParentPid = ids.rootPid;
      writeFileSync(fixture.initializeReleaseFile, "release\n", "utf8");
      await waitForFileText(fixture.healthFile, "health");
      await assertUnknownZombieLeaderWithLiveWorker(ids);
      await assertHeartbeatAdvances(fixture.heartbeatFile);

      writeFileSync(fixture.helperReleaseFile, "release\n", "utf8");
      await expectTaskNotLive(ids.helperWorkerTid);
      await assertHeartbeatStopped(fixture.heartbeatFile);
      writeFileSync(fixture.healthReleaseFile, "release\n", "utf8");

      await expect(pending).resolves.toMatchObject({ all_ok: true });
      expect(readText(fixture.signalFile)).toBe("");
      expectProcessLive(requiredPid(sentinel));
    } finally {
      client.dispose();
      if (ids) killPids([ids.helperPid, ids.helperWorkerTid]);
    }
  }, 12_000);

  it("keeps unknown task-read failure unconfirmed instead of treating a zombie leader as dead", async () => {
    const fixture = createFixture();
    const sentinel = startSentinel();
    const client = new DocWenMachineClient(() => fixture.machineExecutable, () => "en_US");
    let ids: FixtureIds | null = null;

    try {
      const pending = client.query("health/check", {}, undefined, 5_000);
      ids = await waitForFixtureIds(fixture);
      procFault.hiddenChildrenParentPid = ids.rootPid;
      procFault.unreadableUnknownTaskPid = ids.helperPid;
      writeFileSync(fixture.initializeReleaseFile, "release\n", "utf8");
      await waitForFileText(fixture.healthFile, "health");
      await assertUnknownZombieLeaderWithLiveWorker(ids);
      await assertHeartbeatAdvances(fixture.heartbeatFile);

      writeFileSync(fixture.healthReleaseFile, "release\n", "utf8");
      await expect(pending).rejects.toMatchObject({
        code: "cli_cleanup_failed",
        details: {
          cleanupState: "unconfirmed",
          ownershipIssue: "proc_unreadable",
          ownershipState: "unconfirmed",
          systemCode: "EACCES",
        },
      });

      expect(readText(fixture.signalFile)).toBe("");
      expectProcessLive(ids.helperWorkerTid);
      await assertHeartbeatAdvances(fixture.heartbeatFile);
      expectProcessLive(requiredPid(sentinel));
    } finally {
      client.dispose();
      if (ids) killPids([ids.helperPid, ids.helperWorkerTid]);
    }
  }, 12_000);
});

type Fixture = {
  machineExecutable: string;
  rootPidFile: string;
  helperPidFile: string;
  helperTidFile: string;
  helperReadyFile: string;
  heartbeatFile: string;
  helperReleaseFile: string;
  signalFile: string;
  initializeReleaseFile: string;
  healthReleaseFile: string;
  healthFile: string;
};

type FixtureIds = {
  rootPid: number;
  helperPid: number;
  helperWorkerTid: number;
};

function createFixture(): Fixture {
  const root = mkdtempSync(path.join(tmpdir(), "docwen-unknown-pthread-"));
  roots.push(root);
  const helperSource = path.join(root, "helper.c");
  const helperBinary = path.join(root, "helper.bin");
  writeFileSync(helperSource, HELPER_C_SOURCE, "utf8");
  const compile = spawnSync("cc", ["-std=c11", "-O2", "-pthread", helperSource, "-o", helperBinary], {
    encoding: "utf8",
  });
  if (compile.status !== 0) {
    throw new Error("Unable to compile unknown pthread helper: " + (compile.stderr || compile.stdout));
  }
  chmodSync(helperBinary, 0o755);

  const fixture: Fixture = {
    machineExecutable: path.join(root, "machine"),
    rootPidFile: path.join(root, "root.pid"),
    helperPidFile: path.join(root, "helper.pid"),
    helperTidFile: path.join(root, "helper.tid"),
    helperReadyFile: path.join(root, "helper.ready"),
    heartbeatFile: path.join(root, "helper-heartbeat.log"),
    helperReleaseFile: path.join(root, "helper-release"),
    signalFile: path.join(root, "helper-signal.log"),
    initializeReleaseFile: path.join(root, "initialize-release"),
    healthReleaseFile: path.join(root, "health-release"),
    healthFile: path.join(root, "health.log"),
  };

  const machineSource = machineFixtureSource(fixture, helperBinary);
  writeFileSync(fixture.machineExecutable, machineSource, "utf8");
  chmodSync(fixture.machineExecutable, 0o755);
  return fixture;
}

function machineFixtureSource(fixture: Fixture, helperBinary: string): string {
  return `#!/usr/bin/env node
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, writeFileSync } from "node:fs";

const helper = spawn(${JSON.stringify(helperBinary)}, [
  ${JSON.stringify(fixture.heartbeatFile)},
  ${JSON.stringify(fixture.helperReleaseFile)},
  ${JSON.stringify(fixture.signalFile)},
  ${JSON.stringify(fixture.helperTidFile)},
  ${JSON.stringify(fixture.helperPidFile)},
  ${JSON.stringify(fixture.helperReadyFile)},
], { stdio: "ignore" });
helper.unref();
writeFileSync(${JSON.stringify(fixture.rootPidFile)}, String(process.pid) + "\\n", "utf8");

let buffered = Buffer.alloc(0);
process.stdin.on("data", (chunk) => {
  buffered = Buffer.concat([buffered, Buffer.from(chunk)]);
  void drain();
});
process.stdin.on("end", () => process.exit(0));
process.stdin.resume();

let draining = false;
async function drain() {
  if (draining) return;
  draining = true;
  try {
    while (true) {
      const message = takeFrame();
      if (!message) return;
      if (message.method === "initialize") {
        await waitFor(${JSON.stringify(fixture.initializeReleaseFile)});
        reply(message.id, {
          protocol: { name: "docwen.machine", major: 2, minor: 0 },
          artifact_bundle_schema: "docwen.artifact_bundle.v3",
          server: { name: "DocWen", version: "0.17.0" },
          methods: [],
          features: { progress: true, cancellation: true },
          max_concurrent_tasks: 1,
        });
      } else if (message.method === "health/check") {
        appendFileSync(${JSON.stringify(fixture.healthFile)}, "health\\n", "utf8");
        await waitFor(${JSON.stringify(fixture.healthReleaseFile)});
        reply(message.id, { all_ok: true, checks: [] });
      }
    }
  } finally {
    draining = false;
  }
}

function takeFrame() {
  const headerEnd = buffered.indexOf("\\r\\n\\r\\n");
  if (headerEnd < 0) return null;
  const header = buffered.subarray(0, headerEnd + 4).toString("ascii");
  const match = /^Content-Length: ([1-9][0-9]*)\\r\\n\\r\\n$/.exec(header);
  if (!match) process.exit(20);
  const length = Number(match[1]);
  const frameEnd = headerEnd + 4 + length;
  if (buffered.length < frameEnd) return null;
  const message = JSON.parse(buffered.subarray(headerEnd + 4, frameEnd).toString("utf8"));
  buffered = buffered.subarray(frameEnd);
  return message;
}

function reply(id, result) {
  const body = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id, result }), "utf8");
  process.stdout.write(Buffer.from("Content-Length: " + body.length + "\\r\\n\\r\\n", "ascii"));
  process.stdout.write(body);
}

async function waitFor(filename) {
  while (!existsSync(filename)) await new Promise((resolve) => setTimeout(resolve, 5));
}
`;
}

async function waitForFixtureIds(fixture: Fixture): Promise<FixtureIds> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    try {
      const ids = {
        rootPid: Number(readText(fixture.rootPidFile).trim()),
        helperPid: Number(readText(fixture.helperPidFile).trim()),
        helperWorkerTid: Number(readText(fixture.helperTidFile).trim()),
      };
      if (
        Number.isSafeInteger(ids.rootPid)
        && ids.rootPid > 0
        && Number.isSafeInteger(ids.helperPid)
        && ids.helperPid > 0
        && Number.isSafeInteger(ids.helperWorkerTid)
        && ids.helperWorkerTid > 0
        && readText(fixture.helperReadyFile).includes("ready")
      ) return ids;
    } catch {
      // The real helper is still starting.
    }
    await delay(10);
  }
  throw new Error("Unknown pthread helper did not become ready");
}

async function assertUnknownZombieLeaderWithLiveWorker(ids: FixtureIds): Promise<void> {
  const deadline = Date.now() + 1_500;
  while (Date.now() < deadline) {
    const helper = readLinuxStat(ids.helperPid);
    const worker = readLinuxStat(ids.helperWorkerTid);
    if (
      helper?.state === "Z"
      && worker !== null
      && isLiveState(worker.state)
      && helper.processGroup === ids.rootPid
      && helper.session === ids.rootPid
      && worker.processGroup === ids.rootPid
      && worker.session === ids.rootPid
    ) return;
    await delay(10);
  }
  throw new Error("Expected unknown zombie helper leader with a live same-group worker task");
}

async function waitForFileText(filename: string, expected: string): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    if (readText(filename).includes(expected)) return;
    await delay(10);
  }
  throw new Error(`Expected ${filename} to contain ${expected}`);
}

async function assertHeartbeatAdvances(filename: string): Promise<void> {
  const before = fileSize(filename);
  await delay(160);
  expect(fileSize(filename)).toBeGreaterThan(before);
}

async function assertHeartbeatStopped(filename: string): Promise<void> {
  const before = fileSize(filename);
  await delay(160);
  expect(fileSize(filename)).toBe(before);
}

async function expectTaskNotLive(tid: number): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    const task = readLinuxStat(tid);
    if (task === null || !isLiveState(task.state)) return;
    await delay(20);
  }
  throw new Error("Unknown helper task remained live");
}

function expectProcessLive(pid: number): void {
  const state = readLinuxStat(pid);
  if (state === null || !isLiveState(state.state)) {
    throw new Error(`Expected process ${pid} to remain live`);
  }
}

type LinuxStat = {
  state: string;
  processGroup: number;
  session: number;
};

function readLinuxStat(pid: number): LinuxStat | null {
  try {
    const raw = readFileSync(`/proc/${pid}/stat`, "utf8");
    const closingParen = raw.lastIndexOf(")");
    if (closingParen < 0) throw new Error("Malformed proc stat");
    const fields = raw.slice(closingParen + 1).trim().split(/\s+/u);
    return {
      state: fields[0] ?? "",
      processGroup: Number(fields[2]),
      session: Number(fields[3]),
    };
  } catch (error) {
    if (isErrno(error, "ENOENT") || isErrno(error, "ESRCH")) return null;
    throw error;
  }
}

function isLiveState(state: string): boolean {
  return state !== "Z" && state !== "X" && state !== "x";
}

function fileSize(filename: string): number {
  try {
    return statSync(filename).size;
  } catch (error) {
    if (isErrno(error, "ENOENT")) return 0;
    throw error;
  }
}

function startSentinel(): ChildProcess {
  const child = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  controls.push(child);
  return child;
}

function requiredPid(child: ChildProcess): number {
  if (typeof child.pid !== "number") throw new Error("Sentinel process did not expose a pid");
  return child.pid;
}

function killPids(pids: readonly number[]): void {
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Product cleanup or prior task exit may already have removed it.
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

function readText(filename: string): string {
  try {
    return readFileSync(filename, "utf8");
  } catch (error) {
    if (isErrno(error, "ENOENT")) return "";
    throw error;
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isErrno(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

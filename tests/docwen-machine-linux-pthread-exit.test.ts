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

const procBootstrapFault = vi.hoisted(() => ({
  consumeNextNumericStat: false,
  consumed: false,
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readFileSync: (target: Parameters<typeof actual.readFileSync>[0], ...args: unknown[]) => {
      if (
        procBootstrapFault.consumeNextNumericStat
        && typeof target === "string"
        && /^\/proc\/\d+\/stat$/u.test(target)
      ) {
        procBootstrapFault.consumeNextNumericStat = false;
        procBootstrapFault.consumed = true;
        throw Object.assign(new Error("synthetic initial root stat visibility race"), { code: "ENOENT" });
      }
      return (actual.readFileSync as (...values: unknown[]) => unknown)(target, ...args);
    },
  };
});

import { DocWenMachineClient } from "../src/docwen/machine-client";

const C_SOURCE = "#define _GNU_SOURCE\n#include <errno.h>\n#include <fcntl.h>\n#include <pthread.h>\n#include <signal.h>\n#include <stdatomic.h>\n#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <sys/syscall.h>\n#include <sys/types.h>\n#include <unistd.h>\n\nstatic atomic_int ready_count = 0;\nstatic volatile sig_atomic_t stop_requested = 0;\nstatic const char *signal_file = NULL;\n\nstatic const char *env_required(const char *name) {\n  const char *value = getenv(name);\n  if (value == NULL || *value == '\\0') _exit(90);\n  return value;\n}\n\nstatic void append_line(const char *path, const char *line) {\n  int fd = open(path, O_WRONLY | O_CREAT | O_APPEND, 0600);\n  if (fd < 0) return;\n  size_t length = strlen(line);\n  (void)write(fd, line, length);\n  (void)close(fd);\n}\n\nstatic void write_number(const char *path, long value) {\n  int fd = open(path, O_WRONLY | O_CREAT | O_TRUNC, 0600);\n  if (fd < 0) _exit(91);\n  char buffer[64];\n  int length = snprintf(buffer, sizeof(buffer), \"%ld\\n\", value);\n  if (length <= 0 || write(fd, buffer, (size_t)length) != length) _exit(92);\n  (void)close(fd);\n}\n\nstatic void on_term(int signo) {\n  (void)signo;\n  if (signal_file != NULL) {\n    int fd = open(signal_file, O_WRONLY | O_CREAT | O_APPEND, 0600);\n    if (fd >= 0) {\n      (void)write(fd, \"term\\n\", 5);\n      (void)close(fd);\n    }\n  }\n  _exit(0);\n}\n\nstatic long current_tid(void) {\n  return (long)syscall(SYS_gettid);\n}\n\nstatic void *heartbeat_main(void *unused) {\n  (void)unused;\n  write_number(env_required(\"DOCWEN_TEST_HEARTBEAT_TID_FILE\"), current_tid());\n  atomic_fetch_add(&ready_count, 1);\n  while (!stop_requested) {\n    append_line(env_required(\"DOCWEN_TEST_HEARTBEAT_FILE\"), \"h\\n\");\n    usleep(50000);\n  }\n  return NULL;\n}\n\nstatic int read_frame(char *body, size_t capacity, long *id, int *kind) {\n  char header[256];\n  if (fgets(header, sizeof(header), stdin) == NULL) return 0;\n  size_t length = 0;\n  if (sscanf(header, \"Content-Length: %zu\", &length) != 1) _exit(20);\n  if (length + 1 > capacity) _exit(21);\n  if (fgets(header, sizeof(header), stdin) == NULL) _exit(22);\n  if (strcmp(header, \"\\r\\n\") != 0 && strcmp(header, \"\\n\") != 0) _exit(23);\n  if (fread(body, 1, length, stdin) != length) _exit(24);\n  body[length] = '\\0';\n\n  char *id_field = strstr(body, \"\\\"id\\\":\");\n  if (id_field == NULL) _exit(25);\n  *id = strtol(id_field + 5, NULL, 10);\n  if (strstr(body, \"\\\"method\\\":\\\"initialize\\\"\") != NULL) {\n    *kind = 1;\n  } else if (strstr(body, \"\\\"method\\\":\\\"health/check\\\"\") != NULL) {\n    *kind = 2;\n  } else {\n    *kind = 3;\n  }\n  return 1;\n}\n\nstatic void send_json(long id, const char *result) {\n  char body[4096];\n  int body_length = snprintf(\n    body,\n    sizeof(body),\n    \"{\\\"jsonrpc\\\":\\\"2.0\\\",\\\"id\\\":%ld,\\\"result\\\":%s}\",\n    id,\n    result\n  );\n  if (body_length <= 0 || (size_t)body_length >= sizeof(body)) _exit(26);\n  dprintf(STDOUT_FILENO, \"Content-Length: %d\\r\\n\\r\\n\", body_length);\n  if (write(STDOUT_FILENO, body, (size_t)body_length) != body_length) _exit(27);\n}\n\nstatic void *protocol_main(void *unused) {\n  (void)unused;\n  write_number(env_required(\"DOCWEN_TEST_PROTOCOL_TID_FILE\"), current_tid());\n  atomic_fetch_add(&ready_count, 1);\n\n  char body[65536];\n  while (1) {\n    long id = 0;\n    int kind = 0;\n    int read_result = read_frame(body, sizeof(body), &id, &kind);\n    if (read_result == 0) {\n      stop_requested = 1;\n      return NULL;\n    }\n    if (kind == 1) {\n      send_json(\n        id,\n        \"{\\\"protocol\\\":{\\\"name\\\":\\\"docwen.machine\\\",\\\"major\\\":2,\\\"minor\\\":0},\"\n        \"\\\"artifact_bundle_schema\\\":\\\"docwen.artifact_bundle.v3\\\",\"\n        \"\\\"server\\\":{\\\"name\\\":\\\"DocWen\\\",\\\"version\\\":\\\"0.17.0\\\"},\"\n        \"\\\"methods\\\":[],\\\"features\\\":{\\\"progress\\\":true,\\\"cancellation\\\":true},\"\n        \"\\\"max_concurrent_tasks\\\":1}\"\n      );\n      continue;\n    }\n    if (kind == 2) {\n      append_line(env_required(\"DOCWEN_TEST_HEALTH_FILE\"), \"health\\n\");\n      const char *mode = env_required(\"DOCWEN_TEST_MODE\");\n      if (strcmp(mode, \"normal\") == 0) {\n        const char *release_file = env_required(\"DOCWEN_TEST_RELEASE_FILE\");\n        while (access(release_file, F_OK) != 0) usleep(10000);\n        send_json(id, \"{\\\"all_ok\\\":true,\\\"checks\\\":[]}\");\n      }\n      continue;\n    }\n  }\n}\n\nint main(void) {\n  signal_file = env_required(\"DOCWEN_TEST_SIGNAL_FILE\");\n  signal(SIGTERM, on_term);\n  signal(SIGINT, on_term);\n\n  pthread_t heartbeat;\n  pthread_t protocol;\n  if (pthread_create(&heartbeat, NULL, heartbeat_main, NULL) != 0) return 31;\n  if (pthread_create(&protocol, NULL, protocol_main, NULL) != 0) return 32;\n\n  while (atomic_load(&ready_count) < 2) usleep(1000);\n  write_number(env_required(\"DOCWEN_TEST_ROOT_PID_FILE\"), (long)getpid());\n  append_line(env_required(\"DOCWEN_TEST_MAIN_FILE\"), \"pthread_exit\\n\");\n\n  pthread_exit(NULL);\n}\n";
const nativePthreadAvailable = process.platform === "linux"
  && spawnSync("cc", ["--version"], { stdio: "ignore" }).status === 0
  && existsSync("/proc/self/stat");

const roots: string[] = [];
const controls: ChildProcess[] = [];

beforeEach(() => {
  procBootstrapFault.consumeNextNumericStat = false;
  procBootstrapFault.consumed = false;
});

afterEach(() => {
  procBootstrapFault.consumeNextNumericStat = false;
  procBootstrapFault.consumed = false;
  for (const child of controls.splice(0)) killDetached(child);
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe.skipIf(!nativePthreadAvailable)("Linux pthread-exit Machine ownership", () => {
  it("cleans live worker threads when the leader is a zombie on timeout", async () => {
    const fixture = createFixture("timeout");
    const sentinel = startSentinel();
    const client = new DocWenMachineClient(() => fixture.executable, () => "en_US");
    let ids: FixtureIds | null = null;

    try {
      const pending = client.query("health/check", {}, undefined, 800);
      ids = await waitForFixtureReady(fixture);
      await assertLeaderZombieWithLiveWorkers(ids);
      await assertHeartbeatAdvances(fixture.heartbeatFile);
      expectProcessLive(requiredPid(sentinel));

      await expect(pending).rejects.toMatchObject({ code: "cli_timeout" });

      expect(readText(fixture.signalFile)).toContain("term");
      await expectTrackedTasksNotLive(ids);
      await assertHeartbeatStopped(fixture.heartbeatFile);
      expectProcessLive(requiredPid(sentinel));
    } finally {
      client.dispose();
      if (ids) killPids([ids.rootPid, ids.protocolTid, ids.heartbeatTid]);
    }
  }, 12_000);

  it("recovers the direct root identity after the initial proc stat is temporarily unavailable", async () => {
    const fixture = createFixture("timeout");
    const sentinel = startSentinel();
    const client = new DocWenMachineClient(() => fixture.executable, () => "en_US");
    let ids: FixtureIds | null = null;

    try {
      procBootstrapFault.consumeNextNumericStat = true;
      const pending = client.query("health/check", {}, undefined, 800);
      expect(procBootstrapFault.consumed).toBe(true);

      ids = await waitForFixtureReady(fixture);
      await assertLeaderZombieWithLiveWorkers(ids);
      await assertHeartbeatAdvances(fixture.heartbeatFile);
      expectProcessLive(requiredPid(sentinel));

      await expect(pending).rejects.toMatchObject({ code: "cli_timeout" });

      expect(readText(fixture.signalFile)).toContain("term");
      await expectTrackedTasksNotLive(ids);
      await assertHeartbeatStopped(fixture.heartbeatFile);
      expectProcessLive(requiredPid(sentinel));
    } finally {
      client.dispose();
      if (ids) killPids([ids.rootPid, ids.protocolTid, ids.heartbeatTid]);
    }
  }, 12_000);

  it("cleans live worker threads when dispose races a zombie leader", async () => {
    const fixture = createFixture("timeout");
    const sentinel = startSentinel();
    const client = new DocWenMachineClient(() => fixture.executable, () => "en_US");
    let ids: FixtureIds | null = null;

    try {
      const pending = client.query("health/check", {}, undefined, 8_000);
      ids = await waitForFixtureReady(fixture);
      await assertLeaderZombieWithLiveWorkers(ids);
      await assertHeartbeatAdvances(fixture.heartbeatFile);
      expectProcessLive(requiredPid(sentinel));

      client.dispose();
      await expect(pending).rejects.toMatchObject({ code: "cli_cancelled" });

      expect(readText(fixture.signalFile)).toContain("term");
      await expectTrackedTasksNotLive(ids);
      await assertHeartbeatStopped(fixture.heartbeatFile);
      expectProcessLive(requiredPid(sentinel));
    } finally {
      client.dispose();
      if (ids) killPids([ids.rootPid, ids.protocolTid, ids.heartbeatTid]);
    }
  }, 12_000);

  it("lets a zombie leader converge after every worker task exits normally", async () => {
    const fixture = createFixture("normal");
    const sentinel = startSentinel();
    const client = new DocWenMachineClient(() => fixture.executable, () => "en_US");
    let ids: FixtureIds | null = null;

    try {
      const pending = client.query("health/check", {}, undefined, 5_000);
      ids = await waitForFixtureReady(fixture);
      await assertLeaderZombieWithLiveWorkers(ids);
      await assertHeartbeatAdvances(fixture.heartbeatFile);
      expectProcessLive(requiredPid(sentinel));

      writeFileSync(fixture.releaseFile, "release\n", "utf8");
      await expect(pending).resolves.toMatchObject({ all_ok: true });

      expect(readText(fixture.signalFile)).toBe("");
      await expectTrackedTasksNotLive(ids);
      await assertHeartbeatStopped(fixture.heartbeatFile);
      expectProcessLive(requiredPid(sentinel));
    } finally {
      client.dispose();
      if (ids) killPids([ids.rootPid, ids.protocolTid, ids.heartbeatTid]);
    }
  }, 12_000);
});

type Fixture = {
  executable: string;
  rootPidFile: string;
  protocolTidFile: string;
  heartbeatTidFile: string;
  heartbeatFile: string;
  healthFile: string;
  mainFile: string;
  releaseFile: string;
  signalFile: string;
};

type FixtureIds = {
  rootPid: number;
  protocolTid: number;
  heartbeatTid: number;
};

function createFixture(mode: "timeout" | "normal"): Fixture {
  const root = mkdtempSync(path.join(tmpdir(), "docwen-pthread-exit-"));
  roots.push(root);
  const source = path.join(root, "machine.c");
  const binary = path.join(root, "docwen-machine-pthread.bin");
  const executable = path.join(root, "docwen-machine-pthread");
  writeFileSync(source, C_SOURCE, "utf8");
  const compile = spawnSync("cc", ["-std=c11", "-O2", "-pthread", source, "-o", binary], {
    encoding: "utf8",
  });
  if (compile.status !== 0) {
    throw new Error("Unable to compile pthread Machine fixture: " + (compile.stderr || compile.stdout));
  }
  chmodSync(binary, 0o755);

  const fixture: Fixture = {
    executable,
    rootPidFile: path.join(root, "root.pid"),
    protocolTidFile: path.join(root, "protocol.tid"),
    heartbeatTidFile: path.join(root, "heartbeat.tid"),
    heartbeatFile: path.join(root, "heartbeat.log"),
    healthFile: path.join(root, "health.log"),
    mainFile: path.join(root, "main.log"),
    releaseFile: path.join(root, "release"),
    signalFile: path.join(root, "signal.log"),
  };
  const wrapper = [
    "#!/bin/sh",
    "export DOCWEN_TEST_MODE=" + shellQuote(mode),
    "export DOCWEN_TEST_ROOT_PID_FILE=" + shellQuote(fixture.rootPidFile),
    "export DOCWEN_TEST_PROTOCOL_TID_FILE=" + shellQuote(fixture.protocolTidFile),
    "export DOCWEN_TEST_HEARTBEAT_TID_FILE=" + shellQuote(fixture.heartbeatTidFile),
    "export DOCWEN_TEST_HEARTBEAT_FILE=" + shellQuote(fixture.heartbeatFile),
    "export DOCWEN_TEST_HEALTH_FILE=" + shellQuote(fixture.healthFile),
    "export DOCWEN_TEST_MAIN_FILE=" + shellQuote(fixture.mainFile),
    "export DOCWEN_TEST_RELEASE_FILE=" + shellQuote(fixture.releaseFile),
    "export DOCWEN_TEST_SIGNAL_FILE=" + shellQuote(fixture.signalFile),
    "exec " + shellQuote(binary) + " \"$@\"",
    "",
  ].join("\n");
  writeFileSync(executable, wrapper, "utf8");
  chmodSync(executable, 0o755);
  return fixture;
}

function shellQuote(value: string): string {
  return "'" + value.replace(/'/gu, "'\\''") + "'";
}

async function waitForFixtureReady(fixture: Fixture): Promise<FixtureIds> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    try {
      const ids = {
        rootPid: Number(readText(fixture.rootPidFile).trim()),
        protocolTid: Number(readText(fixture.protocolTidFile).trim()),
        heartbeatTid: Number(readText(fixture.heartbeatTidFile).trim()),
      };
      if (
        Number.isSafeInteger(ids.rootPid)
        && ids.rootPid > 0
        && Number.isSafeInteger(ids.protocolTid)
        && ids.protocolTid > 0
        && Number.isSafeInteger(ids.heartbeatTid)
        && ids.heartbeatTid > 0
        && readText(fixture.healthFile).includes("health")
        && readText(fixture.mainFile).includes("pthread_exit")
      ) {
        return ids;
      }
    } catch {
      // The native fixture is still starting.
    }
    await delay(10);
  }
  throw new Error("pthread Machine fixture did not become ready");
}

async function assertLeaderZombieWithLiveWorkers(ids: FixtureIds): Promise<void> {
  const deadline = Date.now() + 1_000;
  while (Date.now() < deadline) {
    const leader = readLinuxStat(ids.rootPid);
    const protocol = readLinuxStat(ids.protocolTid);
    const heartbeat = readLinuxStat(ids.heartbeatTid);
    if (
      leader?.state === "Z"
      && protocol !== null
      && heartbeat !== null
      && isLiveState(protocol.state)
      && isLiveState(heartbeat.state)
    ) {
      expect(protocol.processGroup).toBe(ids.rootPid);
      expect(protocol.session).toBe(ids.rootPid);
      expect(heartbeat.processGroup).toBe(ids.rootPid);
      expect(heartbeat.session).toBe(ids.rootPid);
      return;
    }
    await delay(10);
  }
  throw new Error("Expected zombie leader with live same-group worker threads");
}

async function assertHeartbeatAdvances(filename: string): Promise<void> {
  const before = fileSize(filename);
  await delay(160);
  const after = fileSize(filename);
  expect(after).toBeGreaterThan(before);
}

async function assertHeartbeatStopped(filename: string): Promise<void> {
  const before = fileSize(filename);
  await delay(160);
  expect(fileSize(filename)).toBe(before);
}

function fileSize(filename: string): number {
  try {
    return statSync(filename).size;
  } catch (error) {
    if (isErrno(error, "ENOENT")) return 0;
    throw error;
  }
}

async function expectTrackedTasksNotLive(ids: FixtureIds): Promise<void> {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    const protocol = readLinuxStat(ids.protocolTid);
    const heartbeat = readLinuxStat(ids.heartbeatTid);
    if (
      (protocol === null || !isLiveState(protocol.state))
      && (heartbeat === null || !isLiveState(heartbeat.state))
    ) {
      return;
    }
    await delay(20);
  }
  throw new Error("A pthread Machine worker remained live after the operation settled");
}

type LinuxStat = {
  state: string;
  processGroup: number;
  session: number;
};

function readLinuxStat(pid: number): LinuxStat | null {
  try {
    const raw = readFileSync("/proc/" + pid + "/stat", "utf8");
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

function expectProcessLive(pid: number): void {
  const state = readLinuxStat(pid);
  if (state === null || !isLiveState(state.state)) {
    throw new Error("Expected sentinel process to remain live");
  }
}

function killPids(pids: readonly number[]): void {
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Product cleanup may already have removed it.
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

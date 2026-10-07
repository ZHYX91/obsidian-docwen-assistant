import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { DocWenMachineClient } from "../src/docwen/machine-client";

const nativeThreadChildrenAvailable = process.platform === "linux"
  && spawnSync("python3", ["--version"], { stdio: "ignore" }).status === 0
  && existsSync(`/proc/self/task/${process.pid}/children`);

const roots: string[] = [];
const controls: ChildProcess[] = [];

afterEach(() => {
  for (const child of controls.splice(0)) killDetached(child);
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe.skipIf(!nativeThreadChildrenAvailable)(
  "Linux non-leader thread child ownership",
  () => {
    it("cleans a resistant helper created by a continuously live non-leader thread after a normal query", async () => {
      const fixture = createThreadedFixture("normal");
      const sentinel = startSentinel();
      const client = new DocWenMachineClient(() => fixture.executable, () => "en_US");
      let owned: ThreadedFixturePids | null = null;

      try {
        const pending = client.query("health/check", {}, undefined, 5_000);
        owned = await waitForFixturePids(fixture.pidFile);
        await assertCreatorThreadChildrenSource(owned);
        expectProcessLive(owned.rootPid);
        expectProcessLive(owned.helperPid);
        expectProcessLive(requiredPid(sentinel));

        writeFileSync(fixture.releaseFile, "release\n", "utf8");
        await expect(pending).resolves.toMatchObject({ all_ok: true });

        expect(readEvents(fixture.rootTrace)).toContain("root_normal_exit");
        expect(readEvents(fixture.helperTrace)).toContain("helper_term");
        await expectProcessNotLive(owned.rootPid);
        await expectProcessNotLive(owned.helperPid);
        expectProcessLive(requiredPid(sentinel));
      } finally {
        client.dispose();
        if (owned) killPids([owned.rootPid, owned.helperPid]);
      }
    }, 12_000);

    it("cleans a resistant helper created by a continuously live non-leader thread on timeout", async () => {
      const fixture = createThreadedFixture("timeout");
      const sentinel = startSentinel();
      const client = new DocWenMachineClient(() => fixture.executable, () => "en_US");
      let owned: ThreadedFixturePids | null = null;

      try {
        const pending = client.query("health/check", {}, undefined, 700);
        owned = await waitForFixturePids(fixture.pidFile);
        await assertCreatorThreadChildrenSource(owned);
        expectProcessLive(owned.rootPid);
        expectProcessLive(owned.helperPid);
        expectProcessLive(requiredPid(sentinel));

        await expect(pending).rejects.toMatchObject({ code: "cli_timeout" });

        expect(readEvents(fixture.rootTrace)).toContain("root_term");
        expect(readEvents(fixture.helperTrace)).toContain("helper_term");
        await expectProcessNotLive(owned.rootPid);
        await expectProcessNotLive(owned.helperPid);
        expectProcessLive(requiredPid(sentinel));
      } finally {
        client.dispose();
        if (owned) killPids([owned.rootPid, owned.helperPid]);
      }
    }, 12_000);
  },
);

type ThreadedFixturePids = {
  rootPid: number;
  helperPid: number;
  creatorTid: number;
};

function createThreadedFixture(mode: "normal" | "timeout"): {
  executable: string;
  pidFile: string;
  releaseFile: string;
  rootTrace: string;
  helperTrace: string;
} {
  const root = mkdtempSync(path.join(tmpdir(), "docwen-thread-children-"));
  roots.push(root);
  const executable = path.join(root, "docwen-machine-fixture.py");
  const pidFile = path.join(root, "pids.txt");
  const releaseFile = path.join(root, "release.txt");
  const rootTrace = path.join(root, "root.jsonl");
  const helperTrace = path.join(root, "helper.jsonl");
  writeFileSync(
    executable,
    pythonFixtureSource({ mode, pidFile, releaseFile, rootTrace, helperTrace }),
    "utf8",
  );
  chmodSync(executable, 0o755);
  return { executable, pidFile, releaseFile, rootTrace, helperTrace };
}

function pythonFixtureSource(options: {
  mode: "normal" | "timeout";
  pidFile: string;
  releaseFile: string;
  rootTrace: string;
  helperTrace: string;
}): string {
  return `#!/usr/bin/env python3
import json
import os
import signal
import subprocess
import sys
import threading
import time

MODE = ${JSON.stringify(options.mode)}
PID_FILE = ${JSON.stringify(options.pidFile)}
RELEASE_FILE = ${JSON.stringify(options.releaseFile)}
ROOT_TRACE = ${JSON.stringify(options.rootTrace)}
HELPER_TRACE = ${JSON.stringify(options.helperTrace)}

def record(filename, event):
    with open(filename, "a", encoding="utf-8") as stream:
        stream.write(json.dumps({"event": event, "pid": os.getpid()}) + "\\n")
        stream.flush()

helper_source = r"""
import json
import os
import signal
import sys
import time

trace = sys.argv[1]

def record(event):
    with open(trace, "a", encoding="utf-8") as stream:
        stream.write(json.dumps({"event": event, "pid": os.getpid()}) + "\\n")
        stream.flush()

def on_term(_signum, _frame):
    record("helper_term")

signal.signal(signal.SIGTERM, on_term)
record("helper_ready")
while True:
    time.sleep(0.1)
"""

creator_ready = threading.Event()

def creator():
    creator_tid = threading.get_native_id()
    helper = subprocess.Popen(
        [sys.executable, "-c", helper_source, HELPER_TRACE],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        close_fds=True,
    )
    deadline = time.monotonic() + 2.0
    while True:
        try:
            with open(HELPER_TRACE, "r", encoding="utf-8") as stream:
                if "helper_ready" in stream.read():
                    break
        except FileNotFoundError:
            pass
        if time.monotonic() >= deadline:
            os._exit(26)
        time.sleep(0.01)
    with open(PID_FILE, "w", encoding="utf-8") as stream:
        stream.write(f"{os.getpid()}\\n{helper.pid}\\n{creator_tid}\\n")
        stream.flush()
    record(ROOT_TRACE, "creator_ready")
    creator_ready.set()
    while True:
        time.sleep(0.1)

threading.Thread(target=creator, name="helper-creator", daemon=False).start()
if not creator_ready.wait(timeout=2.0):
    os._exit(24)

def on_term(_signum, _frame):
    record(ROOT_TRACE, "root_term")
    os._exit(0)

signal.signal(signal.SIGTERM, on_term)

def read_frame():
    header = sys.stdin.buffer.readline()
    if header == b"":
        return None
    if not header.startswith(b"Content-Length: "):
        os._exit(20)
    try:
        length = int(header[len(b"Content-Length: "):].strip())
    except ValueError:
        os._exit(20)
    blank = sys.stdin.buffer.readline()
    if blank not in (b"\\r\\n", b"\\n"):
        os._exit(20)
    body = sys.stdin.buffer.read(length)
    if len(body) != length:
        os._exit(20)
    return json.loads(body.decode("utf-8"))

def send(message):
    body = json.dumps(message, separators=(",", ":")).encode("utf-8")
    sys.stdout.buffer.write(b"Content-Length: " + str(len(body)).encode("ascii") + b"\\r\\n\\r\\n" + body)
    sys.stdout.buffer.flush()

while True:
    message = read_frame()
    if message is None:
        record(ROOT_TRACE, "root_normal_exit")
        os._exit(0)
    method = message.get("method")
    if method == "initialize":
        send({
            "jsonrpc": "2.0",
            "id": message.get("id"),
            "result": {
                "protocol": {"name": "docwen.machine", "major": 2, "minor": 0},
                "artifact_bundle_schema": "docwen.artifact_bundle.v3",
                "server": {"name": "DocWen", "version": "0.17.0"},
                "methods": [],
                "features": {"progress": True, "cancellation": True},
                "max_concurrent_tasks": 1,
            },
        })
    elif method == "health/check":
        record(ROOT_TRACE, "health_seen")
        if MODE == "timeout":
            continue
        deadline = time.monotonic() + 3.0
        while not os.path.exists(RELEASE_FILE):
            if time.monotonic() >= deadline:
                os._exit(25)
            time.sleep(0.01)
        send({
            "jsonrpc": "2.0",
            "id": message.get("id"),
            "result": {"all_ok": True, "checks": []},
        })
`;
}

async function assertCreatorThreadChildrenSource(pids: ThreadedFixturePids): Promise<void> {
  expect(pids.creatorTid).not.toBe(pids.rootPid);
  const taskDir = `/proc/${pids.rootPid}/task/${pids.creatorTid}`;
  expect(existsSync(taskDir)).toBe(true);

  const creatorChildren = parsePidList(
    readFileSync(`${taskDir}/children`, "utf8"),
  );
  expect(creatorChildren).toContain(pids.helperPid);

  const leaderChildren = parsePidList(
    readFileSync(`/proc/${pids.rootPid}/task/${pids.rootPid}/children`, "utf8"),
  );
  expect(leaderChildren).not.toContain(pids.helperPid);
}

async function waitForFixturePids(pidFile: string): Promise<ThreadedFixturePids> {
  const deadline = Date.now() + 2_500;
  while (Date.now() < deadline) {
    try {
      const values = parsePidList(readFileSync(pidFile, "utf8"));
      if (values.length === 3) {
        return {
          rootPid: values[0],
          helperPid: values[1],
          creatorTid: values[2],
        };
      }
    } catch {
      // The Python creator thread may still be starting.
    }
    await delay(20);
  }
  throw new Error("Threaded Machine fixture did not publish root/helper/creator ids");
}

function parsePidList(value: string): number[] {
  return value
    .trim()
    .split(/\s+/u)
    .map(Number)
    .filter((pid) => Number.isSafeInteger(pid) && pid > 0);
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
  if (typeof child.pid !== "number") throw new Error("Control process did not expose a pid");
  return child.pid;
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
      // Product cleanup or process exit may already have removed it.
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
      // Control process already exited.
    }
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isErrno(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

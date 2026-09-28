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

describe("DocWenMachineClient POSIX process ownership", () => {
  it.skipIf(process.platform === "win32")(
    "terminates the detached server process group and its descendant on timeout",
    async () => {
      const root = await mkdtemp(path.join(tmpdir(), "docwen-machine-tree-"));
      roots.push(root);
      const executable = path.join(root, "docwen-machine-fixture");
      const pidFile = path.join(root, "pids.txt");
      const closedFile = path.join(root, "stdin-closed.txt");
      await writeFile(executable, fixtureServer(pidFile, closedFile, "timeout"), "utf8");
      await chmod(executable, 0o755);
      const client = new DocWenMachineClient(() => executable, () => "en_US");
      let pids: number[] = [];

      try {
        await expect(client.query("health/check", {}, undefined, 500)).rejects.toMatchObject({
          code: "cli_timeout",
        });
        pids = await waitForPids(pidFile);
        expect(pids).toHaveLength(2);
        for (const pid of pids) await expectProcessGone(pid);
      } finally {
        client.dispose();
        killRemaining(pids);
      }
    },
    10_000,
  );

  it.skipIf(process.platform === "win32").each(["query", "task", "cancel"] as const)(
    "handles a real server closing stdin before a %s write without an unhandled error",
    async (phase) => {
      const root = await mkdtemp(path.join(tmpdir(), "docwen-machine-epipe-"));
      roots.push(root);
      const executable = path.join(root, "docwen-machine-fixture");
      const pidFile = path.join(root, "pids.txt");
      const closedFile = path.join(root, "stdin-closed.txt");
      const staging = path.join(root, "staging");
      const input = path.join(root, "input.md");
      await mkdir(staging);
      await writeFile(input, "# input\n", "utf8");
      await writeFile(executable, fixtureServer(pidFile, closedFile, phase), "utf8");
      await chmod(executable, 0o755);

      const uncaught: unknown[] = [];
      const monitor = (error: unknown): void => {
        uncaught.push(error);
      };
      process.on("uncaughtExceptionMonitor", monitor);
      const controller = new AbortController();
      const client = new DocWenMachineClient(() => executable, () => "en_US");
      let pids: number[] = [];

      try {
        const operation = phase === "query"
          ? client.query("health/check", {}, controller.signal, 8_000)
          : client.runTask(realTaskRequest(staging, input), controller.signal, 8_000);
        const failure = operation.then<unknown>(
          () => new Error("Machine operation unexpectedly resolved."),
          (error: unknown) => error,
        );

        pids = await waitForPids(pidFile);
        await waitForFile(closedFile);
        if (phase === "cancel") controller.abort();

        const error = await Promise.race([
          failure,
          delay(4_000).then(() => WAIT_EXPIRED),
        ]);
        if (error === WAIT_EXPIRED) throw new Error(`Machine ${phase} failure did not settle within the test bound.`);
        expect(error).toMatchObject({ code: phase === "cancel" ? "cli_cancelled" : "cli_protocol_error" });
        expect(uncaught).toEqual([]);
        expect(await readdir(staging)).toEqual([]);
        for (const pid of pids) await expectProcessGone(pid);
      } finally {
        process.removeListener("uncaughtExceptionMonitor", monitor);
        client.dispose();
        killRemaining(pids);
      }
    },
    12_000,
  );
});

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
  mode: "timeout" | "query" | "task" | "cancel",
): string {
  return `#!/usr/bin/env node
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const pidFile = ${JSON.stringify(pidFile)};
const closedFile = ${JSON.stringify(closedFile)};
const mode = ${JSON.stringify(mode)};
const descendant = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], {
  stdio: "ignore",
});
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
    const initialized = {
      protocol: { name: "docwen.machine", major: 2, minor: 0 },
      artifact_bundle_schema: "docwen.artifact_bundle.v3",
      server: { name: "DocWen", version: "0.13.0" },
      methods: [],
      features: { progress: true, cancellation: true },
      max_concurrent_tasks: 1,
    };
    if (mode === "query") {
      closeInput(() => reply(message.id, initialized));
    } else {
      reply(message.id, initialized);
    }
    return;
  }
  if (message.method === "health/check") return;
  if (message.method === "task/plan") {
    if (mode === "task") {
      closeInput(() => reply(message.id, { plan_id: "plan.1" }));
    } else {
      reply(message.id, { plan_id: "plan.1" });
    }
    return;
  }
  if (message.method === "task/execute") {
    reply(message.id, { task_id: "task.1", state: "accepted" });
    if (mode === "cancel") setTimeout(() => closeInput(() => undefined), 50);
  }
}

function closeInput(afterClose) {
  if (inputClosing) return;
  inputClosing = true;
  process.stdin.once("close", () => {
    writeFileSync(closedFile, "closed\\n", "utf8");
    afterClose();
  });
  process.stdin.destroy();
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
  throw new Error("POSIX Machine fixture did not record its process tree");
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
  throw new Error("POSIX Machine fixture did not close its stdin in time");
}

async function expectProcessGone(pid: number): Promise<void> {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (isErrno(error, "ESRCH")) return;
      throw error;
    }
    await delay(20);
  }
  throw new Error(`Process ${pid} survived Machine session termination`);
}

function killRemaining(pids: readonly number[]): void {
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // The expected path already terminated the complete process group.
    }
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isErrno(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

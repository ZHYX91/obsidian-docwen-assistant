import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DocWenMachineClient } from "../src/docwen/machine-client";

const roots: string[] = [];

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
      await writeFile(executable, fixtureServer(pidFile), "utf8");
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
        for (const pid of pids) {
          try {
            process.kill(pid, "SIGKILL");
          } catch {
            // The expected path already terminated the complete process group.
          }
        }
      }
    },
    10_000,
  );
});

function fixtureServer(pidFile: string): string {
  return `#!/usr/bin/env node
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const pidFile = ${JSON.stringify(pidFile)};
const descendant = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], {
  stdio: "ignore",
});
writeFileSync(pidFile, String(process.pid) + "\\n" + String(descendant.pid) + "\\n", "utf8");

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
        protocol: { name: "docwen.machine", major: 1, minor: 0 },
        artifact_bundle_schema: "docwen.artifact_bundle.v2",
        server: { name: "DocWen", version: "0.9.0" },
        methods: [],
        features: { progress: true, cancellation: true },
        max_concurrent_tasks: 1,
      });
    }
  }
});
process.stdin.resume();

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

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isErrno(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

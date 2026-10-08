import { spawn, type ChildProcess } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const observation = vi.hoisted(() => ({
  executable: "",
  rootPid: 0,
  delayingExit: false,
  injectedScan: false,
  exitDelivered: false,
}));

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    spawn: (...args: Parameters<typeof actual.spawn>) => {
      const child = actual.spawn(...args);
      if (args[0] === observation.executable) {
        children.push(child);
        observation.rootPid = child.pid ?? 0;
        const emit = child.emit.bind(child);
        child.emit = (event: string | symbol, ...values: unknown[]): boolean => {
          if (event === "exit") {
            observation.delayingExit = true;
            setTimeout(() => {
              observation.exitDelivered = true;
              observation.delayingExit = false;
              emit(event, ...values);
            }, 250);
            return true;
          }
          return emit(event, ...values);
        };
      }
      return child;
    },
  };
});

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  const readdir = actual.readdir as unknown as (
    target: unknown,
    ...args: unknown[]
  ) => Promise<unknown>;
  return {
    ...actual,
    readdir: async (target: unknown, ...args: unknown[]) => {
      const entries = await readdir(target, ...args);
      if (
        target === "/proc"
        && observation.delayingExit
        && !observation.injectedScan
        && Array.isArray(entries)
      ) {
        // A directory enumeration can include a PID whose stat disappears
        // before the following read. Delay only Node's observation of the real
        // exit so this valid procfs race occurs deterministically.
        observation.injectedScan = true;
        const root = String(observation.rootPid);
        return entries.includes(root) ? entries : [...entries, root];
      }
      return entries;
    },
  };
});

import { DocWenMachineClient } from "../src/docwen/machine-client";

const roots: string[] = [];
const children: ChildProcess[] = [];

beforeEach(() => {
  Object.assign(observation, {
    executable: "", rootPid: 0, delayingExit: false,
    injectedScan: false, exitDelivered: false,
  });
  vi.stubGlobal("window", { setTimeout, clearTimeout });
});

afterEach(async () => {
  for (const child of children.splice(0)) {
    if (child.exitCode === null) child.kill("SIGKILL");
  }
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

describe.skipIf(process.platform !== "linux")("Linux root exit observation", () => {
  it("rechecks a vanished root after its exit event arrives instead of reporting unconfirmed cleanup", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "docwen-exit-observation-"));
    roots.push(root);
    const executable = path.join(root, "docwen-machine-fixture");
    const healthSeen = path.join(root, "health-seen.txt");
    const terminated = path.join(root, "terminated.txt");
    await writeFile(executable, fixtureSource(healthSeen, terminated));
    await chmod(executable, 0o755);
    observation.executable = executable;

    const sentinel = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], {
      stdio: "ignore",
    });
    children.push(sentinel);
    const client = new DocWenMachineClient(() => executable, () => "en_US");
    const pending = client.query("health/check", {}, undefined, 5_000);
    const outcome = pending.then(() => null, (error: unknown) => error);
    try {
      await waitUntil(async () => (await readFile(healthSeen, "utf8")) === "seen\n");
      client.dispose();
      const error = await outcome;
      await waitUntil(async () => observation.exitDelivered);
      expect(observation.injectedScan).toBe(true);
      expect(await readFile(terminated, "utf8")).toBe("terminated\n");
      await expect(readFile(`/proc/${observation.rootPid}/stat`, "utf8"))
        .rejects.toMatchObject({ code: "ENOENT" });
      const sentinelPid = sentinel.pid;
      if (typeof sentinelPid !== "number") throw new Error("Sentinel PID was not captured.");
      expect(process.kill(sentinelPid, 0)).toBe(true);
      expect(error).toMatchObject({ code: "cli_cancelled" });
    } finally {
      client.dispose();
    }
  }, 8_000);
});

async function waitUntil(check: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch {
      // The controlled fixture may not have written its sentinel yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Controlled process observation did not settle within the test bound.");
}

function fixtureSource(healthSeen: string, terminated: string): string {
  return `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
let buffered = Buffer.alloc(0);
process.on("SIGTERM", () => {
  writeFileSync(${JSON.stringify(terminated)}, "terminated\\n");
  process.exit(0);
});
process.stdin.on("data", (chunk) => {
  buffered = Buffer.concat([buffered, chunk]);
  while (true) {
    const end = buffered.indexOf("\\r\\n\\r\\n");
    if (end < 0) return;
    const length = Number(/^Content-Length: ([1-9][0-9]*)/.exec(buffered.subarray(0, end).toString())[1]);
    if (buffered.length < end + 4 + length) return;
    const message = JSON.parse(buffered.subarray(end + 4, end + 4 + length).toString());
    buffered = buffered.subarray(end + 4 + length);
    if (message.method === "initialize") {
      const result = { protocol: { name: "docwen.machine", major: 2, minor: 0 },
        artifact_bundle_schema: "docwen.artifact_bundle.v3", server: { name: "DocWen", version: "0.17.0" },
        methods: [], features: { progress: true, cancellation: true }, max_concurrent_tasks: 1 };
      const body = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
      process.stdout.write("Content-Length: " + body.length + "\\r\\n\\r\\n");
      process.stdout.write(body);
    } else if (message.method === "health/check") {
      writeFileSync(${JSON.stringify(healthSeen)}, "seen\\n");
    }
  }
});
setInterval(() => undefined, 1000);
`;
}

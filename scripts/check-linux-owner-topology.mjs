import process from "node:process";
import { Buffer } from "node:buffer";
import console from "node:console";
import { setTimeout, clearTimeout } from "node:timers";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { spawnFixtureSentinel, trackFixtureChild, withFixtureCleanup } from "./native-fixture-lifecycle.mjs";
import {
  atomicPythonMetadata,
  diagnosticError,
  writeTopologyDiagnostic,
} from "./native-topology-fixture.mjs";

if (process.platform !== "linux" || !["x64", "arm64"].includes(process.arch)) throw new Error("Native Linux x64 or arm64 required.");
const binary = resolve(process.argv[2] ?? `native/linux-owner-${process.arch}`);
if (process.argv[3] && !isAbsolute(process.argv[3]))
  throw new Error("Diagnostics must use an absolute owned directory.");
const root = await mkdtemp(join(tmpdir(), "owner-topology-"));
const diagnostics = process.argv[3] ?? join(root, "diagnostics");
await mkdir(diagnostics, { recursive: true });
const results = [];
const python = "/usr/bin/python3";
const bounded = (promise, label, milliseconds = 6000) => {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Topology deadline exceeded: ${label} (${milliseconds}ms)`)),
        milliseconds,
      );
    }),
  ]).finally(() => clearTimeout(timer));
};
async function identity(pid) {
  try {
    const text = await readFile("/proc/" + pid + "/stat", "utf8");
    const fields = text
      .slice(text.lastIndexOf(")") + 2)
      .trim()
      .split(/\s+/u);
    return {
      pid,
      state: fields[0],
      parent: Number(fields[1]),
      group: Number(fields[2]),
      session: Number(fields[3]),
      startTime: fields[19],
    };
  } catch (error) {
    if (["ENOENT", "ESRCH"].includes(error.code)) return null;
    throw error;
  }
}
async function state(pid) {
  return (await identity(pid))?.state ?? "gone";
}
async function untilGone(pid) {
  for (let i = 0; i < 300; i++) {
    if ((await state(pid)) === "gone") return;
    await delay(10);
  }
  assert.equal(await state(pid), "gone", "Owned PID was not reaped");
}
async function fileSnapshot(filename) {
  try {
    const bytes = await readFile(filename);
    return {
      exists: true,
      bytes: bytes.length,
      text: bytes.subarray(0, 65536).toString("utf8"),
      truncated: bytes.length > 65536,
    };
  } catch (error) {
    return error.code === "ENOENT" ? { exists: false } : { error: diagnosticError(error) };
  }
}
// Compensation and injection open a pidfd before comparing the captured lifetime.
const signalLifetime = [
  "import os,signal,sys",
  "pid=int(sys.argv[1]);expected=sys.argv[2]",
  "try:fd=os.pidfd_open(pid)",
  "except ProcessLookupError:sys.exit(0)",
  "try:",
  " try:raw=open('/proc/'+str(pid)+'/stat').read()",
  " except FileNotFoundError:sys.exit(0)",
  " if raw[raw.rfind(')')+2:].split()[19]!=expected:raise RuntimeError('PID identity changed; refusing signal')",
  " try:signal.pidfd_send_signal(fd,signal.SIGKILL)",
  " except ProcessLookupError:pass",
  "finally:os.close(fd)",
].join("\n");
function killKnown(value) {
  const result = spawnSync(python, ["-c", signalLifetime, String(value.pid), value.startTime], {
    encoding: "utf8",
    timeout: 2000,
    shell: false,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, "Could not signal the exact fixture lifetime: " + result.stderr);
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}
const heartbeat = join(root, "heartbeat.py");
await writeFile(
  heartbeat,
  "import sys,time\nf=open(sys.argv[1],'a',buffering=1)\nwhile True:\n f.write('tick\\n');time.sleep(.01)\n",
);
const sentinel = spawnFixtureSentinel();
let failed = false;
await withFixtureCleanup(
  async () => {
    try {
      for (const mode of ["stop", "normal", "root-crash", "outer-crash", "guardian-crash", "double-fork"]) {
        const beat = join(root, mode + ".beat");
        const metadata = join(root, mode + ".json");
        const release = join(root, mode + ".release");
        const peer = join(root, mode + ".py");
        const source = [
          "#!/usr/bin/python3",
          "import json,os,signal,subprocess,time",
          "mode=" + JSON.stringify(mode),
          "if mode=='double-fork':",
          " p=os.fork()",
          " if p==0:",
          "  os.setsid();q=os.fork()",
          "  if q:os._exit(0)",
          ...atomicPythonMetadata(metadata, "{'child':os.getpid()}").map((line) => "  " + line),
          "  os.execl(" +
            JSON.stringify(python) +
            ",'python3'," +
            JSON.stringify(heartbeat) +
            "," +
            JSON.stringify(beat) +
            ")",
          " os.waitpid(p,0)",
          " while not os.path.exists(" + JSON.stringify(metadata) + "):time.sleep(.005)",
          " with open(" + JSON.stringify(metadata) + ") as f:descendant=json.load(f)['child']",
          "else:",
          " p=subprocess.Popen([" +
            JSON.stringify(python) +
            "," +
            JSON.stringify(heartbeat) +
            "," +
            JSON.stringify(beat) +
            "],start_new_session=True,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)",
          " descendant=p.pid",
          "while not os.path.exists(" + JSON.stringify(beat) + "):time.sleep(.005)",
          "print(json.dumps({'root':os.getpid(),'guard':os.getppid(),'child':descendant}),flush=True)",
          // Keep the baseline alive while the observer durably records it.
          "if mode in ('normal','root-crash'):",
          " while not os.path.exists(" + JSON.stringify(release) + "):time.sleep(.005)",
          "if mode=='normal':os._exit(0)",
          "if mode=='root-crash':os.kill(os.getpid(),signal.SIGKILL)",
          "while True:time.sleep(1)",
          "",
        ].join("\n");
        await writeFile(peer, source, { mode: 0o700 });
        await writeFile(join(diagnostics, mode + "-peer.py"), source);
        const owner = spawn(binary, [peer], { stdio: ["pipe", "pipe", "pipe", "pipe"] });
        const owned = trackFixtureChild(owner, { label: `Topology owner (${mode})`, timeoutMs: 6000 });
        const record = {
          schemaVersion: 1,
          mode,
          binary,
          fixtureRoot: root,
          deadlineMs: 6000,
          stage: "spawn",
          events: [],
          observations: [],
          streams: {},
          streamErrors: [],
          cleanupErrors: [],
        };
        const roles = { owner: owner.pid, sentinel: sentinel.child.pid };
        const known = new Map();
        const chunks = {};
        const append = (name, bytes) => {
          const previous = chunks[name] ?? Buffer.alloc(0);
          const count = (record.streams[name]?.bytes ?? 0) + bytes.length;
          chunks[name] = Buffer.concat([previous, bytes]).subarray(0, 65536);
          record.streams[name] = {
            text: chunks[name].toString("utf8"),
            bytes: count,
            truncated: count > 65536,
          };
        };
        owner.stdout.on("data", (bytes) => append("stdout", bytes));
        owner.stderr.on("data", (bytes) => append("stderr", bytes));
        for (const name of ["stdin", "stdout", "stderr"])
          owner[name].on("error", (error) => {
            record.streamErrors.push({ stream: name, error: diagnosticError(error) });
          });
        owner.on("error", (error) => {
          record.spawnError = diagnosticError(error);
        });
        owner.on("exit", (code, signal) => {
          record.exit = { code, signal };
        });
        owner.on("close", (code, signal) => {
          record.close = { code, signal };
        });
        const capture = async (observation) => {
          const pids = [];
          for (const [role, pid] of Object.entries(roles)) {
            if (!Number.isSafeInteger(pid) || pid <= 0) continue;
            try {
              const current = await identity(pid);
              if (!known.has(role) && current) known.set(role, current);
              pids.push({ role, pid, initial: known.get(role) ?? null, current });
            } catch (error) {
              pids.push({ role, pid, error: diagnosticError(error) });
            }
          }
          record.observation = observation;
          record.capturedAt = new Date().toISOString();
          record.pids = pids;
          record.metadata = await fileSnapshot(metadata);
          record.pendingMetadata = await fileSnapshot(metadata + ".pending");
          record.heartbeat = await fileSnapshot(beat);
          record.observations.push({
            stage: record.stage,
            observation,
            at: record.capturedAt,
            pids,
            metadata: record.metadata,
            pendingMetadata: record.pendingMetadata,
            heartbeat: record.heartbeat,
          });
          await writeTopologyDiagnostic(diagnostics, mode, record);
        };
        const stage = async (name) => {
          record.stage = name;
          record.events.push({ stage: name, at: new Date().toISOString() });
          console.log(JSON.stringify({ mode, stage: name }));
          await capture("stage-start");
        };
        await withFixtureCleanup(
          async () => {
            try {
              const control = owner.stdio[3];
              let statuses = "",
                started = false,
                receivedMetadata = false;
              let rejectMetadata;
              control.on("data", (bytes) => {
                append("control", bytes);
                statuses += bytes.toString();
                if (!started && statuses.includes("DWO1 READY 0\n")) {
                  started = true;
                  control.write("A");
                }
              });
              control.on("error", (error) => {
                record.streamErrors.push({ stream: "control", error: diagnosticError(error) });
                if (!receivedMetadata) rejectMetadata?.(error);
              });
              const metadataReady = new Promise((done, reject) => {
                rejectMetadata = reject;
                let text = "";
                owner.once("error", reject);
                owner.stdout.on("data", (bytes) => {
                  text += bytes.toString();
                  if (text.includes("\n") && !receivedMetadata) {
                    receivedMetadata = true;
                    try {
                      done(JSON.parse(text.split("\n")[0]));
                    } catch (error) {
                      reject(error);
                    }
                  }
                });
                owner.once("close", () => {
                  if (!receivedMetadata) reject(new Error(`Topology ${mode} owner closed before metadata`));
                });
              });
              void metadataReady.catch(() => undefined);
              await stage("metadata-wait");
              const meta = await bounded(metadataReady, `${mode}/metadata-wait`);
              for (const role of ["root", "guard", "child"]) {
                assert.ok(Number.isSafeInteger(meta[role]) && meta[role] > 0, "Invalid owned PID metadata");
                roles[role] = meta[role];
              }
              await stage("live-baseline");
              const before = await state(meta.child);
              assert.ok(
                !["gone", "Z", "X", "x"].includes(before),
                "Escaped child was not active before the deliberate exit",
              );
              assert.ok((await readFile(beat, "utf8")).includes("tick"), "Escaped child never ran");
              await stage("exit-injection");
              if (mode === "outer-crash") owner.kill("SIGKILL");
              else if (mode === "guardian-crash") {
                const guard = known.get("guard");
                assert.ok(
                  guard && guard.parent === owner.pid,
                  "Guardian lifetime was not observed under this owner",
                );
                record.guardianInjection = killKnown(guard);
              } else if (mode === "stop" || mode === "double-fork") control.end();
              else await writeFile(release, "release\n", { flag: "wx" });
              await stage("owner-close-wait");
              await bounded(owned.closed, `${mode}/owner-close-wait`);
              await stage("owned-reap");
              await untilGone(meta.child);
              await untilGone(meta.root);
              await stage("heartbeat-stop");
              const bytesAfter = (await readFile(beat)).length;
              await delay(30);
              assert.equal((await readFile(beat)).length, bytesAfter, "Heartbeat continued after cleanup");
              record.heartbeatStoppedAtBytes = bytesAfter;
              if (!["outer-crash", "guardian-crash"].includes(mode)) assert.match(statuses, /DWO1 DONE /u);
              if (mode === "guardian-crash") assert.match(statuses, /DWO1 UNCONFIRMED /u);
              sentinel.assertRunning();
              assert.ok(
                !["gone", "Z", "X"].includes(await state(sentinel.child.pid)),
                "Unrelated sentinel was killed",
              );
              results.push({
                mode,
                childStateBefore: before,
                childStateAfter: "gone",
                heartbeatStopped: true,
                sentinelSurvived: true,
                statuses: statuses.trim().split("\n"),
              });
              record.status = "passed";
            } catch (error) {
              record.status = "failed";
              record.primaryError = diagnosticError(error);
              throw error;
            }
          },
          async () => {
            const cleanupErrors = [];
            try {
              await capture("before-cleanup");
            } catch (error) {
              cleanupErrors.push(error);
            }
            try {
              await owned.stop();
            } catch (error) {
              cleanupErrors.push(error);
            }
            // A test failure stays failed even when this independent compensation succeeds.
            record.compensation = [];
            for (const role of ["root", "child", "guard"]) {
              const value = known.get(role);
              if (!value) continue;
              try {
                const current = await identity(value.pid);
                if (
                  current &&
                  current.startTime === value.startTime &&
                  !["Z", "X", "x"].includes(current.state)
                ) {
                  if (record.status === "passed") {
                    record.status = "failed";
                    cleanupErrors.push(
                      new Error(`Native cleanup left the observed ${role} alive; compensation is not a pass`),
                    );
                  }
                  record.compensation.push({ role, identity: value, result: killKnown(value) });
                }
              } catch (error) {
                cleanupErrors.push(error);
              }
            }
            record.cleanupErrors = cleanupErrors.map(diagnosticError);
          if (cleanupErrors.length) record.status = "failed";
            try {
              await capture("after-cleanup");
            } catch (error) {
              cleanupErrors.push(error);
            }
            if (cleanupErrors.length)
              throw new AggregateError(cleanupErrors, "Topology diagnostic/cleanup failed");
          },
        ).catch((error) => {
          console.error(`Topology case ${mode} failed; diagnostics: ${join(diagnostics, mode + ".json")}`);
          throw error;
        });
      }
      console.log(JSON.stringify({ binary, results }, null, 2));
    } catch (error) {
      failed = true;
      throw error;
    }
  },
  () =>
    withFixtureCleanup(
      () => sentinel.stop(),
      async () => {
        if (!failed || process.argv[3]) await rm(root, { recursive: true, force: true });
      },
    ),
);

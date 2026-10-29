import process from "node:process";
import console from "node:console";
import { setTimeout, clearTimeout } from "node:timers";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { spawnFixtureSentinel, trackFixtureChild, withFixtureCleanup } from "./native-fixture-lifecycle.mjs";

if (process.platform !== "linux" || !["x64", "arm64"].includes(process.arch)) throw new Error("Native Linux x64 or arm64 required.");
const binary = resolve(process.argv[2] ?? `native/linux-owner-${process.arch}`);
const root = await mkdtemp(join(tmpdir(), "owner-topology-"));
const results = [];
const python = "/usr/bin/python3";
const bounded = (promise, milliseconds = 6000) => {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Topology deadline exceeded")), milliseconds);
    }),
  ]).finally(() => clearTimeout(timer));
};
async function state(pid) {
  try {
    const text = await readFile("/proc/" + pid + "/stat", "utf8");
    return text.slice(text.lastIndexOf(")") + 2).split(" ")[0];
  } catch (error) {
    if (error.code === "ENOENT") return "gone";
    throw error;
  }
}
async function untilGone(pid) {
  for (let i = 0; i < 300; i++) {
    if ((await state(pid)) === "gone") return;
    await delay(10);
  }
  assert.equal(await state(pid), "gone", "Owned PID was not reaped");
}
const heartbeat = join(root, "heartbeat.py");
await writeFile(
  heartbeat,
  "import os,sys,time\nf=open(sys.argv[1],'a',buffering=1)\nend=time.monotonic()+5\nwhile time.monotonic()<end:\n f.write('tick\\n');time.sleep(.01)\n",
);
const sentinel = spawnFixtureSentinel();
await withFixtureCleanup(
  async () => {
    for (const mode of ["stop", "normal", "root-crash", "outer-crash", "guardian-crash", "double-fork"]) {
      const beat = join(root, mode + ".beat");
      const metadata = join(root, mode + ".json");
      const peer = join(root, mode + ".py");
      await writeFile(
        peer,
        [
          "#!/usr/bin/python3",
          "import json,os,signal,subprocess,time",
          "mode=" + JSON.stringify(mode),
          "if mode=='double-fork':",
          " p=os.fork()",
          " if p==0:",
          "  os.setsid();q=os.fork()",
          "  if q:os._exit(0)",
          "  open(" + JSON.stringify(metadata) + ",'w').write(json.dumps({'child':os.getpid()}))",
          "  os.execl(" +
            JSON.stringify(python) +
            ",'python3'," +
            JSON.stringify(heartbeat) +
            "," +
            JSON.stringify(beat) +
            ")",
          " os.waitpid(p,0)",
          " while not os.path.exists(" + JSON.stringify(metadata) + "):time.sleep(.005)",
          " descendant=json.load(open(" + JSON.stringify(metadata) + "))['child']",
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
          "if mode=='normal':os._exit(0)",
          "if mode=='root-crash':os.kill(os.getpid(),signal.SIGKILL)",
          "time.sleep(6)",
          "",
        ].join("\n"),
        { mode: 0o700 },
      );
      const owner = spawn(binary, [peer], { stdio: ["pipe", "pipe", "pipe", "pipe"] });
      const owned = trackFixtureChild(owner, { label: `Topology owner (${mode})`, timeoutMs: 6000 });
      await withFixtureCleanup(
        async () => {
          const control = owner.stdio[3];
          let statuses = "",
            started = false;
          control.on("data", (bytes) => {
            statuses += bytes.toString();
            if (!started && statuses.includes("DWO1 READY 0\n")) {
              started = true;
              control.write("A");
            }
          });
          const closed = owned.closed;
          const meta = await bounded(
            new Promise((done, reject) => {
              let text = "";
              owner.once("error", reject);
              owner.stdout.on("data", (bytes) => {
                text += bytes.toString();
                if (text.includes("\n")) {
                  try {
                    done(JSON.parse(text.split("\n")[0]));
                  } catch (error) {
                    reject(error);
                  }
                }
              });
            }),
          );
          const before = await state(meta.child);
          assert.ok((await readFile(beat, "utf8")).includes("tick"), "Escaped child never ran");
          if (mode === "outer-crash") owner.kill("SIGKILL");
          else if (mode === "guardian-crash") process.kill(meta.guard, "SIGKILL");
          else if (mode === "stop" || mode === "double-fork") control.end();
          await bounded(closed);
          await untilGone(meta.child);
          await untilGone(meta.root);
          const bytesAfter = (await readFile(beat)).length;
          await delay(30);
          assert.equal((await readFile(beat)).length, bytesAfter, "Heartbeat continued after cleanup");
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
        },
        () => owned.stop(),
      ).catch((error) => {
        console.error(`Topology case ${mode} failed; original error follows.`);
        throw error;
      });
    }
    console.log(JSON.stringify({ binary, results }, null, 2));
  },
  () =>
    withFixtureCleanup(
      () => sentinel.stop(),
      () => rm(root, { recursive: true, force: true }),
    ),
);

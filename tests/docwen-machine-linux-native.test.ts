import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { lstat, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { describe, expect, it } from "vitest";

import { DocWenMachineClient } from "../src/docwen/machine-client";

type Identity = {
  pid: number;
  parent: number;
  group: number;
  session: number;
  state: string;
  startTime: string;
};
type Mode = "normal" | "abort" | "dispose" | "epipe" | "owner-failure";
type Outcome = { value: unknown; error?: never } | { error: unknown; value?: never };

async function identity(pid: number): Promise<Identity | null> {
  try {
    const text = await readFile(`/proc/${pid}/stat`, "utf8");
    const fields = text.slice(text.lastIndexOf(")") + 2).trim().split(/\s+/u);
    return { pid, state: fields[0], parent: Number(fields[1]), group: Number(fields[2]),
      session: Number(fields[3]), startTime: fields[19] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT"
      || (error as NodeJS.ErrnoException).code === "ESRCH") return null;
    throw error;
  }
}

async function waitFor<T>(read: () => Promise<T | null | false>, label: string, timeoutMs = 3000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await read();
    if (value !== null && value !== false) return value;
    await delay(10);
  }
  throw new Error(`${label} did not settle within ${timeoutMs}ms`);
}

async function runningIdentity(pid: number): Promise<Identity> {
  return waitFor(async () => {
    const value = await identity(pid);
    // A live peer can briefly be in D while its heartbeat writes to the test
    // filesystem. Observe S/R readiness rather than racing one stat read.
    return value && ["S", "R"].includes(value.state) ? value : false;
  }, "Running controlled process");
}

async function bounded<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

function requiredPid(child: ChildProcess): number {
  if (!child.pid) throw new Error("Controlled process did not start");
  return child.pid;
}

// A pidfd is opened before the recorded starttime is checked. Compensation may
// therefore kill only this test's exact lifetime, never a recycled numeric PID.
const compensationSource = [
  "import errno,os,signal,sys",
  "pid=int(sys.argv[1]);expected=sys.argv[2]",
  "try:fd=os.pidfd_open(pid)",
  "except ProcessLookupError:sys.exit(0)",
  "try:",
  " try:raw=open('/proc/'+str(pid)+'/stat').read()",
  " except FileNotFoundError:sys.exit(0)",
  " if raw[raw.rfind(')')+2:].split()[19]!=expected:sys.exit(0)",
  " try:signal.pidfd_send_signal(fd,signal.SIGKILL)",
  " except ProcessLookupError:pass",
  "finally:os.close(fd)",
].join("\n");

async function runNativeCase(mode: Mode): Promise<void> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "docwen-linux-native-")));
  const peer = join(root, "peer.py");
  const heartbeat = join(root, "heartbeat.py");
  const beat = join(root, "escaped.beat");
  const metadata = join(root, "pids.json");
  const peerStarts = join(root, "peer-starts");
  const release = join(root, "release");
  const inputClosed = join(root, "input-closed");
  const known = new Map<number, Identity>();
  let client: DocWenMachineClient | undefined;
  let operation: Promise<Outcome> | undefined;
  let sentinel: ChildProcess | undefined;
  let sentinelClosed: Promise<unknown> | undefined;
  let primary: unknown;
  let failed = false;
  let cleanupErrors: unknown[] = [];
  try {
    await writeFile(heartbeat, [
      "import os,signal,sys,time",
      "signal.signal(signal.SIGTERM,signal.SIG_IGN)",
      "fd=os.open(sys.argv[1],os.O_WRONLY|os.O_CREAT|os.O_APPEND,0o600)",
      "deadline=time.monotonic()+15",
      "while time.monotonic()<deadline:",
      " os.write(fd,b'tick\\n');time.sleep(.01)",
      "os.close(fd)", "",
    ].join("\n"), { flag: "wx", mode: 0o600 });
    await writeFile(peer, [
      "#!/usr/bin/python3",
      "import json,os,signal,subprocess,sys,time",
      "signal.alarm(15)",
      "with open(" + JSON.stringify(peerStarts) + ",'a') as f:f.write(str(os.getpid())+'\\n')",
      "mode=" + JSON.stringify(mode),
      "release=" + JSON.stringify(release),
      "def read_message():",
      " headers={}",
      " while True:",
      "  line=sys.stdin.buffer.readline()",
      "  if not line:sys.exit(0)",
      "  if line==b'\\r\\n':break",
      "  key,value=line.decode('ascii').split(':',1);headers[key.lower()]=value.strip()",
      " return json.loads(sys.stdin.buffer.read(int(headers['content-length'])))",
      "def send(request,result):",
      " body=json.dumps({'jsonrpc':'2.0','id':request['id'],'result':result},separators=(',',':')).encode()",
      " sys.stdout.buffer.write(('Content-Length: '+str(len(body))+'\\r\\n\\r\\n').encode()+body);sys.stdout.buffer.flush()",
      "initialize=read_message()",
      "assert initialize['method']=='initialize'",
      "initialized={'protocol':{'name':'docwen.machine','major':2,'minor':0},'server':{'name':'DocWen','version':'0.17.0'},'artifact_bundle_schema':'docwen.artifact_bundle.v3','methods':[],'features':{'progress':True,'cancellation':True},'max_concurrent_tasks':1}",
      "if mode!='epipe':",
      " send(initialize,initialized)",
      " request=read_message();assert request['method']=='health/check'",
      "descendant=subprocess.Popen(['/usr/bin/python3'," + JSON.stringify(heartbeat) + "," + JSON.stringify(beat) + "],start_new_session=True,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)",
      "while not os.path.exists(" + JSON.stringify(beat) + "):time.sleep(.005)",
      "with open(" + JSON.stringify(metadata + ".pending") + ",'w') as f:json.dump({'root':os.getpid(),'guardian':os.getppid(),'child':descendant.pid},f)",
      "os.replace(" + JSON.stringify(metadata + ".pending") + "," + JSON.stringify(metadata) + ")",
      "while not os.path.exists(release):time.sleep(.005)",
      "if mode=='normal':",
      " send(request,{'all_ok':True,'checks':[]});os._exit(0)",
      "if mode=='epipe':",
      " os.close(0)",
      " with open(" + JSON.stringify(inputClosed) + ",'w') as f:f.write('closed\\n')",
      " send(initialize,initialized)",
      "time.sleep(12)", "",
    ].join("\n"), { flag: "wx", mode: 0o700 });

    sentinel = spawn(process.execPath, ["-e",
      "setInterval(()=>{},100);setTimeout(()=>process.exit(0),20000)"],
    { detached: true, stdio: "ignore" });
    sentinelClosed = new Promise((done) => sentinel!.once("close", done));
    sentinel.on("error", () => undefined);
    const sentinelBefore = await runningIdentity(requiredPid(sentinel));
    expect(["S", "R"]).toContain(sentinelBefore.state);

    let binaryResolutions = 0;
    client = new DocWenMachineClient(() => { binaryResolutions += 1; return peer; }, () => "en_US");
    const controller = new AbortController();
    operation = client.query("health/check", {}, controller.signal, 8000).then(
      (value) => ({ value }), (error: unknown) => ({ error }),
    );
    const ids = await waitFor(async () => {
      try { return JSON.parse(await readFile(metadata, "utf8")) as { root: number; guardian: number; child: number }; }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
    }, "Framed peer startup");
    const rootBefore = await runningIdentity(ids.root);
    const childBefore = await runningIdentity(ids.child);
    assert.ok(rootBefore && childBefore, "Controlled peer or escaped child disappeared before release");
    assert.equal(childBefore.parent, ids.root);
    known.set(ids.root, rootBefore);
    known.set(ids.child, childBefore);
    expect(["S", "R"]).toContain(rootBefore.state);
    expect(["S", "R"]).toContain(childBefore.state);
    expect(childBefore.group).toBe(ids.child);
    expect(childBefore.session).toBe(ids.child);
    expect(rootBefore.parent).toBe(ids.guardian);
    expect(ids.guardian).not.toBe(process.pid);
    const guardian = await identity(ids.guardian);
    assert.ok(guardian && guardian.parent !== process.pid, "Actual native double supervisor was bypassed");
    const owner = await identity(guardian.parent);
    assert.ok(owner && owner.parent === process.pid, "Native owner is not this test's direct child");
    known.set(guardian.pid, guardian);
    known.set(owner.pid, owner);
    expect(await readFile(beat, "utf8")).toContain("tick\n");

    if (mode === "abort") controller.abort();
    else if (mode === "dispose") client.dispose();
    else if (mode === "owner-failure") {
      const killed = spawnSync("/usr/bin/python3", ["-c", compensationSource,
        String(guardian.pid), guardian.startTime],
      { timeout: 2000, maxBuffer: 4096, stdio: "pipe", shell: false });
      if (killed.error) throw killed.error;
      assert.equal(killed.status, 0, "Could not terminate the recorded guardian identity");
    } else await writeFile(release, "release\n", { flag: "wx" });
    const outcome = await bounded(operation, 4000, "Native Machine operation");
    if (mode === "normal") expect(outcome).toMatchObject({ value: { all_ok: true } });
    else if (mode === "epipe") {
      expect(await readFile(inputClosed, "utf8")).toBe("closed\n");
      expect(outcome.error).toMatchObject({ code: "cli_protocol_error", details: { systemCode: "EPIPE" } });
    } else if (mode === "owner-failure") {
      expect(outcome.error).toMatchObject({ code: "cli_cleanup_failed", details: { cleanupState: "unconfirmed" } });
      expect(binaryResolutions).toBe(1);
      const resolutionsBeforeRetry = binaryResolutions;
      const startsBeforeRetry = await readFile(peerStarts, "utf8");
      const retry = await bounded(client.query("health/check", {}, undefined, 1000).then<Outcome, Outcome>(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      ), 1000, "Blocked client retry");
      expect(retry.error).toMatchObject({ code: "cli_cleanup_failed", details: { cleanupState: "unconfirmed" } });
      expect(binaryResolutions).toBe(resolutionsBeforeRetry);
      expect(await readFile(peerStarts, "utf8")).toBe(startsBeforeRetry);
    } else expect(outcome.error).toMatchObject({ code: "cli_cancelled" });
    for (const pid of [ids.root, ids.child]) {
      await waitFor(async () => (await identity(pid)) === null, "Reaped native-owned PID");
      expect(await identity(pid)).toBeNull();
    }
    const stoppedBytes = (await readFile(beat)).length;
    await delay(40);
    expect((await readFile(beat)).length).toBe(stoppedBytes);
    const sentinelAfter = await identity(requiredPid(sentinel));
    expect(sentinelAfter?.startTime).toBe(sentinelBefore.startTime);
    expect(["S", "R"]).toContain(sentinelAfter?.state);
  } catch (error) {
    primary = error;
    failed = true;
  } finally {
    client?.dispose();
    const errors: unknown[] = [];
    for (const value of known.values()) {
      const result = spawnSync("/usr/bin/python3", ["-c", compensationSource, String(value.pid), value.startTime],
        { timeout: 2000, maxBuffer: 4096, stdio: "pipe", shell: false });
      if (result.error || result.status !== 0) errors.push(result.error ?? new Error("Owned process compensation failed"));
    }
    if (operation) {
      try { await bounded(operation, 3000, "Compensated Machine operation"); } catch (error) { errors.push(error); }
    }
    if (sentinel && sentinel.exitCode === null && sentinel.signalCode === null) sentinel.kill("SIGKILL");
    if (sentinelClosed) {
      try { await bounded(sentinelClosed, 3000, "Sentinel closure"); } catch (error) { errors.push(error); }
    }
    for (const value of known.values()) {
      try {
        await waitFor(async () => {
          const current = await identity(value.pid);
          return !current || current.startTime !== value.startTime || ["Z", "X"].includes(current.state);
        }, "Owned process compensation", 1000);
      } catch (error) { errors.push(error); }
    }
    if (errors.length === 0) {
      try {
        const current = await lstat(root);
        assert.ok(current.isDirectory() && !current.isSymbolicLink());
        assert.equal(await realpath(root), root);
        await rm(root, { recursive: true, force: false });
      } catch (error) { errors.push(error); }
    }
    cleanupErrors = errors;
  }
  if (cleanupErrors.length) throw new AggregateError(failed ? [primary, ...cleanupErrors] : cleanupErrors,
    "Native lifecycle fixture retained at " + root);
  if (failed) throw primary;
}

describe.skipIf(process.platform !== "linux" || process.arch !== "x64")("real Linux native Machine ownership", () => {
  it.each(["normal", "abort", "dispose", "epipe", "owner-failure"] as const)(
    "reaps a pre-existing setsid heartbeat and preserves a sentinel during %s",
    runNativeCase,
    15000,
  );
});

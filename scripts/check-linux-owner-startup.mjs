import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

if (process.platform !== "linux" || process.arch !== "x64") throw new Error("Linux x64 required.");
if (process.argv[2] && !isAbsolute(process.argv[2])) throw new Error("Owner path must be absolute.");
if (!process.env.TMPDIR || !isAbsolute(process.env.TMPDIR)) {
  throw new Error("TMPDIR must name an existing owned run directory.");
}
const binary = process.argv[2] ?? resolve("native/linux-owner-x64");
const temporaryParent = await realpath(process.env.TMPDIR);
const root = await mkdtemp(join(temporaryParent, "owner-startup-"));
const compensationSource = join(root, "compensate.c");
const compensator = join(root, "compensate");
const tracerSource = join(root, "trace-startup.py");
const known = new Map();
const cleanupErrors = [];
const traceEvidence = { control: "", stdout: "", stderr: "" };
let tracer, sentinel, tracerClosed, sentinelClosed, failure;
const report = { binary, mechanism: "ptrace-fork-stop", passed: false };

async function bounded(promise, milliseconds, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label + " timed out")), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

async function identity(pid) {
  try {
    const text = await readFile("/proc/" + pid + "/stat", "utf8");
    const fields = text.slice(text.lastIndexOf(")") + 2).trim().split(/\s+/u);
    return { pid, state: fields[0], parent: Number(fields[1]), group: Number(fields[2]),
      session: Number(fields[3]), startTime: fields[19] };
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ESRCH") return null;
    throw error;
  }
}

async function waitFor(check, milliseconds, label) {
  const deadline = Date.now() + milliseconds;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await delay(10);
  }
  throw new Error(label + " timed out");
}

function observeClose(child) {
  const closed = new Promise((done) => child.once("close", done));
  child.on("error", (error) => { child.startupError = error; });
  return closed;
}

async function rememberTree(pid, depth = 0) {
  if (depth > 3) return;
  const parent = await identity(pid);
  const previous = known.get(pid);
  if (!parent || !previous || previous.startTime !== parent.startTime) return;
  let children;
  try {
    children = await readFile("/proc/" + pid + "/task/" + pid + "/children", "utf8");
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ESRCH") return;
    throw error;
  }
  for (const value of children.trim().split(/\s+/u)) {
    if (!/^\d+$/u.test(value)) continue;
    const child = await identity(Number(value));
    const currentParent = await identity(pid);
    if (child?.parent === pid && currentParent?.startTime === parent.startTime) {
      known.set(child.pid, child);
      await rememberTree(child.pid, depth + 1);
    }
  }
}

function signalIdentity(value, signal = "KILL") {
  const result = spawnSync(compensator, [String(value.pid), value.startTime, signal], {
    timeout: 2000, maxBuffer: 4096, stdio: "pipe", shell: false,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, "Could not signal recorded test identity " + value.pid);
}

// This test-only helper pins a process with pidfd before checking its recorded
// starttime. It cannot signal a different lifetime that reused the same number.
const nativeSource = String.raw`
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/syscall.h>
#include <sys/types.h>
#include <unistd.h>
int main(int argc, char **argv) {
    if (argc != 3 && argc != 4) return 64;
    int sig = SIGKILL;
    if (argc == 4) {
        if (strcmp(argv[3], "CONT") == 0) sig = SIGCONT;
        else if (strcmp(argv[3], "KILL") != 0) return 64;
    }
    char *end = NULL;
    long number = strtol(argv[1], &end, 10);
    if (!end || *end || number <= 0 || number > 2147483647L) return 64;
    int descriptor = (int)syscall(SYS_pidfd_open, (pid_t)number, 0);
    if (descriptor < 0) return errno == ESRCH ? 0 : 65;
    char filename[80], text[4096];
    snprintf(filename, sizeof(filename), "/proc/%ld/stat", number);
    int fd = open(filename, O_RDONLY | O_CLOEXEC);
    if (fd < 0) { close(descriptor); return errno == ENOENT ? 0 : 65; }
    ssize_t count;
    do { count = read(fd, text, sizeof(text) - 1); } while (count < 0 && errno == EINTR);
    close(fd);
    if (count <= 0) { close(descriptor); return 65; }
    text[count] = 0;
    char *tail = strrchr(text, ')'), *save = NULL, *field = NULL;
    if (tail) {
        field = strtok_r(tail + 1, " \t\r\n", &save);
        for (int i = 0; field && i < 19; i++) field = strtok_r(NULL, " \t\r\n", &save);
    }
    if (!field) { close(descriptor); return 66; }
    if (strcmp(field, argv[2]) != 0) { close(descriptor); return 0; }
    int sent = (int)syscall(SYS_pidfd_send_signal, descriptor, sig, NULL, 0);
    int error = errno;
    close(descriptor);
    return sent == 0 || error == ESRCH ? 0 : 67;
}
`;

// TRACEFORK stops R before its child branch or exec can run. Every tracee is
// detached into a real SIGSTOP before the success metadata is emitted. Thus
// tracer EXITKILL cannot make the later parent-death cleanup assertion pass.
const pythonSource = String.raw`
import ctypes,errno,json,os,signal,sys,time
binary=os.path.realpath(sys.argv[1])
if int(open('/proc/self/stat').read().split()[0])!=os.getpid():
 raise RuntimeError('PID/proc namespace mismatch; startup ownership unverified')
libc=ctypes.CDLL(None,use_errno=True)
libc.ptrace.restype=ctypes.c_long
libc.ptrace.argtypes=[ctypes.c_uint,ctypes.c_int,ctypes.c_void_p,ctypes.c_void_p]
TRACEME,CONT,DETACH,SETOPTIONS,GETEVENTMSG=0,7,17,0x4200,0x4201
OPTIONS=0x2|0x100000
WALL=0x40000000
def ptrace(request,pid,address=0,data=0):
 value=libc.ptrace(request,pid,ctypes.c_void_p(address),ctypes.c_void_p(data))
 if value==-1:
  code=ctypes.get_errno();raise OSError(code,os.strerror(code))
 return value
def info(pid):
 with open('/proc/'+str(pid)+'/stat') as f:raw=f.read()
 fields=raw[raw.rfind(')')+2:].split()
 return {'pid':pid,'state':fields[0],'parent':int(fields[1]),'startTime':fields[19]}
def tracer_pid(pid):
 with open('/proc/'+str(pid)+'/status') as f:
  for line in f:
   if line.startswith('TracerPid:'):return int(line.split()[1])
 raise RuntimeError('Missing TracerPid')
def wait_state(pid,state):
 deadline=time.monotonic()+1
 while time.monotonic()<deadline:
  value=info(pid)
  if value['state']==state:return value
  time.sleep(.005)
 raise RuntimeError('Tracee did not enter '+state)
def safe_kill(value):
 try:fd=os.pidfd_open(value['pid'])
 except ProcessLookupError:return
 try:
  try:current=info(value['pid'])
  except FileNotFoundError:return
  if current['startTime']!=value['startTime']:return
  try:signal.pidfd_send_signal(fd,signal.SIGKILL)
  except ProcessLookupError:pass
 finally:os.close(fd)
def emit(value):print(json.dumps(value),flush=True)
def timeout(signum,frame):raise TimeoutError('ptrace setup or W exit exceeded its bound')
owned={}
try:
 signal.signal(signal.SIGALRM,timeout)
 signal.alarm(12)
 outer=os.fork()
 if outer==0:
  try:
   for fd in (0,1,2,3):os.set_inheritable(fd,True)
   ptrace(TRACEME,0)
   os.kill(os.getpid(),signal.SIGSTOP)
   os.execv(binary,[binary,'/bin/true'])
  except BaseException as error:
   os.write(2,('ptrace owner child: '+str(error)+'\n').encode())
   os._exit(124)
 owned[outer]=info(outer)
 emit({'event':'owned','identity':owned[outer]})
 os.close(3)
 os.close(0)
 pid,status=os.waitpid(outer,WALL)
 if not os.WIFSTOPPED(status):raise RuntimeError('PTRACE_TRACEME unavailable or owner exited')
 ptrace(SETOPTIONS,outer,0,OPTIONS)
 ptrace(CONT,outer)
 roles={outer:'outer'}
 stopped={}
 guardian=None
 root=None
 root_stopped=False
 while not root_stopped:
  pid,status=os.waitpid(-1,WALL)
  if not os.WIFSTOPPED(status):raise RuntimeError('Tracee exited before fork-stop setup')
  stopped[pid]=status
  event=status>>16
  if event==1:
   child=ctypes.c_ulong()
   ptrace(GETEVENTMSG,pid,0,ctypes.addressof(child))
   number=child.value
   owned[number]=info(number)
   emit({'event':'owned','identity':owned[number]})
   if roles.get(pid)=='outer' and guardian is None:
    guardian=number;roles[number]='guardian'
    if number in stopped:
     ptrace(CONT,number);stopped.pop(number,None)
    ptrace(CONT,pid);stopped.pop(pid,None)
   elif roles.get(pid)=='guardian' and root is None:
    root=number;roles[number]='root'
    root_stopped=number in stopped
   else:raise RuntimeError('Unexpected fork topology')
  elif roles.get(pid)=='root':
   if os.WSTOPSIG(status)!=signal.SIGSTOP:raise RuntimeError('R missed its initial fork stop')
   root_stopped=True
  elif roles.get(pid) in ('outer','guardian'):
   delivered=os.WSTOPSIG(status)
   ptrace(CONT,pid,0,0 if delivered in (signal.SIGTRAP,signal.SIGSTOP) else delivered)
   stopped.pop(pid,None)
  # Unknown children stay stopped until their parent's fork event names them.
 if root is None or guardian is None:raise RuntimeError('Missing native W/G/R topology')
 if os.WSTOPSIG(stopped[root])!=signal.SIGSTOP:raise RuntimeError('R did not stop at fork')
 os.kill(outer,signal.SIGSTOP)
 while True:
  pid,status=os.waitpid(outer,WALL)
  if not os.WIFSTOPPED(status):raise RuntimeError('W exited before detach')
  delivered=os.WSTOPSIG(status)
  if delivered==signal.SIGSTOP:break
  ptrace(CONT,outer,0,0 if delivered==signal.SIGTRAP else delivered)
 for pid in (root,guardian,outer):
  # A real queued stop also covers ptrace event-stops, where merely injecting
  # a signal is not an adequate guarantee of the subsequent group stop.
  os.kill(pid,signal.SIGSTOP)
  ptrace(DETACH,pid,0,signal.SIGSTOP)
  owned[pid]=wait_state(pid,'T')
  if tracer_pid(pid)!=0:raise RuntimeError('Tracee remained attached')
 image=os.stat('/proc/'+str(root)+'/exe')
 target=os.stat(binary)
 if (image.st_dev,image.st_ino)!=(target.st_dev,target.st_ino):
  raise RuntimeError('R already executed a different image')
 emit({'event':'fork-stopped','outer':owned[outer],'guardian':owned[guardian],
       'root':owned[root],'detached':True,'rootExecutableMatchesOwner':True})
 waited,status=os.waitpid(outer,0)
 if waited!=outer or not os.WIFSIGNALED(status) or os.WTERMSIG(status)!=signal.SIGKILL:
  raise RuntimeError('W was not terminated by the requested SIGKILL')
 signal.alarm(0)
 emit({'event':'outer-exit','signal':signal.SIGKILL})
except BaseException as error:
 signal.alarm(0)
 emit({'event':'error','error':'ptrace startup unverified: '+str(error)})
 for value in reversed(list(owned.values())):
  try:safe_kill(value)
  except BaseException:pass
 deadline=time.monotonic()+1
 while time.monotonic()<deadline:
  try:
   pid,status=os.waitpid(-1,os.WNOHANG|WALL)
   if pid==0:time.sleep(.005)
  except ChildProcessError:break
 sys.exit(1)
`;

try {
  assert.equal(Number((await readFile("/proc/self/stat", "utf8")).split(" ")[0]), process.pid,
    "PID/proc namespace mismatch; ownership unverified");
  report.binarySha256 = createHash("sha256").update(await readFile(binary)).digest("hex");
  const binaryIdentity = await stat(binary);
  assert.ok(binaryIdentity.isFile());
  await writeFile(compensationSource, nativeSource, { flag: "wx", mode: 0o600 });
  await writeFile(tracerSource, pythonSource, { flag: "wx", mode: 0o600 });
  const built = spawnSync(process.env.CC || "cc", ["-std=c11", "-O2", "-Wall", "-Wextra", "-Werror",
    compensationSource, "-o", compensator],
  { encoding: "utf8", timeout: 15000, maxBuffer: 128 * 1024, shell: false });
  if (built.error) throw built.error;
  assert.equal(built.status, 0, "Compensator compilation failed: " + built.stderr);
  sentinel = spawn(process.execPath, ["-e", "setInterval(()=>{},100);setTimeout(()=>process.exit(0),20000)"],
    { detached: true, stdio: "ignore" });
  sentinelClosed = observeClose(sentinel);
  const sentinelBefore = await waitFor(() => identity(sentinel.pid), 1000, "Sentinel startup");
  assert.ok(!["Z", "X"].includes(sentinelBefore.state));

  const environment = { ...process.env };
  delete environment.LD_PRELOAD;
  tracer = spawn("/usr/bin/python3", [tracerSource, binary], {
    stdio: ["pipe", "pipe", "pipe", "pipe"], env: environment,
  });
  tracerClosed = observeClose(tracer);
  const control = tracer.stdio[3];
  let statuses = "", started = false, stdout = "", traceFailure, metadata, outerExited = false;
  control.on("error", () => undefined);
  control.on("data", (bytes) => {
    statuses += bytes.toString("ascii");
    traceEvidence.control = statuses.slice(-16384);
    if (!started && statuses.includes("DWO1 READY 0\n")) { started = true; control.write("A"); }
  });
  tracer.stdout.on("data", (bytes) => {
    stdout += bytes.toString("utf8");
    traceEvidence.stdout = (traceEvidence.stdout + bytes.toString("utf8")).slice(-32768);
    while (stdout.includes("\n")) {
      const end = stdout.indexOf("\n");
      const line = stdout.slice(0, end);
      stdout = stdout.slice(end + 1);
      try {
        const value = JSON.parse(line);
        if (value.event === "owned") {
          const item = value.identity;
          if (!Number.isSafeInteger(item?.pid) || item.pid <= 0 || item.pid === process.pid
            || !/^\d+$/u.test(item.startTime)
            || (item.parent !== tracer.pid && !known.has(item.parent))) {
            traceFailure = "Invalid traced-child ownership record";
          } else known.set(item.pid, item);
        } else if (value.event === "fork-stopped") metadata = value;
        else if (value.event === "outer-exit") outerExited = value.signal === 9;
        else traceFailure = value.error || "Unexpected ptrace status";
      } catch { traceFailure = "Invalid ptrace status"; }
    }
  });
  tracer.stderr.on("data", (bytes) => {
    traceEvidence.stderr = (traceEvidence.stderr + bytes.toString("utf8")).slice(-16384);
  });
  const tracerBefore = await waitFor(async () => {
    if (tracer.startupError) throw tracer.startupError;
    const value = await identity(tracer.pid);
    return value?.parent === process.pid ? value : false;
  }, 1000, "Tracer startup");
  known.set(tracer.pid, tracerBefore);
  const ids = await waitFor(async () => {
    if (tracer.startupError) throw tracer.startupError;
    if (traceFailure) throw new Error(traceFailure);
    return metadata;
  }, 5000, "Ptrace fork-stop setup (unsupported means unverified)");
  assert.equal(ids.detached, true);
  assert.equal(ids.rootExecutableMatchesOwner, true);
  for (const key of ["outer", "guardian", "root"]) {
    const expected = ids[key];
    const value = await identity(expected.pid);
    assert.equal(value?.startTime, expected.startTime);
    assert.equal(value.state, "T");
    const status = await readFile("/proc/" + value.pid + "/status", "utf8");
    assert.equal(/^TracerPid:\s*(\d+)$/mu.exec(status)?.[1], "0", "Tracee still owned by tracer");
    known.set(value.pid, value);
  }
  assert.equal(ids.outer.parent, tracer.pid);
  assert.equal(ids.guardian.parent, ids.outer.pid);
  assert.equal(ids.root.parent, ids.guardian.pid);
  const rootImage = await stat("/proc/" + ids.root.pid + "/exe");
  assert.equal(rootImage.dev, binaryIdentity.dev);
  assert.equal(rootImage.ino, binaryIdentity.ino, "R executed before the startup-window check");
  const cleanupStarted = performance.now();
  signalIdentity(known.get(ids.outer.pid));
  await waitFor(async () => {
    if (traceFailure) throw new Error(traceFailure);
    return outerExited;
  }, 1000, "Tracer reaping W");
  // G was deliberately group-stopped during detach. Resume this exact identity
  // so its queued parent-death signal can run; R stays stopped before exec.
  signalIdentity(known.get(ids.guardian.pid), "CONT");
  await waitFor(async () => (await identity(ids.root.pid)) === null, 3000, "Guardian startup-window cleanup");
  assert.equal(await bounded(tracerClosed, 1000, "Tracer pipe closure"), 0,
    "Tracer failed or compensated instead of observing G cleanup");
  const sentinelAfter = await identity(sentinel.pid);
  assert.equal(sentinelAfter?.startTime, sentinelBefore.startTime);
  assert.ok(!["Z", "X"].includes(sentinelAfter.state), "Unrelated sentinel was killed");
  report.passed = true;
  report.rootStateBefore = "T";
  report.rootStateAfter = "gone";
  report.rootExecutable = "owner";
  report.allTraceesDetached = true;
  report.guardianResumedAfterOuterExit = true;
  report.cleanupElapsedMs = Math.round(performance.now() - cleanupStarted);
  report.sentinelSurvived = true;
  report.statuses = statuses.trim().split("\n");
} catch (error) { failure = error; }
finally {
  if (tracer?.pid && tracer.exitCode === null && tracer.signalCode === null) {
    try { await rememberTree(tracer.pid); } catch (error) { cleanupErrors.push(error.message); }
  }
  for (const value of [...known.values()].reverse()) {
    if (value.pid === tracer?.pid) continue;
    try { signalIdentity(value); } catch (error) { cleanupErrors.push(error.message); }
  }
  if (tracer && tracer.exitCode === null && tracer.signalCode === null) tracer.kill("SIGKILL");
  if (tracerClosed) {
    try { await bounded(tracerClosed, 3000, "Compensated tracer closure"); }
    catch (error) { cleanupErrors.push(error.message); }
  }
  if (sentinel && sentinel.exitCode === null && sentinel.signalCode === null) sentinel.kill("SIGKILL");
  if (sentinelClosed) {
    try { await bounded(sentinelClosed, 3000, "Sentinel closure"); }
    catch (error) { cleanupErrors.push(error.message); }
  }
  for (const value of known.values()) {
    try {
      await waitFor(async () => {
        const current = await identity(value.pid);
        return !current || current.startTime !== value.startTime || ["Z", "X"].includes(current.state);
      }, 1000, "Owned process compensation");
    } catch (error) { cleanupErrors.push(error.message); }
  }
  if (!failure && cleanupErrors.length === 0) {
    try {
      const info = await lstat(root);
      assert.ok(info.isDirectory() && !info.isSymbolicLink() && await realpath(root) === root);
      assert.equal(root.startsWith(join(temporaryParent, "owner-startup-")), true);
      await rm(root, { recursive: true, force: false });
    } catch (error) { cleanupErrors.push(error.message); }
  }
  if (failure || cleanupErrors.length) {
    report.retainedRunDirectory = root;
    try {
      await writeFile(join(root, "failure-evidence.json"), JSON.stringify({ traceEvidence,
        recordedIdentities: [...known.values()] }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    } catch (error) { cleanupErrors.push(error.message); }
  }
}
if (failure || cleanupErrors.length) {
  report.passed = false;
  report.error = failure?.message;
  report.cleanupErrors = cleanupErrors;
  process.exitCode = 1;
}
console.log(JSON.stringify(report));

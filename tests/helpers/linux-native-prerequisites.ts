import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { linuxOwnerPayload } from "../../src/docwen/linux-native-owner";
import { withFixtureCleanup } from "../../scripts/native-fixture-lifecycle.mjs";
import { observeFixtureReadiness } from "../../scripts/native-fixture-readiness.mjs";
import { diagnosticError, writeTopologyDiagnostic } from "../../scripts/native-topology-fixture.mjs";

export interface LinuxProcessIdentity {
  pid: number;
  parent: number;
  group: number;
  session: number;
  state: string;
  startTime: string;
}

export function parseLinuxProcessIdentity(text: string): LinuxProcessIdentity {
  const commandStart = text.indexOf(" (");
  const commandEnd = text.lastIndexOf(") ");
  const pid = Number(text.slice(0, commandStart));
  const fields = text.slice(commandEnd + 2).trim().split(/\s+/u);
  const numbers = [fields[1], fields[2], fields[3]];
  if (commandStart < 1 || commandEnd <= commandStart || !Number.isSafeInteger(pid) || pid <= 0
    || !/^[A-Za-z]$/u.test(fields[0] ?? "") || !/^\d+$/u.test(fields[19] ?? "")
    || numbers.some(value => !/^\d+$/u.test(value ?? "") || !Number.isSafeInteger(Number(value)))) {
    throw new Error("Malformed /proc process identity.");
  }
  return { pid, state: fields[0], parent: Number(fields[1]), group: Number(fields[2]),
    session: Number(fields[3]), startTime: fields[19] };
}

export async function readLinuxProcessIdentity(pid: number): Promise<LinuxProcessIdentity | null> {
  try {
    const value = parseLinuxProcessIdentity(await readFile(`/proc/${pid}/stat`, "utf8"));
    if (value.pid !== pid) throw new Error(`/proc/${pid}/stat reports a different PID: ${value.pid}.`);
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT"
      || (error as NodeJS.ErrnoException).code === "ESRCH") return null;
    throw error;
  }
}

export function assertRunnerObservable(nodePid: number, procSelf: LinuxProcessIdentity): void {
  if (procSelf.pid !== nodePid) {
    throw new Error("Node's PID differs from /proc/self; the fixture cannot authenticate process ownership.");
  }
}

export function assertSentinelObservable(
  runnerPid: number,
  spawnedPid: number | undefined,
  reported: LinuxProcessIdentity,
  observed: LinuxProcessIdentity | null,
): void {
  if (spawnedPid !== reported.pid) {
    throw new Error(`Spawned PID ${spawnedPid} differs from the sentinel's own PID ${reported.pid}; check PID namespace visibility.`);
  }
  if (observed === null) throw new Error(`The live sentinel is not visible at /proc/${spawnedPid}/stat.`);
  if (reported.parent !== runnerPid || observed.parent !== runnerPid) {
    throw new Error("The sentinel is not visible as the test runner's direct child.");
  }
  if (observed.pid !== reported.pid || observed.startTime !== reported.startTime
    || observed.group !== reported.group || observed.session !== reported.session) {
    throw new Error("The sentinel's self-reported identity differs from the runner's /proc observation.");
  }
  if (observed.group !== spawnedPid || observed.session !== spawnedPid) {
    throw new Error("The controlled sentinel did not enter its requested detached session.");
  }
  if (!["S", "R"].includes(observed.state)) {
    throw new Error(`The sentinel is visible but not running or sleeping (state=${observed.state}).`);
  }
}

/** Run once before the real Machine cases; unavailable prerequisites fail the suite. */
export async function checkLinuxNativePrerequisites(): Promise<void> {
  let phase = "native-image";
  let failedPhase: string | undefined;
  const report: Record<string, unknown> = { platform: process.platform, arch: process.arch, runnerPid: process.pid };
  try {
    const payload = linuxOwnerPayload();
    report.nativeImage = { bytes: payload.length, sha256: createHash("sha256").update(payload).digest("hex") };

    phase = "python-pidfd";
    const python = spawnSync("/usr/bin/python3", ["-c", [
      "import json,os,signal,sys",
      "fd=os.pidfd_open(os.getpid())",
      "try:signal.pidfd_send_signal(fd,0)",
      "finally:os.close(fd)",
      "print(json.dumps({'version':sys.version.split()[0],'pidfd':True}))",
    ].join("\n")], { timeout: 2000, maxBuffer: 4096, encoding: "utf8", shell: false });
    report.python = { executable: "/usr/bin/python3", status: python.status, signal: python.signal,
      stdout: python.stdout, stderr: python.stderr, ...(python.error ? { error: diagnosticError(python.error) } : {}) };
    if (python.error || python.status !== 0) {
      throw new Error("The fixture requires /usr/bin/python3 with usable os.pidfd_open and signal.pidfd_send_signal.",
        python.error ? { cause: python.error } : undefined);
    }

    phase = "runner-proc";
    const runner = parseLinuxProcessIdentity(await readFile("/proc/self/stat", "utf8"));
    report.runner = runner;
    assertRunnerObservable(process.pid, runner);

    phase = "sentinel-ready";
    const child = spawn(process.execPath, ["-e", [
      "const fs=require('node:fs');",
      "process.stdout.write('IDENTITY '+JSON.stringify({pid:process.pid,stat:fs.readFileSync('/proc/self/stat','utf8')})+'\\n');",
      "process.stdout.write('DOCWEN_NATIVE_PREREQUISITE_READY\\n');",
      "setInterval(()=>{},100);",
    ].join("\n")], { detached: true, stdio: ["pipe", "pipe", "pipe"], shell: false });
    const observed = observeFixtureReadiness(child, "Linux native prerequisite sentinel");
    const readinessDeadline = Date.now() + 3000;
    await withFixtureCleanup(async () => {
      try {
        await observed.waitForLine("DOCWEN_NATIVE_PREREQUISITE_READY", phase, 3000);
        observed.assertRunning(phase);
        const line = observed.snapshot(phase).streams.stdout.text.split("\n").find(value => value.startsWith("IDENTITY "));
        if (!line) throw new Error("The ready sentinel did not report its own process identity.");
        const record = JSON.parse(line.slice("IDENTITY ".length)) as { pid: number; stat: string };
        const reported = parseLinuxProcessIdentity(record.stat);
        report.sentinelReported = { nodePid: record.pid, ...reported };
        if (record.pid !== reported.pid) throw new Error("The sentinel's Node PID differs from its /proc/self identity.");
        phase = "sentinel-proc";
        let current = await readLinuxProcessIdentity(child.pid!);
        // A ready process can briefly be in D while the fixture filesystem flushes.
        while (current && !["S", "R"].includes(current.state) && Date.now() < readinessDeadline) {
          observed.assertRunning(phase);
          await delay(10);
          current = await readLinuxProcessIdentity(child.pid!);
        }
        report.sentinelObserved = current;
        assertSentinelObservable(process.pid, child.pid, reported, current);
      } catch (error) {
        failedPhase = phase;
        throw error;
      }
    }, async () => {
      phase = "sentinel-cleanup";
      try { await observed.stop(); }
      finally { report.sentinelProcess = observed.snapshot(phase); }
    });
  } catch (error) {
    const record = { ...report, phase: failedPhase ?? phase, error: diagnosticError(error) };
    let diagnostic = "not saved";
    let diagnosticWriteError: unknown;
    try {
      const directory = await mkdtemp(join(tmpdir(), "docwen-linux-prerequisites-"));
      await writeTopologyDiagnostic(directory, "prerequisites", record);
      diagnostic = join(directory, "prerequisites.json");
    } catch (writeError) {
      diagnosticWriteError = diagnosticError(writeError);
    }
    throw new Error(
      `Linux native prerequisites failed at ${record.phase}; Machine lifecycle cases were not run.\n`
      + `Diagnostic: ${diagnostic}\n${JSON.stringify({ ...record, diagnosticWriteError })}`,
      { cause: error },
    );
  }
}

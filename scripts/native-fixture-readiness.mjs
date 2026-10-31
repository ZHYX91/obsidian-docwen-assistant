import { Buffer } from "node:buffer";
import { setTimeout, clearTimeout } from "node:timers";
import { trackFixtureChild } from "./native-fixture-lifecycle.mjs";
import { diagnosticError } from "./native-topology-fixture.mjs";

/** Test-only readiness observation; process spawn is not interpreter readiness. */
export function observeFixtureReadiness(child, label = "Publication writer") {
  const owned = trackFixtureChild(child, { label, timeoutMs: 2000 });
  const started = Date.now();
  const events = [];
  const streams = { stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
  const bytes = { stdout: 0, stderr: 0 };
  const streamErrors = [];
  const waiters = new Set();
  let spawned = false,
    launchError,
    closed;
  const notify = () => {
    for (const check of [...waiters]) check();
  };
  for (const name of ["stdout", "stderr"])
    child[name].on("data", (chunk) => {
      bytes[name] += chunk.length;
      streams[name] = Buffer.concat([streams[name], chunk]).subarray(0, 65536);
      notify();
    });
  for (const name of ["stdin", "stdout", "stderr"])
    child[name].on("error", (error) => {
      streamErrors.push({ stream: name, error: diagnosticError(error) });
      notify();
    });
  child.once("spawn", () => {
    spawned = true;
    events.push({ event: "spawn", elapsedMs: Date.now() - started });
    notify();
  });
  child.once("error", (error) => {
    launchError = error;
    events.push({ event: "error", error: diagnosticError(error) });
    notify();
  });
  child.once("exit", (code, signal) => {
    events.push({ event: "exit", code, signal, elapsedMs: Date.now() - started });
  });
  child.once("close", (code, signal) => {
    closed = { code, signal };
    events.push({ event: "close", ...closed, elapsedMs: Date.now() - started });
    notify();
  });
  const snapshot = (phase) => ({
    phase,
    elapsedMs: Date.now() - started,
    command: { file: child.spawnfile, args: child.spawnargs },
    child: {
      pid: child.pid ?? null,
      spawned,
      exitCode: child.exitCode,
      signalCode: child.signalCode,
      killed: child.killed,
      closed: closed ?? null,
    },
    events: [...events],
    streamErrors: [...streamErrors],
    streams: Object.fromEntries(
      ["stdout", "stderr"].map((name) => [
        name,
        { bytes: bytes[name], text: streams[name].toString("utf8"), truncated: bytes[name] > 65536 },
      ]),
    ),
  });
  const failure = (phase, reason, cause) =>
    new Error(
      `${label} ${phase}: ${reason}\n${JSON.stringify(snapshot(phase))}`,
      cause === undefined ? undefined : { cause },
    );
  const wait = (matches, phase, timeoutMs, closing = false) =>
    new Promise((resolve, reject) => {
      let timer,
        settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        waiters.delete(check);
        if (error) reject(error);
        else resolve(closed);
      };
      const check = () => {
        if (matches()) finish();
        else if (!closing && launchError) finish(failure(phase, "process launch failed", launchError));
        else if (!closing && closed) finish(failure(phase, "child closed before the required line"));
        else if (!closing && streamErrors.length) finish(failure(phase, "child stream failed"));
      };
      waiters.add(check);
      check();
      if (!settled)
        timer = setTimeout(() => finish(failure(phase, `deadline exceeded (${timeoutMs}ms)`)), timeoutMs);
    });
  let stopping;
  return {
    child,
    closed: owned.closed,
    snapshot,
    waitForLine(line, phase, timeoutMs, stream = "stdout") {
      // Only complete, exact lines count; earlier observations remain available.
      return wait(
        () =>
          streams[stream]
            .toString("utf8")
            .split("\n")
            .slice(0, -1)
            .some((value) => value.replace(/\r$/u, "") === line),
        phase,
        timeoutMs,
      );
    },
    waitForClose(phase, timeoutMs) {
      return wait(() => Boolean(closed), phase, timeoutMs, true);
    },
    assertRunning(phase = "publication-open") {
      try {
        owned.assertRunning();
      } catch (error) {
        throw failure(phase, "child did not remain alive at the barrier", error);
      }
    },
    stop() {
      stopping ??= owned.stop().catch((error) => {
        throw failure("cleanup", "child cleanup failed", error);
      });
      return stopping;
    },
  };
}

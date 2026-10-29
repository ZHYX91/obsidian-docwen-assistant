import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout, clearTimeout } from "node:timers";

/** Capture close at spawn time; cleanup never subscribes to an already-fired event. */
export function trackFixtureChild(child, { label = "Fixture child", timeoutMs = 2000 } = {}) {
  let result;
  let launchError;
  const closed = new Promise((resolve) => {
    child.once("close", (code, signal) => {
      result = { code, signal };
      resolve(result);
    });
  });
  child.once("error", (error) => {
    launchError = error;
  });
  let stopping;
  return {
    child,
    closed,
    assertRunning() {
      if (launchError) throw new Error(`${label} failed to start.`, { cause: launchError });
      if (result || child.exitCode !== null || child.signalCode !== null) {
        throw new Error(
          `${label} exited before the case completed: ${JSON.stringify(
            result ?? {
              code: child.exitCode,
              signal: child.signalCode,
            },
          )}`,
        );
      }
    },
    stop() {
      if (!stopping)
        stopping = (async () => {
          // Signal this still-owned ChildProcess handle, never a remembered PID.
          if (!result && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
          let timer;
          try {
            await Promise.race([
              closed,
              new Promise((_, reject) => {
                timer = setTimeout(
                  () => reject(new Error(`${label} cleanup exceeded ${timeoutMs}ms.`)),
                  timeoutMs,
                );
              }),
            ]);
          } finally {
            clearTimeout(timer);
          }
        })();
      return stopping;
    },
  };
}

export function spawnFixtureSentinel() {
  return trackFixtureChild(
    spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      stdio: "ignore",
    }),
    { label: "Unrelated topology sentinel" },
  );
}

/** A cleanup failure must retain, rather than replace, the failing assertion. */
export async function withFixtureCleanup(work, cleanup) {
  let failed = false;
  let primary;
  let result;
  try {
    result = await work();
  } catch (error) {
    failed = true;
    primary = error;
  }
  let cleanupFailed = false;
  let cleanupFailure;
  try {
    await cleanup();
  } catch (error) {
    cleanupFailed = true;
    cleanupFailure = error;
  }
  if (cleanupFailed) {
    if (failed)
      throw new AggregateError([primary, cleanupFailure], "Case and fixture cleanup both failed.", {
        cause: primary,
      });
    throw cleanupFailure;
  }
  if (failed) throw primary;
  return result;
}

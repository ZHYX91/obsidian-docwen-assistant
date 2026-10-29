import process from "node:process";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  atomicPythonMetadata,
  diagnosticError,
  writeTopologyDiagnostic,
} from "../scripts/native-topology-fixture.mjs";
import { withFixtureCleanup } from "../scripts/native-fixture-lifecycle.mjs";
import { observeFixtureReadiness } from "../scripts/native-fixture-readiness.mjs";

const PUBLICATION_TEST_MS = 15000;
const python = process.platform === "win32" ? "python" : "python3";
async function pausedWriter(root, atomic, partial = false) {
  const final = join(root, "metadata.json");
  const expression = "(print('OPEN',flush=True),sys.stdin.readline(),{'child':41})[2]";
  const code = [
    "import json,os,sys",
    "print('READY',flush=True)",
    "assert sys.stdin.readline().strip()=='open'",
    ...(atomic
      ? atomicPythonMetadata(final, expression)
      : [
          `stream=open(${JSON.stringify(final)},'w')`,
          ...(partial ? ["stream.write('{');stream.flush()"] : []),
          "print('OPEN',flush=True)",
          "sys.stdin.readline()",
          "stream.seek(0);stream.truncate()",
          "json.dump({'child':41},stream)",
          "stream.close()",
        ]),
  ].join("\n");
  const child = spawn(python, ["-c", code], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  const owned = observeFixtureReadiness(child, "Publication writer at " + root);
  const inputErrors: unknown[] = [];
  child.stdin.on("error", (error) => {
    inputErrors.push(error);
  });
  try {
    await owned.waitForLine("READY", "interpreter-ready", 5000);
    child.stdin.write("open\n");
    await owned.waitForLine("OPEN", "publication-open", 2000);
    owned.assertRunning();
  } catch (error) {
    await withFixtureCleanup(
      () => {
        throw error;
      },
      async () => {
        await owned.stop();
        await rm(root, { recursive: true, force: true });
      },
    );
  }
  return { child, owned, final, inputErrors };
}
describe("atomic native topology metadata and persistent diagnostics", () => {
  it.each([false, true])(
    "reproduces the old exists-before-complete failure with partial=%s",
    async (partial) => {
      const root = await mkdtemp(join(tmpdir(), "topology-publication-"));
      const writer = await pausedWriter(root, false, partial);
      await withFixtureCleanup(
        async () => {
          expect((await stat(writer.final)).size).toBe(partial ? 1 : 0);
          const reader = spawnSync(
            python,
            ["-c", "import json,sys;json.load(open(sys.argv[1]))", writer.final],
            { encoding: "utf8", timeout: 2000, maxBuffer: 65536, windowsHide: true },
          );
          if (reader.error)
            throw new Error(
              "Publication reader startup/execution failed: " +
                JSON.stringify({
                  command: {
                    file: python,
                    args: ["-c", "import json,sys;json.load(open(sys.argv[1]))", writer.final],
                  },
                  timeoutMs: 2000,
                  status: reader.status,
                  signal: reader.signal,
                  stdout: reader.stdout,
                  stderr: reader.stderr,
                  error: {
                    ...diagnosticError(reader.error),
                    code: Reflect.get(reader.error, "code"),
                    errno: Reflect.get(reader.error, "errno"),
                  },
                }),
              { cause: reader.error },
            );
          expect(reader.status).not.toBe(0);
          expect(reader.stderr).toContain("JSONDecodeError");
          writer.child.stdin.end("continue\n");
          expect(await writer.owned.waitForClose("release-close", 2000)).toMatchObject({ code: 0 });
          expect(writer.inputErrors).toEqual([]);
          expect(JSON.parse(await readFile(writer.final, "utf8"))).toEqual({ child: 41 });
        },
        async () => {
          await writer.owned.stop();
          await rm(root, { recursive: true, force: true });
        },
      );
    },
    PUBLICATION_TEST_MS,
  );
  it(
    "hides a deliberately paused atomic writer until close and replace publish complete JSON",
    async () => {
      const root = await mkdtemp(join(tmpdir(), "topology-publication-"));
      const writer = await pausedWriter(root, true);
      await withFixtureCleanup(
        async () => {
          await expect(stat(writer.final)).rejects.toMatchObject({ code: "ENOENT" });
          expect((await stat(writer.final + ".pending")).size).toBe(0);
          writer.child.stdin.end("continue\n");
          expect(await writer.owned.waitForClose("release-close", 2000)).toMatchObject({ code: 0 });
          expect(writer.inputErrors).toEqual([]);
          expect(JSON.parse(await readFile(writer.final, "utf8"))).toEqual({ child: 41 });
          await expect(stat(writer.final + ".pending")).rejects.toMatchObject({ code: "ENOENT" });
        },
        async () => {
          await writer.owned.stop();
          await rm(root, { recursive: true, force: true });
        },
      );
    },
    PUBLICATION_TEST_MS,
  );
  it("persists failure stage and both original/cleanup errors before replacing the last snapshot", async () => {
    const root = await mkdtemp(join(tmpdir(), "topology-diagnostic-"));
    try {
      const primary = new Error("double-fork/metadata-wait deadline");
      const cleanup = new Error("owned cleanup failed");
      await writeTopologyDiagnostic(root, "double-fork", { stage: "metadata-wait" });
      const failure = await withFixtureCleanup(
        () => {
          throw primary;
        },
        async () => {
          await writeTopologyDiagnostic(root, "double-fork", {
            stage: "metadata-wait",
            primary: diagnosticError(primary),
            cleanup: diagnosticError(cleanup),
          });
          throw cleanup;
        },
      ).catch((error) => error);
      expect(failure.cause).toBe(primary);
      const saved = JSON.parse(await readFile(join(root, "double-fork.json"), "utf8"));
      expect(saved).toMatchObject({
        stage: "metadata-wait",
        primary: { message: primary.message },
        cleanup: { message: cleanup.message },
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("publication fixture readiness diagnostics", () => {
  it(
    "distinguishes spawn from an exact READY line and retains earlier lines",
    async () => {
      const child = spawn(
        process.execPath,
        [
          "-e",
          "process.stdout.write('BOOTED\\nREADYISH\\n');process.stdin.once('data',()=>process.stdout.write('READY\\n'));setInterval(()=>{},1000)",
        ],
        { stdio: ["pipe", "pipe", "pipe"] },
      );
      const observed = observeFixtureReadiness(child, "Controlled ready child");
      await withFixtureCleanup(
        async () => {
          let ready = false;
          const pending = observed.waitForLine("READY", "interpreter-ready", 5000).then(() => {
            ready = true;
          });
          void pending.catch(() => undefined);
          await observed.waitForLine("READYISH", "control-boot", 5000);
          expect(observed.snapshot("before-ready").child.spawned).toBe(true);
          expect(ready).toBe(false);
          child.stdin.write("ready\n");
          await pending;
          await observed.waitForLine("BOOTED", "already-observed", 1);
          await observed.waitForLine("READY", "already-observed", 1);
        },
        () => observed.stop(),
      );
      expect(await observed.closed).toMatchObject({ signal: "SIGKILL" });
    },
    PUBLICATION_TEST_MS,
  );

  it(
    "reports phase, both streams and the real exit/close when a child exits before READY",
    async () => {
      const child = spawn(
        process.execPath,
        [
          "-e",
          "process.stdout.write('BOOTED\\n');process.stderr.write('early failure\\n');process.exitCode=7",
        ],
        { stdio: ["pipe", "pipe", "pipe"] },
      );
      const observed = observeFixtureReadiness(child, "Early exit child");
      await withFixtureCleanup(
        async () => {
          const error = await observed
            .waitForLine("READY", "interpreter-ready", 5000)
            .catch((failure) => failure);
          expect(error).toBeInstanceOf(Error);
          expect(error.message).toContain("interpreter-ready: child closed before the required line");
          const state = JSON.parse(error.message.split("\n")[1]);
          expect(state.child).toMatchObject({ spawned: true, exitCode: 7, closed: { code: 7 } });
          expect(state.streams.stdout.text).toBe("BOOTED\n");
          expect(state.streams.stderr.text).toBe("early failure\n");
          expect(state.events.map((event) => event.event)).toEqual(["spawn", "exit", "close"]);
        },
        async () => {
          const first = observed.stop();
          expect(observed.stop()).toBe(first);
          await first;
        },
      );
      expect(await observed.closed).toMatchObject({ code: 7 });
    },
    PUBLICATION_TEST_MS,
  );

  it.each(["ready", "close"])(
    "keeps a %s deadline and actually closes its still-live controlled child",
    async (phase) => {
      const child = spawn(
        process.execPath,
        [
          "-e",
          "process.stdout.write('BOOTED\\n');process.stderr.write('still alive\\n');process.stdin.once('data',()=>process.stdout.write('RELEASED\\n'));setInterval(()=>{},1000)",
        ],
        { stdio: ["pipe", "pipe", "pipe"] },
      );
      const observed = observeFixtureReadiness(child, "Stalled child");
      let original;
      const result = await withFixtureCleanup(
        async () => {
          await observed.waitForLine("BOOTED", "control-boot", 5000);
          await observed.waitForLine("still alive", "control-stderr", 2000, "stderr");
          if (phase === "close") {
            child.stdin.end("release\n");
            await observed.waitForLine("RELEASED", "control-release", 2000);
          }
          try {
            if (phase === "ready") await observed.waitForLine("READY", "interpreter-ready", 25);
            else await observed.waitForClose("release-close", 25);
          } catch (error) {
            original = error;
            throw error;
          }
          throw new Error("Stalled child unexpectedly became ready/closed");
        },
        async () => {
          const first = observed.stop();
          expect(observed.stop()).toBe(first);
          await first;
        },
      ).catch((error) => error);
      expect(result).toBe(original);
      expect(result.message).toContain(
        phase === "ready"
          ? "interpreter-ready: deadline exceeded (25ms)"
          : "release-close: deadline exceeded (25ms)",
      );
      const state = JSON.parse(result.message.split("\n")[1]);
      expect(state.child).toMatchObject({ spawned: true, exitCode: null, closed: null });
      expect(state.streams.stdout.text).toContain("BOOTED\n");
      expect(state.streams.stderr.text).toBe("still alive\n");
      expect(await observed.closed).toMatchObject({ signal: "SIGKILL" });
    },
    PUBLICATION_TEST_MS,
  );
});

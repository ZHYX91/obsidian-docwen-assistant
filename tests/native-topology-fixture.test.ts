import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { atomicPythonMetadata, diagnosticError, writeTopologyDiagnostic } from "../scripts/native-topology-fixture.mjs";
import { trackFixtureChild, withFixtureCleanup } from "../scripts/native-fixture-lifecycle.mjs";

const python = process.platform === "win32" ? "python" : "python3";
async function pausedWriter(root: string, atomic: boolean, partial = false) {
  const final = join(root, "metadata.json");
  const expression = "(print('OPEN',flush=True),sys.stdin.readline(),{'child':41})[2]";
  const code = ["import json,os,sys", ...(atomic ? atomicPythonMetadata(final, expression) : [
    `stream=open(${JSON.stringify(final)},'w')`,
    ...(partial ? ["stream.write('{');stream.flush()"] : []),
    "print('OPEN',flush=True)", "sys.stdin.readline()", "stream.seek(0);stream.truncate()", "json.dump({'child':41},stream)", "stream.close()",
  ])].join("\n");
  const child = spawn(python, ["-c", code], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  const owned = trackFixtureChild(child);
  let errors = "";
  child.stderr.on("data", (bytes) => { errors += bytes.toString(); });
  const inputErrors: unknown[] = [];
  child.stdin.on("error", (error) => { inputErrors.push(error); });
  const ready = new Promise<void>((resolve, reject) => {
    let output = "";
    child.once("error", reject);
    child.stdout.on("data", (bytes) => { output += bytes.toString(); if (output.includes("OPEN")) resolve(); });
    child.once("close", () => reject(new Error("Writer closed before the barrier: " + errors)));
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([ready, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Writer barrier deadline")), 2000); })]);
  } catch (error) {
    await withFixtureCleanup(() => { throw error; }, async () => { await owned.stop(); await rm(root, { recursive: true, force: true }); });
  } finally { clearTimeout(timer); }
  return { child, owned, final, inputErrors };
}

describe("atomic native topology metadata and persistent diagnostics", () => {
  it.each([false, true])("reproduces the old exists-before-complete failure with partial=%s", async (partial) => {
    const root = await mkdtemp(join(tmpdir(), "topology-publication-"));
    const writer = await pausedWriter(root, false, partial);
    await withFixtureCleanup(async () => {
      expect((await stat(writer.final)).size).toBe(partial ? 1 : 0);
      const reader = spawnSync(python, ["-c", "import json,sys;json.load(open(sys.argv[1]))", writer.final], { encoding: "utf8", timeout: 2000, windowsHide: true });
      expect(reader.error).toBeUndefined();
      expect(reader.status).not.toBe(0);
      expect(reader.stderr).toContain("JSONDecodeError");
      writer.child.stdin.end("continue\n");
      expect(await writer.owned.closed).toMatchObject({ code: 0 });
      expect(writer.inputErrors).toEqual([]);
      expect(JSON.parse(await readFile(writer.final, "utf8"))).toEqual({ child: 41 });
    }, async () => { await writer.owned.stop(); await rm(root, { recursive: true, force: true }); });
  });

  it("hides a deliberately paused atomic writer until close and replace publish complete JSON", async () => {
    const root = await mkdtemp(join(tmpdir(), "topology-publication-"));
    const writer = await pausedWriter(root, true);
    await withFixtureCleanup(async () => {
      await expect(stat(writer.final)).rejects.toMatchObject({ code: "ENOENT" });
      expect((await stat(writer.final + ".pending")).size).toBe(0);
      writer.child.stdin.end("continue\n");
      expect(await writer.owned.closed).toMatchObject({ code: 0 });
      expect(writer.inputErrors).toEqual([]);
      expect(JSON.parse(await readFile(writer.final, "utf8"))).toEqual({ child: 41 });
      await expect(stat(writer.final + ".pending")).rejects.toMatchObject({ code: "ENOENT" });
    }, async () => { await writer.owned.stop(); await rm(root, { recursive: true, force: true }); });
  });

  it("persists failure stage and both original/cleanup errors before replacing the last snapshot", async () => {
    const root = await mkdtemp(join(tmpdir(), "topology-diagnostic-"));
    try {
      const primary = new Error("double-fork/metadata-wait deadline");
      const cleanup = new Error("owned cleanup failed");
      await writeTopologyDiagnostic(root, "double-fork", { stage: "metadata-wait" });
      const failure = await withFixtureCleanup(() => { throw primary; }, async () => {
        await writeTopologyDiagnostic(root, "double-fork", { stage: "metadata-wait", primary: diagnosticError(primary), cleanup: diagnosticError(cleanup) });
        throw cleanup;
      }).catch((error) => error);
      expect(failure.cause).toBe(primary);
      const saved = JSON.parse(await readFile(join(root, "double-fork.json"), "utf8"));
      expect(saved).toMatchObject({ stage: "metadata-wait", primary: { message: primary.message }, cleanup: { message: cleanup.message } });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});

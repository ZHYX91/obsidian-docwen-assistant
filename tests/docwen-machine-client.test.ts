import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { writeFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { PassThrough } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { encodeMachineFrame, MachineFrameDecoder, type JsonObject } from "../src/docwen/machine-framing";

const { spawnMock, serverState } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  serverState: {
    cancelRequested: false,
    corruptHash: false,
    floodHealth: false,
    holdHealth: false,
    holdTask: false,
    ignoreCancellation: false,
    serverName: "DocWen",
    serverVersion: "0.9.0",
    stderrOverflow: false,
    taskAccepted: false,
    bundleVersion: "0.9.0",
    artifactBundleSchema: "docwen.artifact_bundle.v2",
  },
}));

vi.mock("node:child_process", () => ({ spawn: spawnMock }));

import {
  ARTIFACT_BUNDLE_LIMITS,
  DocWenMachineClient,
  type MachineTaskRequest,
  validateArtifactBundle,
} from "../src/docwen/machine-client";

const temporaryRoots: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  for (const root of temporaryRoots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "docwen-machine-test-"));
  temporaryRoots.push(root);
  return root;
}

function artifact(artifactId: string, locator: string, bytes: Buffer, kind = "document"): JsonObject {
  return {
    artifact_id: artifactId,
    kind,
    locator,
    logical_path: locator,
    suggested_name: path.basename(locator),
    media_type: "text/markdown",
    size_bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function bundle(
  artifacts: JsonObject[],
  entries: JsonObject[],
  relations: JsonObject[] = [],
): JsonObject {
  return {
    schema: "docwen.artifact_bundle.v2",
    bundle_id: "bundle.graph",
    task_id: "task.graph",
    producer: { name: "DocWen", product_version: "0.9.0", machine_protocol: "docwen.machine.v1" },
    layout_schema: "docwen.artifact_layout.v1",
    artifacts,
    entries,
    relations,
  };
}

function taskRequest(root: string, input: string, bytes: Buffer): MachineTaskRequest {
  return {
    capability_id: "transform.markdown.heading_numbering",
    inputs: [{
      input_id: "input.1",
      locator: { kind: "local_path", path: input },
      kind: "document",
      role: "source",
      logical_path: "note.md",
      media_type: "text/markdown",
      size_bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    }],
    output: { staging_root: { kind: "local_path", path: root }, staging_policy: "require_empty" },
    options: {},
  };
}

class FakeChild extends EventEmitter {
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  killed = false;
  private readonly decoder = new MachineFrameDecoder();
  private taskPlan: JsonObject | null = null;

  constructor() {
    super();
    this.stdin.on("data", (chunk: Buffer) => {
      for (const message of this.decoder.feed(Buffer.from(chunk))) this.handle(message);
    });
    this.stdin.on("finish", () => queueMicrotask(() => this.emit("close", 0)));
  }

  kill(_signal?: string): boolean {
    this.killed = true;
    queueMicrotask(() => this.emit("close", null));
    return true;
  }

  private handle(message: JsonObject): void {
    const id = message.id;
    if (message.method === "initialize") {
      this.reply(id, {
        protocol: { name: "docwen.machine", major: 1, minor: 0 },
        server: { name: serverState.serverName, version: serverState.serverVersion },
        artifact_bundle_schema: serverState.artifactBundleSchema,
        methods: [],
        features: { progress: true, cancellation: true },
        max_concurrent_tasks: 1,
      });
      return;
    }
    if (message.method === "health/check") {
      if (serverState.stderrOverflow) {
        this.stderr.write(Buffer.alloc(256 * 1024 + 1, 0x78));
        return;
      }
      if (serverState.floodHealth) {
        for (let index = 0; index < 66; index += 1) {
          this.reply(10_000 + index, { noise: index });
        }
        return;
      }
      if (serverState.holdHealth) return;
      this.reply(id, { all_ok: true, checks: [{ id: "config", ok: true }] });
      return;
    }
    if (message.method === "task/plan") {
      this.taskPlan = message.params as JsonObject;
      this.reply(id, {
        plan_id: "plan.1",
        capability_id: this.taskPlan.capability_id,
        effective_options: {},
        output_shape: { cardinality: "one", artifact_kinds: ["document"], relation_types: [], atomic_bundle: true },
        limitations: [],
      });
      return;
    }
    if (message.method === "task/execute") {
      this.reply(id, { task_id: "task.1", state: "accepted" });
      serverState.taskAccepted = true;
      if (serverState.holdTask) return;
      const output = ((this.taskPlan!.output as JsonObject).staging_root as JsonObject).path as string;
      const artifactPath = path.join(output, "output.md");
      const bytes = Buffer.from("# output\n", "utf8");
      writeFileSync(artifactPath, bytes);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      queueMicrotask(() => this.notify("task/completed", {
        task_id: "task.1",
        bundle: {
          schema: "docwen.artifact_bundle.v2",
          bundle_id: "bundle.1",
          task_id: "task.1",
          producer: {
            name: "DocWen",
            product_version: serverState.bundleVersion,
            machine_protocol: "docwen.machine.v1",
          },
          layout_schema: "docwen.artifact_layout.v1",
          artifacts: [{
            artifact_id: "artifact.1",
            kind: "document",
            locator: "output.md",
            logical_path: "output.md",
            suggested_name: "output.md",
            media_type: "text/markdown",
            size_bytes: bytes.length,
            sha256: serverState.corruptHash ? "0".repeat(64) : sha256,
          }],
          entries: [{ artifact_id: "artifact.1", role: "primary", ordinal: 0, preferred: true }],
          relations: [],
        },
        diagnostics: [],
        metrics: { duration_ms: 1, input_bytes: 1, output_bytes: bytes.length },
        sequence: 1,
      }));
      return;
    }
    if (message.method === "task/cancel") {
      serverState.cancelRequested = true;
      if (!serverState.ignoreCancellation) {
        queueMicrotask(() => this.notify("task/cancelled", { task_id: "task.1" }));
      }
    }
  }

  private reply(id: unknown, result: JsonObject): void {
    queueMicrotask(() => this.stdout.write(encodeMachineFrame({ jsonrpc: "2.0", id, result })));
  }

  private notify(method: string, params: JsonObject): void {
    this.stdout.write(encodeMachineFrame({ jsonrpc: "2.0", method, params }));
  }
}

describe("DocWenMachineClient", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    spawnMock.mockReset();
    serverState.cancelRequested = false;
    serverState.corruptHash = false;
    serverState.floodHealth = false;
    serverState.holdHealth = false;
    serverState.holdTask = false;
    serverState.ignoreCancellation = false;
    serverState.serverName = "DocWen";
    serverState.serverVersion = "0.9.0";
    serverState.stderrOverflow = false;
    serverState.taskAccepted = false;
    serverState.bundleVersion = "0.9.0";
    serverState.artifactBundleSchema = "docwen.artifact_bundle.v2";
    spawnMock.mockImplementation(() => new FakeChild());
  });

  it("initializes Machine v1 and performs a framed query", async () => {
    const client = new DocWenMachineClient(() => "C:\\DocWen\\DocWenCLI.exe", () => "en_US");

    await expect(client.query("health/check", {})).resolves.toEqual({
      all_ok: true,
      checks: [{ id: "config", ok: true }],
    });
    expect(spawnMock).toHaveBeenCalledWith(
      "C:\\DocWen\\DocWenCLI.exe",
      ["serve", "--stdio"],
      expect.objectContaining({ shell: false, windowsHide: true }),
    );
  });

  it("launches the fixed automatic alias with an explicit safe working directory", async () => {
    const aliasPath = "C:\\Users\\Tester\\AppData\\Local\\Microsoft\\WindowsApps\\docwen.exe";
    const client = new DocWenMachineClient(
      () => ({ executable: aliasPath, cwd: "C:\\Temp", mode: "automatic" }),
      () => "en_US",
    );

    await expect(client.query("health/check", {})).resolves.toMatchObject({ all_ok: true });
    expect(spawnMock).toHaveBeenCalledWith(
      aliasPath,
      ["serve", "--stdio"],
      expect.objectContaining({ cwd: "C:\\Temp", shell: false }),
    );
  });

  it("preserves only the Linux desktop session variables needed by Machine GUI control", async () => {
    vi.stubEnv("HOME", "/home/tester");
    vi.stubEnv("XDG_RUNTIME_DIR", "/run/user/1000");
    vi.stubEnv("XDG_CONFIG_HOME", "/home/tester/.config");
    vi.stubEnv("DISPLAY", ":0");
    vi.stubEnv("WAYLAND_DISPLAY", "wayland-0");
    vi.stubEnv("UNRELATED_SECRET", "must-not-cross-boundary");
    const client = new DocWenMachineClient(() => "/opt/DocWen/DocWenCLI", () => "en_US");

    await expect(client.query("health/check", {})).resolves.toMatchObject({ all_ok: true });

    const environment = spawnMock.mock.calls[0][2].env as NodeJS.ProcessEnv;
    if (process.platform === "linux") {
      expect(environment).toMatchObject({
        HOME: "/home/tester",
        XDG_RUNTIME_DIR: "/run/user/1000",
        XDG_CONFIG_HOME: "/home/tester/.config",
        DISPLAY: ":0",
        WAYLAND_DISPLAY: "wayland-0",
      });
    } else {
      expect(environment).not.toHaveProperty("XDG_RUNTIME_DIR");
      expect(environment).not.toHaveProperty("WAYLAND_DISPLAY");
    }
    expect(environment).not.toHaveProperty("UNRELATED_SECRET");
  });

  it("rejects relative launch targets instead of resolving them through PATH", async () => {
    const client = new DocWenMachineClient(
      () => ({ executable: "docwen.exe", cwd: "C:\\Temp", mode: "automatic" }),
      () => "en_US",
    );

    await expect(client.query("health/check", {})).rejects.toMatchObject({ code: "cli_spawn_failed" });
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("reports a missing automatic execution alias as a setup failure", async () => {
    spawnMock.mockImplementationOnce(() => {
      const child = new FakeChild();
      queueMicrotask(() => child.emit("error", Object.assign(new Error("missing"), { code: "ENOENT" })));
      return child;
    });
    const client = new DocWenMachineClient(
      () => ({
        executable: "C:\\Users\\Tester\\AppData\\Local\\Microsoft\\WindowsApps\\docwen.exe",
        cwd: "C:\\Temp",
        mode: "automatic",
      }),
      () => "en_US",
    );

    await expect(client.query("health/check", {})).rejects.toMatchObject({ code: "cli_alias_not_found" });
  });

  it("bounds timeout, stderr, and queued-message failures and terminates the owned child", async () => {
    for (const failure of ["timeout", "stderr", "queue"] as const) {
      const child = new FakeChild();
      spawnMock.mockReturnValueOnce(child);
      serverState.holdHealth = failure === "timeout";
      serverState.stderrOverflow = failure === "stderr";
      serverState.floodHealth = failure === "queue";
      const client = new DocWenMachineClient(() => "C:\\DocWen\\DocWenCLI.exe", () => "en_US");

      await expect(client.query("health/check", {}, undefined, 20)).rejects.toMatchObject({
        code: failure === "timeout" ? "cli_timeout" : "cli_output_limit",
      });
      expect(child.killed).toBe(true);
      serverState.holdHealth = false;
      serverState.stderrOverflow = false;
      serverState.floodHealth = false;
    }
  });

  it("requests task cancellation and then settles the owned child", async () => {
    serverState.holdTask = true;
    const child = new FakeChild();
    spawnMock.mockReturnValueOnce(child);
    const root = await temporaryRoot();
    const input = path.join(root, "input.md");
    const bytes = Buffer.from("# input\n", "utf8");
    writeFileSync(input, bytes);
    const controller = new AbortController();
    const client = new DocWenMachineClient(() => "C:\\DocWen\\DocWenCLI.exe", () => "en_US");

    const pending = client.runTask(taskRequest(root, input, bytes), controller.signal, 5_000);
    await vi.waitFor(() => expect(serverState.taskAccepted).toBe(true));
    controller.abort();

    await expect(pending).rejects.toMatchObject({ code: "cli_cancelled" });
    expect(serverState.cancelRequested).toBe(true);
    expect(child.killed).toBe(true);
  });

  it("force-terminates an accepted task when the server ignores cancellation", async () => {
    serverState.holdTask = true;
    serverState.ignoreCancellation = true;
    const child = new FakeChild();
    spawnMock.mockReturnValueOnce(child);
    const root = await temporaryRoot();
    const input = path.join(root, "input.md");
    const bytes = Buffer.from("# input\n", "utf8");
    writeFileSync(input, bytes);
    const controller = new AbortController();
    const client = new DocWenMachineClient(() => "C:\\DocWen\\DocWenCLI.exe", () => "en_US");

    const pending = client.runTask(taskRequest(root, input, bytes), controller.signal, 7_000);
    await vi.waitFor(() => expect(serverState.taskAccepted).toBe(true));
    controller.abort();

    await expect(pending).rejects.toMatchObject({ code: "cli_cancelled" });
    expect(serverState.cancelRequested).toBe(true);
    expect(child.killed).toBe(true);
  }, 6_000);

  it("settles a pending request when plugin unload disposes the client", async () => {
    serverState.holdHealth = true;
    const child = new FakeChild();
    spawnMock.mockReturnValueOnce(child);
    const client = new DocWenMachineClient(() => "C:\\DocWen\\DocWenCLI.exe", () => "en_US");

    const pending = client.query("health/check", {}, undefined, 10_000);
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledOnce());
    client.dispose();

    await expect(pending).rejects.toMatchObject({ code: "cli_cancelled" });
    expect(child.killed).toBe(true);
  });

  it("fails closed for a wrong server identity or incompatible product version", async () => {
    serverState.serverName = "NotDocWen";
    const wrongName = new DocWenMachineClient(() => "C:\\DocWen\\DocWenCLI.exe", () => "en_US");
    await expect(wrongName.query("health/check", {})).rejects.toMatchObject({
      code: "cli_incompatible_version",
    });

    serverState.serverName = "DocWen";
    serverState.serverVersion = "0.10.0";
    const incompatible = new DocWenMachineClient(() => "C:\\DocWen\\DocWenCLI.exe", () => "en_US");
    await expect(incompatible.query("health/check", {})).rejects.toMatchObject({
      code: "cli_incompatible_version",
    });

    const pinnedIncompatible = new DocWenMachineClient(
      () => "C:\\DocWen\\DocWenCLI.exe",
      () => "en_US",
      "0.10.0",
    );
    await expect(pinnedIncompatible.query("health/check", {})).rejects.toMatchObject({
      code: "cli_incompatible_version",
    });

    serverState.serverVersion = "0.9.0-rc.1";
    const prerelease = new DocWenMachineClient(() => "C:\\DocWen\\DocWenCLI.exe", () => "en_US");
    await expect(prerelease.query("health/check", {})).rejects.toMatchObject({
      code: "cli_incompatible_version",
    });

    serverState.serverVersion = "0.9.1";
    const exactCandidate = new DocWenMachineClient(
      () => "C:\\DocWen\\DocWenCLI.exe",
      () => "en_US",
      "0.9.0",
    );
    await expect(exactCandidate.query("health/check", {})).rejects.toMatchObject({
      code: "cli_incompatible_version",
      details: expect.objectContaining({ expectedProductVersion: "0.9.0", actualProductVersion: "0.9.1" }),
    });
  });

  it("fails closed when the Machine server does not declare Bundle v2", async () => {
    serverState.artifactBundleSchema = "docwen.artifact_bundle.v1";
    const client = new DocWenMachineClient(() => "C:\\DocWen\\DocWenCLI.exe", () => "en_US");

    await expect(client.query("health/check", {})).rejects.toMatchObject({
      code: "cli_incompatible_version",
    });
  });

  it("validates every artifact before returning a completed task", async () => {
    const root = await temporaryRoot();
    const input = path.join(root, "input.md");
    writeFileSync(input, "# input\n", "utf8");
    const bytes = Buffer.from("# input\n", "utf8");
    const client = new DocWenMachineClient(() => "C:\\DocWen\\DocWenCLI.exe", () => "en_US");

    const result = await client.runTask({
      capability_id: "transform.markdown.heading_numbering",
      inputs: [{
        input_id: "input.1",
        locator: { kind: "local_path", path: input },
        kind: "document",
        role: "source",
        logical_path: "note.md",
        media_type: "text/markdown",
        size_bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      }],
      output: { staging_root: { kind: "local_path", path: root }, staging_policy: "require_empty" },
      options: {},
    });

    expect(result.bundle.artifacts[0]).toMatchObject({ kind: "document", sha256: expect.stringMatching(/^[0-9a-f]{64}$/u) });
  });

  it("fails closed when bundle integrity does not match disk", async () => {
    serverState.corruptHash = true;
    const root = await temporaryRoot();
    const input = path.join(root, "input.md");
    writeFileSync(input, "# input\n", "utf8");
    const bytes = Buffer.from("# input\n", "utf8");
    const client = new DocWenMachineClient(() => "C:\\DocWen\\DocWenCLI.exe", () => "en_US");

    await expect(client.runTask({
      capability_id: "transform.markdown.heading_numbering",
      inputs: [{
        input_id: "input.1",
        locator: { kind: "local_path", path: input },
        kind: "document",
        role: "source",
        logical_path: "note.md",
        media_type: "text/markdown",
        size_bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      }],
      output: { staging_root: { kind: "local_path", path: root }, staging_policy: "require_empty" },
      options: {},
    })).rejects.toMatchObject({ code: "cli_integrity_error" });
  });

  it("binds every Bundle producer version to the initialized Machine server", async () => {
    serverState.bundleVersion = "0.9.1";
    const root = await temporaryRoot();
    const input = path.join(root, "input.md");
    const bytes = Buffer.from("# input\n", "utf8");
    writeFileSync(input, bytes);
    const client = new DocWenMachineClient(() => "C:\\DocWen\\DocWenCLI.exe", () => "en_US");

    await expect(client.runTask({
      capability_id: "transform.markdown.heading_numbering",
      inputs: [{
        input_id: "input.1",
        locator: { kind: "local_path", path: input },
        kind: "document",
        role: "source",
        logical_path: "note.md",
        media_type: "text/markdown",
        size_bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      }],
      output: { staging_root: { kind: "local_path", path: root }, staging_policy: "require_empty" },
      options: {},
    })).rejects.toMatchObject({ code: "cli_integrity_error" });
  });

  it("rejects traversal and duplicate artifact locators", async () => {
    const root = await temporaryRoot();
    const bytes = Buffer.from("# output\n", "utf8");
    writeFileSync(path.join(root, "output.md"), bytes);
    const entry = { artifact_id: "artifact.1", role: "primary", ordinal: 0, preferred: true };

    await expect(validateArtifactBundle(
      bundle([artifact("artifact.1", "../output.md", bytes)], [entry]),
      root,
      "task.graph",
      "0.9.0",
    )).rejects.toMatchObject({ code: "cli_integrity_error" });

    await expect(validateArtifactBundle(
      bundle(
        [artifact("artifact.1", "output.md", bytes), artifact("artifact.2", "output.md", bytes)],
        [entry],
      ),
      root,
      "task.graph",
      "0.9.0",
    )).rejects.toMatchObject({ code: "cli_integrity_error" });

    if (process.platform !== "win32") {
      const parent = await temporaryRoot();
      const caseRoot = path.join(parent, "Stage");
      const caseSibling = path.join(parent, "stage");
      await mkdir(caseRoot);
      await mkdir(caseSibling);
      writeFileSync(path.join(caseSibling, "outside.md"), bytes);
      await symlink(caseSibling, path.join(caseRoot, "nested"), "dir");
      await expect(validateArtifactBundle(
        bundle([artifact("artifact.1", "nested/outside.md", bytes)], [entry]),
        caseRoot,
        "task.graph",
        "0.9.0",
      )).rejects.toMatchObject({ code: "cli_integrity_error" });
    }
  });

  it("accepts Artifact Bundle v2 logical paths and rejects unsafe paths", async () => {
    const root = await temporaryRoot();
    const bytes = Buffer.from("# output\n", "utf8");
    writeFileSync(path.join(root, "output.md"), bytes);
    const entry = { artifact_id: "artifact.1", role: "primary", ordinal: 0, preferred: true };
    const validArtifact = { ...artifact("artifact.1", "output.md", bytes), logical_path: "output/output.md" };

    await expect(validateArtifactBundle(
      bundle([validArtifact], [entry]),
      root,
      "task.graph",
      "0.9.0",
    )).resolves.toMatchObject({
      schema: "docwen.artifact_bundle.v2",
      layout_schema: "docwen.artifact_layout.v1",
      artifacts: [{ logical_path: "output/output.md" }],
    });

    await expect(validateArtifactBundle(
      bundle([{ ...validArtifact, logical_path: "../output.md" }], [entry]),
      root,
      "task.graph",
      "0.9.0",
    )).rejects.toMatchObject({ code: "cli_integrity_error" });
  });

  it("accepts the v2 document-node manifest relation and rejects Bundle v1", async () => {
    const root = await temporaryRoot();
    const documentBytes = Buffer.from("# output\n", "utf8");
    const manifestBytes = Buffer.from("{}\n", "utf8");
    writeFileSync(path.join(root, "output.md"), documentBytes);
    writeFileSync(path.join(root, "docwen-node.json"), manifestBytes);
    const document = { ...artifact("artifact.document", "output.md", documentBytes), logical_path: "output/output.md" };
    const manifest = {
      ...artifact("artifact.manifest", "docwen-node.json", manifestBytes),
      kind: "resource",
      logical_path: "output/docwen-node.json",
    };
    const entry = { artifact_id: "artifact.document", role: "primary", ordinal: 0, preferred: true };
    const relation = {
      type: "resource_of",
      source_artifact_id: "artifact.manifest",
      target_artifact_id: "artifact.document",
      role: "manifest",
      ordinal: 0,
    };

    await expect(validateArtifactBundle(
      bundle([document, manifest], [entry], [relation]),
      root,
      "task.graph",
      "0.9.0",
    )).resolves.toMatchObject({ schema: "docwen.artifact_bundle.v2" });

    await expect(validateArtifactBundle(
      { ...bundle([document, manifest], [entry], [relation]), schema: "docwen.artifact_bundle.v1" },
      root,
      "task.graph",
      "0.9.0",
    )).rejects.toMatchObject({ code: "cli_integrity_error" });
  });

  it("enforces finite Bundle counts, byte budgets, and portable suggested names", async () => {
    const root = await temporaryRoot();
    const bytes = Buffer.from("# output\n", "utf8");
    writeFileSync(path.join(root, "output.md"), bytes);
    const validArtifact = artifact("artifact.1", "output.md", bytes);
    const validEntry = { artifact_id: "artifact.1", role: "primary", ordinal: 0, preferred: true };

    await expect(validateArtifactBundle(
      bundle([{ ...validArtifact, suggested_name: ".." }], [validEntry]),
      root,
      "task.graph",
      "0.9.0",
    )).rejects.toMatchObject({ code: "cli_integrity_error" });

    await expect(validateArtifactBundle(
      bundle(Array.from({ length: ARTIFACT_BUNDLE_LIMITS.artifacts + 1 }, () => validArtifact), [validEntry]),
      root,
      "task.graph",
      "0.9.0",
    )).rejects.toMatchObject({ code: "cli_output_limit" });

    const oneThirdOver = Math.floor(ARTIFACT_BUNDLE_LIMITS.totalBytes / 3) + 1;
    await expect(validateArtifactBundle(
      bundle([0, 1, 2].map((index) => ({
        ...validArtifact,
        artifact_id: `artifact.${index}`,
        locator: `missing-${index}.md`,
        suggested_name: `missing-${index}.md`,
        size_bytes: oneThirdOver,
      })), [validEntry]),
      root,
      "task.graph",
      "0.9.0",
    )).rejects.toMatchObject({ code: "cli_output_limit" });

    await expect(validateArtifactBundle(
      bundle([validArtifact], Array.from({ length: ARTIFACT_BUNDLE_LIMITS.entries + 1 }, () => validEntry)),
      root,
      "task.graph",
      "0.9.0",
    )).rejects.toMatchObject({ code: "cli_output_limit" });

    await expect(validateArtifactBundle(
      bundle(
        [validArtifact],
        [validEntry],
        Array.from({ length: ARTIFACT_BUNDLE_LIMITS.relations + 1 }, () => ({
          type: "derived_from",
          source_artifact_id: "artifact.1",
          target_artifact_id: "artifact.1",
          role: "source",
        })),
      ),
      root,
      "task.graph",
      "0.9.0",
    )).rejects.toMatchObject({ code: "cli_output_limit" });
  });

  it("accepts peer entries without a preferred hint and rejects multiple hints", async () => {
    const root = await temporaryRoot();
    const bytes = Buffer.from("# peer\n", "utf8");
    writeFileSync(path.join(root, "peer.md"), bytes);
    const peerArtifact = artifact("artifact.peer", "peer.md", bytes);

    await expect(validateArtifactBundle(
      bundle(
        [peerArtifact],
        [{ artifact_id: "artifact.peer", role: "section", ordinal: 0, preferred: false }],
      ),
      root,
      "task.graph",
      "0.9.0",
    )).resolves.toMatchObject({ bundle_id: "bundle.graph" });

    await expect(validateArtifactBundle(
      bundle(
        [peerArtifact],
        [
          { artifact_id: "artifact.peer", role: "primary", ordinal: 0, preferred: true },
          { artifact_id: "artifact.peer", role: "section", ordinal: 1, preferred: true },
        ],
      ),
      root,
      "task.graph",
      "0.9.0",
    )).rejects.toMatchObject({ code: "cli_integrity_error" });
  });

  it("rejects relation cycles and artifacts that are both entries and owned children", async () => {
    const root = await temporaryRoot();
    const bytesA = Buffer.from("# A\n", "utf8");
    const bytesB = Buffer.from("# B\n", "utf8");
    writeFileSync(path.join(root, "a.md"), bytesA);
    writeFileSync(path.join(root, "b.md"), bytesB);
    const artifacts = [artifact("artifact.a", "a.md", bytesA), artifact("artifact.b", "b.md", bytesB)];

    await expect(validateArtifactBundle(
      bundle(
        artifacts,
        [{ artifact_id: "artifact.a", role: "primary", ordinal: 0, preferred: true }],
        [
          { type: "derived_from", source_artifact_id: "artifact.a", target_artifact_id: "artifact.b", role: "source" },
          { type: "derived_from", source_artifact_id: "artifact.b", target_artifact_id: "artifact.a", role: "source" },
        ],
      ),
      root,
      "task.graph",
      "0.9.0",
    )).rejects.toMatchObject({ code: "cli_integrity_error" });

    await expect(validateArtifactBundle(
      bundle(
        artifacts,
        [
          { artifact_id: "artifact.a", role: "primary", ordinal: 0, preferred: true },
          { artifact_id: "artifact.b", role: "supplementary", ordinal: 1, preferred: false },
        ],
        [{
          type: "attachment_of",
          source_artifact_id: "artifact.b",
          target_artifact_id: "artifact.a",
          role: "attachment",
          ordinal: 0,
        }],
      ),
      root,
      "task.graph",
      "0.9.0",
    )).rejects.toMatchObject({ code: "cli_integrity_error" });
  });
});

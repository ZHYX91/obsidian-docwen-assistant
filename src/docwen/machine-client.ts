import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, realpath, stat } from "node:fs/promises";
import * as path from "node:path";

import { LocalCliError, RemoteMachineError } from "./errors";
import { encodeMachineFrame, isJsonObject, MachineFrameDecoder, type JsonObject } from "./machine-framing";

export type { JsonObject } from "./machine-framing";

const CLIENT_NAME = "DocWen Obsidian Assistant";
const CLIENT_VERSION = "2.0.0";
const DEFAULT_QUERY_TIMEOUT_MS = 30_000;
const STDERR_LIMIT_BYTES = 256 * 1024;
const MAX_QUEUED_MESSAGES = 64;
const MAX_DEFERRED_MESSAGES = 64;
const CANCELLATION_GRACE_MS = 2_000;
const CLEAN_CLOSE_GRACE_MS = 2_000;
const TERMINATION_GRACE_MS = 1_000;
const FORCE_KILL_WAIT_MS = 2_000;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const SUPPORTED_DOCWEN_VERSION_PATTERN = /^0\.9\.(?:0|[1-9]\d*)$/u;
const EXIT_WAIT_EXPIRED = Symbol("exit_wait_expired");

export const ARTIFACT_BUNDLE_LIMITS = Object.freeze({
  artifacts: 1_024,
  entries: 1_024,
  relations: 4_096,
  artifactBytes: 512 * 1024 * 1024,
  totalBytes: 1024 * 1024 * 1024,
});

export type MachineInputHandle = {
  input_id: string;
  locator: { kind: "local_path"; path: string };
  kind: "document" | "resource";
  role:
    | "source"
    | "linked_resource"
    | "bibliography"
    | "citation_style"
    | "neutral_document"
    | "numbering_export_plan";
  logical_path: string;
  media_type: string;
  size_bytes: number;
  sha256: string;
};

export type MachineTaskRequest = {
  capability_id: string;
  inputs: readonly MachineInputHandle[];
  output: {
    staging_root: { kind: "local_path"; path: string };
    staging_policy: "require_empty";
  };
  options: JsonObject;
};

export type MachineCapability = {
  capability_id: string;
  operation: string;
  input_shape: {
    slots: Array<{
      role:
        | "source"
        | "linked_resource"
        | "bibliography"
        | "citation_style"
        | "neutral_document"
        | "numbering_export_plan";
      kind: "document" | "resource";
      media_types: string[];
      min_items: number;
      max_items?: number;
    }>;
    undeclared_roles: "reject";
  };
  output_media_types: string[];
  output_shape: {
    cardinality: "one" | "many";
    artifact_kinds: Array<"document" | "fragment" | "resource">;
    relation_types: string[];
    atomic_bundle: true;
  };
  options_schema: JsonObject;
  availability: "available" | "limited" | "unavailable";
  dependencies: JsonObject[];
  limitations: JsonObject[];
};

export type ValidatedBundleArtifact = {
  artifact_id: string;
  kind: "document" | "fragment" | "resource";
  locator: string;
  logical_path: string;
  suggested_name: string;
  media_type: string;
  size_bytes: number;
  sha256: string;
  absolutePath: string;
};

export type ValidatedArtifactBundle = {
  schema: "docwen.artifact_bundle.v2";
  bundle_id: string;
  task_id: string;
  producer: {
    name: "DocWen";
    product_version: string;
    machine_protocol: "docwen.machine.v1";
  };
  layout_schema: "docwen.artifact_layout.v1" | "docwen.document_node.v1";
  artifacts: ValidatedBundleArtifact[];
  entries: JsonObject[];
  relations: JsonObject[];
};

export type MachineTaskCompleted = {
  taskId: string;
  plan: JsonObject;
  bundle: ValidatedArtifactBundle;
  diagnostics: JsonObject[];
  metrics: JsonObject;
};

type PendingReader = {
  resolve: (message: JsonObject) => void;
  reject: (error: Error) => void;
};

class MessageQueue {
  private readonly messages: JsonObject[] = [];
  private readonly readers: PendingReader[] = [];
  private failure: Error | null = null;

  push(message: JsonObject): void {
    if (this.failure) return;
    const reader = this.readers.shift();
    if (reader) reader.resolve(message);
    else {
      if (this.messages.length >= MAX_QUEUED_MESSAGES) {
        throw outputLimitError("DocWen Machine Protocol queued too many messages.");
      }
      this.messages.push(message);
    }
  }

  fail(error: Error): void {
    if (this.failure) return;
    this.failure = error;
    this.messages.splice(0);
    for (const reader of this.readers.splice(0)) reader.reject(error);
  }

  next(): Promise<JsonObject> {
    if (this.failure) return Promise.reject(this.failure);
    const message = this.messages.shift();
    if (message) return Promise.resolve(message);
    return new Promise((resolve, reject) => this.readers.push({ resolve, reject }));
  }

  failureError(): Error | null {
    return this.failure;
  }
}

class MachineSession {
  private readonly queue = new MessageQueue();
  private readonly decoder = new MachineFrameDecoder();
  private readonly deferred: JsonObject[] = [];
  private readonly stderr: Buffer[] = [];
  private stderrBytes = 0;
  private nextRequestId = 0;
  private normalClose = false;
  private termination: Promise<void> | null = null;
  private readonly closed: Promise<number | null>;
  readonly child: ChildProcessWithoutNullStreams;

  constructor(binaryPath: string) {
    try {
      this.child = spawn(binaryPath, ["serve", "--stdio"], {
        cwd: path.dirname(binaryPath),
        env: boundedEnvironment(),
        detached: process.platform !== "win32",
        shell: false,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error) {
      throw new LocalCliError("cli_spawn_failed", "Unable to start DocWen Machine Protocol.", {
        cause: errorMessage(error),
      });
    }
    this.closed = new Promise((resolve) => {
      this.child.once("close", resolve);
      this.child.once("error", (error) => {
        const failure = new LocalCliError("cli_spawn_failed", "DocWen Machine Protocol process failed.", {
          cause: error.message,
        });
        this.queue.fail(failure);
        resolve(null);
      });
    });
    this.child.stdout.on("data", (chunk: Buffer) => {
      try {
        for (const message of this.decoder.feed(Buffer.from(chunk))) this.queue.push(message);
      } catch (error) {
        this.queue.fail(protocolError(error));
        void this.terminate().catch(() => undefined);
      }
    });
    this.child.stderr.on("data", (chunk: Buffer) => {
      const bytes = Buffer.from(chunk);
      this.stderrBytes += bytes.length;
      if (this.stderrBytes <= STDERR_LIMIT_BYTES) this.stderr.push(bytes);
      else {
        this.queue.fail(new LocalCliError("cli_output_limit", "DocWen Machine Protocol stderr exceeded its limit."));
        void this.terminate().catch(() => undefined);
      }
    });
    this.child.once("close", (code) => {
      try {
        this.decoder.finish();
      } catch (error) {
        this.queue.fail(protocolError(error));
        return;
      }
      if (!this.normalClose) {
        this.queue.fail(new LocalCliError("cli_protocol_error", "DocWen exited before the operation completed.", {
          exitCode: code,
        }));
      }
    });
  }

  async initialize(expectedProductVersion?: string): Promise<string> {
    const result = await this.rpc("initialize", {
      protocol: { name: "docwen.machine", major: 1, minor: 0 },
      client: { name: CLIENT_NAME, version: CLIENT_VERSION },
      features: { progress: true, cancellation: true },
    });
    const protocol = requiredObject(result.protocol, "initialize.protocol");
    if (protocol.name !== "docwen.machine" || protocol.major !== 1 || protocol.minor !== 0) {
      throw new LocalCliError("cli_incompatible_version", "DocWen Machine Protocol v1 is required.");
    }
    if (result.artifact_bundle_schema !== "docwen.artifact_bundle.v2") {
      throw new LocalCliError("cli_incompatible_version", "Artifact Bundle v2 is required.");
    }
    const server = requiredObject(result.server, "initialize.server");
    const productVersion = requiredString(server.version, "initialize.server.version");
    if (server.name !== "DocWen") {
      throw new LocalCliError("cli_incompatible_version", "The Machine server is not DocWen.");
    }
    if (!SUPPORTED_DOCWEN_VERSION_PATTERN.test(productVersion)) {
      throw new LocalCliError("cli_incompatible_version", "A stable DocWen 0.9.x version is required.", {
        actualProductVersion: productVersion,
      });
    }
    if (expectedProductVersion !== undefined && productVersion !== expectedProductVersion) {
      throw new LocalCliError("cli_incompatible_version", "The DocWen product version does not match the expected candidate.", {
        expectedProductVersion,
        actualProductVersion: productVersion,
      });
    }
    return productVersion;
  }

  async rpc(method: string, params: JsonObject): Promise<JsonObject> {
    const id = ++this.nextRequestId;
    this.send({ jsonrpc: "2.0", id, method, params });
    while (true) {
      const message = await this.queue.next();
      if (message.id !== id) {
        if (this.deferred.length >= MAX_DEFERRED_MESSAGES) {
          throw outputLimitError("DocWen Machine Protocol deferred too many messages.");
        }
        this.deferred.push(message);
        continue;
      }
      if (message.jsonrpc !== "2.0") throw protocolError(`invalid JSON-RPC response for ${method}`);
      if (isJsonObject(message.error)) throw remoteRpcError(message.error);
      return requiredObject(message.result, `${method}.result`);
    }
  }

  nextMessage(): Promise<JsonObject> {
    const message = this.deferred.shift();
    return message ? Promise.resolve(message) : this.queue.next();
  }

  requestCancellation(taskId: string): void {
    this.send({
      jsonrpc: "2.0",
      id: ++this.nextRequestId,
      method: "task/cancel",
      params: { task_id: taskId },
    });
  }

  fail(error: Error): void {
    this.queue.fail(error);
  }

  throwIfFailed(): void {
    const failure = this.queue.failureError();
    if (failure) throw failure;
  }

  async close(): Promise<void> {
    this.normalClose = true;
    this.child.stdin.end();
    const closeResult = await waitForExit(this.closed, CLEAN_CLOSE_GRACE_MS);
    if (closeResult === EXIT_WAIT_EXPIRED) {
      await this.terminate();
      throw new LocalCliError("cli_cleanup_failed", "DocWen did not exit after its stdin was closed.");
    }
    const code = closeResult;
    const terminalFailure = this.queue.failureError();
    if (terminalFailure) throw terminalFailure;
    let stderrText = Buffer.concat(this.stderr).toString("utf8");
    if (this.stderrBytes > STDERR_LIMIT_BYTES) stderrText += "\n<truncated>";
    if (code !== 0) {
      throw new LocalCliError("cli_protocol_error", "DocWen Machine Protocol exited with an error.", {
        exitCode: code,
        stderr: stderrText,
      });
    }
    if (stderrText.length > 0) {
      throw new LocalCliError("cli_protocol_error", "DocWen Machine Protocol wrote unexpected stderr.", {
        stderr: stderrText,
      });
    }
  }

  terminate(): Promise<void> {
    this.termination ??= this.terminateOnce();
    return this.termination;
  }

  private async terminateOnce(): Promise<void> {
    this.normalClose = true;
    await this.signalProcessTree(false);
    this.child.stdin.destroy();
    let closeResult = await waitForExit(this.closed, TERMINATION_GRACE_MS);
    if (closeResult !== EXIT_WAIT_EXPIRED) return;
    await this.signalProcessTree(true);
    closeResult = await waitForExit(this.closed, FORCE_KILL_WAIT_MS);
    if (closeResult === EXIT_WAIT_EXPIRED) {
      throw new LocalCliError("cli_cleanup_failed", "Unable to terminate the DocWen process tree.", {
        pid: this.child.pid,
      });
    }
  }

  private async signalProcessTree(force: boolean): Promise<void> {
    const pid = this.child.pid;
    if (process.platform === "win32" && typeof pid === "number" && pid > 0) {
      const windowsRoot = process.env.SystemRoot || process.env.WINDIR || "C:\\Windows";
      try {
        const killer = spawn(
          path.join(windowsRoot, "System32", "taskkill.exe"),
          ["/PID", String(pid), "/T", "/F"],
          {
            detached: false,
            env: boundedEnvironment(),
            shell: false,
            stdio: "ignore",
            timeout: TERMINATION_GRACE_MS,
            windowsHide: true,
          },
        );
        const killedTree = await new Promise<boolean>((resolve) => {
          let settled = false;
          const finish = (value: boolean): void => {
            if (settled) return;
            settled = true;
            resolve(value);
          };
          killer.once("error", () => finish(false));
          killer.once("close", (code) => finish(code === 0));
        });
        if (killedTree) return;
      } catch {
        // Fall through to direct termination when taskkill cannot be started.
      }
    }
    if (process.platform !== "win32" && typeof pid === "number" && pid > 0) {
      try {
        process.kill(-pid, force ? "SIGKILL" : "SIGTERM");
        return;
      } catch (error) {
        if (isErrno(error, "ESRCH")) {
          this.signalDirectly(force);
          return;
        }
      }
    }
    this.signalDirectly(force);
  }

  private signalDirectly(force: boolean): void {
    try {
      this.child.kill(force ? "SIGKILL" : "SIGTERM");
    } catch {
      // The bounded exit wait converts an unsuccessful signal into a cleanup failure.
    }
  }

  private send(message: JsonObject): void {
    const failure = this.queue.failureError();
    if (failure) throw failure;
    if (this.child.stdin.destroyed) throw protocolError("DocWen stdin is closed");
    this.child.stdin.write(encodeMachineFrame(message));
  }
}

export class DocWenMachineClient {
  private readonly activeSessions = new Set<MachineSession>();
  private disposed = false;

  constructor(
    private readonly resolveBinaryPath: () => string,
    private readonly resolveLocale: () => string,
    private readonly expectedProductVersion?: string,
  ) {}

  locale(): string {
    return this.resolveLocale();
  }

  query(method: string, params: JsonObject, signal?: AbortSignal, timeoutMs = DEFAULT_QUERY_TIMEOUT_MS): Promise<JsonObject> {
    return this.withSession(signal, timeoutMs, async (session) => session.rpc(method, params));
  }

  runTask(request: MachineTaskRequest, signal?: AbortSignal, timeoutMs = 10 * 60_000): Promise<MachineTaskCompleted> {
    return this.withSession(signal, timeoutMs, async (session, setTaskId, productVersion) => {
      const plan = await session.rpc("task/plan", request);
      const planId = requiredString(plan.plan_id, "task/plan.plan_id");
      const acceptance = await session.rpc("task/execute", { plan_id: planId });
      const taskId = requiredString(acceptance.task_id, "task/execute.task_id");
      if (acceptance.state !== "accepted") throw protocolError("task/execute did not accept the task");
      setTaskId(taskId);
      while (true) {
        const message = await session.nextMessage();
        if (message.id !== undefined) continue;
        if (message.method === "task/progress") continue;
        const params = requiredObject(message.params, "terminal.params");
        if (params.task_id !== taskId) throw protocolError("terminal task id does not match acceptance");
        if (message.method === "task/failed") throw remoteTaskError(params);
        if (message.method === "task/cancelled") {
          throw new LocalCliError("cli_cancelled", "DocWen task was cancelled.");
        }
        if (message.method !== "task/completed") throw protocolError("unexpected Machine notification");
        if (signal?.aborted) throw new LocalCliError("cli_cancelled", "DocWen task was cancelled.");
        const bundle = await validateArtifactBundle(
          params.bundle,
          request.output.staging_root.path,
          taskId,
          productVersion,
          () => {
            session.throwIfFailed();
            if (signal?.aborted) throw new LocalCliError("cli_cancelled", "DocWen task was cancelled.");
          },
        );
        return {
          taskId,
          plan,
          bundle,
          diagnostics: jsonObjectArray(params.diagnostics, "terminal.diagnostics"),
          metrics: requiredObject(params.metrics, "terminal.metrics"),
        };
      }
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const session of this.activeSessions) {
      session.fail(new LocalCliError("cli_cancelled", "DocWen operation was cancelled during plugin unload."));
      void session.terminate().catch(() => undefined);
    }
    this.activeSessions.clear();
  }

  private async withSession<T>(
    signal: AbortSignal | undefined,
    timeoutMs: number,
    body: (
      session: MachineSession,
      setTaskId: (taskId: string) => void,
      productVersion: string,
    ) => Promise<T>,
  ): Promise<T> {
    if (this.disposed) throw new LocalCliError("cli_spawn_failed", "DocWen client has been disposed.");
    if (signal?.aborted) throw new LocalCliError("cli_cancelled", "DocWen operation was cancelled.");
    const session = new MachineSession(this.resolveBinaryPath());
    this.activeSessions.add(session);
    let taskId: string | null = null;
    let timedOut = false;
    let abortHandled = false;
    let cancellationTimer: ReturnType<typeof setTimeout> | null = null;
    const timer = setTimeout(() => {
      timedOut = true;
      session.fail(new LocalCliError("cli_timeout", "DocWen Machine Protocol timed out.", { timeoutMs }));
      void session.terminate().catch(() => undefined);
    }, timeoutMs);
    timer.unref?.();
    const onAbort = (): void => {
      if (abortHandled) return;
      abortHandled = true;
      const cancellation = new LocalCliError("cli_cancelled", "DocWen operation was cancelled.");
      if (taskId) {
        try {
          session.requestCancellation(taskId);
        } catch {
          session.fail(cancellation);
          void session.terminate().catch(() => undefined);
          return;
        }
        cancellationTimer = setTimeout(() => {
          session.fail(cancellation);
          void session.terminate().catch(() => undefined);
        }, CANCELLATION_GRACE_MS);
        cancellationTimer.unref?.();
      } else {
        session.fail(cancellation);
        void session.terminate().catch(() => undefined);
      }
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
    try {
      const productVersion = await session.initialize(this.expectedProductVersion);
      if (this.disposed) {
        throw new LocalCliError("cli_cancelled", "DocWen operation was cancelled during plugin unload.");
      }
      if (signal?.aborted) throw new LocalCliError("cli_cancelled", "DocWen operation was cancelled.");
      const result = await body(session, (value) => { taskId = value; }, productVersion);
      if (signal?.aborted) throw new LocalCliError("cli_cancelled", "DocWen operation was cancelled.");
      await session.close();
      return result;
    } catch (error) {
      const primary = timedOut
        ? new LocalCliError("cli_timeout", "DocWen Machine Protocol timed out.", { timeoutMs })
        : error;
      try {
        await session.terminate();
      } catch (cleanupError) {
        throw new LocalCliError("cli_cleanup_failed", "Unable to clean up the DocWen process tree.", {
          primaryCode: primary instanceof LocalCliError ? primary.code : undefined,
          primaryCause: errorMessage(primary),
          cleanupCause: errorMessage(cleanupError),
        });
      }
      throw primary;
    } finally {
      clearTimeout(timer);
      if (cancellationTimer) clearTimeout(cancellationTimer);
      signal?.removeEventListener("abort", onAbort);
      this.activeSessions.delete(session);
    }
  }
}

export async function validateArtifactBundle(
  value: unknown,
  stagingRoot: string,
  taskId: string,
  productVersion: string,
  assertActive?: () => void,
): Promise<ValidatedArtifactBundle> {
  assertActive?.();
  const bundle = requiredObject(value, "bundle");
  if (
    bundle.schema !== "docwen.artifact_bundle.v2"
    || bundle.task_id !== taskId
  ) {
    throw integrityError("Artifact Bundle schema or task identity is invalid.");
  }
  const layoutSchema = bundle.layout_schema;
  if (
    layoutSchema !== "docwen.artifact_layout.v1"
    && layoutSchema !== "docwen.document_node.v1"
  ) {
    throw integrityError("Artifact Bundle layout schema is invalid.");
  }
  const validatedLayoutSchema = layoutSchema as "docwen.artifact_layout.v1" | "docwen.document_node.v1";
  const producer = requiredObject(bundle.producer, "bundle.producer");
  if (
    producer.name !== "DocWen"
    || producer.machine_protocol !== "docwen.machine.v1"
    || producer.product_version !== productVersion
  ) {
    throw integrityError("Artifact Bundle producer identity is invalid.");
  }
  const root = await realpath(stagingRoot);
  const rawArtifacts = objectArray(bundle.artifacts, "bundle.artifacts");
  if (rawArtifacts.length === 0) throw integrityError("Artifact Bundle is empty.");
  if (rawArtifacts.length > ARTIFACT_BUNDLE_LIMITS.artifacts) {
    throw outputLimitError("Artifact Bundle contains too many artifacts.", {
      actual: rawArtifacts.length,
      limit: ARTIFACT_BUNDLE_LIMITS.artifacts,
    });
  }
  let totalArtifactBytes = 0;
  for (const raw of rawArtifacts) {
    const artifactId = requiredString(raw.artifact_id, "artifact.artifact_id");
    const sizeBytes = requiredInteger(raw.size_bytes, "artifact.size_bytes");
    if (sizeBytes > ARTIFACT_BUNDLE_LIMITS.artifactBytes) {
      throw outputLimitError("Artifact exceeds the per-file byte limit.", {
        artifactId,
        actual: sizeBytes,
        limit: ARTIFACT_BUNDLE_LIMITS.artifactBytes,
      });
    }
    if (totalArtifactBytes > ARTIFACT_BUNDLE_LIMITS.totalBytes - sizeBytes) {
      throw outputLimitError("Artifact Bundle exceeds the total byte limit.", {
        limit: ARTIFACT_BUNDLE_LIMITS.totalBytes,
      });
    }
    totalArtifactBytes += sizeBytes;
  }
  const artifactIds = new Set<string>();
  const artifactLocators = new Set<string>();
  const artifacts: ValidatedBundleArtifact[] = [];
  for (const raw of rawArtifacts) {
    assertActive?.();
    const artifactId = requiredString(raw.artifact_id, "artifact.artifact_id");
    if (artifactIds.has(artifactId)) throw integrityError("Artifact Bundle contains duplicate artifact ids.");
    artifactIds.add(artifactId);
    const kind = raw.kind;
    if (kind !== "document" && kind !== "fragment" && kind !== "resource") {
      throw integrityError("Artifact Bundle contains an invalid artifact kind.");
    }
    const locator = safeLocator(raw.locator);
    if (artifactLocators.has(locator)) throw integrityError("Artifact Bundle contains duplicate locators.");
    artifactLocators.add(locator);
    const suggestedName = safeSuggestedName(raw.suggested_name);
    const logicalPath = safeLogicalPath(raw.logical_path);
    const mediaType = requiredString(raw.media_type, "artifact.media_type");
    const sizeBytes = requiredInteger(raw.size_bytes, "artifact.size_bytes");
    const sha256 = requiredString(raw.sha256, "artifact.sha256");
    if (!SHA256_PATTERN.test(sha256)) throw integrityError("Artifact sha256 is invalid.");
    const absolutePath = path.resolve(root, ...locator.split("/"));
    if (!isPathWithin(root, absolutePath)) throw integrityError("Artifact locator escapes staging.");
    const fileInfo = await lstat(absolutePath);
    if (!fileInfo.isFile() || fileInfo.isSymbolicLink()) throw integrityError("Artifact is not a regular file.");
    const canonicalPath = await realpath(absolutePath);
    if (!isPathWithin(root, canonicalPath)) throw integrityError("Artifact resolves outside staging.");
    const actual = await stat(canonicalPath);
    if (actual.size !== sizeBytes) throw integrityError("Artifact size does not match its manifest.");
    const digest = await sha256File(canonicalPath, sizeBytes, assertActive);
    if (digest !== sha256) throw integrityError("Artifact sha256 does not match its content.");
    const finalInfo = await lstat(absolutePath);
    const finalCanonicalPath = await realpath(absolutePath);
    if (
      !finalInfo.isFile()
      || finalInfo.isSymbolicLink()
      || !sameFilesystemIdentity(fileInfo, finalInfo)
      || !sameCanonicalPath(canonicalPath, finalCanonicalPath)
    ) {
      throw integrityError("Artifact identity changed during validation.");
    }
    artifacts.push({
      artifact_id: artifactId,
      kind,
      locator,
      logical_path: logicalPath,
      suggested_name: suggestedName,
      media_type: mediaType,
      size_bytes: sizeBytes,
      sha256,
      absolutePath: canonicalPath,
    });
  }
  const entries = objectArray(bundle.entries, "bundle.entries");
  if (entries.length === 0) throw integrityError("Artifact Bundle has no entries.");
  if (entries.length > ARTIFACT_BUNDLE_LIMITS.entries) {
    throw outputLimitError("Artifact Bundle contains too many entries.", {
      actual: entries.length,
      limit: ARTIFACT_BUNDLE_LIMITS.entries,
    });
  }
  const preferred = entries.filter((entry) => entry.preferred === true);
  if (preferred.length > 1) throw integrityError("Artifact Bundle has more than one preferred entry.");
  const entryIds = new Set<string>();
  const entryOrdinals = new Set<number>();
  for (const entry of entries) {
    const artifactId = requiredString(entry.artifact_id, "entry.artifact_id");
    if (!artifactIds.has(artifactId)) throw integrityError("Bundle entry references an unknown artifact.");
    const ordinal = requiredInteger(entry.ordinal, "entry.ordinal");
    if (entryIds.has(artifactId) || entryOrdinals.has(ordinal)) {
      throw integrityError("Artifact Bundle contains duplicate entries or entry ordinals.");
    }
    entryIds.add(artifactId);
    entryOrdinals.add(ordinal);
    if (typeof entry.preferred !== "boolean") throw integrityError("Bundle entry preferred flag is invalid.");
    const role = requiredString(entry.role, "entry.role");
    if (!["primary", "supplementary", "ocr_page", "section", "worksheet", "image", "original"].includes(role)) {
      throw integrityError("Bundle entry role is invalid.");
    }
    const artifact = artifacts.find((item) => item.artifact_id === artifactId)!;
    if (role === "ocr_page" && artifact.kind !== "fragment") throw integrityError("ocr_page entry is not a fragment.");
    if (role === "section" && artifact.kind !== "document" && artifact.kind !== "fragment") {
      throw integrityError("section entry is not a document or fragment.");
    }
    if (role === "image" && artifact.kind !== "resource") throw integrityError("image entry is not a resource.");
  }
  const relations = objectArray(bundle.relations, "bundle.relations");
  if (relations.length > ARTIFACT_BUNDLE_LIMITS.relations) {
    throw outputLimitError("Artifact Bundle contains too many relations.", {
      actual: relations.length,
      limit: ARTIFACT_BUNDLE_LIMITS.relations,
    });
  }
  const relationKeys = new Set<string>();
  const structuralOwners = new Set<string>();
  const orderedSlots = new Set<string>();
  const adjacency = new Map(artifacts.map((artifact) => [artifact.artifact_id, new Set<string>()]));
  const directed = new Map(artifacts.map((artifact) => [artifact.artifact_id, new Set<string>()]));
  const relationRoles: Record<string, readonly string[]> = {
    attachment_of: ["attachment"],
    fragment_of: ["ocr_page", "ocr_text", "section", "worksheet"],
    resource_of: ["image", "original", "preview", "worksheet", "manifest"],
    derived_from: ["source", "original"],
  };
  for (const relation of relations) {
    const type = requiredString(relation.type, "relation.type");
    const sourceId = requiredString(relation.source_artifact_id, "relation.source_artifact_id");
    const targetId = requiredString(relation.target_artifact_id, "relation.target_artifact_id");
    const role = requiredString(relation.role, "relation.role");
    if (!["attachment_of", "fragment_of", "resource_of", "derived_from"].includes(type)) {
      throw integrityError("Bundle relation type is invalid.");
    }
    if (!relationRoles[type]!.includes(role)) throw integrityError("Bundle relation role is invalid.");
    if (!artifactIds.has(sourceId) || !artifactIds.has(targetId) || sourceId === targetId) {
      throw integrityError("Bundle relation graph is invalid.");
    }
    const ordinal = relation.ordinal === undefined
      ? null
      : requiredInteger(relation.ordinal, "relation.ordinal");
    if ((type === "attachment_of" || type === "fragment_of") && ordinal === null) {
      throw integrityError("Ordered Bundle relation is missing an ordinal.");
    }
    const key = `${type}\u0000${sourceId}\u0000${targetId}\u0000${role}\u0000${String(ordinal)}`;
    if (relationKeys.has(key)) throw integrityError("Artifact Bundle contains duplicate relations.");
    relationKeys.add(key);
    const source = artifacts.find((item) => item.artifact_id === sourceId)!;
    const target = artifacts.find((item) => item.artifact_id === targetId)!;
    if (type === "attachment_of" && (source.kind !== "document" || target.kind !== "document")) {
      throw integrityError("attachment_of relation kinds are invalid.");
    }
    if (type === "fragment_of" && (source.kind !== "fragment" || target.kind !== "document")) {
      throw integrityError("fragment_of relation kinds are invalid.");
    }
    if (type === "resource_of" && (
      source.kind !== "resource" || (target.kind !== "document" && target.kind !== "fragment")
    )) {
      throw integrityError("resource_of relation kinds are invalid.");
    }
    if (type !== "derived_from") {
      if (structuralOwners.has(sourceId) || entryIds.has(sourceId)) {
        throw integrityError("Artifact has multiple roots or structural owners.");
      }
      structuralOwners.add(sourceId);
    }
    if (ordinal !== null) {
      const slot = `${type}\u0000${targetId}\u0000${ordinal}`;
      if (orderedSlots.has(slot)) throw integrityError("Bundle relation ordinal is duplicated.");
      orderedSlots.add(slot);
    }
    adjacency.get(sourceId)!.add(targetId);
    adjacency.get(targetId)!.add(sourceId);
    directed.get(sourceId)!.add(targetId);
  }
  const visitedForCycle = new Set<string>();
  const visit = (artifactId: string, active: Set<string>): void => {
    if (active.has(artifactId)) throw integrityError("Artifact Bundle relation graph contains a cycle.");
    if (visitedForCycle.has(artifactId)) return;
    active.add(artifactId);
    for (const targetId of directed.get(artifactId)!) visit(targetId, active);
    active.delete(artifactId);
    visitedForCycle.add(artifactId);
  };
  for (const artifactId of artifactIds) visit(artifactId, new Set());
  const reachable = new Set(entryIds);
  const pending = [...entryIds];
  while (pending.length > 0) {
    const artifactId = pending.pop()!;
    for (const neighbor of adjacency.get(artifactId)!) {
      if (reachable.has(neighbor)) continue;
      reachable.add(neighbor);
      pending.push(neighbor);
    }
  }
  if (reachable.size !== artifacts.length) throw integrityError("Artifact Bundle contains unreachable artifacts.");
  return {
    schema: bundle.schema,
    bundle_id: requiredString(bundle.bundle_id, "bundle.bundle_id"),
    task_id: taskId,
    producer: {
      name: "DocWen",
      product_version: producer.product_version,
      machine_protocol: "docwen.machine.v1",
    },
    layout_schema: validatedLayoutSchema,
    artifacts,
    entries,
    relations,
  };
}

function safeLogicalPath(value: unknown): string {
  const logicalPath = requiredString(value, "artifact.logical_path");
  if (
    logicalPath.includes("\\")
    || logicalPath.startsWith("/")
    || logicalPath.endsWith("/")
    || Buffer.byteLength(logicalPath, "utf8") > 4_096
  ) {
    throw integrityError("Artifact logical_path is not a portable relative path.");
  }
  const segments = logicalPath.split("/");
  if (segments.some((segment) => !isSafePortableFilenameSegment(segment))) {
    throw integrityError("Artifact logical_path contains an unsafe segment.");
  }
  return logicalPath;
}

function safeLocator(value: unknown): string {
  const locator = requiredString(value, "artifact.locator");
  if (
    locator.includes("\\")
    || locator.startsWith("/")
    || locator.endsWith("/")
    || Buffer.byteLength(locator, "utf8") > 4_096
  ) {
    throw integrityError("Artifact locator is not a portable relative path.");
  }
  const segments = locator.split("/");
  if (segments.some((segment) => !isSafePortableFilenameSegment(segment))) {
    throw integrityError("Artifact locator contains an unsafe segment.");
  }
  return locator;
}

function safeSuggestedName(value: unknown): string {
  const filename = requiredString(value, "artifact.suggested_name");
  if (
    path.basename(filename) !== filename
    || filename.includes("\\")
    || filename.includes("/")
    || !isSafePortableFilenameSegment(filename)
  ) {
    throw integrityError("Artifact suggested_name must be a safe portable filename.");
  }
  return filename;
}

function isSafePortableFilenameSegment(segment: string): boolean {
  const windowsDevice = /^(?:aux|con|nul|prn|com[1-9]|lpt[1-9])(?:\.|$)/iu;
  return segment.length > 0
    && segment !== "."
    && segment !== ".."
    && !segment.includes(":")
    && !segment.includes("\0")
    && !segment.endsWith(".")
    && !segment.endsWith(" ")
    && segment.length <= 240
    && Buffer.byteLength(segment, "utf8") <= 240
    && !windowsDevice.test(segment);
}

function requiredObject(value: unknown, field: string): JsonObject {
  if (!isJsonObject(value)) throw protocolError(`DocWen response is missing ${field}.`);
  return value;
}

function objectArray(value: unknown, field: string): JsonObject[] {
  if (!Array.isArray(value) || value.some((item) => !isJsonObject(item))) {
    throw protocolError(`DocWen response is missing ${field}.`);
  }
  return value as JsonObject[];
}

function jsonObjectArray(value: unknown, field: string): JsonObject[] {
  return objectArray(value, field);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) throw protocolError(`DocWen response is missing ${field}.`);
  return value;
}

function requiredInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw protocolError(`DocWen response has invalid ${field}.`);
  return value as number;
}

function protocolError(error: unknown): LocalCliError {
  return error instanceof LocalCliError
    ? error
    : new LocalCliError("cli_protocol_error", "DocWen Machine Protocol returned invalid data.", {
      cause: errorMessage(error),
    });
}

function integrityError(message: string): LocalCliError {
  return new LocalCliError("cli_integrity_error", message);
}

function outputLimitError(message: string, details: Record<string, unknown> = {}): LocalCliError {
  return new LocalCliError("cli_output_limit", message, details);
}

async function sha256File(
  filename: string,
  expectedBytes: number,
  assertActive?: () => void,
): Promise<string> {
  const hash = createHash("sha256");
  let bytesRead = 0;
  assertActive?.();
  for await (const chunk of createReadStream(filename)) {
    assertActive?.();
    bytesRead += chunk.length;
    if (bytesRead > expectedBytes) throw integrityError("Artifact grew while it was being hashed.");
    hash.update(chunk);
  }
  assertActive?.();
  if (bytesRead !== expectedBytes) throw integrityError("Artifact size changed while it was being hashed.");
  return hash.digest("hex");
}

function remoteRpcError(error: JsonObject): RemoteMachineError {
  const data = isJsonObject(error.data) ? error.data : {};
  return new RemoteMachineError(
    "protocol",
    typeof data.code === "string" ? data.code : `rpc.${String(error.code)}`,
    typeof data.message === "string" ? data.message : String(error.message || "DocWen request failed."),
    false,
    data,
  );
}

function remoteTaskError(params: JsonObject): RemoteMachineError {
  const error = requiredObject(params.error, "terminal.error");
  return new RemoteMachineError(
    typeof error.category === "string" ? error.category : "conversion_failed",
    typeof error.code === "string" ? error.code : "conversion_failed",
    typeof error.message === "string" ? error.message : "DocWen task failed.",
    error.retryable === true,
    isJsonObject(error.details) ? error.details : {},
  );
}

function waitForExit(
  closed: Promise<number | null>,
  timeoutMs: number,
): Promise<number | null | typeof EXIT_WAIT_EXPIRED> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(EXIT_WAIT_EXPIRED), timeoutMs);
    timer.unref?.();
    void closed.then((code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

function boundedEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const key of ["SystemRoot", "WINDIR", "COMSPEC", "PATH", "PATHEXT", "TEMP", "TMP", "LANG", "LC_ALL"]) {
    if (process.env[key]) environment[key] = process.env[key];
  }
  environment.NO_COLOR = "1";
  environment.PYTHONIOENCODING = "utf-8";
  environment.PYTHONUTF8 = "1";
  return environment;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isErrno(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function sameFilesystemIdentity(
  left: { dev: number; ino: number; mtimeMs: number; size: number },
  right: { dev: number; ino: number; mtimeMs: number; size: number },
): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.size === right.size
    && left.mtimeMs === right.mtimeMs;
}

function sameCanonicalPath(left: string, right: string): boolean {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  return process.platform === "win32"
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function isPathWithin(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative !== ""
    && relative !== ".."
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative);
}

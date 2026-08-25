import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants, createReadStream } from "node:fs";
import {
  copyFile,
  link,
  lstat,
  mkdir,
  mkdtemp,
  realpath,
  rm,
} from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";

import { LocalCliError } from "./errors";
import {
  DocWenMachineClient,
  type JsonObject,
  type MachineCapability,
  type MachineInputHandle,
  type MachineTaskCompleted,
  type ValidatedArtifactBundle,
  type ValidatedBundleArtifact,
} from "./machine-client";

export const INPUT_HANDLE_LIMITS = Object.freeze({
  count: 256,
  fileBytes: 512 * 1024 * 1024,
  totalBytes: 1024 * 1024 * 1024,
});
export const PROOFREAD_REPORT_LIMIT_BYTES = 16 * 1024 * 1024;

export type ProofreadCheck = "typo" | "symbol" | "punct" | "sensitive" | "all" | "none";
export type ConvertTarget = "md" | "docx" | "xlsx";

export interface ConvertOptions {
  target: ConvertTarget;
  template?: string;
  optimization?: string;
  checks?: readonly ProofreadCheck[];
  overwrite?: boolean;
  extractImages?: boolean;
  enableOcr?: boolean;
  ocrLanguage?: "auto" | "chinese" | "chinese_cht" | "english" | "japanese" | "korean" | "latin" | "cyrillic";
  imageMode?: "file" | "base64" | "embed" | "omit";
  imageLinkStyle?: "wiki_embed" | "wiki_link" | "markdown_embed" | "markdown_link";
  tableMergeStrategy?: "fill" | "empty" | "marker" | "replicate";
  ocrPlacement?: "image_md" | "main_md";
  cleanNumbering?: "remove" | "keep";
  addNumbering?: string;
  headingMergeMode?: "always" | "never";
  headingNumberingRenderMode?: "text" | "word_native";
  useDetectedFormat?: boolean;
}

export interface ConvertRequest extends ConvertOptions {
  inputs: readonly TaskInput[];
  /** Original user-selected input used only for inspection and route selection. */
  sourceInput?: TaskInput;
  outputPath: string;
  capabilityId?: string;
}

/** A caller-selected input. Core receives only its isolated local copy. */
export interface TaskInput {
  readonly path: string;
  readonly kind: "document" | "resource";
  readonly role:
    | "source"
    | "linked_resource"
    | "bibliography"
    | "citation_style"
    | "neutral_document"
    | "numbering_export_plan";
  readonly logicalPath: string;
  readonly mediaType?: string;
}

type InputReference = TaskInput | string;

export interface ConversionOutcome {
  output: string;
  outputs: string[];
  bundleId: string;
}

export interface TemplateItem {
  id: string;
  name: string;
  target: string;
  description?: string;
}

export interface OptimizationItem {
  id: string;
  name: string;
  description?: string;
  scopes: string[];
}

export interface NumberingSchemeItem {
  id: string;
  name: string;
  description?: string;
}

export interface ProofreadIssue {
  range: {
    start: ProofreadPosition;
    end: ProofreadPosition;
  };
  matched_text: string;
  error_text: string;
  suggestion: string;
  error_type: string;
  source: string;
  rule_key: string;
  fix?: {
    kind: "replace_text";
    replacement: string;
    applicable: true;
  };
}

export interface ProofreadPosition {
  offset: number;
  line: number;
  column: number;
}

export interface ValidateReport {
  file: string;
  issues: ProofreadIssue[];
}

export interface FileInspection {
  filePath: string;
  contentSha256: string;
  sizeBytes: number;
  decision: string;
  supportedActions: string[];
  declaredFormat: string;
  detectedFormat: string;
  warningCode: string;
  reasonCode: string;
  workflowCategory: string;
  mediaType: string;
}

export interface RuntimeRoute {
  source: string;
  target: string;
  operation: "conversion" | "action";
  action: string | null;
  available: boolean;
  state: string;
  options: string[];
  capabilityId: string;
  inputShape: MachineCapability["input_shape"];
}

export interface RuntimeSource {
  id: string;
  category: string;
  available: boolean;
  routes: RuntimeRoute[];
}

export interface RuntimeCapabilityProjection {
  contractId: "docwen.machine.v1";
  capabilities: MachineCapability[];
}

export interface HealthReport {
  allOk: boolean;
  checks: Array<{ id: string; status: string; message?: string }>;
}

export class DocWenClient {
  constructor(readonly machine: DocWenMachineClient) {}

  dispose(): void {
    this.machine.dispose();
  }

  async doctor(signal?: AbortSignal): Promise<HealthReport> {
    const result = await this.machine.query("health/check", {}, signal);
    const checks = objectArray(result.checks, "health/check.checks").map((item) => ({
      id: stringValue(item.id) || "check",
      status: item.ok === true ? "ok" : "error",
      message: stringValue(item.message) || undefined,
    }));
    return { allOk: result.all_ok === true, checks };
  }

  guiStatus(signal?: AbortSignal): Promise<JsonObject> {
    return this.machine.query("gui/status", { timeout_seconds: 5 }, signal);
  }

  guiActivate(signal?: AbortSignal): Promise<JsonObject> {
    return this.machine.query("gui/activate", { timeout_seconds: 5 }, signal);
  }

  guiOpen(filePath?: string, signal?: AbortSignal): Promise<JsonObject> {
    return this.machine.query(
      "gui/open",
      { timeout_seconds: 10, ...(filePath ? { file_path: filePath } : {}) },
      signal,
    );
  }

  async inspect(input: InputReference, signal?: AbortSignal): Promise<FileInspection> {
    const source = typeof input === "string" ? sourceTaskInput(input, "document") : input;
    const handle = await inputHandle(source, "input.inspect", await inspectInputFile(source), signal);
    const result = await this.machine.query("file/inspect", { input: handle }, signal);
    return {
      filePath: stringValue(result.file_path) || source.path,
      contentSha256: requiredStringValue(result.content_sha256, "file/inspect.content_sha256"),
      sizeBytes: requiredInteger(result.size_bytes, "file/inspect.size_bytes"),
      decision: requiredStringValue(result.decision, "file/inspect.decision"),
      supportedActions: stringArray(result.supported_actions),
      declaredFormat: requiredStringValue(result.declared_format, "file/inspect.declared_format"),
      detectedFormat: requiredStringValue(result.detected_format, "file/inspect.detected_format"),
      warningCode: stringValue(result.warning_code),
      reasonCode: stringValue(result.reason_code),
      workflowCategory: requiredStringValue(result.workflow_category, "file/inspect.workflow_category"),
      mediaType: mediaTypeForFormat(requiredStringValue(result.detected_format, "file/inspect.detected_format")),
    };
  }

  async runtimeCapabilities(signal?: AbortSignal): Promise<RuntimeCapabilityProjection> {
    const result = await this.machine.query("capability/list", {}, signal);
    const capabilities = objectArray(result.capabilities, "capability/list.capabilities").map(normalizeCapability);
    return { contractId: "docwen.machine.v1", capabilities };
  }

  async templates(target?: string, signal?: AbortSignal): Promise<TemplateItem[]> {
    const resources = await this.listResources("templates", target, signal);
    return resources.map((item) => ({
      id: requiredStringValue(item.id, "template.id"),
      name: requiredStringValue(item.name, "template.name"),
      target: stringValue(item.target),
      description: stringValue(item.description) || undefined,
    }));
  }

  async optimizations(signal?: AbortSignal): Promise<OptimizationItem[]> {
    const resources = await this.listResources("optimizations", undefined, signal);
    return resources.map((item) => ({
      id: requiredStringValue(item.id, "optimization.id"),
      name: requiredStringValue(item.name, "optimization.name"),
      description: stringValue(item.description) || undefined,
      scopes: stringArray(item.scopes),
    }));
  }

  async numberingSchemes(signal?: AbortSignal): Promise<NumberingSchemeItem[]> {
    const resources = await this.listResources("numbering-schemes", undefined, signal);
    return resources.map((item) => ({
      id: requiredStringValue(item.id, "numbering-scheme.id"),
      name: requiredStringValue(item.name, "numbering-scheme.name"),
      description: stringValue(item.description) || undefined,
    }));
  }

  async convert(request: ConvertRequest, signal?: AbortSignal): Promise<ConversionOutcome> {
    if (request.optimization) {
      throw new LocalCliError(
        "cli_invalid_envelope",
        "The selected optimization is not exposed by the Machine capability contract.",
      );
    }
    const source = request.sourceInput ?? requiredSourceInput(request.inputs);
    const inspection = await this.inspect(source, signal);
    const capabilityId = request.capabilityId ?? conversionCapabilityId(inspection.mediaType, request.target);
    const options = conversionOptions(request, inspection.mediaType);
    return this.runDeliverableTask(
      capabilityId,
      request.inputs,
      options,
      request.outputPath,
      request.overwrite === true,
      signal,
    );
  }

  async validate(
    input: TaskInput | string,
    checks: readonly ProofreadCheck[],
    signal?: AbortSignal,
  ): Promise<ValidateReport> {
    const source = typeof input === "string" ? sourceTaskInput(input, "document") : input;
    const inspection = await this.inspect(source, signal);
    if (inspection.mediaType !== "text/markdown") {
      throw new LocalCliError("cli_invalid_envelope", "Machine v1 proofreading currently accepts Markdown input.");
    }
    return this.withTaskStaging(async (stagingRoot) => {
      const request = await taskRequest(
        "validate.markdown",
        [source],
        stagingRoot,
        proofreadOptions(checks),
        signal,
      );
      const result = await this.machine.runTask(
        request,
        signal,
      );
      const artifact = preferredArtifact(result.bundle);
      if (artifact.kind !== "resource" || artifact.media_type !== "application/json") {
        throw new LocalCliError("cli_integrity_error", "Proofreading did not return a JSON report resource.");
      }
      if (artifact.size_bytes > PROOFREAD_REPORT_LIMIT_BYTES) {
        throw new LocalCliError("cli_output_limit", "Proofreading report exceeds its byte limit.", {
          actual: artifact.size_bytes,
          limit: PROOFREAD_REPORT_LIMIT_BYTES,
        });
      }
      let reportValue: unknown;
      try {
        reportValue = JSON.parse(await readValidatedArtifactText(artifact, PROOFREAD_REPORT_LIMIT_BYTES));
      } catch (error) {
        if (error instanceof LocalCliError) throw error;
        throw new LocalCliError("cli_integrity_error", "Proofreading returned invalid JSON.", {
          cause: errorMessage(error),
        });
      }
      const report = parseReport(reportValue, request.inputs[0]!.sha256);
      return report;
    });
  }

  async numberMarkdown(
    inputPath: string,
    outputPath: string,
    operation: "add" | "remove",
    scheme?: string,
    signal?: AbortSignal,
    logicalPath = path.basename(inputPath),
  ): Promise<ConversionOutcome> {
    if (operation === "add" && !scheme) {
      throw new LocalCliError("cli_invalid_envelope", "A numbering scheme is required when adding numbering.");
    }
    return this.runDeliverableTask(
      "transform.markdown.heading_numbering",
      [{ ...sourceTaskInput(inputPath, "document", "text/markdown"), logicalPath }],
      {
        remove_numbering: true,
        add_numbering: operation === "add",
        numbering_scheme: operation === "add" ? scheme! : "gongwen_standard",
      },
      outputPath,
      true,
      signal,
    );
  }

  private async listResources(kind: string, target: string | undefined, signal?: AbortSignal): Promise<JsonObject[]> {
    const result = await this.machine.query(
      "resource/list",
      { kind, locale: this.machine.locale(), ...(target ? { target } : {}) },
      signal,
    );
    if (result.kind !== kind) throw invalidResponse("resource/list.kind");
    return objectArray(result.resources, "resource/list.resources");
  }

  private async runDeliverableTask(
    capabilityId: string,
    inputs: readonly TaskInput[],
    options: JsonObject,
    outputPath: string,
    overwrite: boolean,
    signal?: AbortSignal,
  ): Promise<ConversionOutcome> {
    return this.withTaskStaging(async (stagingRoot) => {
      const result = await this.machine.runTask(
        await taskRequest(capabilityId, inputs, stagingRoot, options, signal),
        signal,
      );
      const outputs = await atomicCommitBundle(result.bundle, outputPath, overwrite);
      return { output: outputs[0]!, outputs, bundleId: result.bundle.bundle_id };
    });
  }

  private async withTaskStaging<T>(body: (stagingRoot: string) => Promise<T>): Promise<T> {
    const stagingRoot = await mkdtemp(path.join(tmpdir(), "docwen-assistant-machine-"));
    let bodyCompleted = false;
    try {
      const result = await body(stagingRoot);
      bodyCompleted = true;
      try {
        await rm(stagingRoot, { recursive: true, force: true });
      } catch (error) {
        throw new LocalCliError("cli_cleanup_failed", "Unable to remove DocWen task staging.", {
          stagingRoot,
          cause: errorMessage(error),
        });
      }
      return result;
    } catch (error) {
      if (!bodyCompleted) await rm(stagingRoot, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }
  }
}

type FileIdentity = {
  dev: number;
  ino: number;
  mtimeMs: number;
  size: number;
};

type PreparedOutput = {
  backup: string | null;
  expectedTarget: FileIdentity | null;
  target: string;
  temporary: string;
  temporaryIdentity: FileIdentity;
};

export async function atomicCommitBundle(
  bundle: ValidatedArtifactBundle,
  outputPath: string,
  overwrite: boolean,
): Promise<string[]> {
  const preferred = preferredArtifact(bundle);
  const destinationRoot = path.dirname(path.resolve(outputPath));
  await mkdir(destinationRoot, { recursive: true });
  const orderedArtifacts = [preferred, ...bundle.artifacts.filter((artifact) => artifact !== preferred)];
  const targets = orderedArtifacts.map((artifact) => ({
    artifact,
    allowOverwrite: artifact.artifact_id === preferred.artifact_id && overwrite,
    target: artifact.artifact_id === preferred.artifact_id
      ? path.resolve(outputPath)
      : path.join(destinationRoot, artifact.suggested_name),
  }));
  const normalizedTargets = targets.map(({ target }) => target.toLowerCase());
  if (new Set(normalizedTargets).size !== targets.length) {
    throw new LocalCliError("cli_commit_failed", "Artifact Bundle maps multiple artifacts to the same output path.");
  }
  const transactionId = randomUUID();
  const prepared: PreparedOutput[] = [];
  const committed: Array<{ identity: FileIdentity; target: string }> = [];
  try {
    for (let index = 0; index < targets.length; index += 1) {
      const { allowOverwrite, artifact, target } = targets[index]!;
      const expectedTarget = await inspectCommitTarget(target, allowOverwrite);
      const temporary = path.join(destinationRoot, `.docwen-${transactionId}-${index}.new`);
      await verifyArtifactIdentity(artifact, artifact.absolutePath, true);
      await copyFile(artifact.absolutePath, temporary, fsConstants.COPYFILE_EXCL);
      const initialTemporaryIdentity = await regularFileIdentity(temporary);
      const preparedOutput: PreparedOutput = {
        backup: null,
        expectedTarget,
        target,
        temporary,
        temporaryIdentity: initialTemporaryIdentity,
      };
      prepared.push(preparedOutput);
      preparedOutput.temporaryIdentity = await verifyArtifactIdentity(artifact, temporary, false);
      await verifyArtifactIdentity(artifact, artifact.absolutePath, true);
    }
    for (let index = 0; index < prepared.length; index += 1) {
      const item = prepared[index]!;
      await assertCommitTargetUnchanged(item.target, item.expectedTarget);
      if (item.expectedTarget) {
        item.backup = path.join(destinationRoot, `.docwen-${transactionId}-${index}.bak`);
        await link(item.target, item.backup);
        const backupIdentity = await regularFileIdentity(item.backup);
        if (!sameFileIdentity(backupIdentity, item.expectedTarget)) {
          throw new Error(`Output target changed while its backup was being created: ${item.target}`);
        }
        await rm(item.target);
        const retainedIdentity = await regularFileIdentity(item.backup);
        if (!sameFileIdentity(retainedIdentity, item.expectedTarget)) {
          throw new Error(`Output backup changed while its target was being removed: ${item.target}`);
        }
      }
    }
    for (const item of prepared) {
      await link(item.temporary, item.target);
      const [targetIdentity, temporaryIdentity] = await Promise.all([
        regularFileIdentity(item.target),
        regularFileIdentity(item.temporary),
      ]);
      item.temporaryIdentity = temporaryIdentity;
      if (!sameFileIdentity(targetIdentity, temporaryIdentity)) {
        throw new Error(`Committed output identity does not match its prepared artifact: ${item.target}`);
      }
      committed.push({ identity: targetIdentity, target: item.target });
      await rm(item.temporary);
    }
    for (const item of prepared) {
      if (!item.backup) continue;
      const backupIdentity = await regularFileIdentity(item.backup);
      if (!sameFileIdentity(backupIdentity, item.expectedTarget!)) {
        throw new Error(`Output backup identity changed before cleanup: ${item.backup}`);
      }
      await rm(item.backup);
    }
    return targets.map(({ target }) => target);
  } catch (error) {
    const cleanupFailures: string[] = [];
    for (const item of committed.reverse()) {
      try {
        const current = await regularFileIdentity(item.target);
        if (!sameFileIdentity(current, item.identity)) {
          cleanupFailures.push(`committed output changed and was preserved: ${item.target}`);
          continue;
        }
        await rm(item.target);
      } catch (cleanupError) {
        if (!isErrno(cleanupError, "ENOENT")) cleanupFailures.push(errorMessage(cleanupError));
      }
    }
    for (const item of prepared.slice().reverse()) {
      try {
        const temporaryIdentity = await regularFileIdentity(item.temporary);
        if (sameFileIdentity(temporaryIdentity, item.temporaryIdentity)) await rm(item.temporary);
        else cleanupFailures.push(`prepared output changed and was preserved: ${item.temporary}`);
      } catch (cleanupError) {
        if (!isErrno(cleanupError, "ENOENT")) cleanupFailures.push(errorMessage(cleanupError));
      }
      if (item.backup) {
        try {
          const backupIdentity = await regularFileIdentity(item.backup);
          if (!sameFileIdentity(backupIdentity, item.expectedTarget!)) {
            cleanupFailures.push(`backup changed and was preserved: ${item.backup}`);
            continue;
          }
          let targetIdentity: FileIdentity | null;
          try {
            targetIdentity = await regularFileIdentity(item.target);
          } catch (targetError) {
            if (!isErrno(targetError, "ENOENT")) throw targetError;
            targetIdentity = null;
          }
          if (targetIdentity) {
            if (!sameFileIdentity(targetIdentity, item.expectedTarget!)) {
              cleanupFailures.push(`target changed and backup was preserved: ${item.target}`);
              continue;
            }
          } else {
            await link(item.backup, item.target);
            targetIdentity = await regularFileIdentity(item.target);
            if (!sameFileIdentity(targetIdentity, item.expectedTarget!)) {
              cleanupFailures.push(`restored target identity mismatch; backup preserved: ${item.target}`);
              continue;
            }
          }
          await rm(item.backup);
        } catch (cleanupError) {
          cleanupFailures.push(`backup retained at ${item.backup}: ${errorMessage(cleanupError)}`);
        }
      }
    }
    throw new LocalCliError("cli_commit_failed", "Unable to commit the DocWen Artifact Bundle.", {
      cause: errorMessage(error),
      ...(cleanupFailures.length > 0 ? { cleanupFailures } : {}),
    });
  }
}

async function taskRequest(
  capabilityId: string,
  inputs: readonly TaskInput[],
  stagingRoot: string,
  options: JsonObject,
  signal?: AbortSignal,
): Promise<{
  capability_id: string;
  inputs: MachineInputHandle[];
  output: { staging_root: { kind: "local_path"; path: string }; staging_policy: "require_empty" };
  options: JsonObject;
}> {
  if (inputs.length === 0) {
    throw new LocalCliError("cli_input_invalid", "DocWen tasks require at least one input.");
  }
  if (inputs.length > INPUT_HANDLE_LIMITS.count) {
    throw inputLimitError("DocWen task contains too many input files.", {
      actual: inputs.length,
      limit: INPUT_HANDLE_LIMITS.count,
    });
  }
  const logicalPaths = new Set<string>();
  for (const input of inputs) {
    const logicalPath = normalizeLogicalPath(input.logicalPath);
    if (logicalPaths.has(logicalPath)) {
      throw new LocalCliError("cli_input_invalid", "DocWen task logical_path values must be unique.", { logicalPath });
    }
    logicalPaths.add(logicalPath);
  }
  const inspected: InputFileInspection[] = [];
  let totalBytes = 0;
  for (const input of inputs) {
    throwIfAborted(signal);
    const inspection = await inspectInputFile(input);
    if (inspection.identity.size > INPUT_HANDLE_LIMITS.fileBytes) {
      throw inputLimitError("DocWen input exceeds the per-file byte limit.", {
        actual: inspection.identity.size,
        limit: INPUT_HANDLE_LIMITS.fileBytes,
      });
    }
    if (totalBytes > INPUT_HANDLE_LIMITS.totalBytes - inspection.identity.size) {
      throw inputLimitError("DocWen task inputs exceed the total byte limit.", {
        limit: INPUT_HANDLE_LIMITS.totalBytes,
      });
    }
    totalBytes += inspection.identity.size;
    inspected.push(inspection);
  }
  const handles: MachineInputHandle[] = [];
  for (let index = 0; index < inputs.length; index += 1) {
    handles.push(await inputHandle(
      inputs[index]!,
      `input.${inputs[index]!.role}.${index + 1}`,
      inspected[index]!,
      signal,
    ));
  }
  return {
    capability_id: capabilityId,
    inputs: handles,
    output: {
      staging_root: { kind: "local_path", path: stagingRoot },
      staging_policy: "require_empty",
    },
    options,
  };
}

type InputFileInspection = {
  absolutePath: string;
  canonicalPath: string;
  identity: FileIdentity;
};

async function inspectInputFile(input: TaskInput): Promise<InputFileInspection> {
  const absolutePath = path.resolve(input.path);
  try {
    assertInputKindAndRole(input.kind, input.role);
    const fileInfo = await lstat(absolutePath);
    if (!fileInfo.isFile() || fileInfo.isSymbolicLink()) {
      throw new LocalCliError("cli_input_invalid", "DocWen input must be a regular file.", { filePath: absolutePath });
    }
    const identity = fileIdentity(fileInfo);
    if (identity.size > INPUT_HANDLE_LIMITS.fileBytes) {
      throw inputLimitError("DocWen input exceeds the per-file byte limit.", {
        actual: identity.size,
        limit: INPUT_HANDLE_LIMITS.fileBytes,
      });
    }
    return {
      absolutePath,
      canonicalPath: await realpath(absolutePath),
      identity,
    };
  } catch (error) {
    if (error instanceof LocalCliError) throw error;
    throw new LocalCliError("cli_input_invalid", "Unable to inspect the DocWen input file.", {
      filePath: absolutePath,
      cause: errorMessage(error),
    });
  }
}

async function inputHandle(
  input: TaskInput,
  inputId: string,
  inspected: InputFileInspection,
  signal?: AbortSignal,
): Promise<MachineInputHandle> {
  try {
    throwIfAborted(signal);
    const logicalPath = normalizeLogicalPath(input.logicalPath);
    const digest = await sha256File(inspected.absolutePath, inspected.identity.size, signal);
    throwIfAborted(signal);
    const finalInspection = await inspectInputFile(input);
    if (
      !sameFileIdentity(inspected.identity, finalInspection.identity)
      || !samePath(inspected.canonicalPath, finalInspection.canonicalPath)
    ) {
      throw new LocalCliError("cli_input_invalid", "DocWen input changed while its handle was prepared.", {
        filePath: inspected.absolutePath,
      });
    }
    return {
      input_id: inputId,
      locator: { kind: "local_path", path: inspected.absolutePath },
      kind: input.kind,
      role: input.role,
      logical_path: logicalPath,
      media_type: input.mediaType ?? mediaTypeForPath(inspected.absolutePath),
      size_bytes: inspected.identity.size,
      sha256: digest,
    };
  } catch (error) {
    if (error instanceof LocalCliError) throw error;
    throw new LocalCliError("cli_input_invalid", "Unable to read the DocWen input file.", {
      filePath: inspected.absolutePath,
      cause: errorMessage(error),
    });
  }
}

function sourceTaskInput(
  filePath: string,
  kind: "document" | "resource",
  mediaType?: string,
): TaskInput {
  return {
    path: filePath,
    kind,
    role: "source",
    logicalPath: path.basename(filePath),
    mediaType,
  };
}

function requiredSourceInput(inputs: readonly TaskInput[]): TaskInput {
  const sources = inputs.filter((input) => input.role === "source");
  if (sources.length !== 1) {
    throw new LocalCliError("cli_input_invalid", "DocWen tasks require exactly one source input.");
  }
  return sources[0]!;
}

function assertInputKindAndRole(kind: TaskInput["kind"], role: TaskInput["role"]): void {
  if (kind !== "document" && kind !== "resource") {
    throw new LocalCliError("cli_input_invalid", "DocWen input kind is invalid.", { kind, role });
  }
  if (
    role !== "source"
    && role !== "linked_resource"
    && role !== "bibliography"
    && role !== "citation_style"
    && role !== "neutral_document"
    && role !== "numbering_export_plan"
  ) {
    throw new LocalCliError("cli_input_invalid", "DocWen input role is invalid.", { kind, role });
  }
  if (role === "source") return;
  if (role === "neutral_document" && kind === "document") return;
  if (kind !== "resource") {
    throw new LocalCliError("cli_input_invalid", `${role} inputs must be resources.`, { kind, role });
  }
}

export function normalizeLogicalPath(value: string): string {
  if (
    !value
    || value.includes("\\")
    || value.includes("\u0000")
    || value.startsWith("/")
    || /^[a-z][a-z0-9+.-]*:/iu.test(value)
    || /^[a-z]:/iu.test(value)
  ) {
    throw new LocalCliError("cli_input_invalid", "DocWen input logical_path is invalid.", { logicalPath: value });
  }
  const segments = value.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new LocalCliError("cli_input_invalid", "DocWen input logical_path is invalid.", { logicalPath: value });
  }
  return value;
}

function conversionCapabilityId(inputMediaType: string, target: ConvertTarget): string {
  const key = `${inputMediaType}->${target}`;
  const mapping: Record<string, string> = {
    "text/markdown->docx": "convert.markdown.to_docx",
    "text/markdown->xlsx": "convert.markdown.to_xlsx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document->md": "convert.docx.to_markdown",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet->md": "convert.xlsx.to_markdown",
  };
  const capabilityId = mapping[key];
  if (!capabilityId) {
    throw new LocalCliError("cli_invalid_envelope", "No Machine conversion capability matches this request.", {
      inputMediaType,
      target,
    });
  }
  return capabilityId;
}

function conversionOptions(request: ConvertRequest, inputMediaType: string): JsonObject {
  const options: JsonObject = {};
  if (request.template) options.template_name = request.template;
  if (request.target === "md") {
    if (request.extractImages !== undefined) options.to_md_keep_images = request.extractImages;
    if (request.enableOcr !== undefined) options.to_md_enable_ocr = request.enableOcr;
    if (request.ocrLanguage) options.ocr_language = request.ocrLanguage;
    if (request.imageMode) options.image_mode = request.imageMode;
    if (request.imageLinkStyle) options.image_link_style = request.imageLinkStyle;
    if (request.ocrPlacement) options.ocr_placement = request.ocrPlacement;
    if (request.tableMergeStrategy) {
      options.table_merge_strategy = request.tableMergeStrategy === "replicate" ? "fill" : request.tableMergeStrategy;
    }
  }
  if (inputMediaType === "text/markdown") {
    if (request.cleanNumbering) options.remove_numbering = request.cleanNumbering === "remove";
    if (request.addNumbering) {
      options.add_numbering = request.addNumbering !== "none";
      if (request.addNumbering !== "none") options.numbering_scheme = request.addNumbering;
    }
    if (request.headingMergeMode) options.heading_merge_mode = request.headingMergeMode;
    if (request.headingNumberingRenderMode) {
      options.heading_numbering_render_mode = request.headingNumberingRenderMode;
    }
  }
  return options;
}

function proofreadOptions(checks: readonly ProofreadCheck[]): JsonObject {
  if (checks.length === 0) return {};
  if (checks.includes("none")) {
    return {
      enable_symbol_pairing: false,
      enable_symbol_correction: false,
      enable_typos_rule: false,
      enable_sensitive_word: false,
    };
  }
  const enabled = new Set(checks);
  if (enabled.has("all")) for (const check of ["punct", "typo", "symbol", "sensitive"] as const) enabled.add(check);
  return {
    enable_symbol_pairing: enabled.has("punct"),
    enable_symbol_correction: enabled.has("symbol"),
    enable_typos_rule: enabled.has("typo"),
    enable_sensitive_word: enabled.has("sensitive"),
  };
}

function preferredArtifact(bundle: ValidatedArtifactBundle): ValidatedBundleArtifact {
  const entry = bundle.entries.find((candidate) => candidate.preferred === true);
  const artifact = bundle.artifacts.find((candidate) => candidate.artifact_id === entry?.artifact_id);
  if (!artifact) throw new LocalCliError("cli_integrity_error", "Artifact Bundle preferred output is missing.");
  return artifact;
}

function parseReport(value: unknown, expectedSourceSha256: string): ValidateReport {
  if (!isObject(value)) throw invalidResponse("proofread report");
  const expectedRootKeys = new Set([
    "schema",
    "file",
    "source",
    "location_contract",
    "checks_enabled",
    "issues",
    "summary",
  ]);
  if (Object.keys(value).some((key) => !expectedRootKeys.has(key)) || Object.keys(value).length !== expectedRootKeys.size) {
    throw invalidResponse("proofread report fields");
  }
  if (value.schema !== "docwen.proofread_report.v2") throw invalidResponse("proofread report schema");
  const source = asObject(value.source);
  if (
    Object.keys(source).length !== 3
    || source.content_sha256 !== expectedSourceSha256
    || source.encoding !== "utf-8"
    || source.decode_errors !== "replace"
  ) {
    throw invalidResponse("proofread report source");
  }
  const location = asObject(value.location_contract);
  if (
    location.id !== "docwen.proofread-text-range"
    || location.version !== 1
    || location.coordinate_system !== "unicode_code_point"
    || location.offset_base !== 0
    || location.line_base !== 0
    || location.column_base !== 0
    || location.range_end !== "exclusive"
  ) {
    throw invalidResponse("proofread report location_contract");
  }
  const checks = asObject(value.checks_enabled);
  const checkKeys = ["symbol_pairing", "symbol_correction", "typos_rule", "sensitive_word"];
  if (
    Object.keys(checks).length !== checkKeys.length
    || checkKeys.some((key) => typeof checks[key] !== "boolean")
  ) {
    throw invalidResponse("proofread report checks_enabled");
  }
  const summary = asObject(value.summary);
  if (Object.values(summary).some((count) => !Number.isSafeInteger(count) || (count as number) < 1)) {
    throw invalidResponse("proofread report summary");
  }
  const rawIssues = objectArray(value.issues, "proofread report issues");
  return {
    file: requiredStringValue(value.file, "proofread report file"),
    issues: rawIssues.map(parseProofreadIssue),
  };
}

function parseProofreadIssue(item: JsonObject): ProofreadIssue {
  const allowedKeys = new Set([
    "range",
    "matched_text",
    "error_text",
    "suggestion",
    "error_type",
    "source",
    "rule_key",
    "fix",
  ]);
  if (Object.keys(item).some((key) => !allowedKeys.has(key))) throw invalidResponse("proofread issue fields");
  const range = asObject(item.range);
  if (Object.keys(range).length !== 2 || !("start" in range) || !("end" in range)) {
    throw invalidResponse("proofread issue range");
  }
  const start = parseProofreadPosition(range.start, "proofread issue range.start");
  const end = parseProofreadPosition(range.end, "proofread issue range.end");
  if (
    end.offset <= start.offset
    || end.line < start.line
    || (end.line === start.line && end.column <= start.column)
  ) {
    throw invalidResponse("proofread issue range");
  }
  const matchedText = requiredStringValue(item.matched_text, "proofread issue matched_text");
  const errorText = requiredTextValue(item.error_text, "proofread issue error_text");
  if (errorText !== matchedText) throw invalidResponse("proofread issue error_text");
  const issue: ProofreadIssue = {
    range: { start, end },
    matched_text: matchedText,
    error_text: errorText,
    suggestion: requiredTextValue(item.suggestion, "proofread issue suggestion"),
    error_type: requiredTextValue(item.error_type, "proofread issue error_type"),
    source: requiredStringValue(item.source, "proofread issue source"),
    rule_key: requiredStringValue(item.rule_key, "proofread issue rule_key"),
  };
  if (item.fix !== undefined) {
    const fix = asObject(item.fix);
    if (
      Object.keys(fix).some((key) => !["kind", "replacement", "applicable"].includes(key))
      || fix.kind !== "replace_text"
      || fix.applicable !== true
    ) {
      throw invalidResponse("proofread issue fix");
    }
    issue.fix = {
      kind: "replace_text",
      replacement: requiredTextValue(fix.replacement, "proofread issue fix.replacement"),
      applicable: true,
    };
  }
  return issue;
}

function parseProofreadPosition(value: unknown, field: string): ProofreadPosition {
  const position = asObject(value);
  if (
    Object.keys(position).length !== 3
    || Object.keys(position).some((key) => !["offset", "line", "column"].includes(key))
  ) {
    throw invalidResponse(field);
  }
  return {
    offset: requiredInteger(position.offset, `${field}.offset`),
    line: requiredInteger(position.line, `${field}.line`),
    column: requiredInteger(position.column, `${field}.column`),
  };
}

function normalizeCapability(item: JsonObject): MachineCapability {
  const availability = item.availability;
  if (availability !== "available" && availability !== "limited" && availability !== "unavailable") {
    throw invalidResponse("capability.availability");
  }
  if (item.input_media_types !== undefined) throw invalidResponse("capability.input_media_types");
  const inputShape = asObject(item.input_shape);
  if (inputShape.undeclared_roles !== "reject") throw invalidResponse("capability.input_shape.undeclared_roles");
  const roles = new Set<string>();
  const slots: MachineCapability["input_shape"]["slots"] = objectArray(
    inputShape.slots,
    "capability.input_shape.slots",
  ).map((slot) => {
    if (slot.slot_id !== undefined) throw invalidResponse("capability.input_shape.slots.slot_id");
    const role = slot.role as MachineCapability["input_shape"]["slots"][number]["role"];
    const kind = slot.kind as MachineCapability["input_shape"]["slots"][number]["kind"];
    const minItems = requiredInteger(slot.min_items, "capability.input_shape.slots.min_items");
    const maxItems = slot.max_items === undefined
      ? undefined
      : requiredInteger(slot.max_items, "capability.input_shape.slots.max_items");
    if (
      (
        role !== "source"
        && role !== "linked_resource"
        && role !== "bibliography"
        && role !== "citation_style"
        && role !== "neutral_document"
        && role !== "numbering_export_plan"
      )
      || (kind !== "document" && kind !== "resource")
      || roles.has(role)
      || (role === "neutral_document" ? kind !== "document" : role !== "source" && kind !== "resource")
      || (maxItems !== undefined && maxItems < minItems)
    ) {
      throw invalidResponse("capability.input_shape.slots");
    }
    roles.add(role);
    return { role, kind, media_types: nonEmptyStringArray(slot.media_types, "capability.input_shape.slots.media_types"), min_items: minItems, ...(maxItems === undefined ? {} : { max_items: maxItems }) };
  });
  if (slots.length === 0 || !slots.some((slot) => slot.min_items >= 1)) {
    throw invalidResponse("capability.input_shape.slots.required");
  }
  const outputShape = asObject(item.output_shape);
  const cardinality = outputShape.cardinality;
  if (cardinality !== "one" && cardinality !== "many") throw invalidResponse("capability.output_shape.cardinality");
  return {
    capability_id: requiredStringValue(item.capability_id, "capability.capability_id"),
    operation: requiredStringValue(item.operation, "capability.operation"),
    input_shape: { slots, undeclared_roles: "reject" },
    output_media_types: stringArray(item.output_media_types),
    output_shape: {
      cardinality,
      artifact_kinds: stringArray(outputShape.artifact_kinds) as Array<"document" | "fragment" | "resource">,
      relation_types: stringArray(outputShape.relation_types),
      atomic_bundle: true,
    },
    options_schema: asObject(item.options_schema),
    availability,
    dependencies: objectArray(item.dependencies, "capability.dependencies"),
    limitations: objectArray(item.limitations, "capability.limitations"),
  };
}

export function mediaTypeForPath(filePath: string): string {
  return mediaTypeForFormat(path.extname(filePath).slice(1));
}

function mediaTypeForFormat(format: string): string {
  const normalized = format.toLowerCase();
  const mapping: Record<string, string> = {
    md: "text/markdown",
    markdown: "text/markdown",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    bmp: "image/bmp",
    webp: "image/webp",
    tif: "image/tiff",
    tiff: "image/tiff",
  };
  return mapping[normalized] || "application/octet-stream";
}

async function inspectCommitTarget(target: string, allowOverwrite: boolean): Promise<FileIdentity | null> {
  if (!path.basename(target)) {
    throw new LocalCliError("cli_commit_failed", "The output target must be a file path.", { target });
  }
  let identity: FileIdentity;
  try {
    identity = await regularFileIdentity(target);
  } catch (error) {
    if (isErrno(error, "ENOENT")) return null;
    throw error;
  }
  if (!allowOverwrite) {
    throw new LocalCliError("cli_commit_failed", "An output artifact already exists.", { target });
  }
  return identity;
}

async function assertCommitTargetUnchanged(target: string, expected: FileIdentity | null): Promise<void> {
  let current: FileIdentity | null;
  try {
    current = await regularFileIdentity(target);
  } catch (error) {
    if (!isErrno(error, "ENOENT")) throw error;
    current = null;
  }
  if (
    (expected === null && current !== null)
    || (expected !== null && (current === null || !sameFileIdentity(current, expected)))
  ) {
    throw new LocalCliError("cli_commit_failed", "An output target changed before commit.", { target });
  }
}

async function verifyArtifactIdentity(
  artifact: ValidatedBundleArtifact,
  filePath: string,
  requireCanonicalPath: boolean,
): Promise<FileIdentity> {
  const before = await regularFileIdentity(filePath);
  if (before.size !== artifact.size_bytes) {
    throw new LocalCliError("cli_integrity_error", "Artifact size changed before commit.", {
      artifactId: artifact.artifact_id,
    });
  }
  if (requireCanonicalPath) {
    const canonical = await realpath(filePath);
    const left = path.resolve(canonical);
    const right = path.resolve(artifact.absolutePath);
    const samePath = process.platform === "win32"
      ? left.toLowerCase() === right.toLowerCase()
      : left === right;
    if (!samePath) {
      throw new LocalCliError("cli_integrity_error", "Artifact canonical path changed before commit.", {
        artifactId: artifact.artifact_id,
      });
    }
  }
  const digest = await sha256File(filePath, artifact.size_bytes);
  const after = await regularFileIdentity(filePath);
  if (!sameFileIdentity(before, after) || digest !== artifact.sha256) {
    throw new LocalCliError("cli_integrity_error", "Artifact identity changed before commit.", {
      artifactId: artifact.artifact_id,
    });
  }
  return after;
}

async function readValidatedArtifactText(
  artifact: ValidatedBundleArtifact,
  limitBytes: number,
): Promise<string> {
  try {
    await verifyArtifactIdentity(artifact, artifact.absolutePath, true);
    const chunks: Buffer[] = [];
    let bytesRead = 0;
    for await (const chunk of createReadStream(artifact.absolutePath)) {
      const bytes = Buffer.from(chunk);
      bytesRead += bytes.length;
      if (bytesRead > artifact.size_bytes || bytesRead > limitBytes) {
        throw new LocalCliError("cli_integrity_error", "Artifact grew while it was being read.", {
          artifactId: artifact.artifact_id,
        });
      }
      chunks.push(bytes);
    }
    if (bytesRead !== artifact.size_bytes) {
      throw new LocalCliError("cli_integrity_error", "Artifact size changed while it was being read.", {
        artifactId: artifact.artifact_id,
      });
    }
    await verifyArtifactIdentity(artifact, artifact.absolutePath, true);
    return Buffer.concat(chunks, bytesRead).toString("utf8");
  } catch (error) {
    if (error instanceof LocalCliError && error.code === "cli_integrity_error") throw error;
    throw new LocalCliError("cli_integrity_error", "Unable to revalidate the Artifact Bundle report.", {
      artifactId: artifact.artifact_id,
      cause: errorMessage(error),
    });
  }
}

async function regularFileIdentity(filePath: string): Promise<FileIdentity> {
  const value = await lstat(filePath);
  if (!value.isFile() || value.isSymbolicLink()) {
    throw new LocalCliError("cli_commit_failed", "Commit paths must be regular non-link files.", { filePath });
  }
  return fileIdentity(value);
}

function fileIdentity(value: { dev: number; ino: number; mtimeMs: number; size: number }): FileIdentity {
  return {
    dev: value.dev,
    ino: value.ino,
    mtimeMs: value.mtimeMs,
    size: value.size,
  };
}

function sameFileIdentity(left: FileIdentity, right: FileIdentity): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.size === right.size
    && left.mtimeMs === right.mtimeMs;
}

function samePath(left: string, right: string): boolean {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  return process.platform === "win32"
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

async function sha256File(
  filePath: string,
  expectedBytes: number,
  signal?: AbortSignal,
): Promise<string> {
  const hash = createHash("sha256");
  let bytesRead = 0;
  throwIfAborted(signal);
  for await (const chunk of createReadStream(filePath)) {
    throwIfAborted(signal);
    bytesRead += chunk.length;
    if (bytesRead > expectedBytes) {
      throw new LocalCliError("cli_integrity_error", "File grew while it was being hashed.", { filePath });
    }
    hash.update(chunk);
  }
  if (bytesRead !== expectedBytes) {
    throw new LocalCliError("cli_integrity_error", "File size changed while it was being hashed.", { filePath });
  }
  return hash.digest("hex");
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new LocalCliError("cli_cancelled", "DocWen operation was cancelled.");
}

function objectArray(value: unknown, field: string): JsonObject[] {
  if (!Array.isArray(value) || value.some((item) => !isObject(item))) throw invalidResponse(field);
  return value as JsonObject[];
}

function asObject(value: unknown): JsonObject {
  if (!isObject(value)) throw invalidResponse("object");
  return value;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw invalidResponse("string array");
  return [...value];
}

function nonEmptyStringArray(value: unknown, field: string): string[] {
  const values = stringArray(value);
  if (values.length === 0 || values.some((item) => item.length === 0)) throw invalidResponse(field);
  return values;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function requiredStringValue(value: unknown, field: string): string {
  const text = stringValue(value);
  if (!text) throw invalidResponse(field);
  return text;
}

function requiredTextValue(value: unknown, field: string): string {
  if (typeof value !== "string") throw invalidResponse(field);
  return value;
}

function requiredInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw invalidResponse(field);
  return value as number;
}

function invalidResponse(field: string): LocalCliError {
  return new LocalCliError("cli_invalid_envelope", `DocWen Machine response is missing ${field}.`, { field });
}

function inputLimitError(message: string, details: Record<string, unknown>): LocalCliError {
  return new LocalCliError("cli_input_invalid", message, details);
}

function isErrno(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export type { JsonObject, MachineCapability, MachineTaskCompleted };

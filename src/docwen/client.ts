import {
  type FileIdentity,
  preferredArtifact,
  verifyArtifactIdentity,
  fileIdentity,
  sameFileIdentity,
  samePath,
  sha256File,
  throwIfAborted,
} from "./output-integrity";
import { createReadStream } from "node:fs";
import {
  lstat,
  mkdtemp,
  realpath,
  rm,
} from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";

import { LocalCliError } from "./errors";
import { selectConversionCapability } from "./conversion-selection";
import { atomicCommitBundle } from "./output-files";
import { operationWarning, recordFailureWarning, type OperationWarning } from "./operation-outcome";
import { atomicCommitDirectory, captureOutputDirectory, type DirectoryPublication } from "./output-directory";
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

const DOCX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type ProofreadCheck = "typo" | "symbol" | "punct" | "sensitive" | "all" | "none";
export type ConvertTarget = "md" | "docx" | "xlsx";

export interface ConvertOptions {
  target: ConvertTarget;
  template?: string;
  optimization?: string;
  checks?: readonly ProofreadCheck[];
  extractImages?: boolean;
  enableOcr?: boolean;
  ocrLanguage?: "auto" | "chinese" | "chinese_cht" | "english" | "japanese" | "korean" | "latin" | "cyrillic";
  imageMode?: "file" | "base64" | "embed" | "omit";
  imageLinkStyle?: "wiki_embed" | "wiki_link" | "markdown_embed" | "markdown_link";
  tableMergeStrategy?: "fill" | "empty" | "marker" | "replicate";
  ocrPlacement?: "image_md" | "main_md";
  renderDpi?: number;
  markdownExtensions?: Partial<Record<"input" | "output", Partial<Record<
    "structural_tables" | "captions_references" | "extended_headings" | "typed_endnotes", boolean
  >>>>;
  cleanNumbering?: "remove" | "keep";
  addNumbering?: string;
  headingMergeMode?: "always" | "never";
  headingNumberingRenderMode?: "text" | "word_native";
  useDetectedFormat?: boolean;
  /** Exact option names advertised by the selected Machine capability. */
  supportedOptions?: readonly string[];
}

export interface ConvertRequest extends ConvertOptions {
  inputs: readonly TaskInput[];
  /** Original user-selected input used only for inspection and route selection. */
  sourceInput?: TaskInput;
  outputDirectory: string;
  capabilityId?: string;
  /** Capability already selected during this operation's discovery. Core rechecks it at acceptance. */
  selectedCapability?: MachineCapability;
  /** Host-owned source validation around the final output commit. */
  publish?: DirectoryPublication;
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
  warnings: OperationWarning[];
}

export interface TemplateItem {
  id: string;
  name: string;
  target: string;
  description?: string;
  origin: "builtin" | "custom";
  isDefault: boolean;
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
  warnings: OperationWarning[];
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
  optimizationId?: string;
  capability: MachineCapability;
  inputShape: MachineCapability["input_shape"];
}

export interface RuntimeSource {
  id: string;
  category: string;
  available: boolean;
  routes: RuntimeRoute[];
}

export interface RuntimeCapabilityProjection {
  contractId: "docwen.machine.v2";
  capabilities: MachineCapability[];
}

export interface HealthReport {
  allOk: boolean;
  productVersion: string;
  checks: Array<{ id: string; status: string; message?: string }>;
}

export class DocWenClient {
  constructor(readonly machine: DocWenMachineClient) {}

  dispose(): void {
    this.machine.dispose();
  }

  async doctor(signal?: AbortSignal): Promise<HealthReport> {
    const { result, productVersion } = await this.machine.queryWithProductVersion("health/check", {}, signal);
    const checks = objectArray(result.checks, "health/check.checks").map((item) => ({
      id: stringValue(item.id) || "check",
      status: item.ok === true ? "ok" : "error",
      message: stringValue(item.message) || undefined,
    }));
    return { allOk: result.all_ok === true, productVersion, checks };
  }

  async inspect(input: InputReference, signal?: AbortSignal): Promise<FileInspection> {
    const source = typeof input === "string" ? sourceTaskInput(input, "document") : input;
    const handle = await inputHandle(source, "input.inspect", await inspectInputFile(source), signal);
    const result = await this.machine.query("file/inspect", { input: handle }, signal);
    return normalizeFileInspection(result, source.path);
  }

  async runtimeCapabilities(signal?: AbortSignal): Promise<RuntimeCapabilityProjection> {
    const result = await this.machine.query("capability/list", {}, signal);
    const capabilities = objectArray(result.capabilities, "capability/list.capabilities").map(normalizeCapability);
    return { contractId: "docwen.machine.v2", capabilities };
  }

  async templates(target?: string, signal?: AbortSignal): Promise<TemplateItem[]> {
    const resources = await this.listResources("templates", target, signal);
    const ids = new Set<string>();
    const defaults = new Set<string>();
    return resources.map((item) => {
      if (Object.keys(item).some((key) => !["id", "name", "description", "target", "origin", "is_default"].includes(key))
        || typeof item.name !== "string" || typeof item.description !== "string") {
        throw invalidResponse("template.fields");
      }
      const id = requiredTemplateId(item.id);
      const itemTarget = requiredTemplateTarget(item.target);
      if (!id.startsWith(`template.${itemTarget}.`) || (target !== undefined && target !== itemTarget)) {
        throw invalidResponse("template.target");
      }
      if (ids.has(id)) throw invalidResponse("template.id.unique");
      ids.add(id);
      const isDefault = requiredBoolean(item.is_default, "template.is_default");
      if (isDefault) {
        if (defaults.has(itemTarget)) throw invalidResponse("template.is_default.unique");
        defaults.add(itemTarget);
      }
      return {
        id,
        name: item.name,
        target: itemTarget,
        description: item.description || undefined,
        origin: requiredTemplateOrigin(item.origin),
        isDefault,
      };
    });
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
    const destination = await captureOutputDirectory(request.outputDirectory, signal);
    const source = request.sourceInput ?? requiredSourceInput(request.inputs);
    const inspectionHandle = await inputHandle(source, "input.inspect", await inspectInputFile(source), signal);
    return this.withTaskStaging(async (stagingRoot) => {
      let capabilityId = "";
      const result = await this.machine.runTask(async (query) => {
        const inspection = normalizeFileInspection(await query("file/inspect", { input: inspectionHandle }), source.path);
        const prepared = await taskRequest("", request.inputs, stagingRoot, {}, signal);
        const capabilities = request.selectedCapability
          ? [request.selectedCapability]
          : objectArray((await query("capability/list", {})).capabilities, "capability/list.capabilities").map(normalizeCapability);
        const selected = selectConversionCapability(
          capabilities, prepared.inputs, request.target, request.optimization, request.capabilityId,
        );
        capabilityId = prepared.capability_id = selected.capability_id;
        prepared.options = buildConversionMachineOptions({
          ...request, supportedOptions: Object.keys(asObject(selected.options_schema.properties)),
        }, inspection.mediaType);
        return prepared;
      }, signal);
      if (capabilityId === "convert.markdown.to_docx") requireSingleDocx(result.bundle);
      const outputs = await atomicCommitDirectory(result.bundle, destination, signal, request.publish);
      return { ...outputs, bundleId: result.bundle.bundle_id };
    });
  }

  async validate(
    input: TaskInput | string,
    checks: readonly ProofreadCheck[],
    signal?: AbortSignal,
  ): Promise<ValidateReport> {
    const source = typeof input === "string" ? sourceTaskInput(input, "document") : input;
    const inspection = await this.inspect(source, signal);
    if (inspection.mediaType !== "text/markdown") {
      throw new LocalCliError("cli_invalid_envelope", "Machine v2 proofreading currently accepts Markdown input.");
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
      const report = parseReport(reportValue, request.inputs[0].sha256);
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
    if (result.kind !== kind || Object.keys(result).some((key) => !["kind", "resources"].includes(key))) {
      throw invalidResponse("resource/list.kind");
    }
    return objectArray(result.resources, "resource/list.resources");
  }

  private async runDeliverableTask(
    capabilityId: string,
    inputs: readonly TaskInput[],
    options: JsonObject,
    outputPath: string,
    overwrite: boolean,
    signal?: AbortSignal,
    publish?: <T>(commit: () => Promise<T>) => Promise<T>,
  ): Promise<ConversionOutcome> {
    return this.withTaskStaging(async (stagingRoot) => {
      const result = await this.machine.runTask(
        await taskRequest(capabilityId, inputs, stagingRoot, options, signal),
        signal,
      );
      const committed = await atomicCommitBundle(result.bundle, outputPath, overwrite, signal, publish);
      return { output: committed.outputs[0], ...committed, bundleId: result.bundle.bundle_id };
    });
  }

  private async withTaskStaging<T extends { warnings: OperationWarning[] }>(
    body: (stagingRoot: string) => Promise<T>,
  ): Promise<T> {
    const stagingRoot = await mkdtemp(path.join(tmpdir(), "docwen-assistant-machine-"));
    let result: T;
    try {
      result = await body(stagingRoot);
    } catch (error) {
      await rm(stagingRoot, { recursive: true, force: true }).catch((cleanupError: unknown) => {
        recordFailureWarning(error, operationWarning("task_cleanup_failed", cleanupError));
      });
      throw error;
    }
    try {
      await rm(stagingRoot, { recursive: true, force: true });
    } catch (error) {
      result.warnings.push(operationWarning("task_cleanup_failed", error));
    }
    return result;
  }

}

function normalizeFileInspection(result: JsonObject, sourcePath: string): FileInspection {
  return {
    filePath: stringValue(result.file_path) || sourcePath,
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
      inputs[index],
      `input.${inputs[index].role}.${index + 1}`,
      inspected[index],
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
    const fileInfo = await lstat(absolutePath, { bigint: true });
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
  return sources[0];
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

export function buildConversionMachineOptions(request: ConvertRequest, inputMediaType: string): JsonObject {
  const options: JsonObject = {};
  const supported = request.supportedOptions ? new Set(request.supportedOptions) : null;
  const accepts = (name: string) => supported === null || supported.has(name);
  const setOption = (name: string, value: unknown) => {
    if (value !== undefined && accepts(name)) options[name] = value;
  };

  setOption("template_name", request.template);
  setOption("markdown_extensions", request.markdownExtensions);
  if (request.target === "md") {
    const resourceOption = preferredSupportedOption(
      supported,
      ["preserve_resources", "to_md_keep_images"],
      inputMediaType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ? "to_md_keep_images"
        : "preserve_resources",
    );
    const ocrOption = preferredSupportedOption(
      supported,
      ["recognize_text", "to_md_enable_ocr"],
      inputMediaType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ? "to_md_enable_ocr"
        : "recognize_text",
    );
    if (resourceOption) setOption(resourceOption, request.extractImages);
    if (ocrOption) setOption(ocrOption, request.enableOcr);
    setOption("ocr_language", request.ocrLanguage);
    const isFixedLayout = [
      "application/pdf",
      "application/vnd.ofd",
      "application/vnd.ms-xpsdocument",
    ].includes(inputMediaType);
    if (!isFixedLayout || request.imageMode === "file") setOption("image_mode", request.imageMode);
    setOption("image_link_style", request.imageLinkStyle);
    setOption("ocr_placement", request.ocrPlacement);
    setOption("table_merge_strategy", request.tableMergeStrategy === "replicate" ? "fill" : request.tableMergeStrategy);
    setOption("render_dpi", request.renderDpi);
  }
  if (request.cleanNumbering) setOption("remove_numbering", request.cleanNumbering === "remove");
  if (request.addNumbering) {
    setOption("add_numbering", request.addNumbering !== "none");
    if (request.addNumbering !== "none") setOption("numbering_scheme", request.addNumbering);
  }
  setOption("heading_merge_mode", request.headingMergeMode);
  setOption("heading_numbering_render_mode", request.headingNumberingRenderMode);
  return options;
}

function requiredTemplateOrigin(value: unknown): "builtin" | "custom" {
  if (value === "builtin" || value === "custom") return value;
  throw invalidResponse("template.origin");
}

function requiredTemplateId(value: unknown): string {
  if (typeof value === "string" && /^template\.(?:docx|xlsx)\.[0-9a-f]{64}$/.test(value)) return value;
  throw invalidResponse("template.id");
}

function requiredTemplateTarget(value: unknown): "docx" | "xlsx" {
  if (value === "docx" || value === "xlsx") return value;
  throw invalidResponse("template.target");
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value === "boolean") return value;
  throw invalidResponse(field);
}

function preferredSupportedOption(
  supported: ReadonlySet<string> | null,
  candidates: readonly string[],
  fallback: string,
): string | null {
  if (supported === null) return fallback;
  return candidates.find((candidate) => supported.has(candidate)) ?? null;
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

function requireSingleDocx(bundle: ValidatedArtifactBundle): void {
  const preferred = preferredArtifact(bundle);
  const entry = bundle.entries[0];
  if (
    bundle.entries.length !== 1
    || preferred.kind !== "document"
    || preferred.media_type !== DOCX_MEDIA_TYPE
    || !hasExactKeys(entry, ["artifact_id", "role", "ordinal", "preferred"])
    || entry.artifact_id !== preferred.artifact_id
    || entry.role !== "primary"
    || entry.ordinal !== 0
    || entry.preferred !== true
  ) {
    throw new LocalCliError("cli_integrity_error", "Resolved Markdown to DOCX requires one preferred DOCX document.");
  }
}

function hasExactKeys(value: JsonObject, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
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
    warnings: [],
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
  const operation = requiredStringValue(item.operation, "capability.operation");
  const optimizationId = item.optimization_id === undefined
    ? undefined : requiredStringValue(item.optimization_id, "capability.optimization_id");
  if (optimizationId !== undefined && operation !== "transform") throw invalidResponse("capability.optimization_id");
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
    operation,
    ...(optimizationId === undefined ? {} : { optimization_id: optimizationId }),
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

const DOCUMENT_SOURCE_FORMATS = new Set([
  "md",
  "markdown",
  "txt",
  "docx",
  "doc",
  "odt",
  "rtf",
  "wps",
]);

export function sourceKindForPath(filePath: string): TaskInput["kind"] {
  const format = path.extname(filePath).slice(1).toLowerCase();
  return DOCUMENT_SOURCE_FORMATS.has(format) ? "document" : "resource";
}

function mediaTypeForFormat(format: string): string {
  const normalized = format.toLowerCase();
  const mapping: Record<string, string> = {
    md: "text/markdown",
    markdown: "text/markdown",
    txt: "text/plain",
    csv: "text/csv",
    tsv: "text/tab-separated-values",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    odt: "application/vnd.oasis.opendocument.text",
    rtf: "application/rtf",
    wps: "application/vnd.ms-works",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    et: "application/vnd.ms-excel",
    ods: "application/vnd.oasis.opendocument.spreadsheet",
    pdf: "application/pdf",
    ofd: "application/vnd.ofd",
    xps: "application/vnd.ms-xpsdocument",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    bmp: "image/bmp",
    webp: "image/webp",
    tif: "image/tiff",
    tiff: "image/tiff",
    heic: "image/heic",
    heif: "image/heif",
    html: "text/html",
    htm: "text/html",
    mhtml: "multipart/related",
    mht: "multipart/related",
    epub: "application/epub+zip",
    enex: "application/x-evernote",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ppt: "application/vnd.ms-powerpoint",
  };
  return mapping[normalized] || "application/octet-stream";
}

async function readValidatedArtifactText(
  artifact: ValidatedBundleArtifact,
  limitBytes: number,
): Promise<string> {
  try {
    await verifyArtifactIdentity(artifact, artifact.absolutePath, true);
    const chunks: Array<Buffer<ArrayBufferLike>> = [];
    let bytesRead = 0;
    for await (const chunk of createReadStream(artifact.absolutePath) as AsyncIterable<Buffer<ArrayBufferLike>>) {
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
  if (!Array.isArray(value)) throw invalidResponse("string array");
  const items: unknown[] = value;
  if (items.some((item) => typeof item !== "string")) throw invalidResponse("string array");
  return items as string[];
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export type { JsonObject, MachineCapability, MachineTaskCompleted };

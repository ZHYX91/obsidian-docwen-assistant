import { LocalCliError } from "./errors";
import type {
  ConvertTarget,
  DocWenClient,
  FileInspection,
  OptimizationItem,
  RuntimeCapabilityProjection,
  RuntimeRoute,
  RuntimeSource,
  TaskInput,
} from "./client";
import type { MachineCapability } from "./machine-client";

const MARKDOWN_TO_DOCX_CAPABILITY_ID = "convert.markdown.to_docx";
const MARKDOWN_MEDIA_TYPE = "text/markdown";
const DOCX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const RESOLVED_DOCUMENT_MEDIA_TYPE = "application/vnd.docwen.resolved-document+json";
const NUMBERING_EXPORT_PLAN_MEDIA_TYPE = "application/vnd.docwen.numbering-export-plan+json";

export interface FileCapability {
  readonly inspection: FileInspection;
  readonly source: RuntimeSource;
  readonly machineCapabilities: readonly MachineCapability[];
}

type ProjectionRequest = {
  readonly generation: number;
  readonly promise: Promise<RuntimeCapabilityProjection>;
};

type PreloadRequest = {
  readonly controller: AbortController;
  readonly generation: number;
  readonly promise: Promise<void>;
};

/** Consumer-owned projection of Machine capabilities for one inspected file. */
export class DocWenCapabilityService {
  private generation = 0;
  private projectionController = new AbortController();
  private projectionRequest: ProjectionRequest | null = null;
  private readonly fileCache = new Map<string, FileCapability | Error>();
  private readonly preloadRequests = new Map<string, PreloadRequest>();

  constructor(private readonly client: DocWenClient) {}

  async forFile(input: TaskInput | string, signal?: AbortSignal): Promise<FileCapability> {
    const generation = this.generation;
    const [inspection, projection] = await Promise.all([
      this.client.inspect(input, signal),
      this.projection(),
    ]);
    if (generation !== this.generation) {
      throw new LocalCliError("cli_cancelled", "DocWen capabilities changed during discovery.");
    }
    const machineCapabilities = projection.capabilities.filter((capability) =>
      capabilitySupportsInspectedMediaType(capability, inspection.mediaType)
      && capability.availability !== "unavailable");
    if (machineCapabilities.length === 0) {
      throw new LocalCliError(
        "cli_invalid_envelope",
        "DocWen does not expose a Machine capability for the inspected media type.",
        { mediaType: inspection.mediaType },
      );
    }
    const routes = machineCapabilities.map(toRuntimeRoute).filter((route): route is RuntimeRoute => route !== null);
    return {
      inspection,
      machineCapabilities,
      source: {
        id: inspection.detectedFormat,
        category: inspection.workflowCategory,
        available: routes.length > 0,
        routes,
      },
    };
  }

  async requireAction(input: TaskInput | string, action: string, signal?: AbortSignal): Promise<FileCapability> {
    const capability = await this.forFile(input, signal);
    const machineSupports = action === "convert"
      ? capability.source.routes.some((route) => route.operation === "conversion")
      : capability.source.routes.some((route) => route.action === action);
    if (!capability.inspection.supportedActions.includes(action) || !machineSupports) {
      throw new LocalCliError(
        "cli_invalid_envelope",
        `DocWen does not advertise ${action} for this file through Machine v1.`,
        { action, supportedActions: capability.inspection.supportedActions },
      );
    }
    return capability;
  }

  findConversionRoute(capability: FileCapability, target: ConvertTarget): RuntimeRoute | null {
    return capability.source.routes.find((route) =>
      route.operation === "conversion" && route.target === target && route.available) ?? null;
  }

  requireConversionRoute(capability: FileCapability, target: ConvertTarget): RuntimeRoute {
    const route = this.findConversionRoute(capability, target);
    if (!route) {
      throw new LocalCliError(
        "cli_invalid_envelope",
        `DocWen does not advertise a Machine conversion capability to ${target} for this file.`,
        { source: capability.source.id, target },
      );
    }
    return route;
  }

  requireTaskInputs(route: RuntimeRoute, inputs: readonly TaskInput[]): void {
    const logicalPaths = new Set<string>();
    for (const input of inputs) {
      if (logicalPaths.has(input.logicalPath)) {
        throw new LocalCliError("cli_input_invalid", "DocWen task logical_path values must be unique.", {
          logicalPath: input.logicalPath,
        });
      }
      logicalPaths.add(input.logicalPath);
    }
    for (const slot of route.inputShape.slots) {
      const matching = inputs.filter((input) => input.role === slot.role);
      if (matching.length < slot.min_items || (slot.max_items !== undefined && matching.length > slot.max_items)) {
        throw new LocalCliError("cli_input_invalid", "DocWen task inputs do not satisfy the capability input shape.", {
          role: slot.role,
        });
      }
      for (const input of matching) {
        const mediaType = input.mediaType ?? "";
        if (input.kind !== slot.kind || !slot.media_types.includes(mediaType)) {
          throw new LocalCliError("cli_input_invalid", "DocWen task input does not satisfy the capability input shape.", {
            role: input.role,
            kind: input.kind,
            mediaType,
          });
        }
      }
    }
    for (const input of inputs) {
      if (!route.inputShape.slots.some((slot) => slot.role === input.role)) {
        throw new LocalCliError("cli_input_invalid", "DocWen capability rejects an undeclared input role.", {
          role: input.role,
          capabilityId: route.capabilityId,
        });
      }
    }
  }

  findApplicableOptimizations(
    capability: FileCapability,
    resources: readonly OptimizationItem[],
    target: ConvertTarget,
  ): OptimizationItem[] {
    const actionIds = new Set(this.optimizationActionIds(capability, target));
    return resources.filter((resource) => actionIds.has(resource.id));
  }

  optimizationActionIds(_capability: FileCapability, _target: ConvertTarget): string[] {
    // Machine v1 exposes only consumer-neutral conversion capabilities. Route-
    // specific optimizer actions are intentionally absent until promoted to a
    // versioned capability with normalized options.
    return [];
  }

  requiresDetectedFormatAcceptance(inspection: FileInspection): boolean {
    return inspection.decision === "require_explicit_acceptance";
  }

  peek(filePath: string): FileCapability | Error | null {
    return this.fileCache.get(filePath) ?? null;
  }

  preload(filePath: string): Promise<void> {
    const existing = this.preloadRequests.get(filePath);
    if (existing && this.isCurrentPreload(filePath, existing)) return existing.promise;

    const controller = new AbortController();
    const generation = this.generation;
    let request!: PreloadRequest;
    const promise = this.forFile(filePath, controller.signal).then(
      (capability) => {
        if (this.isCurrentPreload(filePath, request)) this.fileCache.set(filePath, capability);
      },
      (error: unknown) => {
        if (this.isCurrentPreload(filePath, request)) {
          this.fileCache.set(filePath, error instanceof Error ? error : new Error(String(error)));
        }
      },
    ).finally(() => {
      if (this.preloadRequests.get(filePath) === request) this.preloadRequests.delete(filePath);
    });
    request = { controller, generation, promise };
    this.preloadRequests.set(filePath, request);
    return promise;
  }

  invalidate(filePath?: string): void {
    if (filePath) {
      const request = this.preloadRequests.get(filePath);
      this.preloadRequests.delete(filePath);
      this.fileCache.delete(filePath);
      request?.controller.abort();
      return;
    }
    const requests = [...this.preloadRequests.values()];
    this.preloadRequests.clear();
    this.fileCache.clear();
    for (const request of requests) request.controller.abort();
  }

  reset(): void {
    ++this.generation;
    this.projectionController.abort();
    this.projectionController = new AbortController();
    this.projectionRequest = null;
    this.invalidate();
  }

  dispose(): void {
    this.reset();
  }

  private projection(): Promise<RuntimeCapabilityProjection> {
    const current = this.projectionRequest;
    if (current?.generation === this.generation) return current.promise;

    const generation = this.generation;
    let request!: ProjectionRequest;
    const promise = this.client.runtimeCapabilities(this.projectionController.signal).catch((error) => {
      if (this.projectionRequest === request) {
        this.projectionRequest = null;
      }
      throw error;
    });
    request = { generation, promise };
    this.projectionRequest = request;
    return promise;
  }

  private isCurrentPreload(filePath: string, request: PreloadRequest): boolean {
    return this.preloadRequests.get(filePath) === request
      && request.generation === this.generation
      && !request.controller.signal.aborted;
  }
}

function toRuntimeRoute(capability: MachineCapability): RuntimeRoute | null {
  const action = capability.capability_id === "validate.markdown"
    ? "validate"
    : capability.capability_id === "transform.markdown.heading_numbering"
      ? "number markdown"
      : null;
  const target = action ? "md" : targetForMediaTypes(capability.output_media_types);
  if (!target) return null;
  const properties = isObject(capability.options_schema.properties)
    ? Object.keys(capability.options_schema.properties)
    : [];
  return {
    source: capability.input_shape.slots.find((slot) =>
      slot.role === "source" || slot.role === "neutral_document")?.media_types[0] || "",
    target,
    operation: action ? "action" : "conversion",
    action,
    available: capability.availability !== "unavailable",
    state: capability.availability,
    options: properties,
    capabilityId: capability.capability_id,
    inputShape: capability.input_shape,
  };
}

function capabilitySupportsInspectedMediaType(capability: MachineCapability, mediaType: string): boolean {
  if (capability.capability_id === MARKDOWN_TO_DOCX_CAPABILITY_ID) {
    return mediaType === MARKDOWN_MEDIA_TYPE && isCurrentResolvedMarkdownToDocxCapability(capability);
  }
  return capability.input_shape.slots.some((slot) =>
    slot.role === "source" && slot.media_types.includes(mediaType));
}

function isCurrentResolvedMarkdownToDocxCapability(capability: MachineCapability): boolean {
  if (
    capability.operation !== "convert"
    || capability.input_shape.undeclared_roles !== "reject"
    || capability.output_media_types.length !== 1
    || capability.output_media_types[0] !== DOCX_MEDIA_TYPE
    || capability.input_shape.slots.length !== 2
  ) return false;
  const slots = new Map(capability.input_shape.slots.map((slot) => [slot.role, slot]));
  const neutral = slots.get("neutral_document");
  const plan = slots.get("numbering_export_plan");
  return exactInputSlot(neutral, "document", RESOLVED_DOCUMENT_MEDIA_TYPE)
    && exactInputSlot(plan, "resource", NUMBERING_EXPORT_PLAN_MEDIA_TYPE);
}

function exactInputSlot(
  slot: MachineCapability["input_shape"]["slots"][number] | undefined,
  kind: "document" | "resource",
  mediaType: string,
): boolean {
  return slot?.kind === kind
    && slot.min_items === 1
    && slot.max_items === 1
    && slot.media_types.length === 1
    && slot.media_types[0] === mediaType;
}

function targetForMediaTypes(mediaTypes: readonly string[]): ConvertTarget | null {
  if (mediaTypes.includes("text/markdown")) return "md";
  if (mediaTypes.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document")) return "docx";
  if (mediaTypes.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")) return "xlsx";
  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

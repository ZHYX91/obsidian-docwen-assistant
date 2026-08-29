import { describe, expect, it, vi } from "vitest";

import { DocWenCapabilityService } from "../src/docwen";
import type { DocWenClient, MachineCapability } from "../src/docwen";

function inspection(overrides: Record<string, unknown> = {}) {
  return {
    filePath: "D:\\note.md",
    contentSha256: "a".repeat(64),
    sizeBytes: 8,
    decision: "allow",
    supportedActions: ["inspect", "convert", "validate", "number markdown"],
    declaredFormat: "markdown",
    detectedFormat: "markdown",
    workflowCategory: "markdown",
    warningCode: "",
    reasonCode: "",
    mediaType: "text/markdown",
    ...overrides,
  };
}

function capability(
  capabilityId: string,
  operation: string,
  outputMediaType: string,
  properties: Record<string, unknown> = {},
): MachineCapability {
  return {
    capability_id: capabilityId,
    operation,
    input_shape: {
      slots: [
        { role: "source", kind: "document", media_types: ["text/markdown"], min_items: 1 },
        { role: "linked_resource", kind: "resource", media_types: ["image/png"], min_items: 0 },
      ],
      undeclared_roles: "reject",
    },
    output_media_types: [outputMediaType],
    output_shape: {
      cardinality: "one",
      artifact_kinds: [outputMediaType === "application/json" ? "resource" : "document"],
      relation_types: [],
      atomic_bundle: true,
    },
    options_schema: { type: "object", properties, additionalProperties: false },
    availability: "available",
    dependencies: [],
    limitations: [],
  };
}

function resolvedMarkdownDocxCapability(): MachineCapability {
  return {
    capability_id: "convert.markdown.to_docx",
    operation: "convert",
    input_shape: {
      slots: [
        {
          role: "neutral_document",
          kind: "document",
          media_types: ["application/vnd.docwen.resolved-document+json"],
          min_items: 1,
          max_items: 1,
        },
        {
          role: "numbering_export_plan",
          kind: "resource",
          media_types: ["application/vnd.docwen.numbering-export-plan+json"],
          min_items: 1,
          max_items: 1,
        },
      ],
      undeclared_roles: "reject",
    },
    output_media_types: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    output_shape: {
      cardinality: "one",
      artifact_kinds: ["document"],
      relation_types: [],
      atomic_bundle: true,
    },
    options_schema: { type: "object", properties: { template_name: {} }, additionalProperties: false },
    availability: "available",
    dependencies: [],
    limitations: [],
  };
}

function projection() {
  return {
    contractId: "docwen.machine.v1" as const,
    capabilities: [
      resolvedMarkdownDocxCapability(),
      capability("validate.markdown", "validate", "application/json"),
      capability("transform.markdown.heading_numbering", "transform", "text/markdown"),
    ],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe("DocWenCapabilityService", () => {
  it("joins Markdown inspection to the exact resolved-document Word capability", async () => {
    const client = {
      inspect: vi.fn().mockResolvedValue(inspection()),
      runtimeCapabilities: vi.fn().mockResolvedValue(projection()),
    } as unknown as DocWenClient;
    const service = new DocWenCapabilityService(client);

    const file = await service.requireAction("D:\\note.md", "convert");
    expect(service.findConversionRoute(file, "docx")).toMatchObject({
      capabilityId: "convert.markdown.to_docx",
      options: ["template_name"],
      inputShape: {
        slots: [
          { role: "neutral_document" },
          { role: "numbering_export_plan" },
        ],
      },
    });
    expect(service.findConversionRoute(file, "xlsx")).toBeNull();
    await expect(service.requireAction("D:\\note.md", "validate")).resolves.toMatchObject({
      source: { id: "markdown" },
    });
  });

  it("does not accept the retired raw-Markdown Word capability shape", async () => {
    const retired = capability(
      "convert.markdown.to_docx",
      "convert",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      { template_name: {} },
    );
    const client = {
      inspect: vi.fn().mockResolvedValue(inspection({ supportedActions: ["inspect", "validate"] })),
      runtimeCapabilities: vi.fn().mockResolvedValue({
        contractId: "docwen.machine.v1",
        capabilities: [retired, capability("validate.markdown", "validate", "application/json")],
      }),
    } as unknown as DocWenClient;
    const service = new DocWenCapabilityService(client);

    const file = await service.forFile("D:\\note.md");
    expect(service.findConversionRoute(file, "docx")).toBeNull();
  });

  it("does not turn inspection or discovery failure into empty support", async () => {
    const failure = new Error("unavailable");
    const client = {
      inspect: vi.fn().mockRejectedValue(failure),
      runtimeCapabilities: vi.fn().mockResolvedValue(projection()),
    } as unknown as DocWenClient;
    const service = new DocWenCapabilityService(client);

    await expect(service.forFile("D:\\note.md")).rejects.toBe(failure);
  });

  it("requires both inspection action support and a matching Machine capability", async () => {
    const client = {
      inspect: vi.fn().mockResolvedValue(inspection({ supportedActions: ["inspect", "convert"] })),
      runtimeCapabilities: vi.fn().mockResolvedValue(projection()),
    } as unknown as DocWenClient;
    const service = new DocWenCapabilityService(client);

    await expect(service.requireAction("D:\\note.md", "validate")).rejects.toMatchObject({
      code: "cli_invalid_envelope",
    });
  });

  it("keeps route-specific optimizers out until Machine promotes them", async () => {
    const client = {
      inspect: vi.fn().mockResolvedValue(inspection()),
      runtimeCapabilities: vi.fn().mockResolvedValue(projection()),
    } as unknown as DocWenClient;
    const service = new DocWenCapabilityService(client);
    const file = await service.forFile("D:\\note.md");
    const resources = [{ id: "gongwen", name: "Gongwen", scopes: ["markdown"] }];

    expect(service.optimizationActionIds(file, "docx")).toEqual([]);
    expect(service.findApplicableOptimizations(file, resources, "docx")).toEqual([]);
  });

  it("does not let one action abort the shared capability discovery", async () => {
    const client = {
      inspect: vi.fn().mockResolvedValue(inspection()),
      runtimeCapabilities: vi.fn().mockResolvedValue(projection()),
    } as unknown as DocWenClient;
    const service = new DocWenCapabilityService(client);
    const controller = new AbortController();

    await service.forFile("D:\\note.md", controller.signal);
    const sharedSignal = vi.mocked(client.runtimeCapabilities).mock.calls[0]?.[0];
    expect(sharedSignal).toBeInstanceOf(AbortSignal);
    expect(sharedSignal).not.toBe(controller.signal);
    expect(sharedSignal?.aborted).toBe(false);
  });

  it("de-duplicates a pending preload for the same path", async () => {
    const pendingInspection = deferred<ReturnType<typeof inspection>>();
    const client = {
      inspect: vi.fn(() => pendingInspection.promise),
      runtimeCapabilities: vi.fn().mockResolvedValue(projection()),
    } as unknown as DocWenClient;
    const service = new DocWenCapabilityService(client);

    const first = service.preload("D:\\note.md");
    const second = service.preload("D:\\note.md");

    expect(second).toBe(first);
    expect(client.inspect).toHaveBeenCalledOnce();
    pendingInspection.resolve(inspection());
    await first;
    expect(service.peek("D:\\note.md")).toMatchObject({ source: { id: "markdown" } });
  });

  it("retries a preload after a cached failure", async () => {
    const failure = new Error("temporarily unavailable");
    const client = {
      inspect: vi.fn()
        .mockRejectedValueOnce(failure)
        .mockResolvedValueOnce(inspection()),
      runtimeCapabilities: vi.fn().mockResolvedValue(projection()),
    } as unknown as DocWenClient;
    const service = new DocWenCapabilityService(client);

    await service.preload("D:\\note.md");
    expect(service.peek("D:\\note.md")).toBe(failure);
    await service.preload("D:\\note.md");

    expect(client.inspect).toHaveBeenCalledTimes(2);
    expect(service.peek("D:\\note.md")).toMatchObject({ source: { id: "markdown" } });
  });

  it("does not let a reset preload overwrite the replacement cache", async () => {
    const oldInspection = deferred<ReturnType<typeof inspection>>();
    const client = {
      inspect: vi.fn()
        .mockImplementationOnce(() => oldInspection.promise)
        .mockResolvedValueOnce(inspection({ reasonCode: "replacement" })),
      runtimeCapabilities: vi.fn().mockResolvedValue(projection()),
    } as unknown as DocWenClient;
    const service = new DocWenCapabilityService(client);

    const oldPreload = service.preload("D:\\note.md");
    service.reset();
    await service.preload("D:\\note.md");
    oldInspection.resolve(inspection({ reasonCode: "stale" }));
    await oldPreload;

    expect(service.peek("D:\\note.md")).toMatchObject({
      inspection: { reasonCode: "replacement" },
    });
  });

  it("does not let an old projection rejection clear its replacement", async () => {
    const oldProjection = deferred<ReturnType<typeof projection>>();
    const replacementProjection = deferred<ReturnType<typeof projection>>();
    const client = {
      inspect: vi.fn().mockResolvedValue(inspection()),
      runtimeCapabilities: vi.fn()
        .mockImplementationOnce(() => oldProjection.promise)
        .mockImplementationOnce(() => replacementProjection.promise),
    } as unknown as DocWenClient;
    const service = new DocWenCapabilityService(client);

    const oldRequest = service.forFile("D:\\old.md");
    const oldExpectation = expect(oldRequest).rejects.toThrow("stale projection");
    service.reset();
    const replacement = service.forFile("D:\\replacement.md");
    oldProjection.reject(new Error("stale projection"));
    await oldExpectation;
    const sharedReplacement = service.forFile("D:\\shared.md");
    replacementProjection.resolve(projection());
    await Promise.all([replacement, sharedReplacement]);

    expect(client.runtimeCapabilities).toHaveBeenCalledTimes(2);
  });

  it("invalidates only the selected preload", async () => {
    const firstInspection = deferred<ReturnType<typeof inspection>>();
    const secondInspection = deferred<ReturnType<typeof inspection>>();
    const client = {
      inspect: vi.fn((input: string) => input.endsWith("first.md")
        ? firstInspection.promise
        : secondInspection.promise),
      runtimeCapabilities: vi.fn().mockResolvedValue(projection()),
    } as unknown as DocWenClient;
    const service = new DocWenCapabilityService(client);

    const first = service.preload("D:\\first.md");
    const second = service.preload("D:\\second.md");
    service.invalidate("D:\\first.md");
    firstInspection.resolve(inspection({ filePath: "D:\\first.md" }));
    secondInspection.resolve(inspection({ filePath: "D:\\second.md" }));
    await Promise.all([first, second]);

    expect(service.peek("D:\\first.md")).toBeNull();
    expect(service.peek("D:\\second.md")).toMatchObject({
      inspection: { filePath: "D:\\second.md" },
    });
  });

  it("rejects an undeclared typed input role before task planning", async () => {
    const client = {
      inspect: vi.fn().mockResolvedValue(inspection()),
      runtimeCapabilities: vi.fn().mockResolvedValue(projection()),
    } as unknown as DocWenClient;
    const service = new DocWenCapabilityService(client);
    const file = await service.requireAction("D:\\note.md", "convert");
    const route = service.requireConversionRoute(file, "docx");

    expect(() => service.requireTaskInputs(route, [
      {
        path: "D:\\resolved-document.json",
        kind: "document",
        role: "neutral_document",
        logicalPath: "resolved-document.json",
        mediaType: "application/vnd.docwen.resolved-document+json",
      },
      {
        path: "D:\\numbering-export-plan.json",
        kind: "resource",
        role: "numbering_export_plan",
        logicalPath: "numbering-export-plan.json",
        mediaType: "application/vnd.docwen.numbering-export-plan+json",
      },
      {
        path: "D:\\refs.bib",
        kind: "resource",
        role: "bibliography",
        logicalPath: "refs/a.bib",
        mediaType: "application/x-bibtex",
      },
    ])).toThrow(/undeclared/i);
  });
});

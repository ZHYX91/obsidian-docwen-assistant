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
    expect(client.runtimeCapabilities).toHaveBeenCalledWith();
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

import type { App } from "obsidian";
import type { FileCapability } from "../docwen/capability-service";
import type { RuntimeRoute, TaskInput } from "../docwen/client";
import { LocalCliError } from "../docwen/errors";
import { confirmDetectedFormat } from "../host/confirm";

export async function admittedActionInput(
  app: App, source: TaskInput, capability: FileCapability, action: RuntimeRoute | "validate" | "number markdown",
  signal: AbortSignal, materialize: (route: RuntimeRoute) => Promise<TaskInput>,
): Promise<TaskInput | null> {
  const binding = capability.admittedFormat.binding;
  if (binding === "original") return source;
  const route = typeof action === "string"
    ? capability.source.routes.find(item => item.available && item.action === action) : action;
  if (!route) throw new LocalCliError("cli_capability_unavailable", "No matching route for the inspected source.");
  if (binding === "confirm-detected") {
    const accepted = await confirmDetectedFormat(app, signal, {
      sourceName: source.logicalPath, declaredFormat: capability.inspection.declaredFormat,
      detectedFormat: capability.inspection.detectedFormat,
      ...(action === "number markdown" ? { changesHeadings: true } : {}),
    });
    if (!accepted || signal.aborted) return null;
  }
  return materialize(route);
}

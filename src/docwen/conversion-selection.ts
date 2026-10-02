import { LocalCliError } from "./errors";
import type { ConvertTarget } from "./client";
import type { MachineCapability, MachineInputHandle } from "./machine-client";

/** Select by declared facts; capability names and resource scopes are opaque. */
export function selectConversionCapability(
  capabilities: readonly MachineCapability[],
  inputs: readonly MachineInputHandle[],
  target: ConvertTarget,
  optimizationId?: string,
  capabilityId?: string,
): MachineCapability {
  const mediaTypes: Record<ConvertTarget, string> = {
    md: "text/markdown",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  const matches = capabilities.filter((capability) =>
    capability.availability !== "unavailable"
    && (capabilityId === undefined || capability.capability_id === capabilityId)
    && (optimizationId === undefined
      ? capability.optimization_id === undefined && ["convert", "render"].includes(capability.operation)
      : capability.operation === "transform" && capability.optimization_id === optimizationId)
    && capability.output_media_types.includes(mediaTypes[target])
    && acceptsInputs(capability, inputs));
  if (matches.length !== 1) {
    throw new LocalCliError("cli_invalid_envelope", "No unique available Machine conversion matches the selected inputs and optimization.", {
      target, optimizationId, capabilityId, matches: matches.length,
    });
  }
  return matches[0];
}

function acceptsInputs(capability: MachineCapability, inputs: readonly MachineInputHandle[]): boolean {
  const slots = capability.input_shape.slots;
  return inputs.every((input) => slots.some((slot) => slot.role === input.role))
    && slots.every((slot) => {
      const matching = inputs.filter((input) => input.role === slot.role);
      return matching.length >= slot.min_items
        && (slot.max_items === undefined || matching.length <= slot.max_items)
        && matching.every((input) => input.kind === slot.kind && slot.media_types.includes(input.media_type));
    });
}

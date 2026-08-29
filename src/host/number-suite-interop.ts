import type { App } from "obsidian";

export const NUMBER_SUITE_INTEROP_SCHEMA_V2 = "number-suite.interop.v2" as const;

export type NumberSuiteHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type NumberSuiteNumberFormat =
  | "arabic"
  | "arabic_full"
  | "chinese_lower"
  | "chinese_upper"
  | "circled"
  | "letter_upper"
  | "letter_lower"
  | "roman_upper"
  | "roman_lower";

export type NumberSuiteDisplaySegment =
  | Readonly<{ kind: "literal"; literal: string }>
  | Readonly<{
    kind: "counter";
    level: NumberSuiteHeadingLevel;
    numberFormat: NumberSuiteNumberFormat;
  }>;

export interface NumberSuiteHeadingTarget {
  readonly sourceStartUtf16: number;
  readonly sourceEndUtf16: number;
  readonly line: number;
  readonly level: NumberSuiteHeadingLevel;
  readonly targetId: string | null;
  readonly authoredText: string;
  readonly enabled: boolean;
  readonly derivedNumber: string | null;
  readonly counters: readonly number[];
  readonly display: readonly NumberSuiteDisplaySegment[];
}

export interface NumberSuiteCaptionTarget {
  readonly sourceStartUtf16: number;
  readonly sourceEndUtf16: number;
  readonly line: number;
  readonly kind: "Figure" | "Table" | "Equation" | "Code";
  readonly targetId: string | null;
  readonly authoredText: string;
  readonly enabled: boolean;
  readonly derivedNumber: string | null;
}

export interface NumberSuiteReference {
  readonly sourceStartUtf16: number;
  readonly sourceEndUtf16: number;
  readonly targetSourceStartUtf16: number;
  readonly targetSourceEndUtf16: number;
  readonly alias: string | null;
}

export interface NumberSuiteSnapshot {
  readonly schema: typeof NUMBER_SUITE_INTEROP_SCHEMA_V2;
  readonly offsetEncoding: "utf16";
  readonly disabled: boolean;
  readonly headingTargets: readonly NumberSuiteHeadingTarget[];
  readonly captionTargets: readonly NumberSuiteCaptionTarget[];
  readonly references: readonly NumberSuiteReference[];
}

interface InteropApiLike {
  readonly schema?: unknown;
  exportSemanticSnapshot?: (request: unknown) => unknown;
}

interface PluginLike {
  getInteropApi?: () => unknown;
}

interface PluginRegistryLike {
  getPlugin?: (id: string) => unknown;
}

const NUMBER_FORMATS = new Set<NumberSuiteNumberFormat>([
  "arabic",
  "arabic_full",
  "chinese_lower",
  "chinese_upper",
  "circled",
  "letter_upper",
  "letter_lower",
  "roman_upper",
  "roman_lower",
]);
const CAPTION_KINDS = new Set(["Figure", "Table", "Equation", "Code"]);
const TARGET_ID = /^[A-Za-z0-9-]{1,128}$/u;

export class NumberSuiteInteropError extends Error {}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value != null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function integer(value: unknown, label: string, minimum = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
    throw new NumberSuiteInteropError(`${label} is not a bounded integer.`);
  }
  return value;
}

function stringOrNull(value: unknown, label: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new NumberSuiteInteropError(`${label} is not a string or null.`);
  return value;
}

function targetId(value: unknown, label: string): string | null {
  const parsed = stringOrNull(value, label);
  if (parsed !== null && !TARGET_ID.test(parsed)) {
    throw new NumberSuiteInteropError(`${label} is outside the stable ID boundary.`);
  }
  return parsed;
}

function sourceRange(
  value: Record<string, unknown>,
  source: string,
  label: string,
): readonly [number, number] {
  const start = integer(value.sourceStartUtf16, `${label}.sourceStartUtf16`);
  const end = integer(value.sourceEndUtf16, `${label}.sourceEndUtf16`, 1);
  if (end <= start || end > source.length) {
    throw new NumberSuiteInteropError(`${label} source range is outside authored Markdown.`);
  }
  return [start, end];
}

function enabledNumber(value: Record<string, unknown>, label: string): {
  readonly enabled: boolean;
  readonly derivedNumber: string | null;
} {
  if (typeof value.enabled !== "boolean") {
    throw new NumberSuiteInteropError(`${label}.enabled is not boolean.`);
  }
  const derivedNumber = stringOrNull(value.derivedNumber, `${label}.derivedNumber`);
  if (value.enabled !== (derivedNumber !== null && derivedNumber.length > 0)) {
    throw new NumberSuiteInteropError(`${label} enabled state contradicts its derived number.`);
  }
  return { enabled: value.enabled, derivedNumber };
}

function parseDisplay(value: unknown, label: string): NumberSuiteDisplaySegment[] {
  if (!Array.isArray(value)) throw new NumberSuiteInteropError(`${label} is not an array.`);
  return value.map((item, index) => {
    const segment = record(item);
    if (segment?.kind === "literal" && typeof segment.literal === "string") {
      return { kind: "literal", literal: segment.literal };
    }
    if (segment?.kind === "counter") {
      const level = integer(segment.level, `${label}[${index}].level`, 1);
      if (level > 9 || typeof segment.numberFormat !== "string" || !NUMBER_FORMATS.has(
        segment.numberFormat as NumberSuiteNumberFormat,
      )) {
        throw new NumberSuiteInteropError(`${label}[${index}] counter is outside the closed set.`);
      }
      return {
        kind: "counter",
        level: level as NumberSuiteHeadingLevel,
        numberFormat: segment.numberFormat as NumberSuiteNumberFormat,
      };
    }
    throw new NumberSuiteInteropError(`${label}[${index}] is not a supported display segment.`);
  });
}

function parseHeading(value: unknown, source: string, index: number): NumberSuiteHeadingTarget {
  const item = record(value);
  const label = `headingTargets[${index}]`;
  if (item === null) throw new NumberSuiteInteropError(`${label} is not an object.`);
  const [sourceStartUtf16, sourceEndUtf16] = sourceRange(item, source, label);
  const level = integer(item.level, `${label}.level`, 1);
  if (level > 9 || typeof item.authoredText !== "string" || typeof item.line !== "number") {
    throw new NumberSuiteInteropError(`${label} has invalid heading facts.`);
  }
  if (!Array.isArray(item.counters) || item.counters.length !== 9) {
    throw new NumberSuiteInteropError(`${label}.counters must contain nine values.`);
  }
  const counters = item.counters.map((counter, counterIndex) => (
    integer(counter, `${label}.counters[${counterIndex}]`)
  ));
  const state = enabledNumber(item, label);
  const display = parseDisplay(item.display, `${label}.display`);
  if (state.enabled) {
    const currentCount = display.filter((segment) => segment.kind === "counter" && segment.level === level).length;
    if (currentCount !== 1 || display.some((segment) => segment.kind === "counter" && segment.level > level)) {
      throw new NumberSuiteInteropError(`${label}.display has an invalid counter topology.`);
    }
  } else if (display.length > 0) {
    throw new NumberSuiteInteropError(`${label} disabled target has a display plan.`);
  }
  return {
    sourceStartUtf16,
    sourceEndUtf16,
    line: integer(item.line, `${label}.line`),
    level: level as NumberSuiteHeadingLevel,
    targetId: targetId(item.targetId, `${label}.targetId`),
    authoredText: item.authoredText,
    ...state,
    counters,
    display,
  };
}

function parseCaption(value: unknown, source: string, index: number): NumberSuiteCaptionTarget {
  const item = record(value);
  const label = `captionTargets[${index}]`;
  if (item === null) throw new NumberSuiteInteropError(`${label} is not an object.`);
  const [sourceStartUtf16, sourceEndUtf16] = sourceRange(item, source, label);
  if (
    typeof item.kind !== "string"
    || !CAPTION_KINDS.has(item.kind)
    || typeof item.authoredText !== "string"
  ) {
    throw new NumberSuiteInteropError(`${label} has invalid caption facts.`);
  }
  return {
    sourceStartUtf16,
    sourceEndUtf16,
    line: integer(item.line, `${label}.line`),
    kind: item.kind as NumberSuiteCaptionTarget["kind"],
    targetId: targetId(item.targetId, `${label}.targetId`),
    authoredText: item.authoredText,
    ...enabledNumber(item, label),
  };
}

function parseReference(value: unknown, source: string, index: number): NumberSuiteReference {
  const item = record(value);
  const label = `references[${index}]`;
  if (item === null) throw new NumberSuiteInteropError(`${label} is not an object.`);
  const [sourceStartUtf16, sourceEndUtf16] = sourceRange(item, source, label);
  const targetSourceStartUtf16 = integer(item.targetSourceStartUtf16, `${label}.targetSourceStartUtf16`);
  const targetSourceEndUtf16 = integer(item.targetSourceEndUtf16, `${label}.targetSourceEndUtf16`, 1);
  if (targetSourceEndUtf16 <= targetSourceStartUtf16 || targetSourceEndUtf16 > source.length) {
    throw new NumberSuiteInteropError(`${label} target range is outside authored Markdown.`);
  }
  return {
    sourceStartUtf16,
    sourceEndUtf16,
    targetSourceStartUtf16,
    targetSourceEndUtf16,
    alias: stringOrNull(item.alias, `${label}.alias`),
  };
}

function parseSnapshot(value: unknown, source: string): NumberSuiteSnapshot {
  const snapshot = record(value);
  if (
    snapshot?.schema !== NUMBER_SUITE_INTEROP_SCHEMA_V2
    || snapshot.offsetEncoding !== "utf16"
    || typeof snapshot.disabled !== "boolean"
    || !Array.isArray(snapshot.headingTargets)
    || !Array.isArray(snapshot.captionTargets)
    || !Array.isArray(snapshot.references)
  ) {
    throw new NumberSuiteInteropError("Number Suite returned an invalid interoperability envelope.");
  }
  const headings = snapshot.headingTargets.map((item, index) => parseHeading(item, source, index));
  const captions = snapshot.captionTargets.map((item, index) => parseCaption(item, source, index));
  const targets = [...headings, ...captions];
  const targetKeys = new Set<string>();
  const targetIds = new Set<string>();
  for (const target of targets) {
    const key = `${target.sourceStartUtf16}:${target.sourceEndUtf16}`;
    if (targetKeys.has(key)) throw new NumberSuiteInteropError("Number Suite returned duplicate target ranges.");
    targetKeys.add(key);
    if (target.targetId !== null) {
      const idKey = target.targetId.normalize("NFC").toLowerCase();
      if (targetIds.has(idKey)) {
        throw new NumberSuiteInteropError("Number Suite returned an ambiguous target block ID.");
      }
      targetIds.add(idKey);
    }
  }
  const references = snapshot.references.map((item, index) => parseReference(item, source, index));
  const referenceKeys = new Set<string>();
  for (const reference of references) {
    const key = `${reference.sourceStartUtf16}:${reference.sourceEndUtf16}`;
    if (referenceKeys.has(key)) {
      throw new NumberSuiteInteropError("Number Suite returned duplicate reference ranges.");
    }
    referenceKeys.add(key);
  }
  if (
    snapshot.disabled
    && (headings.length > 0 || captions.length > 0 || references.length > 0)
  ) {
    throw new NumberSuiteInteropError("Number Suite disabled state contradicts its exported semantic facts.");
  }
  for (const reference of references) {
    const key = `${reference.targetSourceStartUtf16}:${reference.targetSourceEndUtf16}`;
    const target = targets.find((candidate) => (
      `${candidate.sourceStartUtf16}:${candidate.sourceEndUtf16}` === key
    ));
    if (target == null) {
      throw new NumberSuiteInteropError("Number Suite reference points to a missing target.");
    }
  }
  return {
    schema: NUMBER_SUITE_INTEROP_SCHEMA_V2,
    offsetEncoding: "utf16",
    disabled: snapshot.disabled,
    headingTargets: headings,
    captionTargets: captions,
    references,
  };
}

export function loadNumberSuiteSnapshot(
  app: App,
  source: string,
  frontmatter: unknown,
): NumberSuiteSnapshot | null {
  const registry = (app as unknown as { plugins?: PluginRegistryLike }).plugins;
  const plugin = registry?.getPlugin?.("number-suite") as PluginLike | null | undefined;
  if (plugin == null || typeof plugin.getInteropApi !== "function") return null;
  const api = plugin.getInteropApi() as InteropApiLike | null;
  if (
    api == null
    || api.schema !== NUMBER_SUITE_INTEROP_SCHEMA_V2
    || typeof api.exportSemanticSnapshot !== "function"
  ) {
    throw new NumberSuiteInteropError("Number Suite exposes an unsupported interoperability API.");
  }
  return parseSnapshot(api.exportSemanticSnapshot({
    schema: NUMBER_SUITE_INTEROP_SCHEMA_V2,
    authoredMarkdown: source,
    frontmatter,
  }), source);
}

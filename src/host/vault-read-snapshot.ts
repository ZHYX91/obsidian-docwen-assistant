import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { TFile, type App } from "obsidian";

import { mediaTypeForPath, normalizeLogicalPath, type TaskInput } from "../docwen";
import {
  isSameOpenMarkdownTarget,
  locateOpenMarkdownTarget,
} from "./open-markdown-target";
import {
  loadNumberSuiteSnapshot,
  NumberSuiteInteropError,
  type NumberSuiteCaptionTarget,
  type NumberSuiteDisplaySegment,
  type NumberSuiteHeadingTarget,
  type NumberSuiteNumberFormat,
  type NumberSuiteSnapshot,
} from "./number-suite-interop";
import { VaultWriteError } from "./vault-write-transaction";

export interface IsolatedSnapshot {
  readonly inputPath: string;
  readonly contentSha256: string;
  readonly sourceInput: TaskInput;
  readonly inputs: readonly TaskInput[];
  readonly resolvedMarkdownInputs?: readonly [TaskInput, TaskInput];
  readonly resolvedMarkdownSourcePath?: string;
}

interface ResolvedMarkdownSnapshot {
  readonly inputs: readonly [TaskInput, TaskInput];
  readonly authoredSourcePath: string;
}

const RESOLVED_DOCUMENT_MEDIA_TYPE = "application/vnd.docwen.resolved-document+json";
const NUMBERING_EXPORT_PLAN_MEDIA_TYPE = "application/vnd.docwen.numbering-export-plan+json";
const MAX_EMBEDDED_RESOURCE_BYTES = 6_000_000;
const SUPPORTED_IMAGE_MEDIA_TYPES = new Map<string, string>([
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["gif", "image/gif"],
  ["bmp", "image/bmp"],
  ["webp", "image/webp"],
]);
const IMAGE_LIKE_EXTENSIONS = new Set([...SUPPORTED_IMAGE_MEDIA_TYPES.keys(), "svg", "ico"]);

/** Provides Core with an isolated copy of the current editor/Vault content. */
export class VaultReadSnapshot {
  constructor(private readonly app: App) {}

  async run<T>(
    file: TFile,
    signal: AbortSignal,
    work: (snapshot: IsolatedSnapshot) => Promise<T>,
  ): Promise<T> {
    const targetLookup = locateOpenMarkdownTarget(this.app.workspace, file.path);
    if (targetLookup.kind === "ambiguous") {
      throw new VaultWriteError(
        "vault_target_changed",
        "The source is open in multiple Markdown editors.",
      );
    }
    const target = targetLookup.kind === "open" ? targetLookup.target : null;
    const editor = target?.editor ?? null;
    const original = editor ? editor.getValue() : await this.app.vault.readBinary(file);
    const authoredMarkdown = file.extension.toLowerCase() === "md"
      ? decodeMarkdown(original)
      : null;
    const contentSha256 = sha256(original);
    const workspace = await mkdtemp(path.join(tmpdir(), "docwen-assistant-snapshot-"));
    const extension = file.extension.replace(/[^a-z0-9]/giu, "") || "bin";
    const inputPath = path.join(workspace, `source.${extension}`);
    let result: T;
    try {
      throwIfAborted(signal);
      await writeFile(inputPath, typeof original === "string" ? original : Buffer.from(original));
      const sourceInput: TaskInput = {
        path: inputPath,
        kind: "document",
        role: "source",
        logicalPath: logicalPathFor(file.path),
        mediaType: mediaTypeForPath(file.path),
      };
      const resolvedMarkdownSnapshot = authoredMarkdown !== null
        ? await this.buildResolvedMarkdownInputs(file, authoredMarkdown, workspace)
        : undefined;
      result = await work({
        inputPath,
        contentSha256,
        sourceInput,
        inputs: [sourceInput],
        ...(resolvedMarkdownSnapshot === undefined ? {} : {
          resolvedMarkdownInputs: resolvedMarkdownSnapshot.inputs,
          resolvedMarkdownSourcePath: resolvedMarkdownSnapshot.authoredSourcePath,
        }),
      });
      throwIfAborted(signal);
      if (editor) {
        if (target === null || !isSameOpenMarkdownTarget(this.app.workspace, file.path, target)) {
          throw new VaultWriteError("vault_target_changed", "The Markdown editor changed during the DocWen operation.");
        }
        if (sha256(editor.getValue()) !== contentSha256) {
          throw new VaultWriteError("vault_content_conflict", "The editor changed during the DocWen operation.");
        }
      } else {
        assertNoOpenMarkdownTarget(this.app, file.path);
        const current = await this.app.vault.readBinary(file);
        assertNoOpenMarkdownTarget(this.app, file.path);
        if (sha256(current) !== contentSha256) {
          throw new VaultWriteError("vault_content_conflict", "The Vault file changed during the DocWen operation.");
        }
      }
    } catch (primaryError) {
      await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
      throw primaryError;
    }
    try {
      await rm(workspace, { recursive: true, force: true });
    } catch (cleanupError) {
      throw new VaultWriteError(
        "vault_temp_cleanup_failed",
        "The isolated input workspace could not be removed.",
        { cause: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) },
      );
    }
    return result;
  }

  private async buildResolvedMarkdownInputs(
    file: TFile,
    authoredMarkdown: string,
    workspace: string,
  ): Promise<ResolvedMarkdownSnapshot> {
    const resources: Array<Record<string, unknown>> = [];
    const resourceOccurrences: Array<Record<string, unknown>> = [];
    const resourcesByPath = new Map<string, string>();
    let totalResourceBytes = 0;
    const metadataCache = this.app.metadataCache;
    const fileCache = metadataCache?.getFileCache(file);
    const embeds = [...(fileCache?.embeds ?? [])]
      .sort((left, right) => left.position.start.offset - right.position.start.offset);
    for (const embed of embeds) {
      const linked = metadataCache.getFirstLinkpathDest(embed.link, file.path);
      const requestedExtension = extensionForLink(embed.link);
      if (!(linked instanceof TFile)) {
        if (IMAGE_LIKE_EXTENSIONS.has(requestedExtension)) {
          throw new VaultWriteError(
            "vault_input_invalid",
            `Obsidian could not resolve the embedded image: ${embed.link}`,
          );
        }
        continue;
      }
      const extension = linked.extension.toLowerCase();
      const mediaType = SUPPORTED_IMAGE_MEDIA_TYPES.get(extension);
      if (!mediaType) {
        if (IMAGE_LIKE_EXTENSIONS.has(extension)) {
          throw new VaultWriteError(
            "vault_input_invalid",
            `DocWen does not support the embedded image format: ${linked.extension}`,
          );
        }
        continue;
      }
      const jsStart = embed.position.start.offset;
      const jsEnd = embed.position.end.offset;
      const authoredToken = authoredMarkdown.slice(jsStart, jsEnd);
      if (!authoredToken || authoredToken !== embed.original) {
        throw new VaultWriteError(
          "vault_input_invalid",
          `The Obsidian embed cache is stale for: ${embed.link}`,
        );
      }
      let resourceId = resourcesByPath.get(linked.path);
      if (!resourceId) {
        const content = Buffer.from(await this.app.vault.readBinary(linked));
        totalResourceBytes += content.length;
        if (content.length === 0 || totalResourceBytes > MAX_EMBEDDED_RESOURCE_BYTES) {
          throw new VaultWriteError(
            "vault_input_invalid",
            "Embedded image bytes exceed the DocWen resolved-document limit.",
          );
        }
        resourceId = `image-${resources.length + 1}`;
        resourcesByPath.set(linked.path, resourceId);
        resources.push({
          resource_id: resourceId,
          role: "linked_resource",
          media_type: mediaType,
          size_bytes: content.length,
          sha256: sha256(content),
          content_base64: content.toString("base64"),
        });
      }
      resourceOccurrences.push({
        source_start: unicodeOffset(authoredMarkdown, jsStart),
        source_end: unicodeOffset(authoredMarkdown, jsEnd),
        source_slice_sha256: sha256(authoredToken),
        authored_token: authoredToken,
        authored_locator: embed.link,
        resource_id: resourceId,
      });
    }

    const sourceSha256 = sha256(authoredMarkdown);
    const inputId = `obsidian-${sourceSha256.slice(0, 32)}`;
    const headings = resolvedHeadingTargets(authoredMarkdown, fileCache?.headings ?? []);
    let numbering: NumberingProjection;
    try {
      const numberSuite: NumberSuiteSnapshot | null = loadNumberSuiteSnapshot(
        this.app,
        authoredMarkdown,
        fileCache?.frontmatter ?? null,
      );
      numbering = numberSuite === null
        ? disabledHeadingNumbering(headings)
        : numberSuiteNumbering(authoredMarkdown, headings, numberSuite);
    } catch (error) {
      throw new VaultWriteError(
        "vault_input_invalid",
        "Number Suite returned an invalid semantic export snapshot.",
        { cause: error instanceof Error ? error.message : String(error) },
      );
    }
    const plan = numbering.plan;
    const planSha256 = sha256(canonicalJson(plan));
    const neutralDocument = {
      $schema: "urn:docwen:schema:resolved-document:v1",
      schema: "docwen.resolved_document.v1",
      input_id: inputId,
      source_sha256: sourceSha256,
      plan_sha256: planSha256,
      document: {
        authored_markdown: authoredMarkdown,
        targets: numbering.targets,
        references: numbering.references,
        resource_occurrences: resourceOccurrences,
        citations: [],
        resources,
      },
    };
    const numberingPlan = {
      $schema: "urn:docwen:schema:numbering-export-plan:v1",
      schema: "docwen.numbering_export_plan.v1",
      input_id: inputId,
      source_sha256: sourceSha256,
      plan_sha256: planSha256,
      plan,
    };
    const neutralPath = path.join(workspace, "resolved-document.json");
    const planPath = path.join(workspace, "numbering-export-plan.json");
    const authoredSourcePath = path.join(workspace, "authored-source.md");
    await Promise.all([
      writeFile(neutralPath, JSON.stringify(neutralDocument), "utf8"),
      writeFile(planPath, JSON.stringify(numberingPlan), "utf8"),
      writeFile(authoredSourcePath, authoredMarkdown, "utf8"),
    ]);
    return {
      authoredSourcePath,
      inputs: [
        {
          path: neutralPath,
          kind: "document",
          role: "neutral_document",
          logicalPath: "resolved-document.json",
          mediaType: RESOLVED_DOCUMENT_MEDIA_TYPE,
        },
        {
          path: planPath,
          kind: "resource",
          role: "numbering_export_plan",
          logicalPath: "numbering-export-plan.json",
          mediaType: NUMBERING_EXPORT_PLAN_MEDIA_TYPE,
        },
      ],
    };
  }
}

interface ResolvedTargetRecord {
  readonly source_start: number;
  readonly source_end: number;
  readonly source_slice_sha256: string;
  readonly kind: "heading" | "figure" | "table" | "equation" | "code_block";
  readonly target_id: string | null;
  readonly heading_level: number | null;
  readonly authored_text: string;
}

interface NumberingProjection {
  readonly targets: readonly ResolvedTargetRecord[];
  readonly references: readonly Record<string, unknown>[];
  readonly plan: Readonly<{
    heading_definitions: readonly Record<string, unknown>[];
    heading_instances: readonly Record<string, unknown>[];
    targets: readonly Record<string, unknown>[];
  }>;
}

function disabledHeadingNumbering(headings: readonly ResolvedTargetRecord[]): NumberingProjection {
  return {
    targets: headings,
    references: [],
    plan: {
      heading_definitions: [],
      heading_instances: [],
      targets: headings.map((heading) => disabledPlanTarget(heading)),
    },
  };
}

function disabledPlanTarget(target: ResolvedTargetRecord): Record<string, unknown> {
  return {
    source_start: target.source_start,
    source_end: target.source_end,
    kind: target.kind,
    enabled: false,
    target_id: target.target_id,
    derived_number: null,
    materialization: null,
  };
}

const NUMBER_FORMAT_FOR_DOCWEN: Readonly<Record<NumberSuiteNumberFormat, string>> = {
  arabic: "arabic_half",
  arabic_full: "arabic_full",
  chinese_lower: "chinese_lower",
  chinese_upper: "chinese_upper",
  circled: "arabic_circled",
  letter_upper: "letter_upper",
  letter_lower: "letter_lower",
  roman_upper: "roman_upper",
  roman_lower: "roman_lower",
};

const CAPTION_KIND_FOR_DOCWEN: Readonly<Record<NumberSuiteCaptionTarget["kind"], ResolvedTargetRecord["kind"]>> = {
  Figure: "figure",
  Table: "table",
  Equation: "equation",
  Code: "code_block",
};

function numberSuiteNumbering(
  source: string,
  headings: readonly ResolvedTargetRecord[],
  snapshot: NumberSuiteSnapshot,
): NumberingProjection {
  const headingsByRange = new Map(headings.map((heading) => [
    `${heading.source_start}:${heading.source_end}`,
    heading,
  ]));
  const headingFacts = new Map<string, NumberSuiteHeadingTarget>();
  for (const fact of snapshot.headingTargets) {
    const start = unicodeOffset(source, fact.sourceStartUtf16);
    const end = unicodeOffset(source, fact.sourceEndUtf16);
    const key = `${start}:${end}`;
    const heading = headingsByRange.get(key);
    if (
      heading == null
      || heading.heading_level !== fact.level
      || physicalLineNumber(source, fact.sourceStartUtf16) !== fact.line
    ) {
      throw new NumberSuiteInteropError("Number Suite Heading facts contradict the authenticated Obsidian inventory.");
    }
    assertNumberSuiteTargetIdMatchesSource(
      source,
      fact.sourceStartUtf16,
      fact.sourceEndUtf16,
      fact.targetId,
      "Heading",
    );
    headingFacts.set(key, fact);
  }

  const projectedHeadings = headings.map((heading) => {
    const fact = headingFacts.get(`${heading.source_start}:${heading.source_end}`);
    return fact == null ? heading : { ...heading, target_id: fact.targetId };
  });
  const captionTargets = snapshot.captionTargets.map((caption) => resolvedCaptionTarget(source, caption));
  const targets = [...projectedHeadings, ...captionTargets]
    .sort((left, right) => left.source_start - right.source_start
      || left.source_end - right.source_end
      || left.kind.localeCompare(right.kind));
  const targetByRange = new Map(targets.map((target) => [
    `${target.source_start}:${target.source_end}`,
    target,
  ]));
  const semanticTargets = authenticatedSemanticTargets(source, snapshot, targetByRange);
  const semanticTargetByRange = new Map(semanticTargets.map((target) => [
    `${target.sourceStartUtf16}:${target.sourceEndUtf16}`,
    target,
  ]));
  const definitions: Record<string, unknown>[] = [];
  const instances: Record<string, unknown>[] = [];
  const planTargets: Record<string, unknown>[] = [];
  const derivedByRange = new Map<string, string>();
  let headingSequence = 0;

  for (const target of targets) {
    const key = `${target.source_start}:${target.source_end}`;
    if (target.kind === "heading") {
      const fact = headingFacts.get(key);
      if (fact == null || !fact.enabled || fact.derivedNumber == null) {
        planTargets.push(disabledPlanTarget(target));
        continue;
      }
      const identity = ++headingSequence;
      const definitionId = `number-suite-heading-${identity}`;
      const instanceId = `number-suite-instance-${identity}`;
      definitions.push(headingDefinition(definitionId, fact));
      instances.push({ definition_id: definitionId, instance_id: instanceId, starts: [] });
      planTargets.push({
        source_start: target.source_start,
        source_end: target.source_end,
        kind: target.kind,
        enabled: true,
        target_id: target.target_id,
        derived_number: fact.derivedNumber,
        materialization: {
          definition_id: definitionId,
          instance_id: instanceId,
          level: fact.level,
          type: "heading_list",
        },
      });
      derivedByRange.set(key, fact.derivedNumber);
      continue;
    }

    const caption = captionFactForTarget(source, snapshot.captionTargets, target);
    if (caption == null || !caption.enabled || caption.derivedNumber == null) {
      planTargets.push(disabledPlanTarget(target));
      continue;
    }
    const startValue = Number(caption.derivedNumber);
    if (!Number.isSafeInteger(startValue) || startValue < 1 || startValue > 2_147_483_647) {
      throw new NumberSuiteInteropError("Number Suite caption number is outside the DocWen SEQ boundary.");
    }
    planTargets.push({
      source_start: target.source_start,
      source_end: target.source_end,
      kind: target.kind,
      enabled: true,
      target_id: target.target_id,
      derived_number: caption.derivedNumber,
      materialization: {
        chapter_cached_number: null,
        chapter_heading_level: null,
        chapter_heading_style: null,
        chapter_separator: null,
        counter: caption.kind,
        label_separator: " ",
        localized_label: caption.kind,
        number_format: "arabic_half",
        restart_heading_level: null,
        restart_heading_style: null,
        sequence_action: "reset_to_start",
        sequence_cached_number: caption.derivedNumber,
        start_value: startValue,
        type: "simple_seq",
      },
    });
    derivedByRange.set(key, caption.derivedNumber);
  }

  const references = snapshot.references.flatMap((reference) => {
    const sourceStart = unicodeOffset(source, reference.sourceStartUtf16);
    const sourceEnd = unicodeOffset(source, reference.sourceEndUtf16);
    const targetStart = unicodeOffset(source, reference.targetSourceStartUtf16);
    const targetEnd = unicodeOffset(source, reference.targetSourceEndUtf16);
    const targetKey = `${targetStart}:${targetEnd}`;
    const target = targetByRange.get(targetKey);
    const semanticTarget = semanticTargetByRange.get(
      `${reference.targetSourceStartUtf16}:${reference.targetSourceEndUtf16}`,
    );
    const cachedNumber = derivedByRange.get(targetKey);
    if (target == null || semanticTarget == null) {
      throw new NumberSuiteInteropError("Number Suite reference target is absent from the authenticated inventory.");
    }
    const token = source.slice(reference.sourceStartUtf16, reference.sourceEndUtf16);
    const parsedToken = parseSemanticReferenceToken(token);
    if (parsedToken.alias !== reference.alias) {
      throw new NumberSuiteInteropError("Number Suite reference alias contradicts its authored token.");
    }
    assertSemanticReferenceTarget(parsedToken, semanticTarget, semanticTargets);
    if (cachedNumber == null) {
      // resolved_document.v1 requires a non-empty cached_number. Keep a valid
      // unnumbered reference only in authored_markdown instead of inventing a
      // visible number or rejecting Number Suite's broader semantic snapshot.
      return [];
    }
    return [{
      source_start: sourceStart,
      source_end: sourceEnd,
      source_slice_sha256: sha256(token),
      authored_token: token,
      target_source_start: target.source_start,
      target_source_end: target.source_end,
      target_kind: target.kind,
      target_id: target.target_id,
      cached_number: cachedNumber,
      alias: parsedToken.alias,
    }];
  });
  return {
    targets,
    references,
    plan: {
      heading_definitions: definitions,
      heading_instances: instances,
      targets: planTargets,
    },
  };
}

function resolvedCaptionTarget(
  source: string,
  caption: NumberSuiteCaptionTarget,
): ResolvedTargetRecord {
  const sourceSlice = exactPhysicalLine(
    source,
    caption.sourceStartUtf16,
    caption.sourceEndUtf16,
    "caption",
  );
  const match = CAPTION_LINE.exec(sourceSlice);
  if (
    match?.[2] !== caption.kind
    || match[3] == null
    || semanticAuthoredText(match[3]) !== caption.authoredText
    || physicalLineNumber(source, caption.sourceStartUtf16) !== caption.line
  ) {
    throw new NumberSuiteInteropError("Number Suite caption facts contradict the exact authored source line.");
  }
  assertNumberSuiteTargetIdMatchesSource(
    source,
    caption.sourceStartUtf16,
    caption.sourceEndUtf16,
    caption.targetId,
    "caption",
  );
  return {
    source_start: unicodeOffset(source, caption.sourceStartUtf16),
    source_end: unicodeOffset(source, caption.sourceEndUtf16),
    source_slice_sha256: sha256(sourceSlice),
    kind: CAPTION_KIND_FOR_DOCWEN[caption.kind],
    target_id: caption.targetId,
    heading_level: null,
    authored_text: caption.authoredText,
  };
}

const TRAILING_BLOCK_ID = /(?:^|[ \t])\^([A-Za-z0-9-]{1,128})[ \t]*$/u;
const STANDALONE_BLOCK_ID = /^ {0,3}\^([A-Za-z0-9-]{1,128})[ \t]*$/u;
const CAPTION_LINE = /^( {0,3})(Figure|Table|Equation|Code):(?:[ \t]+)(.*\S|\S)[ \t]*$/u;
const STABLE_TARGET_ID = /^[A-Za-z0-9-]{1,128}$/u;
const BLOCK_ID_HTML_TAGS = new Set([
  "address", "article", "aside", "blockquote", "body", "caption", "center", "details", "dialog",
  "div", "dl", "fieldset", "figcaption", "figure", "footer", "form", "header", "html", "iframe",
  "main", "nav", "ol", "pre", "script", "section", "style", "table", "textarea", "ul",
]);

function exactPhysicalLine(
  source: string,
  sourceStart: number,
  sourceEnd: number,
  label: string,
): string {
  const startsAtBoundary = sourceStart === 0 || source[sourceStart - 1] === "\n";
  const endsAtBoundary = sourceEnd === source.length
    || (source[sourceEnd] === "\n" && source[sourceEnd - 1] !== "\r")
    || (source[sourceEnd] === "\r" && source[sourceEnd + 1] === "\n");
  if (
    !Number.isSafeInteger(sourceStart)
    || !Number.isSafeInteger(sourceEnd)
    || sourceStart < 0
    || sourceEnd <= sourceStart
    || sourceEnd > source.length
    || !startsAtBoundary
    || !endsAtBoundary
  ) {
    throw new NumberSuiteInteropError(
      `Number Suite ${label} does not cover one complete physical source line.`,
    );
  }
  return source.slice(sourceStart, sourceEnd);
}

function physicalLineNumber(source: string, sourceStart: number): number {
  let line = 0;
  for (let index = 0; index < sourceStart; index += 1) {
    if (source[index] === "\n") line += 1;
  }
  return line;
}

function semanticAuthoredText(value: string): string {
  const match = TRAILING_BLOCK_ID.exec(value);
  return match?.[1] == null ? value.trim() : value.slice(0, match.index).trim();
}

function semanticHeadingTitle(source: string, fact: NumberSuiteHeadingTarget): string {
  const sourceLine = exactPhysicalLine(
    source,
    fact.sourceStartUtf16,
    fact.sourceEndUtf16,
    "Heading",
  );
  const match = /^( {0,3})(#{1,9})(?:([ \t]+)(.*)|[ \t]*)$/u.exec(sourceLine);
  if (match == null || match[2]?.length !== fact.level) {
    throw new NumberSuiteInteropError(
      "Number Suite Heading facts contradict the exact authored source line.",
    );
  }
  const rawContent = match[4] ?? "";
  const closing = /^(.*?)(?:[ \t]+#+[ \t]*)$/u.exec(rawContent);
  const sourceContent = closing?.[1] ?? (/^#+[ \t]*$/u.test(rawContent) ? "" : rawContent);
  let visible = "";
  let cursor = 0;
  while (cursor < sourceContent.length) {
    const opening = sourceContent.indexOf("<!--", cursor);
    if (opening < 0) {
      visible += sourceContent.slice(cursor);
      break;
    }
    visible += sourceContent.slice(cursor, opening);
    const close = sourceContent.indexOf("-->", opening + 4);
    if (close < 0) {
      throw new NumberSuiteInteropError("Number Suite Heading contains an unclosed inline comment.");
    }
    cursor = close + 3;
  }
  return semanticAuthoredText(visible);
}

function assertNumberSuiteTargetIdMatchesSource(
  source: string,
  sourceStart: number,
  sourceEnd: number,
  targetId: string | null,
  kind: "Heading" | "caption",
): void {
  const authoredIds = authoredTargetIdsForPhysicalLine(source, sourceStart, sourceEnd);
  if (targetId === null) {
    const soleAuthoredId = authoredIds.length === 1 ? authoredIds[0] : null;
    if (
      soleAuthoredId !== null
      && semanticTargetIdOccurrenceCount(source, soleAuthoredId) === 1
    ) {
      throw new NumberSuiteInteropError(
        `Number Suite ${kind} omitted a globally unique block ID from its authenticated source line.`,
      );
    }
    return;
  }
  if (authoredIds.length !== 1 || authoredIds[0] !== targetId) {
    throw new NumberSuiteInteropError(
      `Number Suite ${kind} block ID contradicts its authenticated source line.`,
    );
  }
}

function authoredTargetIdsForPhysicalLine(
  source: string,
  sourceStart: number,
  sourceEnd: number,
): string[] {
  const sourceLine = exactPhysicalLine(source, sourceStart, sourceEnd, "target");

  const ids: string[] = [];
  const inlineId = TRAILING_BLOCK_ID.exec(sourceLine)?.[1];
  if (inlineId != null) ids.push(inlineId);

  let cursor = sourceEnd;
  if (source[cursor] === "\r") cursor += 1;
  if (source[cursor] === "\n") cursor += 1;
  let blankLines = 0;
  while (cursor < source.length) {
    const newline = source.indexOf("\n", cursor);
    const physicalEnd = newline < 0 ? source.length : newline;
    const contentEnd = physicalEnd > cursor && source[physicalEnd - 1] === "\r"
      ? physicalEnd - 1
      : physicalEnd;
    const line = source.slice(cursor, contentEnd);
    if (line.trim().length === 0) {
      blankLines += 1;
      if (blankLines > 1) break;
    } else {
      const standaloneId = STANDALONE_BLOCK_ID.exec(line)?.[1];
      if (standaloneId == null) break;
      ids.push(standaloneId);
    }
    if (newline < 0) break;
    cursor = newline + 1;
  }
  return ids;
}

function semanticTargetIdOccurrenceCount(source: string, targetId: string): number {
  const lines = source.split(/\n/u).map((raw) => raw.endsWith("\r") ? raw.slice(0, -1) : raw);
  const available = semanticBlockIdLineAvailability(lines);
  const noteContainers = noteContainerLineNumbers(lines, available);
  const targetKey = normalizeTargetId(targetId);
  let count = 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (available[index] !== true || noteContainers.has(index)) continue;
    const id = TRAILING_BLOCK_ID.exec(lines[index] ?? "")?.[1];
    if (id != null && normalizeTargetId(id) === targetKey) count += 1;
  }
  return count;
}

function noteContainerLineNumbers(
  lines: readonly string[],
  available: readonly boolean[],
): ReadonlySet<number> {
  const result = new Set<number>();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (available[index] !== true || !/^ {0,3}\[\^([^\]\r\n]+)\]:/u.test(line)) continue;
    result.add(index);
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const continuation = lines[cursor] ?? "";
      if (continuation.trim().length === 0 || /^(?: {2,}|\t)/u.test(continuation)) {
        result.add(cursor);
        continue;
      }
      break;
    }
  }
  return result;
}

function semanticBlockIdLineAvailability(lines: readonly string[]): boolean[] {
  const output: boolean[] = [];
  let inFrontmatter = false;
  let frontmatterFinished = false;
  let fenceCharacter: "`" | "~" | null = null;
  let fenceLength = 0;
  let inHtmlComment = false;
  let inObsidianComment = false;
  let rawHtmlTag: string | null = null;
  let genericHtmlBlock = false;
  for (let number = 0; number < lines.length; number += 1) {
    const line = lines[number] ?? "";
    const trimmed = line.trim();
    let available = true;
    if (number === 0 && line.replace(/^\uFEFF/u, "").trim() === "---") {
      inFrontmatter = true;
      available = false;
    } else if (inFrontmatter) {
      available = false;
      if (trimmed === "---" || trimmed === "...") {
        inFrontmatter = false;
        frontmatterFinished = true;
      }
    } else {
      if (!frontmatterFinished && number > 0) frontmatterFinished = true;
      if (/^(?: {4}|\t)/u.test(line)) {
        available = false;
      } else if (fenceCharacter !== null) {
        available = false;
        const closing = new RegExp(`^ {0,3}${fenceCharacter}{${fenceLength},}[ \\t]*$`, "u");
        if (closing.test(line)) {
          fenceCharacter = null;
          fenceLength = 0;
        }
      } else {
        const fence = /^ {0,3}(`{3,}|~{3,})/u.exec(line);
        if (fence?.[1] != null) {
          available = false;
          fenceCharacter = fence[1][0] as "`" | "~";
          fenceLength = fence[1].length;
        } else if (rawHtmlTag !== null) {
          available = false;
          if (new RegExp(`</${rawHtmlTag}[ \\t]*>`, "iu").test(line)) rawHtmlTag = null;
        } else if (genericHtmlBlock) {
          available = false;
          if (trimmed.length === 0) genericHtmlBlock = false;
        } else if (inHtmlComment) {
          available = false;
          if (line.includes("-->")) inHtmlComment = false;
        } else if (inObsidianComment) {
          available = false;
          if (line.includes("%%")) inObsidianComment = false;
        } else {
          const htmlStart = line.indexOf("<!--");
          const obsidianStart = line.indexOf("%%");
          const htmlTag = /^ {0,3}<([A-Za-z][A-Za-z0-9-]*)(?:\s|>|\/>)/u
            .exec(line)?.[1]?.toLowerCase();
          if (htmlTag != null && BLOCK_ID_HTML_TAGS.has(htmlTag)) {
            available = false;
            if (["script", "pre", "style", "textarea"].includes(htmlTag)) {
              if (!new RegExp(`</${htmlTag}[ \\t]*>`, "iu").test(line)) rawHtmlTag = htmlTag;
            } else {
              genericHtmlBlock = true;
            }
          } else if (htmlStart >= 0) {
            available = false;
            if (line.indexOf("-->", htmlStart + 4) < 0) inHtmlComment = true;
          } else if (obsidianStart >= 0) {
            available = false;
            if (line.indexOf("%%", obsidianStart + 2) < 0) inObsidianComment = true;
          }
        }
      }
    }
    output.push(available);
  }
  return output;
}

function captionFactForTarget(
  source: string,
  facts: readonly NumberSuiteCaptionTarget[],
  target: ResolvedTargetRecord,
): NumberSuiteCaptionTarget | null {
  return facts.find((fact) => (
    unicodeOffset(source, fact.sourceStartUtf16) === target.source_start
    && unicodeOffset(source, fact.sourceEndUtf16) === target.source_end
  )) ?? null;
}

interface AuthenticatedSemanticTarget {
  readonly sourceStartUtf16: number;
  readonly sourceEndUtf16: number;
  readonly title: string;
  readonly targetId: string | null;
  readonly resolved: ResolvedTargetRecord;
}

function authenticatedSemanticTargets(
  source: string,
  snapshot: NumberSuiteSnapshot,
  targetByRange: ReadonlyMap<string, ResolvedTargetRecord>,
): AuthenticatedSemanticTarget[] {
  return [
    ...snapshot.headingTargets.map((fact) => ({
      fact,
      title: semanticHeadingTitle(source, fact),
    })),
    ...snapshot.captionTargets.map((fact) => ({
      fact,
      title: `${fact.kind}: ${fact.authoredText}`.trimEnd(),
    })),
  ].map(({ fact, title }) => {
    const sourceStart = unicodeOffset(source, fact.sourceStartUtf16);
    const sourceEnd = unicodeOffset(source, fact.sourceEndUtf16);
    const resolved = targetByRange.get(`${sourceStart}:${sourceEnd}`);
    if (resolved == null || resolved.target_id !== fact.targetId) {
      throw new NumberSuiteInteropError(
        "Number Suite semantic target contradicts the authenticated target inventory.",
      );
    }
    return {
      sourceStartUtf16: fact.sourceStartUtf16,
      sourceEndUtf16: fact.sourceEndUtf16,
      title,
      targetId: fact.targetId,
      resolved,
    };
  });
}

function headingDefinition(
  definitionId: string,
  fact: NumberSuiteHeadingTarget,
): Record<string, unknown> {
  if (fact.display.length > 19) {
    throw new NumberSuiteInteropError("Number Suite Heading display exceeds the DocWen segment boundary.");
  }
  const formats = new Map<number, string>();
  for (const segment of fact.display) {
    if (segment.kind !== "counter") continue;
    if (formats.has(segment.level)) {
      throw new NumberSuiteInteropError("Number Suite Heading display repeats a counter level.");
    }
    formats.set(segment.level, NUMBER_FORMAT_FOR_DOCWEN[segment.numberFormat]);
  }
  if (!formats.has(fact.level)) {
    throw new NumberSuiteInteropError("Number Suite Heading display omits its current level.");
  }
  const levels = [...new Set([...formats.keys(), fact.level])].sort((left, right) => left - right);
  return {
    definition_id: definitionId,
    levels: levels.map((level) => {
      const numberFormat = formats.get(level) ?? "arabic_half";
      const display = level === fact.level
        ? fact.display.map((segment) => headingDisplaySegment(segment))
        : [{ counter: { level, number_format: numberFormat } }];
      const start = fact.counters[level - 1];
      if (start == null || start < 1 || start > 2_147_483_647) {
        throw new NumberSuiteInteropError("Number Suite Heading counters cannot materialize in DocWen.");
      }
      return {
        display,
        level,
        number_format: numberFormat,
        restart_after_level: null,
        start,
        suffix: "space",
      };
    }),
  };
}

function headingDisplaySegment(segment: NumberSuiteDisplaySegment): Record<string, unknown> {
  if (segment.kind === "literal") {
    if (
      segment.literal.length === 0
      || Array.from(segment.literal).length > 32
      || segment.literal.includes("%")
      || !isXml10Text(segment.literal)
    ) {
      throw new NumberSuiteInteropError("Number Suite Heading literal is outside the DocWen materialization boundary.");
    }
    return { literal: segment.literal };
  }
  return {
    counter: {
      level: segment.level,
      number_format: NUMBER_FORMAT_FOR_DOCWEN[segment.numberFormat],
    },
  };
}

function isXml10Text(value: string): boolean {
  return Array.from(value).every((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint === 0x9
      || codePoint === 0xa
      || codePoint === 0xd
      || (codePoint != null && codePoint >= 0x20 && codePoint <= 0xd7ff)
      || (codePoint != null && codePoint >= 0xe000 && codePoint <= 0xfffd)
      || (codePoint != null && codePoint >= 0x10000 && codePoint <= 0x10ffff);
  });
}

interface ParsedSemanticReferenceToken {
  readonly kind: "title" | "block";
  readonly target: string;
  readonly alias: string | null;
}

function parseSemanticReferenceToken(token: string): ParsedSemanticReferenceToken {
  if (!token.startsWith("@[[#") || !token.endsWith("]]")) {
    throw new NumberSuiteInteropError("Number Suite reference range is not a semantic reference token.");
  }
  const body = token.slice(4, -2);
  if (body.length === 0 || /[\]\r\n]/u.test(body)) {
    throw new NumberSuiteInteropError("Number Suite reference token is outside the semantic link boundary.");
  }
  const separator = body.indexOf("|");
  const rawTarget = (separator < 0 ? body : body.slice(0, separator)).trim();
  const rawAlias = separator < 0 ? null : body.slice(separator + 1);
  if (rawTarget.length === 0 || rawAlias === "") {
    throw new NumberSuiteInteropError("Number Suite reference token has an empty target or alias carrier.");
  }
  const alias = rawAlias?.trim() || null;
  if (rawTarget.startsWith("^")) {
    const target = rawTarget.slice(1);
    if (!STABLE_TARGET_ID.test(target)) {
      throw new NumberSuiteInteropError("Number Suite reference block ID is outside the stable ID boundary.");
    }
    return { kind: "block", target, alias };
  }
  return { kind: "title", target: rawTarget, alias };
}

function normalizeSemanticTitle(value: string): string {
  return value
    .replace(/\u2060/gu, "")
    .normalize("NFC")
    .trim()
    .replace(/[ \t]+/gu, " ")
    .toLowerCase();
}

function normalizeTargetId(value: string): string {
  return value.normalize("NFC").toLowerCase();
}

function assertSemanticReferenceTarget(
  token: ParsedSemanticReferenceToken,
  target: AuthenticatedSemanticTarget,
  targets: readonly AuthenticatedSemanticTarget[],
): void {
  if (token.kind === "block") {
    const expectedId = target.targetId;
    if (expectedId == null || normalizeTargetId(token.target) !== normalizeTargetId(expectedId)) {
      throw new NumberSuiteInteropError(
        "Number Suite reference block ID contradicts its authenticated target range.",
      );
    }
    const matches = targets.filter((candidate) => (
      candidate.targetId !== null
      && normalizeTargetId(candidate.targetId) === normalizeTargetId(token.target)
    ));
    if (matches.length !== 1) {
      throw new NumberSuiteInteropError("Number Suite reference block ID is ambiguous.");
    }
    return;
  }

  const normalized = normalizeSemanticTitle(token.target);
  if (normalized.length === 0 || normalized !== normalizeSemanticTitle(target.title)) {
    throw new NumberSuiteInteropError(
      "Number Suite reference title contradicts its authenticated target range.",
    );
  }
  const matches = targets.filter((candidate) => normalizeSemanticTitle(candidate.title) === normalized);
  if (matches.length !== 1) {
    throw new NumberSuiteInteropError("Number Suite reference title is ambiguous.");
  }
}

function assertNoOpenMarkdownTarget(app: App, path: string): void {
  if (locateOpenMarkdownTarget(app.workspace, path).kind !== "closed") {
    throw new VaultWriteError(
      "vault_target_changed",
      "The Markdown editor opened or became ambiguous during the DocWen operation.",
    );
  }
}

interface CachedHeadingLike {
  readonly heading: string;
  readonly level: number;
  readonly position: { readonly start: { readonly offset: number }; readonly end: { readonly offset: number } };
}

interface ScannedHeading {
  readonly jsStart: number;
  readonly jsEnd: number;
  readonly level: number;
  readonly targetId: string | null;
  readonly plainAuthoredText: string | null;
}

function resolvedHeadingTargets(
  authoredMarkdown: string,
  cached: readonly CachedHeadingLike[],
): ResolvedTargetRecord[] {
  const scanned = scanAtxHeadings(authoredMarkdown);
  const cachedByRange = new Map(cached.map((heading) => [
    `${heading.level}:${heading.position.start.offset}:${heading.position.end.offset}`,
    heading,
  ]));
  return scanned.map((heading) => {
    const cachedHeading = cachedByRange.get(`${heading.level}:${heading.jsStart}:${heading.jsEnd}`);
    const authoredText = cachedHeading?.heading ?? heading.plainAuthoredText;
    if (authoredText === null) {
      throw new VaultWriteError(
        "vault_input_invalid",
        "Obsidian heading metadata is stale; save the note before exporting a heading that contains inline markup.",
      );
    }
    const sourceSlice = authoredMarkdown.slice(heading.jsStart, heading.jsEnd);
    return {
      source_start: unicodeOffset(authoredMarkdown, heading.jsStart),
      source_end: unicodeOffset(authoredMarkdown, heading.jsEnd),
      source_slice_sha256: sha256(sourceSlice),
      kind: "heading",
      target_id: heading.targetId,
      heading_level: heading.level,
      authored_text: stripCachedTargetId(authoredText, heading.targetId),
    };
  });
}

function scanAtxHeadings(source: string): ScannedHeading[] {
  const headings: ScannedHeading[] = [];
  let cursor = 0;
  let fence: { character: "`" | "~"; length: number } | null = null;
  while (cursor < source.length) {
    const newline = source.indexOf("\n", cursor);
    const physicalEnd = newline < 0 ? source.length : newline;
    const contentEnd = physicalEnd > cursor && source[physicalEnd - 1] === "\r" ? physicalEnd - 1 : physicalEnd;
    const line = source.slice(cursor, contentEnd);
    const content = stripContainerPrefixes(line);
    if (fence !== null) {
      const closing = /^( {0,3})(`{3,}|~{3,})[ \t]*$/u.exec(content);
      if (closing && closing[2][0] === fence.character && closing[2].length >= fence.length) fence = null;
    } else {
      const opening = /^( {0,3})(`{3,}|~{3,})(.*)$/u.exec(content);
      if (opening && !(opening[2][0] === "`" && opening[3].includes("`"))) {
        fence = { character: opening[2][0] as "`" | "~", length: opening[2].length };
      } else {
        const match = /^( {0,3})(#{1,9})[ \t]+(.*?)[ \t]*$/u.exec(content);
        if (match) {
          const body = match[3].replace(/[ \t]+#+[ \t]*$/u, "").trimEnd();
          const idMatch = /^(.*?)[ \t]+\^([A-Za-z0-9-]{1,128})[ \t]*$/u.exec(body);
          const visibleSource = (idMatch?.[1] ?? body).trimEnd();
          headings.push({
            jsStart: cursor,
            jsEnd: contentEnd,
            level: match[2].length,
            targetId: idMatch?.[2] ?? null,
            plainAuthoredText: hasInlineMarkup(visibleSource) ? null : visibleSource,
          });
        }
      }
    }
    if (newline < 0) break;
    cursor = newline + 1;
  }
  return headings;
}

function stripContainerPrefixes(line: string): string {
  let remaining = line;
  while (true) {
    const quote = /^ {0,3}>[ \t]?/u.exec(remaining);
    if (quote) {
      remaining = remaining.slice(quote[0].length);
      continue;
    }
    const list = /^[ \t]*(?:[-+*]|\d{1,9}[.)])[ \t]+/u.exec(remaining);
    if (list) {
      remaining = remaining.slice(list[0].length);
      continue;
    }
    return remaining;
  }
}

function hasInlineMarkup(value: string): boolean {
  return /[\\`*_[\]<>!]/u.test(value);
}

function stripCachedTargetId(value: string, targetId: string | null): string {
  if (targetId === null) return value;
  return value.replace(new RegExp(`[ \\t]+\\^${escapeRegExp(targetId)}[ \\t]*$`, "u"), "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortJsonValue(item)]),
    );
  }
  return value;
}

function extensionForLink(link: string): string {
  const withoutAnchor = link.split("#", 1)[0] ?? link;
  const segments = withoutAnchor.replace(/\\/gu, "/").split("/");
  const finalSegment = segments[segments.length - 1] ?? "";
  const dot = finalSegment.lastIndexOf(".");
  return dot < 0 ? "" : finalSegment.slice(dot + 1).toLowerCase();
}

function unicodeOffset(value: string, utf16Offset: number): number {
  return Array.from(value.slice(0, utf16Offset)).length;
}

function decodeMarkdown(value: string | ArrayBuffer): string {
  if (typeof value === "string") return value;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(value);
  } catch (error) {
    throw new VaultWriteError(
      "vault_input_invalid",
      "The Markdown file is not valid UTF-8.",
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
}

function logicalPathFor(value: string): string {
  try {
    return normalizeLogicalPath(value);
  } catch (error) {
    throw new VaultWriteError(
      "vault_input_invalid",
      "The Vault file path is not a valid DocWen logical_path.",
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
}

function sha256(value: string | ArrayBuffer | Uint8Array): string {
  const bytes = typeof value === "string"
    ? Buffer.from(value, "utf8")
    : value instanceof ArrayBuffer
      ? Buffer.from(value)
      : Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  return createHash("sha256")
    .update(bytes)
    .digest("hex");
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new DOMException("Operation cancelled", "AbortError");
}

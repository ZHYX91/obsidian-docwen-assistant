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
import { VaultWriteError } from "./vault-write-transaction";

export interface IsolatedSnapshot {
  readonly inputPath: string;
  readonly contentSha256: string;
  readonly sourceInput: TaskInput;
  readonly inputs: readonly TaskInput[];
  readonly resolvedMarkdownInputs?: readonly [TaskInput, TaskInput];
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
      const resolvedMarkdownInputs = authoredMarkdown !== null
        ? await this.buildResolvedMarkdownInputs(file, authoredMarkdown, workspace)
        : undefined;
      result = await work({
        inputPath,
        contentSha256,
        sourceInput,
        inputs: [sourceInput],
        ...(resolvedMarkdownInputs === undefined ? {} : { resolvedMarkdownInputs }),
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
  ): Promise<readonly [TaskInput, TaskInput]> {
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
    const plan = {
      heading_definitions: [],
      heading_instances: [],
      targets: headings.map((heading) => ({
        source_start: heading.source_start,
        source_end: heading.source_end,
        kind: "heading",
        enabled: false,
        target_id: heading.target_id,
        derived_number: null,
        materialization: null,
      })),
    };
    const planSha256 = sha256(canonicalJson(plan));
    const neutralDocument = {
      $schema: "urn:docwen:schema:resolved-document:v1",
      schema: "docwen.resolved_document.v1",
      input_id: inputId,
      source_sha256: sourceSha256,
      plan_sha256: planSha256,
      document: {
        authored_markdown: authoredMarkdown,
        targets: headings,
        references: [],
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
    await writeFile(neutralPath, JSON.stringify(neutralDocument), "utf8");
    await writeFile(planPath, JSON.stringify(numberingPlan), "utf8");
    return [
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
    ];
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

function resolvedHeadingTargets(authoredMarkdown: string, cached: readonly CachedHeadingLike[]): Array<Record<string, unknown>> {
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
      if (closing && closing[2]![0] === fence.character && closing[2]!.length >= fence.length) fence = null;
    } else {
      const opening = /^( {0,3})(`{3,}|~{3,})(.*)$/u.exec(content);
      if (opening && !(opening[2]![0] === "`" && opening[3]!.includes("`"))) {
        fence = { character: opening[2]![0] as "`" | "~", length: opening[2]!.length };
      } else {
        const match = /^( {0,3})(#{1,9})[ \t]+(.*?)[ \t]*$/u.exec(content);
        if (match) {
          const body = match[3]!.replace(/[ \t]+#+[ \t]*$/u, "").trimEnd();
          const idMatch = /^(.*?)[ \t]+\^([A-Za-z0-9-]{1,128})[ \t]*$/u.exec(body);
          const visibleSource = (idMatch?.[1] ?? body).trimEnd();
          headings.push({
            jsStart: cursor,
            jsEnd: contentEnd,
            level: match[2]!.length,
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

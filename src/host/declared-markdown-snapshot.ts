/** Bind authored Markdown to explicitly linked resources; source ownership stays with VaultReadSnapshot. */
import { writeFile } from "node:fs/promises";
import * as path from "node:path";
import { setTimeout as yieldToHost } from "node:timers/promises";
import { parseLinktext, TFile, type App } from "obsidian";
import { normalizeLogicalPath, type MarkdownResourceBindings, type TaskInput } from "../docwen";
import { findUncoveredImageEmbeds, includeUncachedImages, scanImageOccurrences } from "./markdown-image-embed-coverage";
import { findUncoveredWikiNavigations, isLocalWikiNavigationLink } from "./markdown-wiki-navigation-coverage";
import { activeCachedReferences, parseAuthoredMarkdown } from "./markdown-source-ownership";
import { VaultWriteError } from "./vault-write-transaction";
import { sourceFormatForExtension } from "../docwen/formats";

export interface DeclaredMarkdownSnapshot {
  readonly inputs: readonly TaskInput[];
  readonly resourceBindings?: MarkdownResourceBindings;
}

const MAX_EMBEDDED_RESOURCE_BYTES = 6_000_000;
const SUPPORTED_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "bmp", "webp"]);
const IMAGE_LIKE_EXTENSIONS = new Set([...SUPPORTED_IMAGE_EXTENSIONS, "svg", "ico"]);

export async function buildDeclaredMarkdownInputs(
  app: App,
  file: TFile,
  authoredMarkdown: string,
  workspace: string,
  signal: AbortSignal,
  sourceInput: TaskInput,
  sourceSha256: string,
): Promise<DeclaredMarkdownSnapshot> {
  await yieldToHost(0, undefined, { signal });
  throwIfAborted(signal);
  const metadataCache = app.metadataCache;
  const fileCache = metadataCache?.getFileCache(file);
  const resources = new Map<string, TaskInput>();
  const imageBindings = new Map<string, string>();
  const wikiLinkBindings = new Map<string, string>();
  let totalResourceBytes = 0;
  const markdown = parseAuthoredMarkdown(authoredMarkdown);
  const occurrences = scanImageOccurrences(markdown);
  // Keep the parser's decision through host resolution. A cache link can still
  // contain a query or an encoded extension that is absent from a Vault path.
  const imageOffsets = new Set(occurrences.filter(item => item.requiresCache).map(item => item.image.start));
  const rawEmbeds = fileCache?.embeds ?? [];
  const activeEmbeds = activeCachedReferences(rawEmbeds, authoredMarkdown, markdown.imageSource);
  const embeds = includeUncachedImages(occurrences, activeEmbeds, rawEmbeds);
  const [missingImage] = findUncoveredImageEmbeds(occurrences, embeds);
  if (missingImage !== undefined) {
    throw imageInputError("metadata", missingImage.link);
  }

  const links = activeCachedReferences(fileCache?.links ?? [], authoredMarkdown, markdown.navigationSource);
  const [missingNavigation] = findUncoveredWikiNavigations(markdown, links);
  if (missingNavigation !== undefined) {
    throw new VaultWriteError(
      "vault_input_invalid",
      "Obsidian WikiLink metadata is incomplete for the current Markdown snapshot: " + missingNavigation.link,
    );
  }
  for (const link of links) {
    throwIfAborted(signal);
    if (!isLocalWikiNavigationLink(link.link)) continue;
    const authoredToken = authoredMarkdown.slice(
      link.position.start.offset,
      link.position.end.offset,
    );
    if (!authoredToken.startsWith("[[") || !authoredToken.endsWith("]]") || authoredToken !== link.original) {
      continue;
    }
    const linked = metadataCache.getFirstLinkpathDest(parseLinktext(link.link).path, file.path);
    if (!(linked instanceof TFile)) continue;
    const href = obsidianNavigationHref(app.vault.getName(), linked.path, link.link);
    const previous = wikiLinkBindings.get(authoredToken);
    if (previous !== undefined && previous !== href) {
      throw new VaultWriteError(
        "vault_input_invalid",
        "The link cache maps identical WikiLink tokens to different navigation targets.",
      );
    }
    wikiLinkBindings.set(authoredToken, href);
  }

  for (const embed of embeds) {
    throwIfAborted(signal);
    const linkpath = embed.linkpath ?? embed.link;
    const expectedPath = embed.sourceRelativePath === undefined
      ? null : path.posix.join(path.posix.dirname(file.path), embed.sourceRelativePath);
    const linked = expectedPath === null
      ? metadataCache.getFirstLinkpathDest(linkpath, file.path) : app.vault.getFileByPath(expectedPath);
    if (expectedPath !== null && linked?.path !== expectedPath) throw imageInputError("missing", embed.link);
    const requestedExtension = extensionForLink(embed.sourceRelativePath ?? linkpath);
    if (!(linked instanceof TFile)) {
      if (imageOffsets.has(embed.position.start.offset) || IMAGE_LIKE_EXTENSIONS.has(requestedExtension)) {
        throw imageInputError("missing", embed.link);
      }
      continue;
    }
    const extension = linked.extension.toLowerCase();
    const format = sourceFormatForExtension(extension);
    if (!format || !SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
      if (IMAGE_LIKE_EXTENSIONS.has(extension)) {
        throw new VaultWriteError(
          "vault_input_invalid",
          `DocWen does not support the embedded image format: ${linked.extension}`,
        );
      }
      if (imageOffsets.has(embed.position.start.offset)) throw imageInputError("metadata", embed.link);
      continue;
    }
    const authoredToken = authoredMarkdown.slice(
      embed.position.start.offset,
      embed.position.end.offset,
    );
    if (!authoredToken || authoredToken !== embed.original) {
      throw imageInputError("metadata", embed.link);
    }
    const logicalPath = logicalPathFor(linked.path);
    const previous = imageBindings.get(authoredToken);
    if (previous !== undefined && previous !== logicalPath) {
      throw new VaultWriteError("vault_input_invalid", "The embed cache maps identical image tokens to different resources.");
    }
    imageBindings.set(authoredToken, logicalPath);
    if (resources.has(linked.path)) continue;

    const content = await readEmbeddedImage(app, linked, MAX_EMBEDDED_RESOURCE_BYTES - totalResourceBytes, signal);
    totalResourceBytes += content.length;
    const resourcePath = path.join(workspace, `linked-${resources.size + 1}.${extension}`);
    await writeFile(resourcePath, content);
    resources.set(linked.path, {
      path: resourcePath,
      kind: "resource",
      role: "linked_resource",
      logicalPath: logicalPathFor(linked.path),
      mediaType: format.mediaType,
    });
  }

  return {
    inputs: [sourceInput, ...resources.values()],
    resourceBindings: imageBindings.size === 0 && wikiLinkBindings.size === 0 ? undefined : {
      authored_sha256: sourceSha256,
      images: [...imageBindings].map(([authored_token, logical_path]) => ({ authored_token, logical_path })),
      ...(wikiLinkBindings.size === 0 ? {} : {
        wiki_links: [...wikiLinkBindings].map(([authored_token, href]) => ({ authored_token, href })),
      }),
    },
  };
}

function imageInputError(issue: "metadata" | "missing", link: string): VaultWriteError {
  const filename = link.split(/[?#]/u, 1)[0]?.split(/[/\\]/u).pop();
  const imageName = filename?.replace(/[\p{Cc}\p{Bidi_Control}]/gu, "").slice(0, 120);
  const message = issue === "metadata" ? "Obsidian image metadata is incomplete or stale"
    : "Obsidian could not resolve the embedded image";
  return new VaultWriteError("vault_input_invalid", message + ": " + link, { imageIssue: issue, imageName });
}

/** Bound unique image reads by the remaining budget; cached sizes never replace byte checks. */
async function readEmbeddedImage(
  app: App,
  file: TFile,
  remainingBytes: number,
  signal: AbortSignal,
): Promise<Buffer> {
  throwIfAborted(signal);
  const message = "Embedded image bytes exceed the DocWen resource limit.";
  const knownSize = file.stat?.size;
  if (knownSize != null && knownSize > remainingBytes) {
    throw new VaultWriteError("vault_input_invalid", message);
  }
  const content = await app.vault.readBinary(file);
  throwIfAborted(signal);
  if (content.byteLength === 0 || content.byteLength > remainingBytes) {
    throw new VaultWriteError("vault_input_invalid", message);
  }
  return Buffer.from(content);
}

function obsidianNavigationHref(vaultName: string, resolvedPath: string, authoredLink: string): string {
  const fragmentIndex = authoredLink.indexOf("#");
  const fragment = fragmentIndex < 0 ? "" : authoredLink.slice(fragmentIndex);
  const file = encodeURIComponent(resolvedPath + fragment);
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${file}`;
}


function extensionForLink(link: string): string {
  const withoutAnchor = link.split("#", 1)[0] ?? link;
  const segments = withoutAnchor.replace(/\\/gu, "/").split("/");
  const finalSegment = segments[segments.length - 1] ?? "";
  const dot = finalSegment.lastIndexOf(".");
  return dot < 0 ? "" : finalSegment.slice(dot + 1).toLowerCase();
}

export function logicalPathFor(value: string): string {
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

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new DOMException("Operation cancelled", "AbortError");
}

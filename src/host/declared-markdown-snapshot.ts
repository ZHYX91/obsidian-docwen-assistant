/** Bind authored Markdown to explicitly linked resources; source ownership stays with VaultReadSnapshot. */
import { writeFile } from "node:fs/promises";
import * as path from "node:path";
import { setTimeout as yieldToHost } from "node:timers/promises";
import { parseLinktext, TFile, type App } from "obsidian";
import { normalizeLogicalPath, type MarkdownResourceBindings, type TaskInput } from "../docwen";
import { findUncoveredImageEmbeds } from "./markdown-image-embed-coverage";
import { findUncoveredWikiNavigations } from "./markdown-wiki-navigation-coverage";
import { VaultWriteError } from "./vault-write-transaction";

export interface DeclaredMarkdownSnapshot {
  readonly inputs: readonly TaskInput[];
  readonly resourceBindings?: MarkdownResourceBindings;
}

export const MAX_EMBEDDED_RESOURCE_BYTES = 6_000_000;
export const SUPPORTED_IMAGE_MEDIA_TYPES = new Map<string, string>([
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["gif", "image/gif"],
  ["bmp", "image/bmp"],
  ["webp", "image/webp"],
]);
export const IMAGE_LIKE_EXTENSIONS = new Set([...SUPPORTED_IMAGE_MEDIA_TYPES.keys(), "svg", "ico"]);

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
  const embeds = [...(fileCache?.embeds ?? [])]
    .sort((left, right) => left.position.start.offset - right.position.start.offset);
  const [missingImage] = findUncoveredImageEmbeds(authoredMarkdown, embeds);
  if (missingImage !== undefined) {
    throw new VaultWriteError(
      "vault_input_invalid",
      "Obsidian image metadata is incomplete for the current Markdown snapshot: " + missingImage.link,
    );
  }

  const links = [...(fileCache?.links ?? [])]
    .sort((left, right) => left.position.start.offset - right.position.start.offset);
  const [missingNavigation] = findUncoveredWikiNavigations(authoredMarkdown, links);
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
    const authoredToken = authoredMarkdown.slice(
      embed.position.start.offset,
      embed.position.end.offset,
    );
    if (!authoredToken || authoredToken !== embed.original) {
      throw new VaultWriteError(
        "vault_input_invalid",
        `The Obsidian embed cache is stale for: ${embed.link}`,
      );
    }
    const logicalPath = logicalPathFor(linked.path);
    const previous = imageBindings.get(authoredToken);
    if (previous !== undefined && previous !== logicalPath) {
      throw new VaultWriteError("vault_input_invalid", "The embed cache maps identical image tokens to different resources.");
    }
    imageBindings.set(authoredToken, logicalPath);
    if (resources.has(linked.path)) continue;

    const content = Buffer.from(await app.vault.readBinary(linked));
    totalResourceBytes += content.length;
    if (content.length === 0 || totalResourceBytes > MAX_EMBEDDED_RESOURCE_BYTES) {
      throw new VaultWriteError(
        "vault_input_invalid",
        "Embedded image bytes exceed the DocWen declared-resource limit.",
      );
    }
    const resourcePath = path.join(workspace, `linked-${resources.size + 1}.${extension}`);
    await writeFile(resourcePath, content);
    resources.set(linked.path, {
      path: resourcePath,
      kind: "resource",
      role: "linked_resource",
      logicalPath: logicalPathFor(linked.path),
      mediaType,
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


function isLocalWikiNavigationLink(link: string): boolean {
  const target = (link.split("|", 1)[0] ?? "").trim();
  if (!target || target.startsWith("#") || target.startsWith("//")) return false;
  return !/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(target);
}

function obsidianNavigationHref(vaultName: string, resolvedPath: string, authoredLink: string): string {
  const fragmentIndex = authoredLink.indexOf("#");
  const fragment = fragmentIndex < 0 ? "" : authoredLink.slice(fragmentIndex);
  const file = encodeURIComponent(resolvedPath + fragment);
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${file}`;
}


export function extensionForLink(link: string): string {
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

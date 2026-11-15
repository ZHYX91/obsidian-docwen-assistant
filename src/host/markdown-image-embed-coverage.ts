import { parseAuthoredMarkdown } from "./markdown-source-ownership";
export { maskProtectedSource } from "./markdown-source-ownership";

export interface CachedEmbedLike {
  readonly link: string;
  readonly original: string;
  readonly position: {
    readonly start: { readonly offset: number };
    readonly end: { readonly offset: number };
  };
}

export interface ScannedImageEmbed {
  readonly start: number;
  readonly end: number;
  readonly token: string;
  readonly link: string;
}

export interface DeclaredImageEmbed extends CachedEmbedLike {
  /** Only uncached references need a parsed URI path for the host resolver. */
  readonly linkpath?: string;
}

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "ico"]);

interface ImageOccurrence {
  readonly image: ScannedImageEmbed;
  readonly reference: boolean;
  readonly requiresCache: boolean;
}

function embedKey(start: number, end: number, token: string): string {
  return [start, end, token].join(":");
}

/** Host versions may omit reference images; only current, unopposed declarations fill that gap. */
export function includeUncachedReferenceImages(
  source: string,
  cachedEmbeds: readonly CachedEmbedLike[],
  rawCachedEmbeds: readonly CachedEmbedLike[] = cachedEmbeds,
): readonly DeclaredImageEmbed[] {
  const references = scanImageOccurrences(source)
    .filter(({ reference, requiresCache }) => reference && requiresCache)
    .map(({ image }) => image);
  const referenceKeys = new Set(references.map(image => embedKey(image.start, image.end, image.token)));
  // Host records are untrusted data: an extra field cannot supply our private
  // resolver locator or override the target whose coverage is checked below.
  const output: DeclaredImageEmbed[] = cachedEmbeds.map(({ link, original, position }) => ({ link, original, position }));
  for (const image of references) {
    // An exact record stays subject to target coverage below. An overlapping or
    // displaced record must not become permission to ignore stale metadata.
    const opposed = rawCachedEmbeds.some(embed => {
      const start = embed.position.start.offset;
      const end = embed.position.end.offset;
      if (start < image.end && end > image.start) return true;
      return embed.original === image.token && !referenceKeys.has(embedKey(start, end, embed.original));
    });
    if (opposed) continue;
    const linkpath = uncachedReferenceLinkpath(image.link);
    if (linkpath === null) continue;
    output.push({
      original: image.token, link: image.link, linkpath,
      position: { start: { offset: image.start }, end: { offset: image.end } },
    });
  }
  return output.sort((left, right) => left.position.start.offset - right.position.start.offset);
}

function uncachedReferenceLinkpath(link: string): string | null {
  if (referenceTargetKey(link) === null) return null;
  const pathname = link.split(/[?#]/u, 1)[0] ?? "";
  try {
    const segments = pathname.split("/").map(segment => decodeURIComponent(segment));
    // The public host resolver takes a linkpath, not a URI. Encoded separators,
    // delimiters or another percent escape have no unambiguous representation
    // here. Keep requiring exact host metadata instead of trying multiple paths.
    if (segments.some(segment => /[/\\?#%]/u.test(segment))) return null;
    return segments.join("/");
  } catch {
    return null;
  }
}

export function findUncoveredImageEmbeds(
  source: string,
  cachedEmbeds: readonly CachedEmbedLike[],
): readonly ScannedImageEmbed[] {
  const cached = new Map<string, CachedEmbedLike[]>();
  for (const embed of cachedEmbeds) {
    const key = embedKey(embed.position.start.offset, embed.position.end.offset, embed.original);
    const matches = cached.get(key) ?? [];
    matches.push(embed);
    cached.set(key, matches);
  }
  return scanImageOccurrences(source).filter(({ image, reference, requiresCache }) => {
    const matches = cached.get(embedKey(image.start, image.end, image.token));
    if (!matches?.length) return requiresCache;
    if (!reference) return false;
    // The occurrence can stay byte-identical when only its definition changes.
    // Never authorize the stale cache target (or conflicting duplicate records).
    const expected = referenceTargetKey(image.link);
    return expected === null || matches.some((embed) => referenceTargetKey(embed.link) !== expected);
  }).map(({ image }) => image);
}

export function scanAuthoredImageEmbeds(source: string): readonly ScannedImageEmbed[] {
  return scanImageOccurrences(source).filter(({ requiresCache }) => requiresCache).map(({ image }) => image);
}

function scanImageOccurrences(source: string): readonly ImageOccurrence[] {
  const { tree } = parseAuthoredMarkdown(source);
  // Container markers are not part of a label split across blockquote lines.
  // Keep the original source for tokens and offsets; this copy is only for keys.
  const labelParts: string[] = [];
  let labelPosition = 0;
  tree.iterate({ enter(node) {
    if (node.name === "QuoteMark") {
      labelParts.push(source.slice(labelPosition, node.from), " ".repeat(node.to - node.from));
      labelPosition = node.to;
    }
  } });
  const labelSource = labelParts.length ? labelParts.join("") + source.slice(labelPosition) : source;
  const references = new Map<string, string>();
  tree.iterate({ enter(node) {
    if (node.name !== "LinkReference") return;
    const label = node.node.getChild("LinkLabel");
    const destination = node.node.getChild("URL");
    if (label && destination) {
      const key = normalizeReferenceLabel(labelSource.slice(label.from + 1, label.to - 1));
      // Every definition participates, including remote/non-image destinations.
      // A later image definition must not override the first definition.
      if (!references.has(key)) references.set(key, imageDestination(source.slice(destination.from, destination.to)));
    }
    return false;
  } });
  const output: ImageOccurrence[] = [];
  tree.iterate({ enter(node) {
    if (node.name !== "Image" && node.name !== "AuthoredWikiImage") return;
    const token = source.slice(node.from, node.to);
    if (node.name === "AuthoredWikiImage") {
      const body = token.slice(3, -2);
      const link = (body.split("|", 1)[0] ?? "").trim();
      if (isLocalImageLocator(link)) {
        output.push({ image: { start: node.from, end: node.to, token, link }, reference: false, requiresCache: true });
      }
    } else {
      const destination = node.node.getChild("URL");
      const label = node.node.getChild("LinkLabel");
      const marks = node.node.getChildren("LinkMark");
      const closing = marks[1];
      const referenceLabel = label && label.to - label.from > 2
        ? labelSource.slice(label.from + 1, label.to - 1)
        : closing ? labelSource.slice(node.from + 2, closing.from) : "";
      const link = destination
        ? imageDestination(source.slice(destination.from, destination.to))
        : marks.length > 2 ? undefined : references.get(normalizeReferenceLabel(referenceLabel));
      const reference = !destination && marks.length === 2;
      const requiresCache = link !== undefined && isLocalImageLocator(link, true);
      if (reference || requiresCache) {
        output.push({ image: { start: node.from, end: node.to, token, link: link ?? "" }, reference, requiresCache });
      }
    }
    return false;
  } });
  return output.sort((left, right) => left.image.start - right.image.start);
}

function normalizeReferenceLabel(label: string): string {
  return label.replace(/\s+/gu, " ").trim().toLowerCase().toUpperCase();
}

function imageDestination(destination: string): string {
  const value = destination.startsWith("<") ? destination.slice(1, -1) : destination;
  // Decode both forms in one pass: an escaped ampersand must not introduce an
  // entity, and an entity that produces an ampersand must not be decoded twice.
  return value.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])|&(?:#[0-9]{1,7}|#[xX][0-9A-Fa-f]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});/gu,
    (match: string, escaped: string | undefined) => {
      // Escaped URI delimiters are filename characters, not a second decoding
      // instruction. A backslash-escaped %20 names a literal "%20", not a space.
      if (escaped !== undefined) return "#?%<>\\".includes(escaped) ? encodeURIComponent(escaped) : escaped;
      // Only one regex-validated entity reaches the detached host parser. The
      // prefix preserves whitespace entities that HTML would discard at start.
      const text = new DOMParser().parseFromString("x" + match, "text/html").body.textContent;
      return text === null ? match : text.slice(1);
    });
}

function decodeImageLocator(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    // A malformed or ambiguous encoded cache target cannot establish identity.
    return null;
  }
}

function referenceTargetKey(value: string): string | null {
  try {
    // Split URI delimiters before one decoding pass. Encoded delimiters remain
    // filename characters, and %2523 stays distinct from %23 and a fragment #.
    const fragmentIndex = value.indexOf("#");
    const fragment = fragmentIndex < 0 ? null : value.slice(fragmentIndex + 1);
    const beforeFragment = fragmentIndex < 0 ? value : value.slice(0, fragmentIndex);
    const queryIndex = beforeFragment.indexOf("?");
    const query = queryIndex < 0 ? null : beforeFragment.slice(queryIndex + 1);
    const pathname = queryIndex < 0 ? beforeFragment : beforeFragment.slice(0, queryIndex);
    return JSON.stringify([
      pathname.split("/").map((segment) => decodeURIComponent(segment)),
      query === null ? null : decodeURIComponent(query),
      fragment === null ? null : decodeURIComponent(fragment),
    ]);
  } catch {
    return null;
  }
}

function isLocalImageLocator(value: string, decode = false): boolean {
  const locator = (decode ? decodeImageLocator(value) ?? value : value).trim();
  if (!locator || locator.startsWith("//") || /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(locator)) return false;
  const withoutQuery = value.trim().split("?", 1)[0] ?? value;
  const withoutAnchor = withoutQuery.split("#", 1)[0] ?? withoutQuery;
  const normalized = (decode ? decodeImageLocator(withoutAnchor) ?? withoutAnchor : withoutAnchor).replace(/\\/gu, "/");
  const segments = normalized.split("/");
  const finalSegment = segments[segments.length - 1] ?? "";
  const dot = finalSegment.lastIndexOf(".");
  if (dot < 0) return false;
  return IMAGE_EXTENSIONS.has(finalSegment.slice(dot + 1).toLowerCase());
}

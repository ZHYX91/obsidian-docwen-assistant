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

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "ico"]);

export function findUncoveredImageEmbeds(
  source: string,
  cachedEmbeds: readonly CachedEmbedLike[],
): readonly ScannedImageEmbed[] {
  const cached = new Set(cachedEmbeds.map((embed) =>
    [embed.position.start.offset, embed.position.end.offset, embed.original].join(":")));
  return scanAuthoredImageEmbeds(source).filter((image) =>
    !cached.has([image.start, image.end, image.token].join(":")));
}

export function scanAuthoredImageEmbeds(source: string): readonly ScannedImageEmbed[] {
  const { tree } = parseAuthoredMarkdown(source);
  const output: ScannedImageEmbed[] = [];
  tree.iterate({ enter(node) {
    if (node.name !== "Image" && node.name !== "AuthoredWikiImage") return;
    const token = source.slice(node.from, node.to);
    if (node.name === "AuthoredWikiImage") {
      const body = token.slice(3, -2);
      const link = (body.split("|", 1)[0] ?? "").trim();
      if (isLocalImageLocator(link)) output.push({ start: node.from, end: node.to, token, link });
    } else {
      const opening = /^!\[(?:\\.|[^\]\\\r\n])*\]\(/u.exec(token);
      if (opening) {
        const destination = scanImageDestination(source, node.from + opening[0].length);
        if (destination?.end === node.to && isLocalImageLocator(destination.link)) {
          output.push({ start: node.from, end: node.to, token, link: destination.link });
        }
      }
    }
    return false;
  } });
  return output.sort((left, right) => left.start - right.start);
}

function scanImageDestination(source: string, start: number): { link: string; end: number } | null {
  let cursor = start;
  while (source[cursor] === " " || source[cursor] === "\t") cursor += 1;
  const angled = source[cursor] === "<";
  if (angled) cursor += 1;
  const destinationStart = cursor;
  let depth = 0;
  while (cursor < source.length) {
    const character = source[cursor];
    if (character === "\n" || character === "\r") return null;
    if (character === "\\" && cursor + 1 < source.length) {
      cursor += 2;
      continue;
    }
    if (angled) {
      if (character === ">") break;
      if (character === "<") return null;
    } else {
      if (character === "(") depth += 1;
      else if (character === ")") {
        if (depth === 0) break;
        depth -= 1;
      } else if (/\s/u.test(character ?? "")) break;
    }
    cursor += 1;
  }
  if (cursor === source.length || depth !== 0 || (angled && source[cursor] !== ">")) return null;
  const link = source.slice(destinationStart, cursor).replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/gu, "$1");
  if (angled) cursor += 1;
  while (source[cursor] === " " || source[cursor] === "\t") cursor += 1;
  const titleDelimiter = source[cursor];
  if (titleDelimiter === "\"" || titleDelimiter === "'" || titleDelimiter === "(") {
    const closer = titleDelimiter === "(" ? ")" : titleDelimiter;
    cursor += 1;
    while (cursor < source.length && source[cursor] !== closer) {
      if (source[cursor] === "\n" || source[cursor] === "\r") return null;
      cursor += source[cursor] === "\\" ? 2 : 1;
    }
    if (source[cursor] !== closer) return null;
    cursor += 1;
    while (source[cursor] === " " || source[cursor] === "\t") cursor += 1;
  }
  return source[cursor] === ")" ? { link, end: cursor + 1 } : null;
}

function isLocalImageLocator(value: string): boolean {
  const locator = value.trim();
  if (!locator || locator.startsWith("//") || /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(locator)) return false;
  const withoutQuery = locator.split("?", 1)[0] ?? locator;
  const withoutAnchor = withoutQuery.split("#", 1)[0] ?? withoutQuery;
  const normalized = withoutAnchor.replace(/\\/gu, "/");
  const segments = normalized.split("/");
  const finalSegment = segments[segments.length - 1] ?? "";
  const dot = finalSegment.lastIndexOf(".");
  if (dot < 0) return false;
  return IMAGE_EXTENSIONS.has(finalSegment.slice(dot + 1).toLowerCase());
}

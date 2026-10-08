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
const BACKTICK = String.fromCharCode(96);

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
  const masked = maskProtectedSource(source, { preserveImageDestinations: true });
  const output: ScannedImageEmbed[] = [];

  for (const match of masked.matchAll(/!\[\[([^\]\r\n]+)\]\]/gu)) {
    if (match.index == null || isBackslashEscaped(source, match.index)) continue;
    const token = source.slice(match.index, match.index + match[0].length);
    const body = source.slice(match.index + 3, match.index + match[0].length - 2);
    const link = (body.split("|", 1)[0] ?? "").trim();
    if (!isLocalImageLocator(link)) continue;
    output.push({ start: match.index, end: match.index + match[0].length, token, link });
  }

  for (const match of masked.matchAll(/!\[(?:\\.|[^\]\\\r\n])*\]\(/gu)) {
    if (match.index == null || isBackslashEscaped(source, match.index)) continue;
    const destination = scanImageDestination(source, match.index + match[0].length);
    if (destination === null) continue;
    const token = source.slice(match.index, destination.end);
    const link = destination.link;
    if (!isLocalImageLocator(link)) continue;
    output.push({ start: match.index, end: destination.end, token, link });
  }

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

function isBackslashEscaped(source: string, start: number): boolean {
  let count = 0;
  for (let index = start - 1; index >= 0 && source[index] === "\\"; index -= 1) count += 1;
  return count % 2 === 1;
}

export function maskProtectedSource(
  source: string,
  { preserveImageDestinations = false }: { preserveImageDestinations?: boolean } = {},
): string {
  const characters = source.split("");
  const mask = (start: number, end: number): void => {
    for (let index = start; index < end; index += 1) {
      if (characters[index] !== "\n" && characters[index] !== "\r") characters[index] = " ";
    }
  };

  maskPairedSource(source, "<!--", "-->", mask);
  maskPairedSource(source, "%%", "%%", mask);

  let lineStart = 0;
  let lineNumber = 0;
  let inFrontmatter = false;
  let fence: { readonly character: string; readonly length: number } | null = null;
  while (lineStart < source.length) {
    const newline = source.indexOf("\n", lineStart);
    const physicalEnd = newline < 0 ? source.length : newline;
    const contentEnd = physicalEnd > lineStart && source[physicalEnd - 1] === "\r"
      ? physicalEnd - 1
      : physicalEnd;
    const line = source.slice(lineStart, contentEnd);
    const containerContent = stripContainerPrefixes(line);
    const trimmed = containerContent.trim();

    if (lineNumber === 0 && line.replace(/^\uFEFF/u, "").trim() === "---") {
      inFrontmatter = true;
      mask(lineStart, contentEnd);
    } else if (inFrontmatter) {
      mask(lineStart, contentEnd);
      if (trimmed === "---" || trimmed === "...") inFrontmatter = false;
    } else if (fence !== null) {
      mask(lineStart, contentEnd);
      const closing = new RegExp(
        "^ {0,3}" + escapeRegExp(fence.character) + "{" + String(fence.length) + ",}[ \\t]*$",
        "u",
      );
      if (closing.test(containerContent)) fence = null;
    } else {
      const opening = /^ {0,3}(\x60{3,}|~{3,})(.*)$/u.exec(containerContent);
      if (opening?.[1] != null && !(opening[1][0] === BACKTICK && (opening[2] ?? "").includes(BACKTICK))) {
        fence = { character: opening[1][0] ?? "", length: opening[1].length };
        mask(lineStart, contentEnd);
      } else if (/^(?: {4}|\t)/u.test(line)) {
        mask(lineStart, contentEnd);
      }
    }

    lineNumber += 1;
    if (newline < 0) break;
    lineStart = newline + 1;
  }

  let masked = characters.join("");
  for (const match of masked.matchAll(/<[^>\r\n]*>/gu)) {
    if (match.index == null) continue;
    const prefix = masked.slice(0, match.index);
    if (preserveImageDestinations && /!\[(?:\\.|[^\]\\\r\n])*\]\([ \t]*$/u.test(prefix)) continue;
    mask(match.index, match.index + match[0].length);
  }

  masked = characters.join("");
  for (const match of masked.matchAll(/!?\[(?:\\.|[^\]\\\r\n])*\]\(/gu)) {
    if (match.index == null || isBackslashEscaped(source, match.index)) continue;
    if (preserveImageDestinations && match[0].startsWith("!")) continue;
    const start = match.index + match[0].length;
    const destination = scanImageDestination(source, start);
    if (destination !== null) mask(start, destination.end);
  }

  masked = characters.join("");
  let cursor = 0;
  while (cursor < masked.length) {
    const start = masked.indexOf(BACKTICK, cursor);
    if (start < 0) break;
    let delimiterEnd = start;
    while (delimiterEnd < masked.length && masked[delimiterEnd] === BACKTICK) delimiterEnd += 1;
    if (isBackslashEscaped(source, start)) {
      cursor = delimiterEnd;
      continue;
    }
    const delimiter = masked.slice(start, delimiterEnd);
    const closing = findExactBacktickCloser(masked, delimiterEnd, delimiter.length);
    if (closing < 0) {
      cursor = delimiterEnd;
      continue;
    }
    const end = closing + delimiter.length;
    mask(start, end);
    masked = characters.join("");
    cursor = end;
  }

  return characters.join("");
}

function findExactBacktickCloser(source: string, start: number, length: number): number {
  const paragraphBreak = source.slice(start).search(/\r?\n[ \t]*\r?\n/u);
  const limit = paragraphBreak < 0 ? source.length : start + paragraphBreak;
  let cursor = start;
  while (cursor < limit) {
    const tick = source.indexOf(BACKTICK, cursor);
    if (tick < 0 || tick >= limit) return -1;
    let end = tick;
    while (source[end] === BACKTICK) end += 1;
    if (end - tick === length) return tick;
    cursor = end;
  }
  return -1;
}

function maskPairedSource(
  source: string,
  opener: string,
  closer: string,
  mask: (start: number, end: number) => void,
): void {
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf(opener, cursor);
    if (start < 0) return;
    const closing = source.indexOf(closer, start + opener.length);
    const end = closing < 0 ? source.length : closing + closer.length;
    mask(start, end);
    if (closing < 0) return;
    cursor = end;
  }
}

function stripContainerPrefixes(line: string): string {
  let remaining = line;
  while (true) {
    const quote = /^ {0,3}>[ \t]?/u.exec(remaining);
    if (quote != null) {
      remaining = remaining.slice(quote[0].length);
      continue;
    }
    const list = /^[ \t]*(?:[-+*]|\d{1,9}[.)])[ \t]+/u.exec(remaining);
    if (list != null) {
      remaining = remaining.slice(list[0].length);
      continue;
    }
    return remaining;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[\^$.*+?()[\]{}|\\]/gu, "\\$&");
}

import { maskProtectedSource } from "./markdown-image-embed-coverage";

export interface CachedLinkLike {
  readonly link: string;
  readonly original: string;
  readonly position: {
    readonly start: { readonly offset: number };
    readonly end: { readonly offset: number };
  };
}

export interface ScannedWikiNavigation {
  readonly start: number;
  readonly end: number;
  readonly token: string;
  readonly link: string;
}

export function findUncoveredWikiNavigations(
  source: string,
  cachedLinks: readonly CachedLinkLike[],
): readonly ScannedWikiNavigation[] {
  const cached = new Set(cachedLinks.map((link) =>
    [link.position.start.offset, link.position.end.offset, link.original].join(":")));
  return scanAuthoredWikiNavigations(source).filter((link) =>
    !cached.has([link.start, link.end, link.token].join(":")));
}

export function scanAuthoredWikiNavigations(source: string): readonly ScannedWikiNavigation[] {
  const masked = maskProtectedSource(source);
  const output: ScannedWikiNavigation[] = [];
  for (const match of masked.matchAll(/(?<!!)\[\[([^\]\r\n]+)\]\]/gu)) {
    if (match.index == null || isBackslashEscaped(source, match.index)) continue;
    const token = source.slice(match.index, match.index + match[0].length);
    const body = source.slice(match.index + 2, match.index + match[0].length - 2);
    const link = (body.split("|", 1)[0] ?? "").trim();
    if (!isLocalNavigationLocator(link)) continue;
    output.push({ start: match.index, end: match.index + match[0].length, token, link });
  }
  return output.sort((left, right) => left.start - right.start);
}

function isLocalNavigationLocator(value: string): boolean {
  const locator = value.trim();
  if (!locator || locator.startsWith("#") || locator.startsWith("//")) return false;
  return !/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(locator);
}

function isBackslashEscaped(source: string, start: number): boolean {
  let count = 0;
  for (let index = start - 1; index >= 0 && source[index] === "\\"; index -= 1) count += 1;
  return count % 2 === 1;
}

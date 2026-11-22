import { isEscaped, type AuthoredMarkdown, type CachedMarkdownReference } from "./markdown-source-ownership";

export interface ScannedWikiNavigation {
  readonly start: number;
  readonly end: number;
  readonly token: string;
  readonly link: string;
}

export function findUncoveredWikiNavigations(
  markdown: AuthoredMarkdown,
  cachedLinks: readonly CachedMarkdownReference[],
): readonly ScannedWikiNavigation[] {
  const cached = new Set(cachedLinks.map((link) =>
    [link.position.start.offset, link.position.end.offset, link.original].join(":")));
  return scanAuthoredWikiNavigations(markdown).filter((link) =>
    !cached.has([link.start, link.end, link.token].join(":")));
}

export function scanAuthoredWikiNavigations({ source, navigationSource }: AuthoredMarkdown): readonly ScannedWikiNavigation[] {
  const output: ScannedWikiNavigation[] = [];
  for (const match of navigationSource.matchAll(/(?<!!)\[\[([^\]\r\n]+)\]\]/gu)) {
    if (isEscaped(source, match.index)) continue;
    const token = source.slice(match.index, match.index + match[0].length);
    const body = source.slice(match.index + 2, match.index + match[0].length - 2);
    const link = (body.split("|", 1)[0] ?? "").trim();
    if (!isLocalWikiNavigationLink(link)) continue;
    output.push({ start: match.index, end: match.index + match[0].length, token, link });
  }
  return output;
}

export function isLocalWikiNavigationLink(value: string): boolean {
  const locator = (value.split("|", 1)[0] ?? "").trim();
  if (!locator || locator.startsWith("#") || locator.startsWith("//")) return false;
  return !/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(locator);
}

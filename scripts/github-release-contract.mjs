import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const API_ROOT = "https://api.github.com";
const API_VERSION = "2026-03-10";
const PUBLIC_DOCWEN_REPOSITORY = "ZHYX91/docwen";
const PUBLIC_DOCWEN_ASSET = "DocWen-windows-x64.zip";
const MINIMUM_DOCWEN_VERSION = Object.freeze(["0", "9", "0"]);
const RELEASE_TAG_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const HISTORICAL_RELEASE_TAG_PATTERN = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;

export function selectReleaseNotesBaseline(releases, candidateTag) {
  const candidateVersion = parseReleaseTag(candidateTag);
  const comparable = publishedStableReleases(releases, parseHistoricalStableTag);
  assertUniqueStableVersions(comparable);
  const notOlder = comparable.filter(({ version }) => compareVersion(version, candidateVersion) >= 0);
  if (notOlder.length > 0) {
    const tags = notOlder.map(({ release }) => release.tag_name).sort().join(", ");
    throw new Error(`Published stable Release is not older than ${candidateTag}: ${tags}`);
  }
  comparable.sort((left, right) => compareVersion(right.version, left.version));
  return comparable[0]?.release ?? null;
}

export function selectPublicDocWenRelease(releases) {
  const eligible = publishedStableReleases(releases)
    .filter(({ version }) => (
      version[0] === "0"
      && version[1] === "9"
      && compareVersion(version, MINIMUM_DOCWEN_VERSION) >= 0
    ))
    .sort((left, right) => compareVersion(right.version, left.version));
  if (eligible.length === 0) {
    throw new Error("No public stable DocWen 0.9.x Release exists");
  }

  const selected = eligible[0];
  if (typeof selected.release.immutable !== "boolean") {
    throw new Error(`GitHub Release ${selected.release.tag_name} has an invalid immutable field`);
  }
  if (selected.release.immutable !== true) {
    throw new Error(`Public DocWen Release ${selected.release.tag_name} is not immutable`);
  }
  if (!Array.isArray(selected.release.assets)) {
    throw new Error(`GitHub Release ${selected.release.tag_name} has an invalid assets field`);
  }
  if (typeof selected.release.html_url !== "string" || selected.release.html_url.length === 0) {
    throw new Error(`GitHub Release ${selected.release.tag_name} has an invalid html_url field`);
  }
  const packageAssets = selected.release.assets.filter((asset, index) => {
    if (!isPlainObject(asset) || typeof asset.name !== "string" || asset.name.trim().length === 0) {
      throw new Error(`GitHub Release ${selected.release.tag_name} asset ${index} has an invalid name`);
    }
    return asset.name === PUBLIC_DOCWEN_ASSET;
  });
  if (packageAssets.length !== 1) {
    throw new Error(
      `Public DocWen Release ${selected.release.tag_name} must contain exactly one ${PUBLIC_DOCWEN_ASSET}`,
    );
  }
  const asset = packageAssets[0];
  if (
    typeof asset.state !== "string" ||
    asset.state.length === 0 ||
    !Number.isSafeInteger(asset.size) ||
    asset.size <= 0
  ) {
    throw new Error(`Public DocWen asset ${PUBLIC_DOCWEN_ASSET} is not fully uploaded or has an invalid size`);
  }
  if (typeof asset.digest !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(asset.digest)) {
    throw new Error(`Public DocWen asset ${PUBLIC_DOCWEN_ASSET} has no trusted SHA-256 digest`);
  }
  if (
    typeof selected.release.html_url !== "string" ||
    !selected.release.html_url.startsWith(`https://github.com/${PUBLIC_DOCWEN_REPOSITORY}/releases/tag/`) ||
    typeof asset.browser_download_url !== "string" ||
    !asset.browser_download_url.startsWith(
      `https://github.com/${PUBLIC_DOCWEN_REPOSITORY}/releases/download/`,
    )
  ) {
    throw new Error("Public DocWen Release or asset URL is outside the canonical GitHub repository");
  }
  return { asset, release: selected.release, version: selected.version };
}

export function compareVersion(left, right) {
  for (let index = 0; index < 3; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];
    if (leftPart.length !== rightPart.length) return Math.sign(leftPart.length - rightPart.length);
    if (leftPart !== rightPart) return leftPart < rightPart ? -1 : 1;
  }
  return 0;
}

function publishedStableReleases(releases, parseTag = parseStableTag) {
  if (!Array.isArray(releases)) throw new Error("GitHub Releases response must be an array");
  return releases.flatMap((release) => {
    validateReleaseRecord(release);
    if (release.draft || release.prerelease) return [];
    const version = parseTag(release.tag_name);
    return version ? [{ release, version }] : [];
  });
}

function assertUniqueStableVersions(releases) {
  const tagsByVersion = new Map();
  for (const { release, version } of releases) {
    const key = version.join(".");
    const previous = tagsByVersion.get(key);
    if (previous) {
      throw new Error(
        `Published stable Releases have ambiguous tags for ${key}: ${[previous, release.tag_name].sort().join(", ")}`,
      );
    }
    tagsByVersion.set(key, release.tag_name);
  }
}

function validateReleaseRecord(release) {
  if (!isPlainObject(release)) throw new Error("GitHub Release record must be a plain object");
  if (typeof release.tag_name !== "string" || release.tag_name.trim().length === 0) {
    throw new Error("GitHub Release tag_name must be a non-empty string");
  }
  if (typeof release.draft !== "boolean") {
    throw new Error(`GitHub Release ${release.tag_name} draft must be boolean`);
  }
  if (typeof release.prerelease !== "boolean") {
    throw new Error(`GitHub Release ${release.tag_name} prerelease must be boolean`);
  }
  if (!Object.hasOwn(release, "published_at")) {
    throw new Error(`GitHub Release ${release.tag_name} is missing published_at`);
  }
  if (release.published_at !== null && !isValidPublishedAt(release.published_at)) {
    throw new Error(`GitHub Release ${release.tag_name} has an invalid published_at`);
  }
  if (!release.draft && !release.prerelease && release.published_at === null) {
    throw new Error(`Published stable GitHub Release ${release.tag_name} has no published_at`);
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isValidPublishedAt(value) {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/u.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;
  const timestamp = new Date(0);
  timestamp.setUTCFullYear(year, month - 1, day);
  timestamp.setUTCHours(hour, minute, second, 0);
  return timestamp.getUTCFullYear() === year &&
    timestamp.getUTCMonth() === month - 1 &&
    timestamp.getUTCDate() === day &&
    timestamp.getUTCHours() === hour &&
    timestamp.getUTCMinutes() === minute &&
    timestamp.getUTCSeconds() === second;
}

function parseReleaseTag(tag) {
  const match = RELEASE_TAG_PATTERN.exec(tag ?? "");
  if (!match) throw new Error(`Release tag must use x.y.z without a v prefix: ${String(tag ?? "")}`);
  return match.slice(1, 4);
}

function parseStableTag(tag) {
  const match = RELEASE_TAG_PATTERN.exec(tag ?? "");
  return match ? match.slice(1, 4) : null;
}

function parseHistoricalStableTag(tag) {
  const match = HISTORICAL_RELEASE_TAG_PATTERN.exec(tag ?? "");
  return match ? match.slice(1, 4) : null;
}

async function main() {
  const [mode, repository, candidateTag] = process.argv.slice(2);
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error("GH_TOKEN is required");

  if (mode === "baseline") {
    assertRepository(repository);
    const releases = await fetchAllReleases(repository, token);
    const baseline = selectReleaseNotesBaseline(releases, candidateTag);
    writeOutput("start_tag", baseline?.tag_name ?? "");
    console.log(
      baseline
        ? `Release notes baseline verified: ${baseline.tag_name}`
        : `Release notes baseline verified: ${candidateTag} is the first published stable Release`,
    );
    return;
  }

  if (mode === "docwen-core" && repository == null && candidateTag == null) {
    const metadata = await fetchJson(`/repos/${PUBLIC_DOCWEN_REPOSITORY}`, token);
    if (metadata.private !== false || metadata.visibility !== "public") {
      throw new Error(`${PUBLIC_DOCWEN_REPOSITORY} is not a public repository`);
    }
    const releases = await fetchAllReleases(PUBLIC_DOCWEN_REPOSITORY, token);
    const selected = selectPublicDocWenRelease(releases);
    writeOutput("docwen_tag", selected.release.tag_name);
    writeOutput("docwen_version", selected.version.join("."));
    writeOutput("docwen_asset_digest", selected.asset.digest);
    console.log(
      `Public DocWen dependency verified: ${selected.release.tag_name} ${PUBLIC_DOCWEN_ASSET} ${selected.asset.digest}`,
    );
    return;
  }

  throw new Error(
    "Usage: github-release-contract.mjs baseline <owner/repo> <x.y.z> | docwen-core",
  );
}

async function fetchAllReleases(repository, token) {
  const releases = [];
  for (let page = 1; page <= 100; page += 1) {
    const batch = await fetchJson(`/repos/${repository}/releases?per_page=100&page=${page}`, token);
    if (!Array.isArray(batch)) throw new Error("GitHub Releases response must be an array");
    releases.push(...batch);
    if (batch.length < 100) return releases;
  }
  throw new Error("GitHub Releases pagination exceeded the fail-closed limit");
}

async function fetchJson(path, token) {
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "docwen-assistant-release-governance",
      "X-GitHub-Api-Version": API_VERSION,
    },
  });
  if (!response.ok) throw new Error(`GitHub API request failed (${response.status}): ${path}`);
  return response.json();
}

function assertRepository(repository) {
  if (typeof repository !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) {
    throw new Error(`Invalid GitHub repository: ${String(repository ?? "")}`);
  }
}

function writeOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

const entryUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (entryUrl === import.meta.url) await main();

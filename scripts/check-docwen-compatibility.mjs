import { appendFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const PUBLIC_DOCWEN_REPOSITORY = "ZHYX91/docwen";
export const PUBLIC_DOCWEN_ASSET = "DocWen-windows-x64.zip";
const API_ROOT = "https://api.github.com";
const API_VERSION = "2026-03-10";
const MINIMUM_DOCWEN_VERSION = Object.freeze(["0", "9", "0"]);
const RELEASE_TAG_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;

export function selectPublicDocWenRelease(releases) {
  if (!Array.isArray(releases)) throw new Error("GitHub Releases response must be an array");
  const eligible = releases.flatMap((release) => {
    validateReleaseRecord(release);
    if (release.draft || release.prerelease) return [];
    const version = parseStableTag(release.tag_name);
    if (
      version === null ||
      version[0] !== "0" ||
      version[1] !== "9" ||
      compareVersion(version, MINIMUM_DOCWEN_VERSION) < 0
    ) {
      return [];
    }
    return [{ release, version }];
  }).sort((left, right) => compareVersion(right.version, left.version));

  if (eligible.length === 0) {
    throw new Error("No public stable DocWen 0.9.x Release exists");
  }
  const selected = eligible[0];
  const { release } = selected;
  if (release.immutable !== true) {
    throw new Error(`Public DocWen Release ${release.tag_name} is not immutable`);
  }
  if (!Array.isArray(release.assets)) {
    throw new Error(`GitHub Release ${release.tag_name} has an invalid assets field`);
  }
  if (
    typeof release.html_url !== "string" ||
    release.html_url !==
      `https://github.com/${PUBLIC_DOCWEN_REPOSITORY}/releases/tag/${release.tag_name}`
  ) {
    throw new Error("Public DocWen Release URL is outside the canonical GitHub repository");
  }

  const packageAssets = release.assets.filter((asset, index) => {
    if (!isPlainObject(asset) || typeof asset.name !== "string") {
      throw new Error(`GitHub Release ${release.tag_name} asset ${index} has an invalid name`);
    }
    return asset.name === PUBLIC_DOCWEN_ASSET;
  });
  if (packageAssets.length !== 1) {
    throw new Error(
      `Public DocWen Release ${release.tag_name} must contain exactly one ${PUBLIC_DOCWEN_ASSET}`,
    );
  }
  const asset = packageAssets[0];
  if (asset.state !== "uploaded" || !Number.isSafeInteger(asset.size) || asset.size <= 0) {
    throw new Error(`Public DocWen asset ${PUBLIC_DOCWEN_ASSET} is not fully uploaded`);
  }
  if (typeof asset.digest !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(asset.digest)) {
    throw new Error(`Public DocWen asset ${PUBLIC_DOCWEN_ASSET} has no trusted SHA-256 digest`);
  }
  if (
    typeof asset.browser_download_url !== "string" ||
    asset.browser_download_url !==
      `https://github.com/${PUBLIC_DOCWEN_REPOSITORY}/releases/download/` +
        `${release.tag_name}/${PUBLIC_DOCWEN_ASSET}`
  ) {
    throw new Error("Public DocWen asset URL is outside the canonical GitHub repository");
  }
  return Object.freeze({ asset, release, version: Object.freeze(selected.version) });
}

export function compareVersion(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index].length !== right[index].length) {
      return Math.sign(left[index].length - right[index].length);
    }
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  }
  return 0;
}

function validateReleaseRecord(release) {
  if (!isPlainObject(release)) throw new Error("GitHub Release record must be a plain object");
  if (typeof release.tag_name !== "string" || release.tag_name.length === 0) {
    throw new Error("GitHub Release tag_name must be a non-empty string");
  }
  if (typeof release.draft !== "boolean" || typeof release.prerelease !== "boolean") {
    throw new Error(`GitHub Release ${release.tag_name} state must be boolean`);
  }
  if (!release.draft && !release.prerelease && !isValidPublishedAt(release.published_at)) {
    throw new Error(`Published stable GitHub Release ${release.tag_name} has invalid published_at`);
  }
}

function parseStableTag(tag) {
  const match = RELEASE_TAG_PATTERN.exec(tag);
  return match ? match.slice(1, 4) : null;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function isValidPublishedAt(value) {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/u.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) {
    return false;
  }
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

async function fetchJson(apiPath, token) {
  const response = await fetch(`${API_ROOT}${apiPath}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "docwen-assistant-compatibility-preflight",
      "X-GitHub-Api-Version": API_VERSION,
    },
  });
  if (!response.ok) throw new Error(`GitHub API request failed (${response.status}): ${apiPath}`);
  return response.json();
}

async function fetchAllReleases(token) {
  const releases = [];
  for (let page = 1; page <= 100; page += 1) {
    const batch = await fetchJson(
      `/repos/${PUBLIC_DOCWEN_REPOSITORY}/releases?per_page=100&page=${page}`,
      token,
    );
    if (!Array.isArray(batch)) throw new Error("GitHub Releases response must be an array");
    releases.push(...batch);
    if (batch.length < 100) return releases;
  }
  throw new Error("GitHub Releases pagination exceeded the fail-closed limit");
}

function writeOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
}

async function main() {
  if (process.argv.length !== 2) {
    throw new Error("Usage: node scripts/check-docwen-compatibility.mjs");
  }
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error("GH_TOKEN is required");
  const repository = await fetchJson(`/repos/${PUBLIC_DOCWEN_REPOSITORY}`, token);
  if (repository?.private !== false || repository?.visibility !== "public") {
    throw new Error(`${PUBLIC_DOCWEN_REPOSITORY} is not a public repository`);
  }
  const selected = selectPublicDocWenRelease(await fetchAllReleases(token));
  writeOutput("docwen_tag", selected.release.tag_name);
  writeOutput("docwen_version", selected.version.join("."));
  writeOutput("docwen_asset_digest", selected.asset.digest);
  console.log(
    `Public DocWen compatibility verified: ${selected.release.tag_name} ` +
      `${PUBLIC_DOCWEN_ASSET} ${selected.asset.digest}`,
  );
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;
if (import.meta.url === entryPoint) await main();

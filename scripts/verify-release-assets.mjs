import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { readDeterministicZip } from "./deterministic-zip.mjs";
import {
  PRODUCTION_ASSETS,
  RELEASE_CHECKSUM_ASSET,
  assertReleaseVersion,
  releaseArchiveName,
  releaseAssetNames,
} from "./release-assets.mjs";

export async function verifyReleaseDirectory(directory, version) {
  assertReleaseVersion(version);
  const releaseRoot = resolve(directory);
  const rootStats = await lstat(releaseRoot);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    throw new Error(`Release root must be a regular directory: ${releaseRoot}`);
  }
  const expectedNames = releaseAssetNames(version);
  const entries = await readdir(releaseRoot, { withFileTypes: true });
  const actualNames = entries.map(({ name }) => name).sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error(
      `Release asset set mismatch: expected=${expectedNames.join(",")} actual=${actualNames.join(",")}`,
    );
  }
  for (const entry of entries) {
    const stats = await lstat(resolve(releaseRoot, entry.name));
    if (!entry.isFile() || entry.isSymbolicLink() || !stats.isFile() || stats.isSymbolicLink()) {
      throw new Error(`Release asset must be a regular file: ${entry.name}`);
    }
  }

  const assets = new Map();
  for (const name of expectedNames) assets.set(name, await readFile(resolve(releaseRoot, name)));
  verifyChecksumManifest(assets, version);
  verifyInstallationZip(assets, version);
  verifyManifestIdentity(assets.get("manifest.json"), version);
  return Object.freeze(
    expectedNames.map((name) => Object.freeze({
      name,
      sha256: sha256(assets.get(name)),
      size: assets.get(name).length,
    })),
  );
}

function verifyChecksumManifest(assets, version) {
  const checksumBytes = assets.get(RELEASE_CHECKSUM_ASSET);
  const checksumText = new TextDecoder("utf-8", { fatal: true }).decode(checksumBytes);
  if (checksumText.startsWith("\ufeff") || checksumText.includes("\r") || !checksumText.endsWith("\n")) {
    throw new Error("SHA256SUMS must be UTF-8 without BOM, use LF, and end with one newline");
  }
  const hashedNames = [...PRODUCTION_ASSETS, releaseArchiveName(version)].sort();
  const expected = hashedNames
    .map((name) => `${sha256(assets.get(name))}  ${name}`)
    .join("\n") + "\n";
  if (checksumText !== expected) throw new Error("SHA256SUMS does not exactly match the release assets");
}

function verifyInstallationZip(assets, version) {
  const zipEntries = readDeterministicZip(assets.get(releaseArchiveName(version)));
  const expectedNames = PRODUCTION_ASSETS.map((name) => `docwen-assistant/${name}`).sort();
  const actualNames = zipEntries.map(({ name }) => name);
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error(`Installation ZIP inventory mismatch: ${actualNames.join(",")}`);
  }
  for (const entry of zipEntries) {
    const looseName = entry.name.slice("docwen-assistant/".length);
    if (!entry.data.equals(assets.get(looseName))) {
      throw new Error(`Installation ZIP bytes differ from loose asset: ${looseName}`);
    }
  }
}

function verifyManifestIdentity(bytes, version) {
  let manifest;
  try {
    manifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    throw new Error(`manifest.json is not strict UTF-8 JSON: ${String(error)}`);
  }
  if (
    manifest?.id !== "docwen-assistant" ||
    manifest?.version !== version ||
    manifest?.minAppVersion !== "1.12.7" ||
    manifest?.isDesktopOnly !== true
  ) {
    throw new Error("manifest.json identity, version, host floor, or desktop boundary changed");
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function main() {
  const [directory, version] = process.argv.slice(2);
  if (!directory || !version) throw new Error("Usage: verify-release-assets.mjs <release-dir> <x.y.z>");
  const records = await verifyReleaseDirectory(directory, version);
  console.log(`Verified ${records.length} exact release assets in ${resolve(directory)}`);
}

const entryUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (entryUrl === import.meta.url) await main();

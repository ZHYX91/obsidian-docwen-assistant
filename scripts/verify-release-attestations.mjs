import { spawnSync } from "node:child_process";
import { lstat, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  RELEASE_VERSION_PATTERN,
  publicReleaseAssetNames,
  releaseAssetNames,
} from "./release-assets.mjs";

export function buildAttestationVerifyArguments({ repository, sourceDigest, sourceRef }, assetPath) {
  validateIdentity({ repository, sourceDigest, sourceRef });
  return [
    "attestation",
    "verify",
    assetPath,
    "--repo",
    repository,
    "--signer-workflow",
    `${repository}/.github/workflows/release.yml`,
    "--source-ref",
    sourceRef,
    "--source-digest",
    sourceDigest,
    "--deny-self-hosted-runners",
  ];
}

export async function verifyExistingReleaseAttestations(
  { releaseDirectory, repository, sourceDigest, sourceRef, tag },
  run = spawnSync,
) {
  validateReleaseIdentity({ repository, sourceDigest, sourceRef, tag });
  const releaseRoot = resolve(releaseDirectory);
  const expectedDirectoryNames = releaseAssetNames(tag);
  const expectedNames = publicReleaseAssetNames(tag);
  const rootStats = await lstat(releaseRoot);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    throw new Error(`Release root must be a regular directory: ${releaseRoot}`);
  }
  const entries = await readdir(releaseRoot, { withFileTypes: true });
  const actualNames = entries.map(({ name }) => name).sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedDirectoryNames)) {
    throw new Error(
      `Release asset set mismatch: expected=${expectedDirectoryNames.join(",")} actual=${actualNames.join(",")}`,
    );
  }
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new Error(`Release asset must be a regular file: ${entry.name}`);
    }
  }

  for (const asset of expectedNames) {
    const assetPath = resolve(releaseRoot, asset);
    const result = run(
      "gh",
      buildAttestationVerifyArguments({ repository, sourceDigest, sourceRef }, assetPath),
      { shell: false, stdio: "inherit", windowsHide: true },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`Release asset has no matching trusted provenance attestation: ${asset}`);
    }
  }
  console.log(`Trusted provenance verified for ${expectedNames.length} existing Release assets`);
}

function validateReleaseIdentity({ repository, sourceDigest, sourceRef, tag }) {
  if (!RELEASE_VERSION_PATTERN.test(tag ?? "")) {
    throw new Error("Release version must use x.y.z without a v prefix");
  }
  if (sourceRef !== `refs/tags/${tag}`) {
    throw new Error(`Attestation source ref must match refs/tags/${tag}`);
  }
  validateIdentity({ repository, sourceDigest, sourceRef });
}

function validateIdentity({ repository, sourceDigest, sourceRef }) {
  if (typeof repository !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) {
    throw new Error(`Invalid GitHub repository: ${String(repository ?? "")}`);
  }
  if (
    typeof sourceRef !== "string" ||
    !/^refs\/tags\/(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(sourceRef)
  ) {
    throw new Error(`Invalid release source ref: ${String(sourceRef ?? "")}`);
  }
  if (typeof sourceDigest !== "string" || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(sourceDigest)) {
    throw new Error(`Invalid release source digest: ${String(sourceDigest ?? "")}`);
  }
}

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  requiredEnvironment("GH_TOKEN");
  await verifyExistingReleaseAttestations({
    releaseDirectory: process.argv[2] ?? "release",
    repository: requiredEnvironment("GITHUB_REPOSITORY"),
    sourceDigest: requiredEnvironment("GITHUB_SHA"),
    sourceRef: requiredEnvironment("GITHUB_REF"),
    tag: requiredEnvironment("RELEASE_VERSION"),
  });
}

const entryUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (entryUrl === import.meta.url) await main();

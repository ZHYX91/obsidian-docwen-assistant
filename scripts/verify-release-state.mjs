import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
import { lstat, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { publicReleaseAssetNames, releaseAssetNames } from "./release-assets.mjs";

const [mode, repository, tag, releaseDirectory = "release"] = process.argv.slice(2);
if (!new Set(["before", "after"]).has(mode) || !repository?.includes("/") || !tag) {
  throw new Error("Usage: verify-release-state.mjs <before|after> <owner/repo> <tag> [release-dir]");
}
const token = process.env.GH_TOKEN;
if (!token) throw new Error("GH_TOKEN is required");
const apiVersion = "2026-03-10";
const expectedLocalAssetNames = releaseAssetNames(tag);
const expectedPublicAssetNames = publicReleaseAssetNames(tag);
const releaseRoot = resolve(releaseDirectory);
const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": apiVersion,
  "User-Agent": "docwen-assistant-release-verifier",
};

await verifyLocalAssets();

if (mode === "before") {
  const release = await api(`/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`);
  if (release.status === 404) {
    writeOutput("decision", "create");
    console.log("Release does not exist; creation is allowed after local gates");
    process.exit(0);
  }
  requireOk(release, "release query");
  await verifyPublishedRelease(release.data);
  writeOutput("decision", "noop");
  console.log("Existing immutable Release matches the local asset contract; provenance verification is required");
} else {
  await retryPublishedReleaseVerification();
  console.log("New immutable Release exactly matches the local asset contract");
}

async function verifyLocalAssets() {
  const rootStats = await lstat(releaseRoot);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    throw new Error(`Local release root must be a regular directory: ${releaseRoot}`);
  }
  const entries = await readdir(releaseRoot, { withFileTypes: true });
  const localNames = entries.map(({ name }) => name).sort();
  assertExactAssetNames(localNames, expectedLocalAssetNames, "Local release asset set");
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new Error(`Local release asset must be a regular file: ${entry.name}`);
    }
  }
}

async function verifyPublishedRelease(releaseData) {
  if (
    releaseData?.tag_name !== tag ||
    releaseData?.draft !== false ||
    releaseData?.prerelease !== false ||
    releaseData?.immutable !== true ||
    typeof releaseData?.published_at !== "string" ||
    releaseData.published_at.length === 0
  ) {
    throw new Error("Tagged Release is not a published immutable Release");
  }
  await verifyRemoteAssets(releaseData);
}

async function verifyRemoteAssets(releaseData) {
  const remoteAssets = Array.isArray(releaseData.assets) ? releaseData.assets : [];
  const remoteNames = remoteAssets.map(({ name }) => name).sort();
  assertExactAssetNames(remoteNames, expectedPublicAssetNames, "Remote Release asset set");
  for (const asset of remoteAssets) {
    const expectedAssetUrlPrefix = `https://api.github.com/repos/${repository}/releases/assets/`;
    if (typeof asset.url !== "string" || !asset.url.startsWith(expectedAssetUrlPrefix)) {
      throw new Error(`Release asset URL is outside the expected repository: ${asset.name}`);
    }
    const local = await readFile(resolve(releaseRoot, asset.name));
    const remoteResponse = await fetch(asset.url, {
      headers: { ...headers, Accept: "application/octet-stream" },
    });
    if (!remoteResponse.ok) throw new Error(`Asset download failed (${remoteResponse.status}): ${asset.name}`);
    const remote = Buffer.from(await remoteResponse.arrayBuffer());
    if (sha256(local) !== sha256(remote)) throw new Error(`Release asset hash mismatch: ${asset.name}`);
  }
}

function assertExactAssetNames(actualNames, expectedNames, label) {
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error(
      `${label} mismatch: expected=${expectedNames.join(",")} actual=${actualNames.join(",")}`,
    );
  }
}

async function retryPublishedReleaseVerification() {
  let lastError = new Error("Published Release verification did not run");
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      const release = await api(`/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`);
      requireOk(release, "release query after creation");
      await verifyPublishedRelease(release.data);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === 10) break;
      console.log(`Published Release is not yet verifiable (attempt ${attempt}/10): ${lastError.message}`);
      await delay(3_000);
    }
  }
  throw new Error(`Published Release did not reach the immutable asset contract: ${lastError.message}`);
}

async function api(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  let data = null;
  try {
    data = await response.json();
  } catch {
    // A non-JSON response fails below unless it is the one explicit pre-publication 404.
  }
  return { status: response.status, ok: response.ok, data };
}

function requireOk(response, label) {
  if (!response.ok) throw new Error(`${label} failed (${response.status})`);
}

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function writeOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

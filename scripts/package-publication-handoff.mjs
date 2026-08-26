import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createDeterministicZip, readDeterministicZip } from "./deterministic-zip.mjs";
import {
  MAIN_BUNDLE_BUDGET_BYTES,
  PUBLICATION_HANDOFF_NAME,
  RELEASE_VERSION_PATTERN,
  releaseAssetNames,
} from "./release-assets.mjs";
import { verifyReleaseDirectory } from "./verify-release-assets.mjs";

const HANDOFF_SCHEMA_VERSION = 1;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const RUN_NUMBER_PATTERN = /^[1-9]\d*$/u;
const CORE_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const STABLE_TAG_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const HISTORICAL_STABLE_TAG_PATTERN = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;

export async function packagePublicationHandoff({ metadata, outputPath, releaseDirectory }) {
  const normalized = validateMetadata(metadata);
  const records = await verifyReleaseDirectory(releaseDirectory, normalized.version);
  const releaseRoot = resolve(releaseDirectory);
  const document = Object.freeze({
    schemaVersion: HANDOFF_SCHEMA_VERSION,
    repository: normalized.repository,
    sourceCommit: normalized.sourceCommit,
    sourceRef: normalized.sourceRef,
    defaultBranch: normalized.defaultBranch,
    runId: normalized.runId,
    runAttempt: normalized.runAttempt,
    version: normalized.version,
    previousReleaseTag: normalized.previousReleaseTag,
    signerWorkflow: `${normalized.repository}/.github/workflows/release.yml`,
    publicationArtifactName: normalized.publicationArtifactName,
    mainBundleBudgetBytes: MAIN_BUNDLE_BUDGET_BYTES,
    docwenCore: normalized.docwenCore,
    releaseAssets: records,
  });
  const entries = [{ name: "handoff.json", data: canonicalJsonBytes(document) }];
  for (const name of releaseAssetNames(normalized.version)) {
    entries.push({ name: `release/${name}`, data: await readFile(resolve(releaseRoot, name)) });
  }
  const archive = createDeterministicZip(entries);
  verifyPublicationHandoff(archive, document);
  const destination = resolve(outputPath);
  if (destination.split(/[\\/]/u).at(-1) !== PUBLICATION_HANDOFF_NAME) {
    throw new Error(`Publication handoff must be named ${PUBLICATION_HANDOFF_NAME}`);
  }
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, archive, { flag: "wx" });
  return Object.freeze({
    document,
    sha256: sha256(archive),
    size: archive.length,
  });
}

export function verifyPublicationHandoff(archive, expectedDocument) {
  const entries = readDeterministicZip(archive);
  const expectedNames = [
    "handoff.json",
    ...releaseAssetNames(expectedDocument.version).map((name) => `release/${name}`),
  ].sort((left, right) => left.localeCompare(right, "en"));
  const actualNames = entries.map(({ name }) => name);
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error(`Publication handoff inventory mismatch: ${actualNames.join(",")}`);
  }
  const handoffEntry = entries.find(({ name }) => name === "handoff.json");
  const parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(handoffEntry.data));
  if (!handoffEntry.data.equals(canonicalJsonBytes(parsed))) {
    throw new Error("Publication handoff JSON is not canonical");
  }
  if (!canonicalJsonBytes(parsed).equals(canonicalJsonBytes(expectedDocument))) {
    throw new Error("Publication handoff identity document changed during packaging");
  }
  for (const record of parsed.releaseAssets) {
    const entry = entries.find(({ name }) => name === `release/${record.name}`);
    if (!entry || entry.data.length !== record.size || sha256(entry.data) !== record.sha256) {
      throw new Error(`Publication handoff release asset mismatch: ${record.name}`);
    }
  }
  return Object.freeze({ document: parsed, entries });
}

function validateMetadata(value) {
  const metadata = value && typeof value === "object" ? value : {};
  if (!REPOSITORY_PATTERN.test(metadata.repository ?? "")) throw new Error("Invalid handoff repository");
  if (!COMMIT_PATTERN.test(metadata.sourceCommit ?? "")) throw new Error("Invalid handoff source commit");
  if (!RELEASE_VERSION_PATTERN.test(metadata.version ?? "")) throw new Error("Invalid handoff version");
  if (metadata.sourceRef !== `refs/tags/${metadata.version}`) throw new Error("Invalid handoff source ref");
  if (!/^[A-Za-z0-9._/-]+$/u.test(metadata.defaultBranch ?? "")) throw new Error("Invalid default branch");
  if (!RUN_NUMBER_PATTERN.test(metadata.runId ?? "") || !RUN_NUMBER_PATTERN.test(metadata.runAttempt ?? "")) {
    throw new Error("Invalid workflow run identity");
  }
  if (
    metadata.previousReleaseTag !== "" &&
    !HISTORICAL_STABLE_TAG_PATTERN.test(metadata.previousReleaseTag ?? "")
  ) {
    throw new Error("Invalid previous stable Release tag");
  }
  if (
    metadata.publicationArtifactName !==
    `docwen-assistant-publication-${metadata.runId}-${metadata.runAttempt}`
  ) {
    throw new Error("Publication artifact name is not bound to run_id + run_attempt");
  }
  const core = metadata.docwenCore && typeof metadata.docwenCore === "object" ? metadata.docwenCore : {};
  if (
    !STABLE_TAG_PATTERN.test(core.tag ?? "") ||
    !RELEASE_VERSION_PATTERN.test(core.version ?? "") ||
    !CORE_DIGEST_PATTERN.test(core.assetDigest ?? "")
  ) {
    throw new Error("Invalid verified DocWen Core dependency identity");
  }
  return Object.freeze({
    repository: metadata.repository,
    sourceCommit: metadata.sourceCommit,
    sourceRef: metadata.sourceRef,
    defaultBranch: metadata.defaultBranch,
    runId: metadata.runId,
    runAttempt: metadata.runAttempt,
    version: metadata.version,
    previousReleaseTag: metadata.previousReleaseTag,
    publicationArtifactName: metadata.publicationArtifactName,
    docwenCore: Object.freeze({
      tag: core.tag,
      version: core.version,
      assetDigest: core.assetDigest,
    }),
  });
}

function canonicalJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(sortJson(value), null, 2)}\n`, "utf8");
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, item]) => [key, sortJson(item)]),
  );
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const [releaseDirectory, outputPath] = process.argv.slice(2);
  if (!releaseDirectory || !outputPath) {
    throw new Error("Usage: package-publication-handoff.mjs <release-dir> <output-zip>");
  }
  const result = await packagePublicationHandoff({
    releaseDirectory,
    outputPath,
    metadata: {
      repository: requiredEnvironment("GITHUB_REPOSITORY"),
      sourceCommit: requiredEnvironment("GITHUB_SHA"),
      sourceRef: requiredEnvironment("GITHUB_REF"),
      defaultBranch: requiredEnvironment("GITHUB_DEFAULT_BRANCH"),
      runId: requiredEnvironment("GITHUB_RUN_ID"),
      runAttempt: requiredEnvironment("GITHUB_RUN_ATTEMPT"),
      version: requiredEnvironment("RELEASE_VERSION"),
      previousReleaseTag: process.env.PREVIOUS_RELEASE_TAG ?? "",
      publicationArtifactName: requiredEnvironment("PUBLICATION_ARTIFACT_NAME"),
      docwenCore: {
        tag: requiredEnvironment("DOCWEN_TAG"),
        version: requiredEnvironment("DOCWEN_VERSION"),
        assetDigest: requiredEnvironment("DOCWEN_ASSET_DIGEST"),
      },
    },
  });
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `handoff_sha256=${result.sha256}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `handoff_size=${String(result.size)}\n`);
  }
  console.log(`Publication handoff created: ${resolve(outputPath)} sha256:${result.sha256}`);
}

const entryUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (entryUrl === import.meta.url) await main();

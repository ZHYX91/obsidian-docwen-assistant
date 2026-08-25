import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { createDeterministicZip } from "./deterministic-zip.mjs";
import {
  PRODUCTION_ASSETS,
  RELEASE_CHECKSUM_ASSET,
  releaseArchiveName,
  releaseAssetNames,
} from "./release-assets.mjs";
import { verifyReleaseDirectory } from "./verify-release-assets.mjs";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const release = resolve(root, "release");
const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
const zipName = releaseArchiveName(manifest.version);

const distEntries = (await readdir(dist)).sort();
const expected = [...PRODUCTION_ASSETS].sort();
if (JSON.stringify(distEntries) !== JSON.stringify(expected)) {
  throw new Error(`dist must contain exactly ${expected.join(", ")}; found ${distEntries.join(", ")}`);
}

await rm(release, { recursive: true, force: true });
await mkdir(release, { recursive: true });
const zipEntries = [];
for (const asset of PRODUCTION_ASSETS) {
  const source = resolve(dist, asset);
  const data = await readFile(source);
  await copyFile(source, resolve(release, asset));
  zipEntries.push({ name: `docwen-assistant/${asset}`, data });
}

const zip = createDeterministicZip(zipEntries);
const repeatedZip = createDeterministicZip([...zipEntries].reverse());
if (!zip.equals(repeatedZip)) throw new Error("Deterministic ZIP self-check failed");
await writeFile(resolve(release, zipName), zip);

const hashedAssets = [...PRODUCTION_ASSETS, zipName].sort();
const checksums = [];
for (const asset of hashedAssets) {
  const data = await readFile(resolve(release, asset));
  checksums.push(`${createHash("sha256").update(data).digest("hex")}  ${basename(asset)}`);
}
await writeFile(resolve(release, RELEASE_CHECKSUM_ASSET), `${checksums.join("\n")}\n`, "utf8");

const expectedReleaseAssets = releaseAssetNames(manifest.version);
const releaseEntries = (await readdir(release)).sort();
if (JSON.stringify(releaseEntries) !== JSON.stringify(expectedReleaseAssets)) {
  throw new Error(
    `release must contain exactly ${expectedReleaseAssets.join(", ")}; found ${releaseEntries.join(", ")}`,
  );
}
for (const asset of expectedReleaseAssets) {
  const stats = await lstat(resolve(release, asset));
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error(`release/${asset} must be a regular file`);
  }
}

await verifyReleaseDirectory(release, manifest.version);

console.log(`Deterministic release package created: release/${zipName}`);

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { releaseAssetNames } from "./release-assets.mjs";
import { verifyReleaseDirectory } from "./verify-release-assets.mjs";

export async function verifyReproducibleRelease(firstDirectory, secondDirectory, version) {
  const firstRoot = resolve(firstDirectory);
  const secondRoot = resolve(secondDirectory);
  if (firstRoot === secondRoot) throw new Error("Reproducible builds require two distinct directories");
  const [firstRecords, secondRecords] = await Promise.all([
    verifyReleaseDirectory(firstRoot, version),
    verifyReleaseDirectory(secondRoot, version),
  ]);
  if (JSON.stringify(firstRecords) !== JSON.stringify(secondRecords)) {
    throw new Error("Independent release build digests or sizes differ");
  }
  for (const name of releaseAssetNames(version)) {
    const [first, second] = await Promise.all([
      readFile(resolve(firstRoot, name)),
      readFile(resolve(secondRoot, name)),
    ]);
    if (!first.equals(second)) throw new Error(`Independent release build bytes differ: ${name}`);
  }
  return firstRecords;
}

async function main() {
  const [firstDirectory, secondDirectory, version] = process.argv.slice(2);
  if (!firstDirectory || !secondDirectory || !version) {
    throw new Error("Usage: verify-reproducible-release.mjs <first-dir> <second-dir> <x.y.z>");
  }
  const records = await verifyReproducibleRelease(firstDirectory, secondDirectory, version);
  console.log(`Independent release builds are byte-identical across ${records.length} assets`);
}

const entryUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (entryUrl === import.meta.url) await main();

import { readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const RELEASE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;

const root = resolve(import.meta.dirname, "..");
const paths = ["package.json", "package-lock.json", "manifest.json", "versions.json"]
  .map((name) => resolve(root, name));
const originals = new Map(paths.map((file) => [file, readFileSync(file, "utf8")]));
const packageJson = JSON.parse(originals.get(paths[0]));
const packageLock = JSON.parse(originals.get(paths[1]));
const manifest = JSON.parse(originals.get(paths[2]));
const versions = JSON.parse(originals.get(paths[3]));
const requested = process.argv[2];
const next = resolveVersion(manifest.version, requested);
packageJson.version = next;
packageLock.version = next;
packageLock.packages[""].version = next;
manifest.version = next;
versions[next] = manifest.minAppVersion;
const values = [packageJson, packageLock, manifest, versions];
const temporary = paths.map((file) => `${file}.docwen-version-tmp`);
try {
  for (let index = 0; index < paths.length; index += 1) {
    writeFileSync(temporary[index], `${JSON.stringify(values[index], null, 2)}\n`, "utf8");
  }
  for (let index = 0; index < paths.length; index += 1) renameSync(temporary[index], paths[index]);
} catch (error) {
  for (const [file, content] of originals) writeFileSync(file, content, "utf8");
  for (const file of temporary) {
    try { unlinkSync(file); } catch { /* absent */ }
  }
  throw error;
}
console.log(`Version synchronized: ${next}`);

function resolveVersion(current, requested) {
  if (RELEASE_VERSION_PATTERN.test(requested ?? "")) return requested;
  if (!new Set(["major", "minor", "patch"]).has(requested)) {
    throw new Error("Usage: npm run version:set -- <x.y.z|major|minor|patch>");
  }
  const parts = current.split(".").map(Number);
  if (requested === "major") return `${parts[0] + 1}.0.0`;
  if (requested === "minor") return `${parts[0]}.${parts[1] + 1}.0`;
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

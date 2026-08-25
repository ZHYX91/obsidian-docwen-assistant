import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { RELEASE_VERSION_PATTERN } from "./release-assets.mjs";

const root = resolve(import.meta.dirname, "..");
const [manifest, packageJson, packageLock, versions] = await Promise.all(
  ["manifest.json", "package.json", "package-lock.json", "versions.json"].map(async (name) =>
    JSON.parse(await readFile(resolve(root, name), "utf8"))),
);
const tag = process.argv[2] ?? manifest.version;
if (typeof tag !== "string" || !RELEASE_VERSION_PATTERN.test(tag)) {
  throw new Error(`Release tag must use x.y.z without a v prefix: ${tag ?? ""}`);
}
if (
  tag !== manifest.version ||
  tag !== packageJson.version ||
  tag !== packageLock.version ||
  tag !== packageLock.packages?.[""]?.version
) {
  throw new Error("Tag, package, lockfile, and manifest versions must match");
}
if (versions[tag] !== manifest.minAppVersion) {
  throw new Error(`versions.json must map ${tag} to ${manifest.minAppVersion}`);
}
console.log(`Release version verified: ${tag}`);

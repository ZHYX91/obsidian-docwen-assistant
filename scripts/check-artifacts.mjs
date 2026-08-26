import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

import { MAIN_BUNDLE_BUDGET_BYTES, PRODUCTION_ASSETS } from "./release-assets.mjs";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const packageLock = JSON.parse(await readFile(resolve(root, "package-lock.json"), "utf8"));
const versions = JSON.parse(await readFile(resolve(root, "versions.json"), "utf8"));
if (
  manifest.version !== packageJson.version ||
  manifest.version !== packageLock.version ||
  manifest.version !== packageLock.packages?.[""]?.version
) {
  throw new Error("package, lockfile, and manifest versions must match");
}
if (versions[manifest.version] !== manifest.minAppVersion) {
  throw new Error("versions.json does not map the current version to minAppVersion");
}
if (manifest.minAppVersion !== "1.12.7" || manifest.id !== "docwen-assistant" || manifest.isDesktopOnly !== true) {
  throw new Error("Manifest identity, host floor, or desktop boundary changed");
}
for (const asset of PRODUCTION_ASSETS) await stat(resolve(dist, asset));
for (const asset of PRODUCTION_ASSETS.filter((name) => name !== "main.js")) {
  const [source, built] = await Promise.all([
    readFile(resolve(root, asset)),
    readFile(resolve(dist, asset)),
  ]);
  if (!source.equals(built)) throw new Error(`dist/${asset} does not match its source`);
}
const mainSize = (await stat(resolve(dist, "main.js"))).size;
if (mainSize > MAIN_BUNDLE_BUDGET_BYTES) {
  throw new Error(`dist/main.js exceeds ${MAIN_BUNDLE_BUDGET_BYTES} bytes: ${mainSize}`);
}
console.log(`Production assets verified: ${PRODUCTION_ASSETS.join(", ")}`);

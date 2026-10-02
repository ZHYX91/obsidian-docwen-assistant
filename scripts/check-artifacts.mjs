import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

import { MAIN_BUNDLE_BUDGET_BYTES, PRODUCTION_ASSETS } from "./product-assets.mjs";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const packageLock = JSON.parse(await readFile(resolve(root, "package-lock.json"), "utf8"));
const versions = JSON.parse(await readFile(resolve(root, "versions.json"), "utf8"));
const nativeBuild = JSON.parse(await readFile(resolve(root, "native/BUILD.json"), "utf8"));
const nativeSource = await readFile(resolve(root, "native/rename-directory.c"));
const embeddedNativeSource = await readFile(resolve(root, "src/docwen/publish-path-linux-x64.ts"), "utf8");
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
const mainPath = resolve(dist, "main.js");
const mainSize = (await stat(mainPath)).size;
if (mainSize > MAIN_BUNDLE_BUDGET_BYTES) {
  throw new Error(`dist/main.js exceeds ${MAIN_BUNDLE_BUDGET_BYTES} bytes: ${mainSize}`);
}

const expectedProvenance = {
  repository: "ZHYX91/docwen-openclaw",
  commit: "935f0a816da96c8f42a72ddba662d5556fa3ddd1",
  sourcePath: "native/rename-directory.c",
  binaryPath: "native/linux-x64.node",
};
const provenanceKeys = Object.keys(nativeBuild.provenance ?? {}).sort();
if (
  JSON.stringify(provenanceKeys) !== JSON.stringify(Object.keys(expectedProvenance).sort())
  || Object.entries(expectedProvenance).some(([key, value]) => nativeBuild.provenance?.[key] !== value)
) {
  throw new Error("Linux publication helper provenance changed");
}
const sourceSha256 = createHash("sha256").update(nativeSource).digest("hex");
if (sourceSha256 !== nativeBuild.sourceSha256) {
  throw new Error("Linux publication helper source digest does not match native/BUILD.json");
}
const digestMatch = /LINUX_X64_RENAME_ADDON_SHA256 = "([0-9a-f]{64})"/u.exec(embeddedNativeSource);
const payloadMatch = /LINUX_X64_RENAME_ADDON_BASE64 = \[([\s\S]*?)\]\.join\(""\);/u.exec(embeddedNativeSource);
const chunks = payloadMatch
  ? [...payloadMatch[1].matchAll(/"([A-Za-z0-9+/=]+)"/gu)].map((match) => match[1])
  : [];
if (!digestMatch || chunks.length === 0) throw new Error("Embedded Linux publication helper source is malformed");
const embeddedBytes = Buffer.from(chunks.join(""), "base64");
const embeddedSha256 = createHash("sha256").update(embeddedBytes).digest("hex");
if (embeddedSha256 !== nativeBuild.binarySha256 || embeddedSha256 !== digestMatch[1]) {
  throw new Error("Embedded Linux publication helper digest does not match native/BUILD.json");
}
const mainBundle = await readFile(mainPath, "utf8");
if (!mainBundle.includes(nativeBuild.binarySha256)) {
  throw new Error("dist/main.js is missing the pinned Linux publication helper digest");
}
let searchFrom = 0;
for (const chunk of chunks) {
  const index = mainBundle.indexOf(chunk, searchFrom);
  if (index < 0) throw new Error("dist/main.js is missing embedded Linux publication helper bytes");
  searchFrom = index + chunk.length;
}
console.log(`Production assets verified: ${PRODUCTION_ASSETS.join(", ")}; embedded Linux helper verified`);

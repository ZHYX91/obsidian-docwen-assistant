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

if (!mainBundle.includes("DOCWEN_PROCESS_OWNER_READY:1") || !mainBundle.includes("--managed")) {
  throw new Error("dist/main.js is missing the managed DocWenCLI launch contract");
}
if (mainBundle.includes("windows-x64.exe") || mainBundle.includes("DOCWEN_ASSISTANT_JOB_TARGET")) {
  throw new Error("dist/main.js still contains the retired temporary Windows executable path");
}
const linuxOwnerSource = await readFile(resolve(root, "native/linux-owner.c"));
const muslLicense = await readFile(resolve(root, "native/MUSL-LICENSE.txt"), "utf8");
for (const [arch, recordName, machine, maximum] of [
  ["x64", "LINUX-OWNER-BUILD.json", 62, 128 * 1024],
  ["arm64", "LINUX-OWNER-BUILD.arm64.json", 183, 256 * 1024],
]) {
  const build = JSON.parse(await readFile(resolve(root, "native", recordName), "utf8"));
  const module = await readFile(resolve(root, `src/docwen/linux-native-owner-${arch}.ts`), "utf8");
  const chunks = [...module.matchAll(/^ {2}"([A-Za-z0-9+/=]+)",$/gmu)].map((match) => match[1]);
  const bytes = Buffer.from(chunks.join(""), "base64");
  if (createHash("sha256").update(linuxOwnerSource).digest("hex") !== build.sourceSha256
    || createHash("sha256").update(bytes).digest("hex") !== build.binarySha256
    || bytes.length !== build.binaryBytes || bytes.length > maximum
    || bytes.subarray(0, 6).toString("hex") !== "7f454c460201"
    || bytes.readUInt16LE(18) !== machine || build.platform !== "linux" || build.arch !== arch
    || build.linkage?.kind !== "static-musl"
    || createHash("sha256").update(muslLicense).digest("hex") !== build.linkage?.licenseSha256
    || !mainBundle.includes(muslLicense.replaceAll("*/", "* /"))
    || build.provenance?.repository !== "ZHYX91/docwen-openclaw"
    || build.provenance?.sourcePath !== "native/linux-owner.c"
    || build.provenance?.sourceSha256 !== build.sourceSha256 || build.provenance?.license !== "MIT"
    || !module.includes(build.binarySha256) || !mainBundle.includes(build.binarySha256)) {
    throw new Error(`Linux ${arch} Machine owner source, payload, ELF identity or provenance mismatch`);
  }
  const offset = Number(bytes.readBigUInt64LE(32));
  for (let index = 0; index < bytes.readUInt16LE(56); index++) {
    const type = bytes.readUInt32LE(offset + index * bytes.readUInt16LE(54));
    if (type === 2 || type === 3) throw new Error("Linux Machine owner must not add a dynamic libc or interpreter requirement");
  }
  let from = 0;
  for (const chunk of chunks) {
    const index = mainBundle.indexOf(chunk, from);
    if (index < 0) throw new Error(`dist/main.js is missing embedded Linux ${arch} Machine owner bytes`);
    from = index + chunk.length;
  }
}
for (const packageName of ["markdown", "common", "highlight"]) {
  const license = (await readFile(new URL(`../node_modules/@lezer/${packageName}/LICENSE`, import.meta.url), "utf8")).trim();
  if (!mainBundle.includes(license)) throw new Error(`Bundled @lezer/${packageName} license is missing`);
}
console.log(
  `Production assets verified: ${PRODUCTION_ASSETS.join(", ")}; embedded Linux helpers and managed Windows CLI boundary verified`,
);

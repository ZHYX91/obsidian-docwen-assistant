export const PRODUCTION_ASSETS = Object.freeze([
  "main.js",
  "manifest.json",
  "styles.css",
]);

export const RELEASE_CHECKSUM_ASSET = "SHA256SUMS";
export const RELEASE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
export const MAIN_BUNDLE_BUDGET_BYTES = 1_000_000;
export const PUBLICATION_HANDOFF_NAME = "docwen-assistant-publication-handoff.zip";

export function releaseArchiveName(version) {
  assertReleaseVersion(version);
  return `docwen-assistant-${version}.zip`;
}

export function releaseAssetNames(version) {
  return Object.freeze([
    ...publicReleaseAssetNames(version),
    RELEASE_CHECKSUM_ASSET,
  ].sort());
}

export function publicReleaseAssetNames(version) {
  return Object.freeze([
    ...PRODUCTION_ASSETS,
    releaseArchiveName(version),
  ].sort());
}

export function assertReleaseVersion(version) {
  if (typeof version !== "string" || !RELEASE_VERSION_PATTERN.test(version)) {
    throw new Error("Release version must use x.y.z without a v prefix");
  }
}

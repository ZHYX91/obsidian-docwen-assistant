import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

interface Manifest {
  version: string;
}

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL("manifest.json", root), "utf8"),
) as Manifest;
const script = new URL("scripts/check-release-version.mjs", root);

function runVersionCheck(version: string) {
  return spawnSync(process.execPath, [fileURLToPath(script), version], {
    cwd: fileURLToPath(root),
    encoding: "utf8",
  });
}

describe("release version check", () => {
  it("accepts the current exact version", () => {
    const result = runVersionCheck(manifest.version);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      `Release version verified: ${manifest.version}`,
    );
  });

  it.each(["v1.2.0", "01.2.0", "1.02.0", "1.2.00", "1.2", "next"])(
    "rejects an invalid tag %s",
    (tag) => {
      const result = runVersionCheck(tag);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(
        "Release tag must use x.y.z without a v prefix",
      );
    },
  );

  it("rejects a different semantic version", () => {
    const differentVersion =
      manifest.version === "9.9.9" ? "9.9.8" : "9.9.9";

    const result = runVersionCheck(differentVersion);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Tag, package, lockfile, and manifest versions must match");
  });
});

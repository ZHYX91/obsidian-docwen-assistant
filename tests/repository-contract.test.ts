import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

interface Manifest {
  id: string;
  isDesktopOnly: boolean;
  minAppVersion: string;
  version: string;
}

interface PackageJson {
  version: string;
  devDependencies: Record<string, string>;
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(
    readFileSync(new URL(relativePath, import.meta.url), "utf8"),
  ) as T;
}

describe("repository contract", () => {
  it("uses the verified Obsidian baseline and desktop-only boundary", () => {
    const manifest = readJson<Manifest>("../manifest.json");

    expect(manifest.id).toBe("docwen-assistant");
    expect(manifest.minAppVersion).toBe("1.12.7");
    expect(manifest.isDesktopOnly).toBe(true);
  });

  it("keeps package and plugin versions aligned", () => {
    const manifest = readJson<Manifest>("../manifest.json");
    const packageJson = readJson<PackageJson>("../package.json");

    expect(packageJson.version).toBe(manifest.version);
  });

  it("keeps the 1.12.7 runtime floor and custom tabbed settings boundary explicit", () => {
    const manifest = readJson<Manifest>("../manifest.json");
    const packageJson = readJson<PackageJson>("../package.json");
    const settingsSource = readFileSync(new URL("../src/settings.ts", import.meta.url), "utf8");

    expect(manifest.minAppVersion).toBe("1.12.7");
    expect(packageJson.devDependencies.obsidian).toMatch(/^\^?1\.13\./u);
    expect(settingsSource).toContain("override display(): void");
    expect(settingsSource).toContain("override getSettingDefinitions()");
    expect(settingsSource).toContain("return [];");
    expect(settingsSource).not.toContain("getDeclarativeSettingDefinitions()");
    expect(settingsSource).toContain("override getControlValue(");
    expect(settingsSource).toContain("override async setControlValue(");
    expect(settingsSource).not.toContain("this.update()");
  });
});

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

// @ts-expect-error The JavaScript release adapter is exercised directly.
import {
  releaseConfig,
  verifyReleaseCorePin,
} from "../scripts/release.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vendorDirectory = path.join(projectRoot, "scripts", "vendor");
const runtimePath = path.join(vendorDirectory, "obsidian-release-core.mjs");
const lockPath = path.join(vendorDirectory, "obsidian-release-core.lock.json");

describe("release adapter", () => {
  it("declares only DocWen Assistant's repository-specific policy", () => {
    expect(releaseConfig).toEqual({
      schemaVersion: 1,
      plugin: {
        id: "docwen-assistant",
        name: "DocWen Assistant",
        minAppVersion: "1.12.7",
        isDesktopOnly: true,
      },
      assets: { styles: "required" },
      publication: { repository: "ZHYX91/obsidian-docwen-assistant" },
    });
    expect(Object.isFrozen(releaseConfig)).toBe(true);
    expect(Object.isFrozen(releaseConfig.plugin)).toBe(true);
    expect(Object.isFrozen(releaseConfig.assets)).toBe(true);
    expect(Object.isFrozen(releaseConfig.publication)).toBe(true);
  });

  it("binds the standalone vendored runtime to the canonical lock and identity", async () => {
    const runtime = readFileSync(runtimePath);
    const lockSource = readFileSync(lockPath, "utf8");
    const lock = JSON.parse(lockSource) as Record<string, unknown>;
    const runtimeDigest = createHash("sha256").update(runtime).digest("hex");
    const runtimeModule = await import(pathToFileURL(runtimePath).href) as {
      getReleaseCoreIdentity: () => Promise<{ sha256: string; version: string }>;
    };

    expect(lockSource).toBe(`${JSON.stringify(lock, null, 2)}\n`);
    expect(lock).toEqual({
      schemaVersion: 1,
      package: "@zhyx/obsidian-release-core",
      version: "1.0.0",
      runtime: "obsidian-release-core.mjs",
      sha256: runtimeDigest,
    });
    await expect(runtimeModule.getReleaseCoreIdentity()).resolves.toMatchObject({
      version: "1.0.0",
      sha256: runtimeDigest,
    });
    await expect(verifyReleaseCorePin()).resolves.toBeUndefined();
  });

  it("has a self-contained import closure with no private workspace path", () => {
    const adapter = readFileSync(path.join(projectRoot, "scripts", "release.mjs"), "utf8");
    const runtime = readFileSync(runtimePath, "utf8");
    const adapterImports = [...adapter.matchAll(/from "([^"]+)"/gu)]
      .map((match) => match[1]);
    const runtimeImports = [...runtime.matchAll(/from "([^"]+)"/gu)]
      .map((match) => match[1]);

    expect(adapterImports).toEqual([
      "node:fs/promises",
      "node:path",
      "node:url",
      "../release.config.mjs",
      "./vendor/obsidian-release-core.mjs",
    ]);
    expect(runtimeImports.every((specifier) => specifier.startsWith("node:"))).toBe(true);
    expect(`${adapter}\n${runtime}`).not.toMatch(
      /(?:[A-Za-z]:\\|file:\/\/|from "\.\.\/\.\.\/)/u,
    );
  });

  it("loads from a standalone clone using only repository-owned files", () => {
    const isolatedRoot = mkdtempSync(path.join(tmpdir(), "docwen-release-import-"));
    try {
      const isolatedScripts = path.join(isolatedRoot, "scripts");
      const isolatedVendor = path.join(isolatedScripts, "vendor");
      mkdirSync(isolatedVendor, { recursive: true });
      copyFileSync(path.join(projectRoot, "release.config.mjs"), path.join(
        isolatedRoot,
        "release.config.mjs",
      ));
      copyFileSync(path.join(projectRoot, "scripts", "release.mjs"), path.join(
        isolatedScripts,
        "release.mjs",
      ));
      copyFileSync(runtimePath, path.join(isolatedVendor, "obsidian-release-core.mjs"));
      copyFileSync(lockPath, path.join(isolatedVendor, "obsidian-release-core.lock.json"));

      const result = spawnSync(
        process.execPath,
        [path.join(isolatedScripts, "release.mjs")],
        { cwd: isolatedRoot, encoding: "utf8", windowsHide: true },
      );

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("Release command is required");
      expect(result.stderr).not.toContain("ERR_MODULE_NOT_FOUND");
    } finally {
      rmSync(isolatedRoot, { force: true, recursive: true });
    }
  });

  it("fails closed before core execution when the vendored lock is tampered", () => {
    const isolatedRoot = mkdtempSync(path.join(tmpdir(), "docwen-release-adapter-"));
    try {
      const isolatedScripts = path.join(isolatedRoot, "scripts");
      const isolatedVendor = path.join(isolatedScripts, "vendor");
      mkdirSync(isolatedVendor, { recursive: true });
      copyFileSync(path.join(projectRoot, "release.config.mjs"), path.join(
        isolatedRoot,
        "release.config.mjs",
      ));
      copyFileSync(path.join(projectRoot, "scripts", "release.mjs"), path.join(
        isolatedScripts,
        "release.mjs",
      ));
      copyFileSync(runtimePath, path.join(isolatedVendor, "obsidian-release-core.mjs"));
      const tampered = JSON.parse(readFileSync(lockPath, "utf8")) as Record<string, unknown>;
      tampered.sha256 = "0".repeat(64);
      writeFileSync(
        path.join(isolatedVendor, "obsidian-release-core.lock.json"),
        `${JSON.stringify(tampered, null, 2)}\n`,
        "utf8",
      );

      const result = spawnSync(
        process.execPath,
        [path.join(isolatedScripts, "release.mjs"), "validate"],
        { cwd: isolatedRoot, encoding: "utf8", windowsHide: true },
      );

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("Vendored release-core differs from its exact lock");
      expect(result.stderr).not.toContain("manifest.json is missing");
    } finally {
      rmSync(isolatedRoot, { force: true, recursive: true });
    }
  });
});

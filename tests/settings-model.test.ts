import { describe, expect, it } from "vitest";
import {
  CURRENT_SETTINGS_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  createSettingsSnapshot,
  loadSettingsData,
  normalizeSettings,
} from "../src/settings-model";

describe("settings model", () => {
  it("ignores fields that are not owned by the settings schema", () => {
    const normalized = normalizeSettings({
      unknownPath: "C:\\unowned.exe",
      unownedFlag: true,
      docwenCliPath: "D:\\DocWen\\DocWenCLI.exe",
      extractImages: false,
    });
    expect(normalized.docwenCliPath).toBe("D:\\DocWen\\DocWenCLI.exe");
    expect(normalized.extractImages).toBe(false);
    expect(normalized).not.toHaveProperty("unknownPath");
    expect(normalized).not.toHaveProperty("unownedFlag");
  });

  it("uses defaults for wrong types and non-object data", () => {
    expect(normalizeSettings({ enableOcr: "yes" }).enableOcr).toBe(DEFAULT_SETTINGS.enableOcr);
    expect(normalizeSettings({ imageMode: "external" }).imageMode).toBe(DEFAULT_SETTINGS.imageMode);
    expect(normalizeSettings(null, "win32")).toEqual(DEFAULT_SETTINGS);
  });

  it("defaults to following Obsidian and keeps only supported explicit languages", () => {
    expect(normalizeSettings({}).language).toBe("auto");
    expect(normalizeSettings({ language: "pt-BR" }).language).toBe("pt-BR");
    expect(normalizeSettings({ language: "pt" }).language).toBe("auto");
  });

  it("defaults new users to automatic discovery and preserves legacy manual paths", () => {
    expect(normalizeSettings({}, "win32").docwenConnectionMode).toBe("automatic");
    expect(normalizeSettings({
      docwenCliPath: "D:\\DocWen\\DocWenCLI.exe",
    }, "win32").docwenConnectionMode).toBe("manual");
    expect(normalizeSettings({
      docwenConnectionMode: "automatic",
      docwenCliPath: "D:\\DocWen\\DocWenCLI.exe",
    }, "win32").docwenConnectionMode).toBe("automatic");
  });

  it("uses manual installation on Linux and unsupported desktop platforms", () => {
    expect(normalizeSettings({}, "linux").docwenConnectionMode).toBe("manual");
    expect(normalizeSettings({ docwenConnectionMode: "automatic" }, "linux").docwenConnectionMode).toBe("manual");
    expect(normalizeSettings({ docwenConnectionMode: "automatic" }, "darwin").docwenConnectionMode).toBe("manual");
  });

  it("migrates unversioned settings once into the current canonical schema", () => {
    const legacy = {
      docwenCliPath: "D:\\DocWen\\DocWenCLI.exe",
      extractImages: false,
    };
    const before = structuredClone(legacy);

    const loaded = loadSettingsData(legacy, "win32");

    expect(loaded.compatibility).toEqual({
      status: "compatible",
      currentSchemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
      storedSchemaVersion: 0,
    });
    expect(loaded.settings.docwenConnectionMode).toBe("manual");
    expect(loaded.migration).toEqual(createSettingsSnapshot(loaded.settings));
    expect(legacy).toEqual(before);

    const reloaded = loadSettingsData(loaded.migration, "win32");
    expect(reloaded.settings).toEqual(loaded.settings);
    expect(reloaded.migration).toBeNull();
    expect(reloaded.compatibility.status).toBe("compatible");
  });

  it("migrates schema 1 settings, adds render DPI, and normalizes the retired table alias", () => {
    const loaded = loadSettingsData({
      schemaVersion: 1,
      tableMergeStrategy: "replicate",
      proofreadPunct: false,
    }, "win32");

    expect(loaded.compatibility).toEqual({
      status: "compatible",
      currentSchemaVersion: 2,
      storedSchemaVersion: 1,
    });
    expect(loaded.settings.tableMergeStrategy).toBe("fill");
    expect(loaded.settings.renderDpi).toBe(200);
    expect(loaded.settings.proofreadPunct).toBe(false);
    expect(loaded.migration).toEqual(createSettingsSnapshot(loaded.settings));
  });

  it("accepts only integer render DPI values from 72 through 600", () => {
    expect(normalizeSettings({ renderDpi: 72 }).renderDpi).toBe(72);
    expect(normalizeSettings({ renderDpi: 600 }).renderDpi).toBe(600);
    expect(normalizeSettings({ renderDpi: 71 }).renderDpi).toBe(200);
    expect(normalizeSettings({ renderDpi: 200.5 }).renderDpi).toBe(200);
  });

  it("fails closed for future schemas without removing unknown fields", () => {
    const future = {
      schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION + 1,
      language: "zh-CN",
      extractImages: false,
      futureBehavior: { mode: "lossless", revision: 7 },
    };
    const before = structuredClone(future);

    const loaded = loadSettingsData(future, "win32");

    expect(loaded.compatibility).toEqual({
      status: "incompatible",
      currentSchemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
      storedSchemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION + 1,
      reason: "future-schema",
    });
    expect(loaded.migration).toBeNull();
    expect(loaded.settings.language).toBe("zh-CN");
    expect(loaded.settings.extractImages).toBe(false);
    expect(future).toEqual(before);
    expect(future.futureBehavior).toEqual({ mode: "lossless", revision: 7 });
  });

  it("treats an explicit malformed schema as incompatible instead of rewriting it", () => {
    const loaded = loadSettingsData({ schemaVersion: "2", futureField: true }, "win32");

    expect(loaded.compatibility).toMatchObject({
      status: "incompatible",
      storedSchemaVersion: null,
      reason: "invalid-schema",
    });
    expect(loaded.migration).toBeNull();
  });

  it("normalizes purely and returns independent deep-copied defaults", () => {
    const source = Object.freeze({
      docwenCliPath: "D:\\DocWen\\DocWenCLI.exe",
      extractImages: false,
    });
    const first = normalizeSettings(source, "win32");
    const second = normalizeSettings(source, "win32");

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    first.docwenCliPath = "changed";
    first.extractImages = true;
    expect(second.docwenCliPath).toBe("D:\\DocWen\\DocWenCLI.exe");
    expect(second.extractImages).toBe(false);

    const defaultA = normalizeSettings(null, "win32");
    const defaultB = normalizeSettings(null, "win32");
    defaultA.docwenCliPath = "changed";
    expect(defaultB).toEqual(DEFAULT_SETTINGS);
    expect(defaultA).not.toBe(DEFAULT_SETTINGS);
  });
});

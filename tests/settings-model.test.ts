import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings } from "../src/settings-model";

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
});

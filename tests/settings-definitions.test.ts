import { describe, expect, it, vi } from "vitest";
import type { SettingDefinition } from "obsidian";
import { getSettingsPages } from "../src/settings-definitions";
import { DEFAULT_SETTINGS } from "../src/settings-model";

describe("settings page definitions", () => {
  it("builds five shared pages without filesystem or CLI work", () => {
    const renderCliPath = vi.fn();
    const renderDocWenDownload = vi.fn();
    const renderCliStatus = vi.fn();
    const renderPersistenceStatus = vi.fn();
    const renderNumberingScheme = vi.fn();
    const runDoctor = vi.fn();
    const pages = getSettingsPages({
      settings: { ...DEFAULT_SETTINGS },
      renderCliPath,
      renderDocWenDownload,
      renderCliStatus,
      renderPersistenceStatus,
      isPersistencePending: () => false,
      renderNumberingScheme,
      renderHelp: vi.fn(),
      runDoctor,
    });
    expect(pages).toHaveLength(5);
    expect(pages.map((page) => page.id)).toEqual(["general", "markdown", "word", "proofread", "usage"]);
    expect(new Set(pages.map((page) => page.name)).size).toBe(5);
    expect(collectControlKeys(pages.flatMap((page) => page.items))).toEqual(new Set([
      "language",
      "extractImages",
      "imageMode",
      "imageLinkStyle",
      "enableOcr",
      "ocrLanguage",
      "ocrPlacement",
      "tableMergeStrategy",
      "docToMdCleanNumbering",
      "headingMergeMode",
      "proofreadOnConvert",
      "proofreadTypo",
      "proofreadSymbol",
      "proofreadPunct",
      "proofreadSensitive",
    ]));
    expect(renderCliPath).not.toHaveBeenCalled();
    expect(renderDocWenDownload).not.toHaveBeenCalled();
    expect(renderCliStatus).not.toHaveBeenCalled();
    expect(renderPersistenceStatus).not.toHaveBeenCalled();
    expect(renderNumberingScheme).not.toHaveBeenCalled();
    expect(runDoctor).not.toHaveBeenCalled();
  });

  it("uses live settings for disabled state", () => {
    const settings = { ...DEFAULT_SETTINGS, extractImages: false, enableOcr: false };
    const pages = getSettingsPages({
      settings,
      renderCliPath: vi.fn(),
      renderDocWenDownload: vi.fn(),
      renderCliStatus: vi.fn(),
      renderPersistenceStatus: vi.fn(),
      isPersistencePending: () => false,
      renderNumberingScheme: vi.fn(),
      renderHelp: vi.fn(),
      runDoctor: vi.fn(),
    });
    const controls = collectControls(pages.flatMap((page) => page.items));
    expect(readDisabled(controls.get("imageMode"))).toBe(true);
    expect(readDisabled(controls.get("ocrLanguage"))).toBe(true);
    settings.extractImages = true;
    settings.enableOcr = true;
    expect(readDisabled(controls.get("imageMode"))).toBe(false);
    expect(readDisabled(controls.get("ocrLanguage"))).toBe(false);
  });

  it("keeps legacy numbering controls off the resolved Markdown-to-DOCX page", () => {
    const definitions = getSettingsPages({
      settings: { ...DEFAULT_SETTINGS },
      renderCliPath: vi.fn(),
      renderDocWenDownload: vi.fn(),
      renderCliStatus: vi.fn(),
      renderPersistenceStatus: vi.fn(),
      isPersistencePending: () => false,
      renderNumberingScheme: vi.fn(),
      renderHelp: vi.fn(),
      runDoctor: vi.fn(),
    });

    expect(collectControlKeys(definitions[1].items ?? [])).toContain("docToMdCleanNumbering");
    expect(collectControlKeys(definitions[1].items ?? [])).not.toContain("mdToDocCleanNumbering");
    expect(collectControlKeys(definitions[2].items ?? [])).toEqual(new Set(["headingMergeMode"]));
    expect(collectControlKeys(definitions[2].items ?? [])).not.toContain("docToMdCleanNumbering");
  });
});

function collectControlKeys(items: SettingDefinition[]): Set<string> {
  return new Set(collectControls(items).keys());
}

function collectControls(items: SettingDefinition[]): Map<string, { disabled?: boolean | (() => boolean) }> {
  const result = new Map<string, { disabled?: boolean | (() => boolean) }>();
  for (const item of items) {
    if (item.control) result.set(item.control.key, item.control);
  }
  return result;
}

function readDisabled(control: { disabled?: boolean | (() => boolean) } | undefined): boolean {
  const value = control?.disabled;
  return typeof value === "function" ? value() : Boolean(value);
}

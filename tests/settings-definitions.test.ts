import { describe, expect, it, vi } from "vitest";
import type { SettingDefinition } from "obsidian";
import { getSettingsPages } from "../src/settings-definitions";
import { DEFAULT_SETTINGS } from "../src/settings-model";

describe("settings page definitions", () => {
  it("builds four shared pages with contextual guides and no filesystem or CLI work", () => {
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
      renderGuide: vi.fn(),
      runDoctor,
    });
    expect(pages).toHaveLength(4);
    expect(pages.map((page) => page.id)).toEqual(["general", "markdown", "word", "proofread"]);
    expect(new Set(pages.map((page) => page.name)).size).toBe(4);
    expect(collectControlKeys(pages.flatMap((page) => page.items))).toEqual(new Set([
      "language",
      "docwenConnectionMode",
      "extractImages",
      "imageMode",
      "imageLinkStyle",
      "enableOcr",
      "ocrLanguage",
      "ocrPlacement",
      "renderDpi",
      "tableMergeStrategy",
      "docToMdCleanNumbering",
      "headingMergeMode",
      "mdToDocCleanNumbering",
      "headingNumberingRenderMode",
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

  it("explains that Word conversion depends on DocWen's opt-in input extensions", async () => {
    const { initI18n, t } = await import("../src/i18n");
    for (const language of ["zh-CN", "en-US", "ko-KR", "es-ES"] as const) {
      initI18n(language);
      const guidance = t("settingsWordGuideDesc");
      if (language === "ko-KR") expect(guidance).toMatch(/입력 확장/u);
      else if (language === "es-ES") expect(guidance).toMatch(/extensiones de entrada/u);
      else expect(guidance).toMatch(/(?:输入扩展|input extensions)/u);
      expect(guidance).toContain("DocWen");
    }
    initI18n("en-US");
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
      renderGuide: vi.fn(),
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

  it("exposes request-scoped numbering controls on the source-native Word page", () => {
    const definitions = getSettingsPages({
      settings: { ...DEFAULT_SETTINGS },
      renderCliPath: vi.fn(),
      renderDocWenDownload: vi.fn(),
      renderCliStatus: vi.fn(),
      renderPersistenceStatus: vi.fn(),
      isPersistencePending: () => false,
      renderNumberingScheme: vi.fn(),
      renderGuide: vi.fn(),
      runDoctor: vi.fn(),
    });

    expect(collectControlKeys(definitions[1].items ?? [])).toContain("docToMdCleanNumbering");
    expect(collectControlKeys(definitions[1].items ?? [])).not.toContain("mdToDocCleanNumbering");
    expect(collectControlKeys(definitions[2].items ?? [])).toEqual(new Set([
      "headingMergeMode",
      "mdToDocCleanNumbering",
      "headingNumberingRenderMode",
    ]));
    const numberingRender = definitions[2].items.find((item) => "render" in item && item.render);
    expect(numberingRender).toBeDefined();
    expect(collectControlKeys(definitions[2].items ?? [])).not.toContain("docToMdCleanNumbering");
  });

  it("offers only manual DocWen selection on Linux", () => {
    const definitions = getSettingsPages({
      settings: { ...DEFAULT_SETTINGS, docwenConnectionMode: "manual" },
      renderCliPath: vi.fn(),
      renderDocWenDownload: vi.fn(),
      renderCliStatus: vi.fn(),
      renderPersistenceStatus: vi.fn(),
      isPersistencePending: () => false,
      renderNumberingScheme: vi.fn(),
      renderGuide: vi.fn(),
      runDoctor: vi.fn(),
    }, "linux");
    const connection = definitions[0].items.find(
      (item) => item.control?.key === "docwenConnectionMode",
    );

    expect(connection?.control).toMatchObject({
      type: "dropdown",
      options: { manual: expect.any(String) },
    });
    expect((connection?.control as { options?: Record<string, string> } | undefined)?.options)
      .not.toHaveProperty("automatic");
  });

  it("does not expose the retired table merge alias", () => {
    const definitions = getSettingsPages({
      settings: { ...DEFAULT_SETTINGS },
      renderCliPath: vi.fn(),
      renderDocWenDownload: vi.fn(),
      renderCliStatus: vi.fn(),
      renderPersistenceStatus: vi.fn(),
      isPersistencePending: () => false,
      renderNumberingScheme: vi.fn(),
      renderGuide: vi.fn(),
      runDoctor: vi.fn(),
    });
    const tableMerge = collectControls(definitions.flatMap((page) => page.items))
      .get("tableMergeStrategy") as { options?: Record<string, string> } | undefined;

    expect(tableMerge?.options).not.toHaveProperty("replicate");
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

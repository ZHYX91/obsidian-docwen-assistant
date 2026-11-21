import type { Setting } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupportedLocales, initI18n, t } from "../src/i18n";
import { getSettingsPages } from "../src/settings-definitions";
import { renderSettingsGuide } from "../src/settings-guide";
import { DEFAULT_SETTINGS } from "../src/settings-model";
import { useObsidianDom } from "./helpers/obsidian-dom";

vi.mock("obsidian", () => import("./helpers/obsidian-dom"));
useObsidianDom();
afterEach(() => initI18n("en"));

function createSetting() {
  const settingEl = document.createElement("div");
  return {
    settingEl,
    setClass(name: string) { settingEl.classList.add(name); return this; },
    setName(value: string) { settingEl.createSpan({ text: value }); return this; },
    setDesc(value: string) { settingEl.createDiv({ text: value }); return this; },
  };
}

describe("DocWen settings guidance", () => {
  it("keeps brief advice visible and restores the Word tutorial on redraw", () => {
    const setting = createSetting();
    const state = new Set<string>();
    const render = (kind: "brief" | "word") => renderSettingsGuide(
      setting as unknown as Setting, "Guide", kind === "brief" ? "Help text" : [{ title: "Example", text: "Help text" }], state,
    );

    render("brief");
    expect(setting.settingEl.textContent).toBe("Help text");
    expect(setting.settingEl.querySelector("p.setting-item-description")?.textContent).toBe("Help text");
    expect(setting.settingEl.querySelector("details")).toBeNull();

    const remember = render("word");
    const details = setting.settingEl.querySelector("details")!;
    expect(details.open).toBe(false);
    expect(details.querySelector("summary")?.textContent).toBe("Guide");
    details.open = true;
    // Leave the page before the native toggle event is delivered.
    remember?.();
    const rememberRedraw = render("word");
    expect(setting.settingEl.querySelector("details")?.open).toBe(true);
    rememberRedraw?.();
    state.clear();
    details.dispatchEvent(new window.Event("toggle"));
    render("word");
    expect(setting.settingEl.querySelector("details")?.open).toBe(false);
  });

  it.each(getSupportedLocales())("renders the Word tab's three tutorial steps with a text-only summary in %s", (locale) => {
    initI18n(locale);
    const setting = createSetting();
    const pages = getSettingsPages({
      settings: DEFAULT_SETTINGS, renderCliPath: vi.fn(), renderDocWenDownload: vi.fn(), renderCliStatus: vi.fn(),
      renderPersistenceStatus: vi.fn(), isPersistencePending: () => false, renderNumberingScheme: vi.fn(),
      renderSupport: vi.fn(), renderGuide: (target, title, content) => renderSettingsGuide(target, title, content, new Set()),
    });
    const word = pages.find((page) => page.id === "word")!;
    word.items[0]?.render?.(setting as unknown as Setting, undefined as never);
    const details = setting.settingEl.querySelector("details")!;
    const summary = details.querySelector("summary")!;
    expect(summary.textContent).toBe(locale === "zh-cn" ? "如何导出 Word" : t("settingsWordGuideTitle"));
    expect(summary.querySelector("svg, [data-icon], button, a, [tabindex]")).toBeNull();
    expect([...details.querySelectorAll("dt")].map((element) => element.textContent)).toEqual([
      t("settingsWordGuideTemplateTitle"), t("settingsWordGuideExtensionsTitle"), t("settingsWordGuideNumberingTitle"),
    ]);
    expect([...details.querySelectorAll("dd")].map((element) => element.textContent)).toEqual([
      t("settingsWordGuideTemplateText"), t("settingsWordGuideExtensionsText"), t("settingsWordGuideNumberingText"),
    ]);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { SettingsPageDefinition } from "../src/settings-definitions";
import { SettingsTabs } from "../src/settings-tabs";
import { initI18n } from "../src/i18n";

import { useObsidianDom } from "./helpers/obsidian-dom";

const pages: SettingsPageDefinition[] = [
  { id: "general", name: "General", items: [] },
  { id: "markdown", name: "To Markdown", items: [] },
  { id: "word", name: "To Word", items: [] },
  { id: "proofread", name: "Proofread", items: [] },
];

describe("settings top tabs", () => {
  useObsidianDom();

  function mount(initialPageId: SettingsPageDefinition["id"] = "general") {
    const container = document.body.createDiv();
    const renderPage = vi.fn((panel: HTMLElement, page: SettingsPageDefinition) => {
      panel.createEl("input", { attr: { placeholder: page.name } });
    });
    const controller = new SettingsTabs({ ariaLabel: "Settings", containerEl: container, initialPageId, pages, renderPage });
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const panel = container.querySelector<HTMLElement>('[role="tabpanel"]')!;
    const list = container.querySelector<HTMLElement>('[role="tablist"]')!;
    return { container, controller, buttons, panel, list, renderPage };
  }

  function press(element: HTMLElement, key: string): boolean {
    return !element.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  }

  it("renders complete tab semantics without a duplicate heading", () => {
    const { buttons, panel, list, container, renderPage } = mount();
    expect(list.getAttribute("aria-label")).toBe("Settings");
    expect(list.getAttribute("aria-orientation")).toBe("horizontal");
    expect(buttons.map(button => button.tabIndex)).toEqual([0, -1, -1, -1]);
    expect(panel.getAttribute("aria-labelledby")).toBe(buttons[0].id);
    expect(buttons.every(button => button.getAttribute("aria-controls") === panel.id)).toBe(true);
    expect(container.querySelector("h1,h2,h3,h4,h5,h6")).toBeNull();
    expect(renderPage).toHaveBeenCalledOnce();
    expect(renderPage.mock.calls[0][1].id).toBe("general");
  });

  it.each([["ar", "ltr", "rtl"], ["en", "rtl", "ltr"], ["zh-CN", "rtl", "ltr"]])(
    "applies the %s locale on a host with %s direction", (locale, hostDirection, direction) => {
      document.body.dir = hostDirection;
      initI18n(locale);
      try {
        const root = mount().container.firstElementChild as HTMLElement;
        expect(root.dir).toBe(direction);
        expect(root.lang).toBe(locale.toLowerCase());
      } finally {
        initI18n("en");
      }
    },
  );

  it("moves keyboard focus in both directions and leaves vertical scrolling to the host", () => {
    const { buttons, controller, list, panel } = mount();
    const panelId = panel.id;
    expect(press(buttons[0], "ArrowLeft")).toBe(true);
    expect(controller.activePageId).toBe("proofread");
    expect(document.activeElement).toBe(buttons[3]);
    expect(panel.getAttribute("aria-labelledby")).toBe(buttons[3].id);
    press(buttons[3], "Home");
    expect(controller.activePageId).toBe("general");
    press(buttons[0], "End");
    expect(controller.activePageId).toBe("proofread");
    list.style.direction = "rtl";
    press(buttons[3], "ArrowLeft");
    expect(controller.activePageId).toBe("general");
    list.style.direction = "ltr";
    for (const key of ["ArrowDown", "ArrowUp", "Escape"]) expect(press(buttons[0], key)).toBe(false);
    press(buttons[0], "ArrowRight");
    expect(buttons.map(button => button.tabIndex)).toEqual([-1, 0, -1, -1]);
    expect(document.activeElement).toBe(buttons[1]);
    expect(panel.id).toBe(panelId);
    expect(buttons.every(button => button.getAttribute("aria-controls") === panelId)).toBe(true);
  });

  it("keeps the current page mounted on click and repeated boundary navigation", () => {
    const { buttons, panel, renderPage, controller } = mount("proofread");
    const draft = panel.querySelector("input")!;
    draft.value = "draft";
    buttons[3].click();
    press(buttons[3], "End");
    expect(renderPage).toHaveBeenCalledOnce();
    expect(panel.querySelector("input")).toBe(draft);
    expect(draft.value).toBe("draft");
    expect(document.activeElement).toBe(buttons[3]);
    press(buttons[3], "Home");
    press(buttons[0], "Home");
    expect(renderPage).toHaveBeenCalledTimes(2);
    controller.renderActivePage();
    expect(renderPage).toHaveBeenCalledTimes(3);
    expect(controller.close()).toBe("general");
  });

  it("keeps the family tab styling resilient and responsive", () => {
    const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

    expect(css).toMatch(/\.docwen-settings-tabs\s*\{[^}]*overflow-x:\s*auto;/su);
    expect(css).toMatch(/button\.docwen-settings-tab\s*\{[^}]*font-size:\s*var\(--font-ui-small\)\s*!important;/su);
    expect(css).toMatch(/button\.docwen-settings-tab\[aria-selected="true"\]/u);
    expect(css).toMatch(/button\.docwen-settings-tab\[aria-selected="true"\]\s*\{[^}]*font-weight:\s*var\(--font-semibold\)\s*!important;/su);
    expect(css).toMatch(/\.docwen-settings-panel\s*\{[^}]*margin-block-start:\s*var\(--size-4-5\);/su);
    expect(css).toMatch(/@media \(pointer:\s*coarse\)[\s\S]*?min-block-size:\s*44px;/u);
    expect(css).toMatch(/\.docwen-settings-help\.setting-item\s*\{[^}]*border:\s*0;/su);
    expect(css).toMatch(/\.docwen-settings-help-disclosure > summary\s*\{[^}]*min-block-size:\s*32px;/su);
    expect(css).toMatch(/\.docwen-settings-help-disclosure > summary:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--interactive-accent\);/su);
    expect(css).not.toMatch(/\.docwen-settings-tab\s*\{[^}]*\n\s*height:/su);
  });
});

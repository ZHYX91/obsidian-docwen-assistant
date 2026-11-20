import type { Setting } from "obsidian";
import { describe, expect, it } from "vitest";
import { renderSettingsGuide } from "../src/settings-guide";
import { useObsidianDom } from "./helpers/obsidian-dom";

useObsidianDom();

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
    const render = (kind: "brief" | "word") =>
      renderSettingsGuide(setting as unknown as Setting, "Guide", "Help text", kind, state);

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
});

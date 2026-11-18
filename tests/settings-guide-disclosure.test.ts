// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderSettingsGuide } from "../../src/settings-guide";

describe("DocWen settings help hierarchy", () => {
  it("keeps short scope advice visible; Word tutorial closes by default", () => {
    Object.assign(HTMLElement.prototype, {
      empty(this: HTMLElement) { this.replaceChildren(); },
      createEl(this: HTMLElement, tag: string, options?: { cls?: string; text?: string }) {
        const el = document.createElement(tag);
        if (options?.cls) el.className = options.cls;
        if (options?.text) el.textContent = options.text;
        this.append(el);
        return el;
      },
    });
    const short = { settingEl: document.createElement("div"), setClass() { return this; },
      setName(name: string) { this.settingEl.textContent = name; return this; },
      setDesc(value: string) { this.settingEl.append(value); return this; } };
    renderSettingsGuide(short as never, "Scope", "Does not write notes.");
    expect(short.settingEl.textContent).toContain("Does not write notes.");
    const word = { ...short, settingEl: document.createElement("div") };
    const state = new Set<string>();
    renderSettingsGuide(word as never, "Word details", "Advanced explanation", true, state);
    const details = word.settingEl.querySelector("details")!;
    expect(details.open).toBe(false);
    details.open = true;
    details.dispatchEvent(new Event("toggle"));
    expect(state.has("word")).toBe(true);
    state.clear();
    renderSettingsGuide(word as never, "Word details", "Advanced explanation", true, state);
    expect(word.settingEl.querySelector("details")?.open).toBe(false);
  });
});

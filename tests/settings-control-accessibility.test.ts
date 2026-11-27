// @vitest-environment happy-dom
import type { ToggleComponent } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { configureSettingsToggle } from "../src/settings-control-accessibility";

describe("settings switch accessibility", () => {
  it.each([true, false])("exposes one named, synchronized control (native checkbox: %s)", (nativeInput) => {
    const root = document.createElement("div");
    document.body.append(root);
    const nameEl = document.createElement("div");
    const descEl = document.createElement("div");
    const wrapper = document.createElement("label");
    root.append(nameEl, descEl, wrapper);
    nameEl.textContent = "Check punctuation";
    descEl.textContent = "Include punctuation in the report";
    const input = nativeInput ? wrapper.appendChild(document.createElement("input")) : null;
    if (input) input.type = "checkbox";
    let change!: (value: boolean) => void;
    const toggle = {
      toggleEl: wrapper,
      setValue() { return this; },
      setDisabled() { return this; },
      onChange(handler: typeof change) { change = handler; },
    };
    const update = vi.fn();
    const setting = { nameEl, descEl };
    configureSettingsToggle(setting, toggle as unknown as ToggleComponent, true, false, update);
    const control = input ?? wrapper;
    expect(control.tabIndex).toBe(0);
    expect(document.getElementById(control.getAttribute("aria-labelledby")!)).toBe(nameEl);
    expect(document.getElementById(control.getAttribute("aria-describedby")!)).toBe(descEl);
    const checked = () => input ? input.checked : wrapper.getAttribute("aria-checked") === "true";
    expect(checked()).toBe(true);
    if (input) expect(wrapper.tabIndex).toBe(-1);
    else expect(wrapper.getAttribute("role")).toBe("switch");
    change(false);
    expect(checked()).toBe(false);
    expect(update).toHaveBeenCalledExactlyOnceWith(false);
    configureSettingsToggle(setting, toggle as unknown as ToggleComponent, false, true, update);
    expect(input ? input.disabled : wrapper.getAttribute("aria-disabled") === "true").toBe(true);
    root.remove();
  });
});

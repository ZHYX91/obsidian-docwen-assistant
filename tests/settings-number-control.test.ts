// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import type { Setting, SettingNumberControl } from "obsidian";
import { configureNumberSetting } from "../src/settings-number-control";

describe("number settings", () => {
  it("marks an out-of-range draft and restores the last saved value on blur", () => {
    const inputEl = document.createElement("input");
    let onChange: (value: string) => void = () => undefined;
    const textControl = {
      inputEl,
      setValue(value: string) { inputEl.value = value; return this; },
      setDisabled(_disabled: boolean) { return this; },
      onChange(callback: (value: string) => void) { onChange = callback; return this; },
    };
    const setting = {
      addText(callback: (control: typeof textControl) => void) { callback(textControl); },
    } as unknown as Setting;
    const control = {
      key: "renderDpi",
      min: 72,
      max: 600,
      step: 1,
      defaultValue: 200,
    } as SettingNumberControl<"renderDpi">;
    const save = vi.fn();

    configureNumberSetting(setting, control, 200, false, save);
    inputEl.value = "601";
    onChange("601");

    expect(inputEl.getAttribute("aria-invalid")).toBe("true");
    expect(save).not.toHaveBeenCalled();

    inputEl.dispatchEvent(new Event("blur"));
    expect(inputEl.value).toBe("200");
    expect(inputEl.getAttribute("aria-invalid")).toBe("false");
    expect(save).not.toHaveBeenCalled();
  });

  it("keeps the last accepted value when a later draft is invalid", () => {
    const inputEl = document.createElement("input");
    let onChange: (value: string) => void = () => undefined;
    const textControl = {
      inputEl,
      setValue(value: string) { inputEl.value = value; return this; },
      setDisabled(_disabled: boolean) { return this; },
      onChange(callback: (value: string) => void) { onChange = callback; return this; },
    };
    const setting = {
      addText(callback: (control: typeof textControl) => void) { callback(textControl); },
    } as unknown as Setting;
    const control = { key: "renderDpi", min: 72, max: 600, defaultValue: 200 }
      as SettingNumberControl<"renderDpi">;
    const save = vi.fn();

    configureNumberSetting(setting, control, 200, false, save);
    onChange("300");
    onChange("601");
    inputEl.value = "601";
    inputEl.dispatchEvent(new Event("blur"));

    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith(300);
    expect(inputEl.value).toBe("300");
  });
});

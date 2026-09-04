import type { Setting, SettingNumberControl } from "obsidian";

export function configureNumberSetting<K extends string>(
  setting: Setting,
  control: SettingNumberControl<K>,
  value: unknown,
  disabled: boolean,
  onChange: (value: number) => void,
): void {
  setting.addText((text) => {
    text.inputEl.type = "number";
    if (control.min !== undefined) text.inputEl.min = String(control.min);
    if (control.max !== undefined) text.inputEl.max = String(control.max);
    if (control.step !== undefined) text.inputEl.step = String(control.step);
    text
      .setValue(String(typeof value === "number" ? value : control.defaultValue ?? 0))
      .setDisabled(disabled)
      .onChange((nextValue) => {
        const parsed = Number(nextValue);
        if (
          !Number.isInteger(parsed)
          || (control.min !== undefined && parsed < control.min)
          || (control.max !== undefined && parsed > control.max)
        ) return;
        onChange(parsed);
      });
  });
}

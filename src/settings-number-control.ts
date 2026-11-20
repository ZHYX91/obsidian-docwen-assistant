import type { Setting, SettingNumberControl } from "obsidian";

export function configureNumberSetting<K extends string>(
  setting: Setting,
  control: SettingNumberControl<K>,
  value: unknown,
  disabled: boolean,
  onChange: (value: number) => void,
): void {
  const initialValue = typeof value === "number" ? value : control.defaultValue ?? 0;
  let lastValidValue = initialValue;
  setting.addText((text) => {
    const input = text.inputEl;
    input.type = "number";
    if (control.min !== undefined) input.min = String(control.min);
    if (control.max !== undefined) input.max = String(control.max);
    if (control.step !== undefined) input.step = String(control.step);
    const isValid = (raw: string): boolean => {
      if (raw.trim().length === 0) return false;
      const parsed = Number(raw);
      return Number.isInteger(parsed)
        && (control.min === undefined || parsed >= control.min)
        && (control.max === undefined || parsed <= control.max);
    };
    text
      .setValue(String(initialValue))
      .setDisabled(disabled)
      .onChange((nextValue) => {
        if (!isValid(nextValue)) {
          input.setAttribute("aria-invalid", "true");
          return;
        }
        const parsed = Number(nextValue);
        lastValidValue = parsed;
        input.setAttribute("aria-invalid", "false");
        onChange(parsed);
      });
    // Invalid text is useful while editing, but must not remain visible as if it were saved.
    input.addEventListener("blur", () => {
      if (isValid(input.value)) return;
      input.value = String(lastValidValue);
      input.setAttribute("aria-invalid", "false");
    });
  });
}

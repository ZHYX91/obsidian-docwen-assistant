import type { Setting, ToggleComponent } from "obsidian";

type SettingLabels = Pick<Setting, "nameEl" | "descEl">;

let nextLabelId = 0;

/** Obsidian renders the visible name and description as siblings of the form control. */
export function labelSettingsControl(setting: SettingLabels, control: HTMLElement): void {
  const id = ++nextLabelId;
  setting.nameEl.id ||= `docwen-control-name-${id}`;
  setting.descEl.id ||= `docwen-control-help-${id}`;
  control.setAttribute("aria-labelledby", setting.nameEl.id);
  control.setAttribute("aria-describedby", setting.descEl.id);
}

export function configureSettingsToggle(
  setting: SettingLabels, toggle: ToggleComponent, checked: boolean, disabled: boolean, onChange: (value: boolean) => void,
): void {
  const wrapper = toggle.toggleEl;
  const checkbox = wrapper.querySelector<HTMLInputElement>('input[type="checkbox"]');
  labelSettingsControl(setting, checkbox ?? wrapper);
  if (checkbox) {
    // The host handles Space/Enter on the wrapping label. Let its real input
    // receive focus and bubble those keys through the same event handler.
    wrapper.tabIndex = -1;
    checkbox.tabIndex = 0;
    checkbox.disabled = disabled;
  } else {
    wrapper.setAttribute("role", "switch");
    wrapper.setAttribute("aria-disabled", String(disabled));
    wrapper.tabIndex = disabled ? -1 : 0;
  }
  const syncValue = (value: boolean): void => {
    if (checkbox) checkbox.checked = value;
    else wrapper.setAttribute("aria-checked", String(value));
  };
  syncValue(checked);
  toggle.setValue(checked).setDisabled(disabled).onChange(value => {
    syncValue(value);
    onChange(value);
  });
}

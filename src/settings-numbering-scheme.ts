import { Setting, type ButtonComponent, type DropdownComponent } from "obsidian";
import { labelSettingsControl } from "./settings-control-accessibility";

import { t } from "./i18n";

interface NumberingScheme {
  readonly id: string;
  readonly name: string;
}

interface NumberingSchemeSettingOptions {
  readonly getValue: () => string;
  readonly isCurrent: () => boolean;
  readonly loadSchemes: (signal: AbortSignal) => Promise<readonly NumberingScheme[] | null | undefined>;
  readonly setValue: (value: string) => Promise<void>;
  readonly readOnly?: boolean;
}

export function configureNumberingSchemeSetting(
  setting: Setting,
  options: NumberingSchemeSettingOptions,
): () => void {
  let active = true;
  let controller: AbortController | null = null;
  let dropdown: DropdownComponent | null = null;
  let retryButton: ButtonComponent | null = null;
  const baseDescription = t("settingsAddNumberingDesc");

  const rebuildOptions = (schemes: readonly NumberingScheme[] | null): void => {
    if (!dropdown) return;
    dropdown.selectEl.innerHTML = "";
    dropdown.addOption("default", t("settingsNumberingDefault"));
    dropdown.addOption("none", t("settingsNumberingNone"));
    const seen = new Set(["default", "none"]);
    for (const scheme of schemes ?? []) {
      if (seen.has(scheme.id)) continue;
      seen.add(scheme.id);
      dropdown.addOption(scheme.id, scheme.name);
    }
    const savedValue = options.getValue();
    if (!seen.has(savedValue)) {
      dropdown.addOption(
        savedValue,
        t(schemes === null ? "settingsNumberingSchemeSaved" : "settingsNumberingSchemeUnavailable", { id: savedValue }),
      );
    }
    dropdown.setValue(savedValue);
  };

  const updateState = (state: "loading" | "ready" | "error"): void => {
    const loading = state === "loading";
    const failed = state === "error";
    setting.setDesc(failed
      ? `${baseDescription} ${t("settingsNumberingSchemeError")}`
      : loading
        ? `${baseDescription} ${t("settingsNumberingSchemeLoading")}`
        : baseDescription);
    setting.descEl.setAttribute("role", "status");
    setting.descEl.setAttribute("aria-live", "polite");
    setting.settingEl.setAttribute("aria-busy", String(loading));
    setting.descEl.classList.remove(
      "docwen-settings-status-loading",
      "docwen-settings-status-error",
    );
    if (loading) setting.descEl.classList.add("docwen-settings-status-loading");
    if (failed) setting.descEl.classList.add("docwen-settings-status-error");
    dropdown?.setDisabled(loading || options.readOnly === true);
    if (retryButton) {
      const retry = retryButton.buttonEl;
      // Keep a retry in the tab order while its request runs. Move focus only
      // when successful completion is about to remove the user's active control.
      if (state === "ready" && retry.ownerDocument.activeElement === retry) {
        dropdown?.selectEl.focus({ preventScroll: true });
      }
      if (!loading) retry.hidden = !failed;
      retryButton.setDisabled(Boolean(retry.hidden) || options.readOnly === true);
      retry.setAttribute("aria-disabled", String(loading || options.readOnly === true));
    }
  };

  const loadSchemes = async (): Promise<void> => {
    if (!active || controller) return;
    controller = new AbortController();
    updateState("loading");
    try {
      const schemes = await options.loadSchemes(controller.signal);
      if (!active || !options.isCurrent()) return;
      if (!schemes) {
        updateState("error");
        return;
      }
      rebuildOptions(schemes);
      updateState("ready");
    } catch {
      if (active && options.isCurrent()) updateState("error");
    } finally {
      controller = null;
    }
  };

  setting
    .setName(t("settingsAddNumbering"))
    .setDesc(baseDescription)
    .addDropdown((control) => {
      dropdown = control;
      labelSettingsControl(setting, control.selectEl);
      rebuildOptions(null);
      control.setDisabled(true);
      control.onChange(options.setValue);
    })
    .addButton((button) => {
      retryButton = button;
      button
        .setButtonText(t("settingsRetry"))
        .setTooltip(t("settingsRetry"))
        .setDisabled(true)
        .onClick(() => {
          if (!options.readOnly && !button.buttonEl.hidden && options.isCurrent()) void loadSchemes();
        });
      button.buttonEl.hidden = true;
    });
  if (options.readOnly) setting.settingEl.setAttribute("aria-disabled", "true");
  void loadSchemes();

  return () => {
    active = false;
    controller?.abort();
  };
}

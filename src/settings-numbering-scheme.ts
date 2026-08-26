import { Setting, type ButtonComponent, type DropdownComponent } from "obsidian";

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
}

export function configureNumberingSchemeSetting(
  setting: Setting,
  options: NumberingSchemeSettingOptions,
): () => void {
  let active = true;
  let controller: AbortController | null = null;
  let dropdown: DropdownComponent | null = null;
  let retryButton: ButtonComponent | null = null;
  let requestGeneration = 0;
  const baseDescription = t("settingsAddNumberingDesc");

  const rebuildOptions = (schemes: readonly NumberingScheme[]): void => {
    if (!dropdown) return;
    dropdown.selectEl.innerHTML = "";
    dropdown.addOption("default", t("settingsNumberingDefault"));
    dropdown.addOption("none", t("settingsNumberingNone"));
    const seen = new Set(["default", "none"]);
    for (const scheme of schemes) {
      if (seen.has(scheme.id)) continue;
      seen.add(scheme.id);
      dropdown.addOption(scheme.id, scheme.name);
    }
    const savedValue = options.getValue();
    if (!seen.has(savedValue)) {
      dropdown.addOption(
        savedValue,
        t("settingsNumberingSchemeUnavailable", { id: savedValue }),
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
    dropdown?.setDisabled(loading);
    if (retryButton) {
      retryButton.buttonEl.hidden = !failed;
      retryButton.setDisabled(!failed);
    }
  };

  const loadSchemes = (): void => {
    const request = ++requestGeneration;
    controller?.abort();
    controller = new AbortController();
    updateState("loading");
    void options.loadSchemes(controller.signal).then((schemes) => {
      if (!active || request !== requestGeneration || !options.isCurrent() || !dropdown) return;
      rebuildOptions(schemes ?? []);
      updateState("ready");
    }).catch(() => {
      if (active && request === requestGeneration && options.isCurrent()) updateState("error");
    });
  };

  setting
    .setName(t("settingsAddNumbering"))
    .setDesc(baseDescription)
    .addDropdown((control) => {
      dropdown = control;
      control.addOption("default", t("settingsNumberingDefault"));
      control.addOption("none", t("settingsNumberingNone"));
      rebuildOptions([]);
      control.setDisabled(true);
      control.onChange(options.setValue);
    })
    .addButton((button) => {
      retryButton = button;
      button
        .setButtonText(t("settingsRetry"))
        .setTooltip(t("settingsRetry"))
        .setDisabled(true)
        .onClick(loadSchemes);
      button.buttonEl.hidden = true;
    });
  loadSchemes();

  return () => {
    active = false;
    ++requestGeneration;
    controller?.abort();
  };
}

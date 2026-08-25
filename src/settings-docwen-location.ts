import { Setting } from "obsidian";

import { LocalCliError } from "./docwen/errors";
import { DOCWEN_RELEASES_URL } from "./docwen/links";
import { resolveDocWenCliPath } from "./docwen/path";
import { getElectronOpenDialog } from "./host/electron-dialogs";
import { showNotice } from "./host/notices";
import { t } from "./i18n";

export type DocWenLocationKind = "program" | "directory";
export type DocWenPathStatus = {
  message: string;
  state: "valid" | "error" | "empty";
};

export function configureDocWenLocationSetting(
  setting: Setting,
  value: string,
  selectLocation: (kind: DocWenLocationKind) => void,
): void {
  setting.settingEl.addClass("docwen-location-setting");
  setting
    .setName(t("settingsCliPath"))
    .setDesc(t("settingsCliPathDesc"))
    .addText((text) => {
      text.setPlaceholder(t("settingsCliPathPlaceholder")).setValue(value);
      text.inputEl.readOnly = true;
      text.inputEl.setAttribute("aria-label", t("settingsCliPath"));
      text.inputEl.addClass("docwen-path-input");
    })
    .addButton((button) => button
      .setButtonText(t("settingsSelectProgram"))
      .setTooltip(t("settingsSelectProgram"))
      .onClick(() => selectLocation("program")))
    .addButton((button) => button
      .setButtonText(t("settingsSelectFolder"))
      .setTooltip(t("settingsSelectFolder"))
      .onClick(() => selectLocation("directory")));
}

export function configureDocWenDownloadSetting(setting: Setting): void {
  setting.setName(t("settingsDownloadDocWen")).setDesc(t("settingsDownloadDocWenDesc"));
  setting.descEl.createEl("br");
  const link = setting.descEl.createEl("a", { text: t("settingsViewReleases") });
  link.href = DOCWEN_RELEASES_URL;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
}

export function getDocWenPathStatus(value: string): DocWenPathStatus {
  try {
    const cliPath = resolveDocWenCliPath(value);
    return { message: `${t("settingsPathValid")}: ${cliPath}`, state: "valid" };
  } catch (error) {
    if (!(error instanceof LocalCliError)) {
      return { message: t("settingsPathInvalid"), state: "error" };
    }
    if (error.code === "cli_path_not_configured") {
      return { message: t("settingsCliPathNotSet"), state: "empty" };
    }
    if (error.code === "cli_not_file") {
      return { message: t("settingsPathNotFile"), state: "error" };
    }
    if (error.code === "cli_wrong_filename") {
      return { message: t("settingsPathUnsupportedSelection"), state: "error" };
    }
    return { message: t("settingsPathInvalid"), state: "error" };
  }
}

export async function pickDocWenCliPath(kind: DocWenLocationKind): Promise<string | null> {
  const dialog = getElectronOpenDialog();
  if (!dialog) {
    showNotice(t("noticeLaunchFailed", { error: "dialog_unavailable" }));
    return null;
  }
  const result = await dialog.showOpenDialog(kind === "program" ? {
    title: t("settingsSelectProgram"),
    filters: [
      { name: "DocWen", extensions: ["exe"] },
      { name: "All Files", extensions: ["*"] },
    ],
    properties: ["openFile"],
  } : {
    title: t("settingsSelectFolder"),
    properties: ["openDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const status = getDocWenPathStatus(result.filePaths[0]);
  if (status.state !== "valid") {
    showNotice(status.message);
    return null;
  }
  return resolveDocWenCliPath(result.filePaths[0]);
}

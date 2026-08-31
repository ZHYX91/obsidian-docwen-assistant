import { Setting } from "obsidian";

import { LocalCliError } from "./docwen/errors";
import type { DocWenConnectionStatus } from "./docwen/connection-status";
import { DOCWEN_RELEASES_URL, DOCWEN_STORE_URL } from "./docwen/links";
import { resolveDocWenCliPath } from "./docwen/path";
import { getElectronOpenDialog } from "./host/electron-dialogs";
import { showNotice } from "./host/notices";
import { t } from "./i18n";
import type { DocWenConnectionMode } from "./settings-model";

export type DocWenLocationKind = "program" | "directory";
export type DocWenPathStatus = {
  message: string;
  state: "valid" | "error" | "empty";
};

export function configureDocWenLocationSetting(
  setting: Setting,
  value: string,
  selectLocation: (kind: DocWenLocationKind) => void,
  readOnly = false,
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
      .setDisabled(readOnly)
      .onClick(() => selectLocation("program")))
    .addButton((button) => button
      .setButtonText(t("settingsSelectFolder"))
      .setTooltip(t("settingsSelectFolder"))
      .setDisabled(readOnly)
      .onClick(() => selectLocation("directory")));
  if (readOnly) setting.settingEl.setAttribute("aria-disabled", "true");
}

export function configureDocWenDownloadSetting(
  setting: Setting,
  platform: NodeJS.Platform = process.platform,
): void {
  setting.setName(t("settingsDownloadDocWen")).setDesc(t("settingsDownloadDocWenDesc"));
  setting.descEl.createEl("br");
  if (platform === "win32") {
    const storeLink = setting.descEl.createEl("a", { text: t("settingsGetFromStore") });
    storeLink.href = DOCWEN_STORE_URL;
    storeLink.target = "_blank";
    storeLink.rel = "noopener noreferrer";
    setting.descEl.createSpan({ text: " · " });
  }
  const portableLink = setting.descEl.createEl("a", { text: t("settingsDownloadPortable") });
  portableLink.href = DOCWEN_RELEASES_URL;
  portableLink.target = "_blank";
  portableLink.rel = "noopener noreferrer";
}

export function getDocWenConnectionDisplay(
  mode: DocWenConnectionMode,
  manualPath: string,
  connection: DocWenConnectionStatus,
  platform: NodeJS.Platform = process.platform,
): DocWenPathStatus {
  if (connection.state === "checking") {
    return { message: t("settingsConnectionChecking"), state: "empty" };
  }
  if (connection.state === "connected") {
    const source = connection.mode === "automatic"
      ? t("settingsConnectionAutomatic")
      : t("settingsConnectionManual");
    return {
      message: t("settingsConnectionConnected", {
        source,
        version: connection.productVersion,
      }),
      state: "valid",
    };
  }
  if (connection.state === "error") {
    if (connection.code === "cli_alias_not_found") {
      return { message: t("settingsConnectionStoreMissing"), state: "error" };
    }
    if (connection.code === "cli_platform_unsupported") {
      return { message: t("settingsPlatformUnsupported"), state: "error" };
    }
    if (connection.code === "cli_incompatible_version") {
      return { message: t("settingsConnectionIncompatible"), state: "error" };
    }
    if (connection.code === "cli_health_failed") {
      return { message: t("settingsConnectionHealthFailed"), state: "error" };
    }
    if (mode === "manual") {
      const manualStatus = getDocWenPathStatus(manualPath, platform);
      if (manualStatus.state !== "valid") return manualStatus;
    }
    return { message: t("settingsConnectionFailed"), state: "error" };
  }
  if (mode === "automatic") {
    return { message: t("settingsConnectionAutomaticReady"), state: "empty" };
  }
  const manualStatus = getDocWenPathStatus(manualPath, platform);
  if (manualStatus.state !== "valid") return manualStatus;
  return { message: t("settingsConnectionManualReady"), state: "empty" };
}

export function getDocWenPathStatus(
  value: string,
  platform: NodeJS.Platform = process.platform,
): DocWenPathStatus {
  try {
    const cliPath = resolveDocWenCliPath(value, platform);
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
    if (error.code === "cli_not_executable") {
      return { message: t("settingsPathNotExecutable"), state: "error" };
    }
    if (error.code === "cli_platform_unsupported") {
      return { message: t("settingsPlatformUnsupported"), state: "error" };
    }
    if (error.code === "cli_wrong_filename") {
      return { message: t("settingsPathUnsupportedSelection"), state: "error" };
    }
    return { message: t("settingsPathInvalid"), state: "error" };
  }
}

export async function pickDocWenCliPath(
  kind: DocWenLocationKind,
  platform: NodeJS.Platform = process.platform,
): Promise<string | null> {
  const dialog = getElectronOpenDialog();
  if (!dialog) {
    showNotice(t("noticeLaunchFailed", { error: "dialog_unavailable" }));
    return null;
  }
  const programOptions = {
    title: t("settingsSelectProgram"),
    properties: ["openFile"],
    ...(platform === "win32" ? {
      filters: [
        { name: "DocWen", extensions: ["exe"] },
        { name: "All Files", extensions: ["*"] },
      ],
    } : {}),
  };
  const result = await dialog.showOpenDialog(kind === "program" ? programOptions : {
    title: t("settingsSelectFolder"),
    properties: ["openDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const status = getDocWenPathStatus(result.filePaths[0], platform);
  if (status.state !== "valid") {
    showNotice(status.message);
    return null;
  }
  return resolveDocWenCliPath(result.filePaths[0], platform);
}

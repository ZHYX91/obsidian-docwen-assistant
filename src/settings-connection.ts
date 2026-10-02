import type { Setting } from "obsidian";
import type DocWenPlugin from "./main";
import { t } from "./i18n";
import { diagnosticCode, diagnosticDetails } from "./actions/diagnostic-details";
import { OperationDetailsModal } from "./actions/action-runner";
import { getDocWenConnectionDisplay, type DocWenPathStatus } from "./settings-docwen-location";
import packageJson from "../package.json";
import { isSettingsReadOnly } from "./settings-schema-compatibility";

export function connectionDisplay(plugin: DocWenPlugin): DocWenPathStatus {
  const { docwenConnectionMode: mode, docwenCliPath: path } = plugin.settings;
  const background = getDocWenConnectionDisplay(mode, path, plugin.getDocWenConnectionStatus());
  const application = getDocWenConnectionDisplay(mode, path, plugin.getGuiConnectionStatus());
  return {
    state: background.state === "error" || application.state === "error" ? "error" : background.state,
    message: `${t("settingsApplicationControl")}: ${application.message}\n${t("settingsBackgroundIntegration")}: ${background.message}`,
  };
}

export function configureConnectionActions(setting: Setting, plugin: DocWenPlugin, refresh: () => void): void {
  const readOnly = isSettingsReadOnly(plugin.getSettingsCompatibility());
  setting.addButton((button) => button.setButtonText(t("commandLaunch"))
    .setDisabled(readOnly)
    .onClick(() => { void plugin.openDocWenApplication().finally(refresh); }));
  setting.addButton((button) => button.setButtonText(t("dialogDetails")).setDisabled(readOnly).onClick(() => {
    const statuses = [plugin.getGuiConnectionStatus(), plugin.getDocWenConnectionStatus()].map((status) => ({
      state: status.state,
      ...(status.state === "connected" ? { productVersion: status.productVersion } : {}),
      ...(status.state === "error" ? { code: diagnosticCode(status.code), details: diagnosticDetails(status.details) } : {}),
    }));
    const details = {
      redacted: true,
      client: { name: "docwen-assistant", runtimeVersion: packageJson.version, manifestVersion: plugin.manifest.version },
      application: statuses[0],
      background: statuses[1],
    };
    new OperationDetailsModal(plugin.app, connectionDisplay(plugin).message, JSON.stringify(details, null, 2)).open();
  }));
}

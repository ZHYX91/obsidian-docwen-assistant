import type { ButtonComponent, Setting } from "obsidian";
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

export function configureConnectionActions(setting: Setting, plugin: DocWenPlugin, refresh: () => void): () => void {
  const readOnly = isSettingsReadOnly(plugin.getSettingsCompatibility());
  let active = true;
  setting.setClass("docwen-settings-connection");
  const addAction = (label: string, action: () => Promise<void>): void => {
    setting.addButton((button: ButtonComponent) => {
      let pending = false;
      button.setButtonText(label).setDisabled(readOnly).onClick(() => {
        if (!active || readOnly || pending) return;
        pending = true;
        button.setDisabled(true);
        button.buttonEl.setAttribute("aria-busy", "true");
        // The action runner owns notices. Keep failures handled even if the host
        // rejects unexpectedly, and never update a dismissed/replaced surface.
        void (async () => {
          try {
            const work = action();
            refresh();
            await work;
          } catch {
            // Connection monitors and the action runner own failure presentation.
          } finally {
            pending = false;
            if (active) {
              button.setDisabled(readOnly);
              button.buttonEl.setAttribute("aria-busy", "false");
              refresh();
            }
          }
        })();
      });
    });
  };
  addAction(t("settingsCheckConnection"), () => plugin.runDoctorCheck());
  addAction(t("commandLaunch"), () => plugin.openDocWenApplication());
  setting.addButton((button) => button.setButtonText(t("dialogDetails")).setDisabled(readOnly).onClick(() => {
    if (!active || readOnly) return;
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
  return () => { active = false; };
}

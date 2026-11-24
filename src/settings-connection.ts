import { isDeepStrictEqual } from "node:util";
import type { ButtonComponent, Setting } from "obsidian";
import type DocWenPlugin from "./main";
import { t } from "./i18n";
import { diagnosticCode, diagnosticDetails } from "./actions/diagnostic-details";
import { OperationDetailsModal } from "./actions/action-runner";
import { getDocWenConnectionDisplay, type DocWenPathStatus } from "./settings-docwen-location";
import packageJson from "../package.json";
import { isSettingsReadOnly } from "./settings-schema-compatibility";

export function connectionDisplay(plugin: DocWenPlugin): DocWenPathStatus[] {
  const { docwenConnectionMode: mode, docwenCliPath: path } = plugin.settings;
  const gui = plugin.getGuiConnectionStatus();
  const machine = plugin.getDocWenConnectionStatus();
  const application = getDocWenConnectionDisplay(mode, path, gui);
  const openLabel = t("settingsApplicationControl");
  const backgroundLabel = t("settingsBackgroundIntegration");
  // The Store alias always has the same remedy. Other errors can carry different
  // recovery instructions or version numbers even when their codes match.
  if (gui.state === "error" && machine.state === "error" && gui.code === machine.code
    && (gui.code === "cli_alias_not_found" || isDeepStrictEqual(gui.details, machine.details))) {
    return [{ state: application.state, message: `${openLabel} · ${backgroundLabel}: ${application.message}` }];
  }
  const background = getDocWenConnectionDisplay(mode, path, machine);
  return [
    { state: application.state, message: `${openLabel}: ${application.message}` },
    { state: background.state, message: `${backgroundLabel}: ${background.message}` },
  ];
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
    new OperationDetailsModal(plugin.app, connectionDisplay(plugin).map((line) => line.message).join("\n"), JSON.stringify(details, null, 2)).open();
  }));
  return () => { active = false; };
}

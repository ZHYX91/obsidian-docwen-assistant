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
  const state = connectionActionState(plugin);
  const controls = new Map<ConnectionAction, ButtonComponent>();
  const updateControls = () => {
    for (const [action, button] of controls) {
      const busy = state.pending.has(action);
      button.setDisabled(readOnly || busy);
      button.buttonEl.setAttribute("aria-busy", String(busy));
    }
  };
  const onChange = () => { updateControls(); refresh(); };
  setting.setClass("docwen-settings-connection");
  const addAction = (action: ConnectionAction, label: string): void => {
    setting.addButton((button) => {
      controls.set(action, button);
      button.setButtonText(label).onClick(async () => {
        if (!state.listeners.has(onChange) || readOnly || state.pending.has(action)) return;
        state.pending.add(action);
        try {
          const work = plugin[action]();
          state.listeners.forEach(update => update());
          await work;
        } catch {
          // Connection monitors and the action runner own failure presentation.
        } finally {
          state.pending.delete(action);
          state.listeners.forEach(update => update());
        }
      });
    });
  };
  addAction("runDoctorCheck", t("settingsCheckConnection"));
  addAction("openDocWenApplication", t("commandLaunch"));
  updateControls();
  state.listeners.add(onChange);
  setting.addButton((button) => button.setButtonText(t("dialogDetails")).setDisabled(readOnly).onClick(() => {
    if (!state.listeners.has(onChange) || readOnly) return;
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
  return () => { state.listeners.delete(onChange); };
}

type ConnectionAction = "runDoctorCheck" | "openDocWenApplication";

type ConnectionActionState = {
  pending: Set<ConnectionAction>;
  listeners: Set<() => void>;
};

// Actions belong to the plugin instance, while each mounted card owns its listener.
const connectionActions = new WeakMap<DocWenPlugin, ConnectionActionState>();

function connectionActionState(plugin: DocWenPlugin): ConnectionActionState {
  let state = connectionActions.get(plugin);
  if (!state) {
    state = { pending: new Set(), listeners: new Set() };
    connectionActions.set(plugin, state);
  }
  return state;
}

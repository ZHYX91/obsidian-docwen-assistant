import type { App } from "obsidian";

interface SettingsController {
  open?: () => void;
  openTabById?: (id: string) => void;
}

/** Open one plugin's settings without assuming the private host API exists. */
export function openPluginSettings(app: App, pluginId: string): boolean {
  const controller = (app as App & { setting?: SettingsController }).setting;
  if (typeof controller?.open !== "function" || typeof controller.openTabById !== "function") {
    return false;
  }
  controller.open();
  controller.openTabById(pluginId);
  return true;
}

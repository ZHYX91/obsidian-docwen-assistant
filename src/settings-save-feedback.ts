import { Setting } from "obsidian";
import { t } from "./i18n";
import type DocWenPlugin from "./main";

export function refreshSettingsSaveFeedback(
  plugin: Pick<DocWenPlugin, "getSettingsSaveState" | "retrySettingsSave">,
  getRegion: () => HTMLElement | null,
): void {
  const region = getRegion();
  if (!region) return;
  const state = plugin.getSettingsSaveState();
  if (state !== "pending") {
    if (state !== "saving" && region.children.length) {
      const active = region.ownerDocument.activeElement;
      const hadFocus = active && region.contains(active);
      region.empty();
      if (hadFocus) region.parentElement?.focus({ preventScroll: true });
    }
    return;
  }
  if (region.children.length) return;
  new Setting(region)
    .setName(t("settingsPersistence"))
    .setDesc(t("settingsChangesPending"))
    .addButton((button) => button.setButtonText(t("settingsRetry")).onClick(async () => {
      if (region !== getRegion() || plugin.getSettingsSaveState() !== "pending") return;
      // Native disabling would blur the focused button before a failed retry returns.
      button.buttonEl.setAttribute("aria-disabled", "true");
      try {
        await plugin.retrySettingsSave();
      } catch {
        // The coordinator retains the pending snapshot for the next retry.
      } finally {
        if (region === getRegion()) button.buttonEl.setAttribute("aria-disabled", "false");
        refreshSettingsSaveFeedback(plugin, getRegion);
      }
    }));
}

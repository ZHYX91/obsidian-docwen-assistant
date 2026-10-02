import { describe, expect, it } from "vitest";

import { openPluginSettings } from "../src/host/settings-navigation";

describe("openPluginSettings", () => {
  it("opens the host settings before selecting the plugin tab", () => {
    const calls: string[] = [];
    const app = {
      setting: {
        open: () => calls.push("open"),
        openTabById: (id: string) => calls.push(id),
      },
    };

    expect(openPluginSettings(app as never, "docwen-assistant")).toBe(true);
    expect(calls).toEqual(["open", "docwen-assistant"]);
  });

  it("fails safely when the host settings controller is unavailable", () => {
    expect(openPluginSettings({} as never, "docwen-assistant")).toBe(false);
  });
});

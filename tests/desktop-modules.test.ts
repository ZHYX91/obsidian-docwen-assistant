import { afterEach, describe, expect, it, vi } from "vitest";

import { copyTextToClipboard } from "../src/host/clipboard";
import { getElectronOpenDialog, getElectronSaveDialog } from "../src/host/electron-dialogs";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("desktop module adapters", () => {
  it("prefers the browser clipboard and does not load Electron", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const moduleLoader = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    vi.stubGlobal("window", { require: moduleLoader });

    await expect(copyTextToClipboard("details")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("details");
    expect(moduleLoader).not.toHaveBeenCalled();
  });

  it("uses a validated Electron clipboard fallback and fails closed otherwise", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    vi.stubGlobal("window", { require: vi.fn().mockReturnValue({ clipboard: { writeText } }) });

    await expect(copyTextToClipboard("details")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("details");

    vi.stubGlobal("window", { require: vi.fn().mockReturnValue({ clipboard: {} }) });
    await expect(copyTextToClipboard("details")).resolves.toBe(false);
  });

  it("accepts only Electron dialog objects with the requested method", () => {
    const saveDialog = { showSaveDialog: vi.fn() };
    const openDialog = { showOpenDialog: vi.fn() };
    const moduleLoader = vi.fn((moduleId: string) => moduleId === "electron"
      ? { remote: { dialog: saveDialog } }
      : { dialog: openDialog });
    vi.stubGlobal("window", { require: moduleLoader });

    expect(getElectronSaveDialog()).toBe(saveDialog);
    expect(getElectronOpenDialog()).toBe(openDialog);

    moduleLoader.mockReturnValue({ dialog: {} });
    expect(getElectronOpenDialog()).toBeNull();
  });
});

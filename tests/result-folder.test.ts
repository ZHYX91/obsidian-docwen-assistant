import { beforeEach, describe, expect, it, vi } from "vitest";
import { openResultFolder } from "../src/host/result-folder";

const moduleLoader = vi.hoisted(() => vi.fn());
vi.mock("../src/host/desktop-modules", () => ({ requireDesktopModule: moduleLoader }));
beforeEach(() => moduleLoader.mockReset());

describe("completed result navigation", () => {
  it("uses the local shell only when invoked and passes paths without shell interpolation", async () => {
    const openPath = vi.fn().mockResolvedValue("");
    moduleLoader.mockReturnValue({ shell: { openPath } });
    expect(openPath).not.toHaveBeenCalled();
    await expect(openResultFolder("/exports/a file; $name")).resolves.toBe(true);
    expect(openPath).toHaveBeenCalledExactlyOnceWith("/exports/a file; $name");
  });
  it("falls back to the remote shell and rejects relative paths", async () => {
    const openPath = vi.fn().mockResolvedValue("");
    moduleLoader.mockImplementation((id) => id === "@electron/remote" ? { shell: { openPath } } : {});
    await expect(openResultFolder("relative/file")).resolves.toBe(false);
    expect(moduleLoader).not.toHaveBeenCalled();
    await expect(openResultFolder("/exports/result")).resolves.toBe(true);
  });
  it.each(["native-error", "throw", "missing"])("retains the successful export when navigation fails: %s", async (failure) => {
    moduleLoader.mockReturnValue(failure === "missing" ? null : {
      shell: { openPath: failure === "throw" ? vi.fn().mockRejectedValue(new Error("private native path")) : vi.fn().mockResolvedValue("private native path") },
    });
    await expect(openResultFolder("/exports/result")).resolves.toBe(false);
  });
});

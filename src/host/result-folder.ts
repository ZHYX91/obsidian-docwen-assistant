import * as path from "node:path";
import { requireDesktopModule } from "./desktop-modules";

/** Open a completed local result only after the user clicks its action. */
export async function openResultFolder(directory: string): Promise<boolean> {
  if (!path.isAbsolute(directory)) return false;
  try {
    for (const id of ["electron", "@electron/remote"] as const) {
      const module = requireDesktopModule(id);
      if (typeof module !== "object" || module === null || !("shell" in module)) continue;
      const shell = module.shell;
      if (!isDesktopShell(shell)) continue;
      return (await shell.openPath(directory)) === "";
    }
  } catch {
    // Keep filesystem paths and native error text out of shareable diagnostics.
  }
  return false;
}

function isDesktopShell(value: unknown): value is { openPath(directory: string): Promise<string> } {
  return typeof value === "object" && value !== null && "openPath" in value && typeof value.openPath === "function";
}

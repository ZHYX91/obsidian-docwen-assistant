interface DesktopModuleLoader {
  (moduleId: string): unknown;
}

export function requireDesktopModule(moduleId: "electron" | "@electron/remote"): unknown {
  const moduleLoader: unknown = window.require;
  if (!isDesktopModuleLoader(moduleLoader)) return null;
  try {
    return moduleLoader(moduleId);
  } catch {
    return null;
  }
}

function isDesktopModuleLoader(value: unknown): value is DesktopModuleLoader {
  return typeof value === "function";
}

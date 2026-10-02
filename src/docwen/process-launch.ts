import { homedir } from "node:os";
import * as path from "node:path";

import { LocalCliError } from "./errors";

export type DocWenLaunchTarget = {
  executable: string;
  cwd: string;
  mode: "automatic" | "manual";
};

export function normalizeDocWenLaunchTarget(
  target: string | DocWenLaunchTarget,
): DocWenLaunchTarget {
  const normalized = typeof target === "string"
    ? {
        executable: target,
        cwd: path.win32.isAbsolute(target) ? path.win32.dirname(target) : path.dirname(target),
        mode: "manual" as const,
      }
    : target;
  if (!isAbsolutePlatformPath(normalized.executable) || !isAbsolutePlatformPath(normalized.cwd)) {
    throw new LocalCliError(
      "cli_spawn_failed",
      "DocWen launch targets must use fixed absolute paths.",
      { mode: normalized.mode },
    );
  }
  return normalized;
}

export function docWenChildEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const key of ["SystemRoot", "WINDIR", "COMSPEC", "PATH", "PATHEXT", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL"]) {
    if (process.env[key]) environment[key] = process.env[key];
  }
  const profileKeys = process.platform === "win32"
    ? ["USERPROFILE", "APPDATA", "LOCALAPPDATA", "HOMEDRIVE", "HOMEPATH"]
    : ["HOME", "XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_STATE_HOME", "XDG_CACHE_HOME"];
  for (const key of profileKeys) {
    if (process.env[key]) environment[key] = process.env[key];
  }
  for (const key of ["DOCWEN_CONFIG_DIR", "DOCWEN_DATA_DIR", "DOCWEN_LOG_DIR"]) {
    const value = process.env[key]?.trim();
    if (value) environment[key] = profileDirectory(value);
  }
  if (["1", "true", "yes", "on"].includes(process.env.DOCWEN_LOG_TO_TEMP?.trim().toLowerCase() ?? "")) {
    environment.DOCWEN_LOG_TO_TEMP = "1";
  }
  if (process.platform === "linux") {
    for (const key of [
      "XDG_RUNTIME_DIR",
      "DISPLAY",
      "WAYLAND_DISPLAY",
      "XAUTHORITY",
      "DBUS_SESSION_BUS_ADDRESS",
    ]) {
      if (process.env[key]) environment[key] = process.env[key];
    }
  }
  environment.NO_COLOR = "1";
  environment.PYTHONIOENCODING = "utf-8";
  environment.PYTHONUTF8 = "1";
  return environment;
}

function profileDirectory(value: string): string {
  if (value.includes("\u0000")) throw new Error("DocWen profile directory contains a NUL character.");
  const expanded = value === "~" || value.startsWith("~/") || (process.platform === "win32" && value.startsWith("~\\"))
    ? path.join(homedir(), value.slice(2))
    : value;
  return path.isAbsolute(expanded) || path.win32.isAbsolute(expanded) ? expanded : path.resolve(expanded);
}

function isAbsolutePlatformPath(value: string): boolean {
  return path.isAbsolute(value) || path.win32.isAbsolute(value);
}

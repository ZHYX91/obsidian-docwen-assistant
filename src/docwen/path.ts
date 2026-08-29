import { accessSync, constants as fsConstants } from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";

import { isDirectory, isFile, pathExists } from "../host/file-system";
import type { DocWenConnectionMode } from "../settings-model";
import { LocalCliError } from "./errors";
import type { DocWenLaunchTarget } from "./machine-client";

export const DOCWEN_EXECUTION_ALIAS = "docwen.exe";
const WINDOWS_APPS_ALIAS_DIRECTORY = ["Microsoft", "WindowsApps"] as const;
const WINDOWS_EXECUTABLES = Object.freeze({ cli: "DocWenCLI.exe", gui: "DocWen.exe" });
const LINUX_EXECUTABLES = Object.freeze({ cli: "DocWenCLI", gui: "DocWen" });

export type DocWenHostPlatform = "win32" | "linux";

export function isSupportedDocWenPlatform(platform: NodeJS.Platform = process.platform): platform is DocWenHostPlatform {
  return platform === "win32" || platform === "linux";
}

export function resolveDocWenExecutionAlias(
  localAppData = process.env.LOCALAPPDATA,
  aliasIsAccessible: (candidate: string) => boolean = canAccessAlias,
  platform: NodeJS.Platform = process.platform,
): string {
  if (platform !== "win32") {
    throw unsupportedPlatformError(platform);
  }
  if (!localAppData || !path.win32.isAbsolute(localAppData)) {
    throw new LocalCliError(
      "cli_alias_not_found",
      "The local application-data directory is unavailable.",
      { source: "LOCALAPPDATA" },
    );
  }
  const executable = path.win32.join(localAppData, ...WINDOWS_APPS_ALIAS_DIRECTORY, DOCWEN_EXECUTION_ALIAS);
  if (!aliasIsAccessible(executable)) {
    throw new LocalCliError(
      "cli_alias_not_found",
      "The DocWen application execution alias is unavailable.",
      { source: "LOCALAPPDATA" },
    );
  }
  return executable;
}

export function resolveDocWenLaunchTarget(
  mode: DocWenConnectionMode,
  manualPath: string,
  localAppData = process.env.LOCALAPPDATA,
  aliasIsAccessible: (candidate: string) => boolean = canAccessAlias,
  platform: NodeJS.Platform = process.platform,
): DocWenLaunchTarget {
  if (mode === "automatic") {
    return {
      executable: resolveDocWenExecutionAlias(localAppData, aliasIsAccessible, platform),
      cwd: tmpdir(),
      mode,
    };
  }
  const executable = resolveDocWenCliPath(manualPath, platform);
  return {
    executable,
    cwd: path.dirname(executable),
    mode,
  };
}

function canAccessAlias(candidate: string): boolean {
  try {
    accessSync(candidate, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function resolveDocWenCliPath(
  rawValue: string,
  platform: NodeJS.Platform = process.platform,
  cliIsExecutable: (candidate: string) => boolean = canExecuteFile,
): string {
  if (!isSupportedDocWenPlatform(platform)) throw unsupportedPlatformError(platform);
  const names = platform === "win32" ? WINDOWS_EXECUTABLES : LINUX_EXECUTABLES;
  const value = rawValue.trim().replace(/^["']|["']$/g, "");
  if (!value) throw new LocalCliError("cli_path_not_configured", "DocWen location is not configured.");
  if (!path.isAbsolute(value)) {
    throw new LocalCliError("cli_not_found", "DocWen location must be absolute.", { path: value });
  }

  const selectedPath = path.normalize(value);
  let cliPath: string;
  if (isDirectory(selectedPath)) {
    cliPath = path.join(selectedPath, names.cli);
  } else {
    const basename = path.basename(selectedPath);
    const filename = platform === "win32" ? basename.toLowerCase() : basename;
    const cliFilename = platform === "win32" ? names.cli.toLowerCase() : names.cli;
    const guiFilename = platform === "win32" ? names.gui.toLowerCase() : names.gui;
    if (filename === cliFilename) {
      cliPath = selectedPath;
    } else if (filename === guiFilename) {
      if (!pathExists(selectedPath)) {
        throw new LocalCliError("cli_not_found", `The selected ${names.gui} does not exist.`, {
          path: selectedPath,
        });
      }
      if (!isFile(selectedPath)) {
        throw new LocalCliError("cli_not_file", `The selected ${names.gui} path is not a file.`, {
          path: selectedPath,
        });
      }
      cliPath = path.join(path.dirname(selectedPath), names.cli);
    } else if (!pathExists(selectedPath)) {
      throw new LocalCliError("cli_not_found", "The selected DocWen location does not exist.", {
        path: selectedPath,
      });
    } else if (!isFile(selectedPath)) {
      throw new LocalCliError("cli_not_file", "The selected DocWen location is not a file or directory.", {
        path: selectedPath,
      });
    } else {
      throw new LocalCliError(
        "cli_wrong_filename",
        `Select ${names.gui}, ${names.cli}, or the extracted DocWen folder.`,
        { path: selectedPath },
      );
    }
  }

  if (!pathExists(cliPath)) {
    throw new LocalCliError("cli_not_found", `${names.cli} was not found beside the selected DocWen location.`, {
      path: selectedPath,
      cliPath,
    });
  }
  if (!isFile(cliPath)) {
    throw new LocalCliError("cli_not_file", `The configured ${names.cli} path is not a file.`, {
      path: cliPath,
    });
  }
  if (platform === "linux" && !cliIsExecutable(cliPath)) {
    throw new LocalCliError("cli_not_executable", "The configured DocWenCLI file is not executable.", {
      path: cliPath,
    });
  }
  return cliPath;
}

function canExecuteFile(candidate: string): boolean {
  try {
    accessSync(candidate, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function unsupportedPlatformError(platform: NodeJS.Platform): LocalCliError {
  return new LocalCliError(
    "cli_platform_unsupported",
    "DocWen Assistant supports Windows desktop hosts.",
    { platform },
  );
}

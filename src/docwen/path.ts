import * as path from "node:path";

import { isDirectory, isFile, pathExists } from "../host/file-system";
import { LocalCliError } from "./errors";

export function resolveDocWenCliPath(rawValue: string): string {
  const value = rawValue.trim().replace(/^["']|["']$/g, "");
  if (!value) throw new LocalCliError("cli_path_not_configured", "DocWen location is not configured.");
  if (!path.isAbsolute(value)) {
    throw new LocalCliError("cli_not_found", "DocWen location must be absolute.", { path: value });
  }

  const selectedPath = path.normalize(value);
  let cliPath: string;
  if (isDirectory(selectedPath)) {
    cliPath = path.join(selectedPath, "DocWenCLI.exe");
  } else {
    const filename = path.basename(selectedPath).toLowerCase();
    if (filename === "docwencli.exe") {
      cliPath = selectedPath;
    } else if (filename === "docwen.exe") {
      if (!pathExists(selectedPath)) {
        throw new LocalCliError("cli_not_found", "The selected DocWen.exe does not exist.", {
          path: selectedPath,
        });
      }
      if (!isFile(selectedPath)) {
        throw new LocalCliError("cli_not_file", "The selected DocWen.exe path is not a file.", {
          path: selectedPath,
        });
      }
      cliPath = path.join(path.dirname(selectedPath), "DocWenCLI.exe");
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
        "Select DocWen.exe, DocWenCLI.exe, or the extracted DocWen folder.",
        { path: selectedPath },
      );
    }
  }

  if (!pathExists(cliPath)) {
    throw new LocalCliError("cli_not_found", "DocWenCLI.exe was not found beside the selected DocWen location.", {
      path: selectedPath,
      cliPath,
    });
  }
  if (!isFile(cliPath)) {
    throw new LocalCliError("cli_not_file", "The configured DocWenCLI.exe path is not a file.", {
      path: cliPath,
    });
  }
  return cliPath;
}

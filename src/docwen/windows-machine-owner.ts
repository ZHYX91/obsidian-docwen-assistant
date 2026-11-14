import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import * as path from "node:path";

import { LocalCliError } from "./errors";
import { docWenChildEnvironment, type DocWenLaunchTarget } from "./process-launch";

export const WINDOWS_MACHINE_OWNER_FAILURE_EXIT = 125;
export const WINDOWS_MACHINE_TARGET_NOT_FOUND_EXIT = 126;
export const WINDOWS_MACHINE_TARGET_CREATE_FAILED_EXIT = 128;
export const WINDOWS_MACHINE_OWNER_READY = "DOCWEN_PROCESS_OWNER_READY:1";
export const WINDOWS_MINIMUM_DOCWEN_VERSION = "0.23.0";

export type WindowsMachineOwnerPhase = "owner_spawn" | "owner_runtime";

export function windowsMachineOwnerDetails(phase: WindowsMachineOwnerPhase, error?: unknown): Record<string, unknown> {
  const code = typeof error === "object" && error !== null
    ? Object.getOwnPropertyDescriptor(error, "code")?.value as unknown : undefined;
  return {
    ownershipState: "windows_job",
    ownerComponent: "DocWenCLI",
    phase,
    ...(typeof code === "string" && /^E[A-Z0-9_]{1,39}$/u.test(code) ? { systemCode: code } : {}),
  };
}

export async function spawnWindowsOwnedMachineProcess(
  target: DocWenLaunchTarget,
  assertStartAllowed: () => void = () => undefined,
): Promise<ChildProcessWithoutNullStreams> {
  assertStartAllowed();
  if (target.mode === "automatic") {
    const localAppData = process.env.LOCALAPPDATA;
    const expected = localAppData && path.win32.isAbsolute(localAppData)
      ? path.win32.join(localAppData, "Microsoft", "WindowsApps", "docwen.exe") : null;
    if (!expected || path.win32.normalize(target.executable).toLowerCase() !== expected.toLowerCase()) {
      throw new LocalCliError("cli_alias_not_found", "The fixed DocWen application execution alias is unavailable.");
    }
  }
  try {
    return spawn(target.executable, ["serve", "--stdio", "--managed", "--parent-pid", String(process.pid)], {
      cwd: target.cwd,
      env: docWenChildEnvironment(),
      detached: false,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    if (error instanceof LocalCliError) throw error;
    throw new LocalCliError("cli_spawn_failed", "Unable to start the DocWenCLI process supervisor.", {
      ...windowsMachineOwnerDetails("owner_spawn", error),
    });
  }
}

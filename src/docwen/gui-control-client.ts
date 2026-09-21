import { spawn } from "node:child_process";
import * as path from "node:path";
import { clearTimeout as cancelTimeout, setTimeout as scheduleTimeout } from "node:timers";

import { LocalCliError } from "./errors";
import {
  docWenChildEnvironment,
  normalizeDocWenLaunchTarget,
  type DocWenLaunchTarget,
} from "./process-launch";

const GUI_OPEN_TIMEOUT_SECONDS = 10;
const PROCESS_TIMEOUT_MS = 15_000;
const OUTPUT_LIMIT_BYTES = 256 * 1024;

export class DocWenGuiControlClient {
  constructor(
    private readonly resolveLaunchTarget: () => string | DocWenLaunchTarget,
  ) {}

  async open(filePath?: string, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      throw new LocalCliError("cli_cancelled", "DocWen GUI open was cancelled.");
    }
    if (filePath && !isAbsolutePlatformPath(filePath)) {
      throw new LocalCliError("cli_input_invalid", "DocWen GUI open requires an absolute file path.");
    }

    const target = normalizeDocWenLaunchTarget(this.resolveLaunchTarget());
    const args = [
      "gui",
      "open",
      "--json",
      "--quiet",
      "--timeout",
      String(GUI_OPEN_TIMEOUT_SECONDS),
      ...(filePath ? [filePath] : []),
    ];
    const child = spawn(target.executable, args, {
      cwd: target.cwd,
      env: docWenChildEnvironment(),
      detached: false,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let outputBytes = 0;
      const finish = (error?: Error): void => {
        if (settled) return;
        settled = true;
        cancelTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        if (error) reject(error);
        else resolve();
      };
      const terminate = (): void => {
        try {
          child.kill("SIGTERM");
        } catch {
          // The close/error event remains authoritative.
        }
      };
      const onAbort = (): void => {
        terminate();
        finish(new LocalCliError("cli_cancelled", "DocWen GUI open was cancelled."));
      };
      const countOutput = (chunk: Buffer): void => {
        outputBytes += chunk.length;
        if (outputBytes > OUTPUT_LIMIT_BYTES) {
          terminate();
          finish(new LocalCliError("cli_output_limit", "DocWen GUI control output exceeded its limit.", {
            limitBytes: OUTPUT_LIMIT_BYTES,
          }));
        }
      };
      child.stdout.on("data", countOutput);
      child.stderr.on("data", countOutput);
      child.once("error", (error) => {
        const aliasMissing = target.mode === "automatic" && isErrno(error, "ENOENT");
        finish(new LocalCliError(
          aliasMissing ? "cli_alias_not_found" : "cli_spawn_failed",
          aliasMissing
            ? "The DocWen application execution alias is unavailable."
            : "Unable to run DocWen GUI control.",
          { mode: target.mode },
        ));
      });
      child.once("close", (code) => {
        if (settled) return;
        if (code === 0) {
          finish();
          return;
        }
        finish(new LocalCliError(
          "cli_gui_control_failed",
          "DocWen rejected the GUI control request.",
          { exitCode: code },
        ));
      });

      const timer = scheduleTimeout(() => {
        terminate();
        finish(new LocalCliError("cli_timeout", "DocWen GUI control timed out.", {
          timeoutMs: PROCESS_TIMEOUT_MS,
        }));
      }, PROCESS_TIMEOUT_MS);
      signal?.addEventListener("abort", onAbort, { once: true });
      if (signal?.aborted) onAbort();
    });
  }
}

function isErrno(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function isAbsolutePlatformPath(value: string): boolean {
  return path.isAbsolute(value) || path.win32.isAbsolute(value);
}

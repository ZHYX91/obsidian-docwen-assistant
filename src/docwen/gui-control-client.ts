import { spawn } from "node:child_process";
import * as path from "node:path";
import { clearTimeout as cancelTimeout, setTimeout as scheduleTimeout } from "node:timers";
import { TextDecoder } from "node:util";

import { LocalCliError } from "./errors";
import {
  docWenChildEnvironment,
  normalizeDocWenLaunchTarget,
  type DocWenLaunchTarget,
} from "./process-launch";

const GUI_OPEN_TIMEOUT_SECONDS = 10;
const PROCESS_TIMEOUT_MS = 15_000;
const OUTPUT_LIMIT_BYTES = 256 * 1024;
const TERMINATE_GRACE_MS = 500;

export class DocWenGuiControlClient {
  constructor(
    private readonly resolveLaunchTarget: () => string | DocWenLaunchTarget,
  ) {}

  async open(filePath?: string, signal?: AbortSignal): Promise<void> {
    await this.execute("open", filePath, signal);
  }

  async status(signal?: AbortSignal): Promise<{ productVersion: string; running: boolean }> {
    const envelope = await this.execute("status", undefined, signal);
    return { productVersion: envelope.productVersion, running: envelope.running === true };
  }

  private async execute(command: "open" | "status", filePath?: string, signal?: AbortSignal): Promise<GuiResult> {
    if (signal?.aborted) {
      throw new LocalCliError("cli_cancelled", "DocWen GUI open was cancelled.");
    }
    if (filePath && !isAbsolutePlatformPath(filePath)) {
      throw new LocalCliError("cli_input_invalid", "DocWen GUI open requires an absolute file path.");
    }

    const target = normalizeDocWenLaunchTarget(this.resolveLaunchTarget());
    const args = [
      "gui",
      command,
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

    return await new Promise<GuiResult>((resolve, reject) => {
      let settled = false;
      let stopping: LocalCliError | null = null;
      let outputBytes = 0;
      let timer: ReturnType<typeof scheduleTimeout> | null = null;
      const stdout: Buffer[] = [];
      const finish = (error?: Error, result?: GuiResult): void => {
        if (settled) return;
        settled = true;
        if (timer) cancelTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        if (error) reject(error);
        else if (result) resolve(result);
      };
      const terminate = (error: LocalCliError): void => {
        if (settled || stopping) return;
        stopping = error;
        if (timer) cancelTimeout(timer);
        try {
          child.kill("SIGTERM");
        } catch {
          // Still wait for close and escalate only this owned CLI process.
        }
        timer = scheduleTimeout(() => {
          try { child.kill("SIGKILL"); } catch { /* Wait for close until the deadline. */ }
          timer = scheduleTimeout(() => finish(new LocalCliError(
            "cli_cleanup_failed", "DocWen GUI control process did not close.",
            { primaryCode: error.code, timeoutMs: TERMINATE_GRACE_MS * 2 },
          )), TERMINATE_GRACE_MS);
        }, TERMINATE_GRACE_MS);
      };
      const onAbort = (): void => {
        terminate(new LocalCliError("cli_cancelled", "DocWen GUI control was cancelled."));
      };
      const countOutput = (chunk: Buffer, capture: boolean): void => {
        if (settled || stopping) return;
        const bytes = Buffer.from(chunk);
        outputBytes += bytes.length;
        if (outputBytes > OUTPUT_LIMIT_BYTES) {
          terminate(new LocalCliError("cli_output_limit", "DocWen GUI control output exceeded its limit.", {
            limitBytes: OUTPUT_LIMIT_BYTES,
          }));
          return;
        }
        if (capture) stdout.push(bytes);
      };
      child.stdout.on("data", (chunk: Buffer) => countOutput(chunk, true));
      child.stderr.on("data", (chunk: Buffer) => countOutput(chunk, false));
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
        if (stopping) { finish(stopping); return; }
        if (code !== 0) {
          finish(new LocalCliError(
            "cli_gui_control_failed",
            "DocWen rejected the GUI control request.",
            { exitCode: code },
          ));
          return;
        }
        try {
          finish(undefined, validateGuiEnvelope(Buffer.concat(stdout), command));
        } catch (error) {
          finish(error instanceof LocalCliError
            ? error
            : new LocalCliError("cli_invalid_response", "DocWen GUI control returned invalid JSON."));
          return;
        }
      });

      timer = scheduleTimeout(() => {
        terminate(new LocalCliError("cli_timeout", "DocWen GUI control timed out.", {
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


type GuiResult = { productVersion: string; running?: boolean };

function validateGuiEnvelope(bytes: Buffer, command: "open" | "status"): GuiResult {
  let value: unknown;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    value = JSON.parse(text);
  } catch {
    throw new LocalCliError("cli_invalid_response", "DocWen GUI control returned invalid JSON.");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new LocalCliError("cli_invalid_response", "DocWen GUI control returned an invalid envelope.");
  }
  const envelope = value as Record<string, unknown>;
  if (
    envelope.protocol_version !== 3
    || envelope.success !== true
    || envelope.command !== `gui ${command}`
    || envelope.error !== null
    || typeof envelope.product_version !== "string"
    || !/^\d{1,8}\.\d{1,8}\.\d{1,8}(?:[-+][a-zA-Z0-9.-]{1,32})?$/u.test(envelope.product_version)
  ) {
    throw new LocalCliError("cli_invalid_response", "DocWen GUI control returned an incompatible envelope.", {
      protocolVersion: Number.isSafeInteger(envelope.protocol_version) ? envelope.protocol_version : undefined,
      command: envelope.command === "gui open" ? "gui open" : undefined,
    });
  }
  const data = envelope.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)
    || (command === "status" ? typeof (data as Record<string, unknown>).running !== "boolean"
      : (data as Record<string, unknown>).accepted !== true)) {
    throw new LocalCliError("cli_invalid_response", "DocWen GUI control returned invalid result data.");
  }
  return { productVersion: envelope.product_version, running: (data as Record<string, unknown>).running === true };
}

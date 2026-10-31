import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  mkdtempSync,
  openSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Duplex } from "node:stream";

import { LINUX_MACHINE_OWNER_BASE64 as X64_BASE64, LINUX_MACHINE_OWNER_SHA256 as X64_SHA256 } from "./linux-native-owner-x64";
import { LINUX_MACHINE_OWNER_BASE64 as ARM64_BASE64, LINUX_MACHINE_OWNER_SHA256 as ARM64_SHA256 } from "./linux-native-owner-arm64";
import { LocalCliError } from "./errors";

const assets = {
  x64: { base64: X64_BASE64, sha256: X64_SHA256, bytes: 81352, maximum: 128 * 1024, machine: 62 },
  arm64: { base64: ARM64_BASE64, sha256: ARM64_SHA256, bytes: 158416, maximum: 256 * 1024, machine: 183 },
};

export function linuxOwnerPayload(arch: string = process.arch): Buffer {
  const asset = Object.prototype.hasOwnProperty.call(assets, arch) ? assets[arch as keyof typeof assets] : undefined;
  if (!asset) throw new LocalCliError("cli_platform_unsupported", "Linux Machine ownership requires x64 or arm64.", { platform: "linux", arch });
  const payload = Buffer.from(asset.base64, "base64");
  if (payload.length !== asset.bytes || payload.length > asset.maximum
    || payload.subarray(0, 6).toString("hex") !== "7f454c460201"
    || payload.readUInt16LE(18) !== asset.machine
    || createHash("sha256").update(payload).digest("hex") !== asset.sha256) {
    throw new Error("Linux process owner integrity mismatch for " + arch);
  }
  return payload;
}

export type LinuxOwner = Readonly<{
  kind: "linux-supervisor";
  completion: Promise<void>;
  stop: () => void;
  diagnostics?: Record<string, string>;
}>;

const imageFailures = new WeakMap<Error, Record<string, string>>();
export function linuxOwnerErrorDetails(error: unknown): Record<string, string> | undefined {
  return error instanceof Error ? imageFailures.get(error) : undefined;
}
function systemCode(error: unknown): string {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return typeof code === "string" && /^E[A-Z0-9]{1,30}$/u.test(code) ? code : "UNKNOWN";
}

export function spawnLinuxOwnedMachine(
  binaryPath: string,
  options: { cwd: string; env: NodeJS.ProcessEnv; shell: false; windowsHide: true },
): { child: ChildProcessWithoutNullStreams; ownership: LinuxOwner } {
  if (process.platform !== "linux") throw new LocalCliError("cli_platform_unsupported", "Linux Machine ownership requires Linux.", { platform: process.platform, arch: process.arch });
  // Architecture admission precedes all image writes and every business spawn.
  const payload = linuxOwnerPayload();
  const root = mkdtempSync(join(tmpdir(), "docwen-owner-"));
  const executable = join(root, "owner");
  let imagePresent = false;
  let rootPresent = true;
  let cleanupPhase = "image_unlink";
  let imageFailure: Record<string, string> | undefined;
  function recordImageFailure(primary: Error, cleanup: unknown): void {
    imageFailure = {
      cleanupObject: "owner_image",
      cleanupPhase,
      cleanupSystemCode: systemCode(cleanup),
      primarySystemCode: systemCode(primary),
    };
    imageFailures.set(primary, imageFailure);
  }
  function cleanImage(): void {
    if (imagePresent) {
      cleanupPhase = "image_unlink";
      unlinkSync(executable);
      imagePresent = false;
    }
    if (rootPresent) {
      cleanupPhase = "directory_remove";
      rmdirSync(root);
      rootPresent = false;
    }
  }
  let child: ChildProcessWithoutNullStreams;
  try {
    const descriptor = openSync(executable, "wx", 0o500);
    imagePresent = true;
    try {
      writeFileSync(descriptor, payload);
    } finally {
      closeSync(descriptor);
    }
    child = spawn(executable, [binaryPath], {
      ...options,
      detached: false,
      stdio: ["pipe", "pipe", "pipe", "pipe"],
    });
  } catch (error) {
    try {
      cleanImage();
    } catch (cleanup) {
      const primary = error instanceof Error ? error : new Error("Linux owner preparation failed.");
      recordImageFailure(primary, cleanup);
      throw primary;
    }
    throw error;
  }
  const control = child.stdio[3] as Duplex;
  let resolveCompletion!: () => void;
  let rejectCompletion!: (error: Error) => void;
  const completion = new Promise<void>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });
  void completion.catch(() => undefined);
  let ready = false,
    done = false,
    stopping = false,
    failed = false;
  let pending = "";
  let startupError = false;
  const stop = (): void => {
    if (stopping || done) return;
    stopping = true;
    if (!control.destroyed && !control.writableEnded) control.end();
  };
  const fail = (message: string, emit = true): void => {
    if (failed || done) return;
    failed = true;
    const error = new Error(message);
    // A control failure can precede READY. Record image cleanup before handing
    // off the error; notification deduplication must not defer this until close.
    if (!imageFailure) {
      try {
        cleanImage();
      } catch (cleanup) {
        recordImageFailure(error, cleanup);
      }
    }
    if (imageFailure) imageFailures.set(error, imageFailure);
    rejectCompletion(error);
    stop();
    // Consumers handle the first startup notification once. Subsequent owner
    // failures belong to completion, including after an image startup error.
    if (emit && !startupError) {
      startupError = true;
      child.emit("error", error);
    }
  };
  control.on("data", (bytes: Buffer) => {
    if (failed || done) return;
    pending += bytes.toString("ascii");
    if (pending.length > 256) {
      fail("Linux owner status exceeded its limit.");
      return;
    }
    while (pending.includes("\n") && !failed && !done) {
      const end = pending.indexOf("\n");
      const line = pending.slice(0, end);
      pending = pending.slice(end + 1);
      if (line === "DWO1 READY 0" && !ready) {
        ready = true;
        try {
          cleanImage();
        } catch (cleanup) {
          const error = new Error("Linux owner executable cleanup failed before Machine start.");
          recordImageFailure(error, cleanup);
          startupError = true;
          stop();
          child.emit("error", error);
        }
        if (!stopping) control.write("A");
      } else if (/^DWO1 DONE (?:[0-9]|[1-9][0-9]{1,2})$/u.test(line) && ready) {
        const code = Number(line.slice(10));
        if (code > 255) {
          fail("Linux owner returned an invalid exit result.");
          return;
        }
        done = true;
        resolveCompletion();
      } else if (/^DWO1 ERROR [1-9][0-9]*$/u.test(line) && ready && !startupError) {
        startupError = true;
        stop();
        // A launch error and confirmed teardown are independent outcomes.
        child.emit("error", new Error("Linux Machine owner could not start the configured executable."));
      } else {
        fail("Linux Machine owner cleanup was not confirmed.");
      }
    }
  });
  control.on("error", () => fail("Linux owner control channel failed."));
  child.once("error", (error) => {
    if (startupError) return;
    startupError = true;
    try {
      cleanImage();
    } catch (cleanup) {
      recordImageFailure(error, cleanup);
    }
    if (child.pid === undefined && !ready) {
      done = true;
      resolveCompletion();
    } else fail("Linux owner failed to start or complete.", false);
  });
  child.once("close", () => {
    try {
      cleanImage();
    } catch (cleanup) {
      // File cleanup is independent of the native DONE/exit result. The
      // startup error already carries this failure; never discard valid DONE.
      if (!imageFailure) {
        const error = new Error("Linux owner executable cleanup remained incomplete.");
        recordImageFailure(error, cleanup);
        if (!startupError) {
          startupError = true;
          child.emit("error", error);
        }
      }
    }
    if (!done) fail("Linux owner exited without confirmed cleanup.", false);
    control.destroy();
  });
  return {
    child,
    ownership: {
      kind: "linux-supervisor",
      completion,
      stop,
      get diagnostics() {
        return imageFailure;
      },
    },
  };
}

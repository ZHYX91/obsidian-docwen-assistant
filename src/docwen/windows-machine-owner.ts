import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { LocalCliError } from "./errors";
import { docWenChildEnvironment, type DocWenLaunchTarget } from "./process-launch";
import {
  WINDOWS_X64_MACHINE_OWNER_BASE64,
  WINDOWS_X64_MACHINE_OWNER_BYTES,
  WINDOWS_X64_MACHINE_OWNER_SHA256,
} from "./windows-machine-owner-x64";

export const WINDOWS_MACHINE_OWNER_TARGET_ENV = "DOCWEN_ASSISTANT_JOB_TARGET";
export const WINDOWS_MACHINE_OWNER_FAILURE_EXIT = 125;
export const WINDOWS_MACHINE_TARGET_NOT_FOUND_EXIT = 126;

type WindowsMachineOwnerImage = {
  root: string;
  executable: string;
};

type WindowsMachineOwnerLease = {
  executable: string;
  release(): void;
};

type WindowsMachineOwnerMaterializer = () => Promise<WindowsMachineOwnerImage>;

export class WindowsMachineOwnerStore {
  private image: Promise<WindowsMachineOwnerImage> | null = null;
  private leases = 0;
  private disposed = false;

  constructor(
    private readonly materialize: WindowsMachineOwnerMaterializer = materializeWindowsMachineOwner,
  ) {}

  async acquire(): Promise<WindowsMachineOwnerLease> {
    if (this.disposed) {
      throw new LocalCliError("cli_spawn_failed", "The Windows Machine lifetime owner has been disposed.");
    }
    const image = await this.loadImage();
    if (this.disposed) {
      void this.cleanupIfIdle();
      throw new LocalCliError("cli_spawn_failed", "The Windows Machine lifetime owner has been disposed.");
    }
    try {
      await verifyWindowsMachineOwnerFile(image.executable);
    } catch (error) {
      if (error instanceof LocalCliError) throw error;
      throw new LocalCliError(
        "cli_integrity_error",
        "The materialized Windows Machine lifetime owner could not be verified.",
        { cause: errorMessage(error), ownershipState: "windows_job" },
      );
    }
    this.leases += 1;
    let released = false;
    return {
      executable: image.executable,
      release: () => {
        if (released) return;
        released = true;
        this.leases -= 1;
        void this.cleanupIfIdle();
      },
    };
  }

  dispose(): void {
    this.disposed = true;
    void this.cleanupIfIdle();
  }

  private loadImage(): Promise<WindowsMachineOwnerImage> {
    if (!this.image) {
      const loading = this.materialize();
      this.image = loading;
      void loading.catch(() => {
        if (this.image === loading) this.image = null;
      });
    }
    return this.image;
  }

  private async cleanupIfIdle(): Promise<void> {
    if (!this.disposed || this.leases !== 0 || !this.image) return;
    const imagePromise = this.image;
    this.image = null;
    try {
      const image = await imagePromise;
      await rm(image.root, { recursive: true, force: true });
    } catch {
      // The process owner is already closed. A leftover verified helper image
      // grants no process authority and is confined to its random temp root.
    }
  }
}

export async function spawnWindowsOwnedMachineProcess(
  target: DocWenLaunchTarget,
  store: WindowsMachineOwnerStore,
): Promise<ChildProcessWithoutNullStreams> {
  const lease = await store.acquire();
  try {
    const child = spawn(lease.executable, [], {
      cwd: target.cwd,
      env: {
        ...docWenChildEnvironment(),
        [WINDOWS_MACHINE_OWNER_TARGET_ENV]: target.executable,
      },
      detached: false,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let released = false;
    const release = (): void => {
      if (released) return;
      released = true;
      lease.release();
    };
    child.once("close", release);
    child.once("error", release);
    return child;
  } catch (error) {
    lease.release();
    throw new LocalCliError("cli_spawn_failed", "Unable to start the Windows Machine lifetime owner.", {
      cause: errorMessage(error),
      ownershipState: "windows_job",
    });
  }
}

export async function materializeWindowsMachineOwner(
  parent: string = tmpdir(),
): Promise<WindowsMachineOwnerImage> {
  if (process.platform !== "win32") {
    throw new LocalCliError(
      "cli_platform_unsupported",
      "The Windows Machine lifetime owner is only available on Windows.",
      { platform: process.platform },
    );
  }
  const bytes = Buffer.from(WINDOWS_X64_MACHINE_OWNER_BASE64, "base64");
  verifyWindowsMachineOwnerImage(bytes);
  let root: string | null = null;
  try {
    root = await mkdtemp(path.join(parent, "docwen-assistant-owner-"));
    const executable = path.join(root, "windows-x64.exe");
    await writeFile(executable, bytes, { flag: "wx" });
    await verifyWindowsMachineOwnerFile(executable);
    return { root, executable };
  } catch (error) {
    if (root) await rm(root, { recursive: true, force: true }).catch(() => undefined);
    if (error instanceof LocalCliError) throw error;
    throw new LocalCliError("cli_spawn_failed", "Unable to materialize the Windows Machine lifetime owner.", {
      cause: errorMessage(error),
      ownershipState: "windows_job",
    });
  }
}

export function verifyWindowsMachineOwnerImage(bytes: Buffer): void {
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (bytes.length !== WINDOWS_X64_MACHINE_OWNER_BYTES || digest !== WINDOWS_X64_MACHINE_OWNER_SHA256) {
    throw ownerIntegrityError("The embedded Windows Machine lifetime owner failed its digest check.");
  }
  if (bytes.length < 0x100 || bytes.readUInt16LE(0) !== 0x5a4d) {
    throw ownerIntegrityError("The embedded Windows Machine lifetime owner is not a PE image.");
  }
  const pe = bytes.readUInt32LE(0x3c);
  if (
    pe < 0x40
    || pe + 24 + 70 > bytes.length
    || bytes.readUInt32LE(pe) !== 0x00004550
    || bytes.readUInt16LE(pe + 4) !== 0x8664
    || bytes.readUInt32LE(pe + 8) !== 0
    || bytes.readUInt16LE(pe + 24) !== 0x020b
    || bytes.readUInt16LE(pe + 24 + 68) !== 3
  ) {
    throw ownerIntegrityError("The embedded Windows Machine lifetime owner has an unexpected PE identity.");
  }
}

async function verifyWindowsMachineOwnerFile(filename: string): Promise<void> {
  const info = await lstat(filename);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw ownerIntegrityError("The materialized Windows Machine lifetime owner is not a regular file.");
  }
  verifyWindowsMachineOwnerImage(await readFile(filename));
}

function ownerIntegrityError(message: string): LocalCliError {
  return new LocalCliError("cli_integrity_error", message, {
    ownershipState: "windows_job",
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

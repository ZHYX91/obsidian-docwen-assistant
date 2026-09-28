import { createHash } from "node:crypto";
import { lstat, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { getSystemErrorName } from "node:util";

import { LocalCliError } from "./errors";
import { operationWarning, recordFailureWarning } from "./operation-outcome";
import {
  LINUX_X64_RENAME_ADDON_BASE64,
  LINUX_X64_RENAME_ADDON_SHA256,
} from "./publish-path-linux-x64";

type DirectoryBinding = {
  renameDirectory(source: string, destination: string): number;
};

const REQUIRED_NODE_API = 8;
let linuxBindingPromise: Promise<DirectoryBinding> | null = null;

export function assertDirectoryPublicationSupported(
  platform: NodeJS.Platform = process.platform,
  arch = process.arch,
  nodeApi = process.versions.napi,
): void {
  if (platform === "win32") return;
  const napi = Number(nodeApi);
  if (platform !== "linux" || arch !== "x64" || !Number.isSafeInteger(napi) || napi < REQUIRED_NODE_API) {
    throw new LocalCliError(
      "cli_platform_unsupported",
      "Atomic result-directory publication requires Windows or Linux x64 with Node-API 8 or later.",
      { platform, arch, nodeApi: nodeApi ?? null },
    );
  }
}

export async function publishDirectoryNoReplace(source: string, destination: string): Promise<void> {
  assertDirectoryPublicationSupported();
  if (process.platform === "win32") {
    try {
      await rename(source, destination);
      return;
    } catch (error) {
      const code = systemErrorCode(error);
      if (code === "EEXIST" || code === "ENOTEMPTY") throw collisionError(destination);
      if ((code === "EPERM" || code === "EACCES") && await targetExists(destination)) {
        throw collisionError(destination);
      }
      throw commitError(code);
    }
  }

  const binding = await linuxDirectoryBinding();
  const errno = binding.renameDirectory(source, destination);
  if (errno === 0) return;
  const code = errnoName(errno);
  if (code === "EEXIST" || code === "ENOTEMPTY") throw collisionError(destination);
  if (code === "ENOSYS" || code === "ENOTSUP" || code === "EOPNOTSUPP" || code === "EINVAL") {
    throw new LocalCliError(
      "cli_platform_unsupported",
      "The selected Linux filesystem cannot provide atomic no-replace directory publication.",
      { systemCode: code },
    );
  }
  throw commitError(code);
}

async function linuxDirectoryBinding(): Promise<DirectoryBinding> {
  assertDirectoryPublicationSupported();
  if (!linuxBindingPromise) {
    const loading = loadLinuxBinding();
    linuxBindingPromise = loading;
    void loading.catch(() => {
      if (linuxBindingPromise === loading) linuxBindingPromise = null;
    });
  }
  return linuxBindingPromise;
}

async function loadLinuxBinding(): Promise<DirectoryBinding> {
  const bytes = Buffer.from(LINUX_X64_RENAME_ADDON_BASE64, "base64");
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== LINUX_X64_RENAME_ADDON_SHA256) {
    throw new LocalCliError("cli_integrity_error", "The embedded Linux publication helper failed its integrity check.");
  }

  const root = await mkdtemp(path.join(tmpdir(), "docwen-assistant-native-"));
  let primaryFailure: unknown;
  let cleanupFailure: unknown;
  let loaded: DirectoryBinding | null = null;
  try {
    const addonPath = path.join(root, "linux-x64.node");
    await writeFile(addonPath, bytes, { flag: "wx", mode: 0o500 });
    const requireNative = createRequire(path.join(root, "loader.cjs"));
    const candidate = requireNative(addonPath) as unknown;
    if (!isDirectoryBinding(candidate)) {
      throw new LocalCliError("cli_integrity_error", "The embedded Linux publication helper has an invalid interface.");
    }
    loaded = candidate;
  } catch (error) {
    primaryFailure = error;
  } finally {
    try {
      await rm(root, { recursive: true, force: true });
    } catch (error) {
      cleanupFailure = error;
    }
  }
  if (primaryFailure !== undefined) {
    const failure = nativeLoadError(primaryFailure);
    if (cleanupFailure !== undefined) {
      recordFailureWarning(failure, operationWarning("output_cleanup_failed", cleanupFailure));
    }
    throw failure;
  }
  if (cleanupFailure !== undefined) {
    throw new LocalCliError(
      "cli_cleanup_failed",
      "The temporary Linux publication helper could not be removed.",
      safeSystemDetails(cleanupFailure),
    );
  }
  if (!loaded) {
    throw new LocalCliError("cli_integrity_error", "The embedded Linux publication helper did not load.");
  }
  return loaded;
}

function isDirectoryBinding(value: unknown): value is DirectoryBinding {
  return typeof value === "object"
    && value !== null
    && "renameDirectory" in value
    && typeof value.renameDirectory === "function";
}

async function targetExists(target: string): Promise<boolean> {
  try {
    await lstat(target);
    return true;
  } catch (error) {
    if (systemErrorCode(error) === "ENOENT") return false;
    throw commitError(systemErrorCode(error));
  }
}

function collisionError(target: string): LocalCliError {
  return new LocalCliError(
    "cli_commit_failed",
    "The result directory already exists. Run again to create a new result.",
    { target },
  );
}

function commitError(systemCode?: string): LocalCliError {
  return new LocalCliError(
    "cli_commit_failed",
    "Atomic result-directory publication failed.",
    systemCode ? { systemCode } : {},
  );
}

function nativeLoadError(error: unknown): LocalCliError {
  if (error instanceof LocalCliError) return error;
  return new LocalCliError(
    "cli_platform_unsupported",
    "The embedded Linux publication helper could not be loaded.",
    safeSystemDetails(error),
  );
}

function errnoName(errno: number): string {
  try {
    return getSystemErrorName(-errno);
  } catch {
    return `ERRNO_${errno}`;
  }
}

function safeSystemDetails(error: unknown): Record<string, unknown> {
  const systemCode = systemErrorCode(error);
  return systemCode ? { systemCode } : {};
}

function systemErrorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
}

/** Shared integrity checks for input snapshots and both publication modes. */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, realpath } from "node:fs/promises";
import * as path from "node:path";
import { LocalCliError } from "./errors";
import type { ValidatedArtifactBundle, ValidatedBundleArtifact } from "./machine-client";

export type FileIdentity = {
  dev: number;
  ino: number;
  mtimeMs: number;
  size: number;
};

export function preferredArtifact(bundle: ValidatedArtifactBundle): ValidatedBundleArtifact {
  const entry = bundle.entries.find((candidate) => candidate.preferred === true);
  const artifact = bundle.artifacts.find((candidate) => candidate.artifact_id === entry?.artifact_id);
  if (!artifact) throw new LocalCliError("cli_integrity_error", "Artifact Bundle preferred output is missing.");
  return artifact;
}

export async function verifyArtifactIdentity(
  artifact: ValidatedBundleArtifact,
  filePath: string,
  requireCanonicalPath: boolean,
  signal?: AbortSignal,
): Promise<FileIdentity> {
  const before = await regularFileIdentity(filePath);
  if (before.size !== artifact.size_bytes) {
    throw new LocalCliError("cli_integrity_error", "Artifact size changed before commit.", {
      artifactId: artifact.artifact_id,
    });
  }
  if (requireCanonicalPath) {
    const canonical = await realpath(filePath);
    const left = path.resolve(canonical);
    const right = path.resolve(artifact.absolutePath);
    const samePath = process.platform === "win32"
      ? left.toLowerCase() === right.toLowerCase()
      : left === right;
    if (!samePath) {
      throw new LocalCliError("cli_integrity_error", "Artifact canonical path changed before commit.", {
        artifactId: artifact.artifact_id,
      });
    }
  }
  const digest = await sha256File(filePath, artifact.size_bytes, signal);
  const after = await regularFileIdentity(filePath);
  if (!sameFileIdentity(before, after) || digest !== artifact.sha256) {
    throw new LocalCliError("cli_integrity_error", "Artifact identity changed before commit.", {
      artifactId: artifact.artifact_id,
    });
  }
  return after;
}

export async function regularFileIdentity(filePath: string): Promise<FileIdentity> {
  const value = await lstat(filePath);
  if (!value.isFile() || value.isSymbolicLink()) {
    throw new LocalCliError("cli_commit_failed", "Commit paths must be regular non-link files.", { filePath });
  }
  return fileIdentity(value);
}

export function fileIdentity(value: { dev: number; ino: number; mtimeMs: number; size: number }): FileIdentity {
  return {
    dev: value.dev,
    ino: value.ino,
    mtimeMs: value.mtimeMs,
    size: value.size,
  };
}

export function sameFileIdentity(left: FileIdentity, right: FileIdentity): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.size === right.size
    && left.mtimeMs === right.mtimeMs;
}

export function samePath(left: string, right: string): boolean {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  return process.platform === "win32"
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

export async function sha256File(
  filePath: string,
  expectedBytes: number,
  signal?: AbortSignal,
): Promise<string> {
  const hash = createHash("sha256");
  let bytesRead = 0;
  throwIfAborted(signal);
  for await (const chunk of createReadStream(filePath) as AsyncIterable<Buffer<ArrayBufferLike>>) {
    throwIfAborted(signal);
    bytesRead += chunk.length;
    if (bytesRead > expectedBytes) {
      throw new LocalCliError("cli_integrity_error", "File grew while it was being hashed.", { filePath });
    }
    hash.update(chunk);
  }
  if (bytesRead !== expectedBytes) {
    throw new LocalCliError("cli_integrity_error", "File size changed while it was being hashed.", { filePath });
  }
  return hash.digest("hex");
}

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new LocalCliError("cli_cancelled", "DocWen operation was cancelled.");
}

export function isErrno(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code;
}

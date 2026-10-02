/** File-only output transactions; directory conversions use output-directory. */
import { randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { copyFile, link, mkdir, rm } from "node:fs/promises";
import * as path from "node:path";
import { LocalCliError } from "./errors";
import type { ValidatedArtifactBundle } from "./machine-client";
import { operationWarning, publishOnce, type OperationWarning, type Completed } from "./operation-outcome";
import {
  type FileIdentity, preferredArtifact, verifyArtifactIdentity, regularFileIdentity,
  sameFileIdentity, sha256File, throwIfAborted, isErrno,
} from "./output-integrity";

type PreparedOutput = {
  backup: string | null;
  expectedTarget: FileIdentity | null;
  target: string;
  temporary: string;
  temporaryIdentity: FileIdentity;
};

/** Capture the user-selected destination before conversion or other preparation. */
export async function captureOutputTarget(outputPath: string, signal?: AbortSignal) {
  const target = path.resolve(outputPath);
  const expected = await inspectCommitTarget(target, true);
  const contentSha256 = expected ? await sha256File(target, expected.size, signal) : null;
  await assertCommitTargetUnchanged(target, expected);
  return {
    existed: expected !== null,
    contentSha256,
    async assertCurrent(): Promise<void> {
      throwIfAborted(signal);
      await assertCommitTargetUnchanged(target, expected);
      if (expected && await sha256File(target, expected.size, signal) !== contentSha256) {
        throw new LocalCliError("cli_commit_failed", "The selected output changed during conversion.");
      }
      await assertCommitTargetUnchanged(target, expected);
      throwIfAborted(signal);
    },
  };
}

export async function atomicCommitBundle(
  bundle: ValidatedArtifactBundle,
  outputPath: string,
  overwrite: boolean,
  signal?: AbortSignal,
  publish?: <T>(commit: () => Promise<T>) => Promise<T>,
): Promise<{ outputs: string[]; warnings: OperationWarning[] }> {
  throwIfAborted(signal);
  const preferred = preferredArtifact(bundle);
  const destinationRoot = path.dirname(path.resolve(outputPath));
  await mkdir(destinationRoot, { recursive: true });
  const manifestIds = new Set(bundle.relations
    .filter((relation) => relation.type === "resource_of" && relation.role === "manifest")
    .map((relation) => relation.source_artifact_id));
  const orderedArtifacts = [preferred, ...bundle.artifacts.filter((artifact) =>
    artifact !== preferred && !manifestIds.has(artifact.artifact_id))];
  const targets = orderedArtifacts.map((artifact) => ({
    artifact,
    allowOverwrite: artifact.artifact_id === preferred.artifact_id && overwrite,
    target: artifact.artifact_id === preferred.artifact_id
      ? path.resolve(outputPath)
      : path.join(destinationRoot, artifact.suggested_name),
  }));
  const normalizedTargets = targets.map(({ target }) => target.toLowerCase());
  if (new Set(normalizedTargets).size !== targets.length) {
    throw new LocalCliError("cli_commit_failed", "Artifact Bundle maps multiple artifacts to the same output path.");
  }
  const transactionId = randomUUID();
  const prepared: PreparedOutput[] = [];
  const committed: Array<{ identity: FileIdentity; target: string }> = [];
  let checkingPublication = false;
  let commitStarted = false;
  let published: Completed<string[]>;
  try {
    for (let index = 0; index < targets.length; index += 1) {
      throwIfAborted(signal);
      const { allowOverwrite, artifact, target } = targets[index];
      const expectedTarget = await inspectCommitTarget(target, allowOverwrite);
      const temporary = path.join(destinationRoot, `.docwen-${transactionId}-${index}.new`);
      await verifyArtifactIdentity(artifact, artifact.absolutePath, true);
      await copyFile(artifact.absolutePath, temporary, fsConstants.COPYFILE_EXCL);
      const initialTemporaryIdentity = await regularFileIdentity(temporary);
      const preparedOutput: PreparedOutput = {
        backup: null,
        expectedTarget,
        target,
        temporary,
        temporaryIdentity: initialTemporaryIdentity,
      };
      prepared.push(preparedOutput);
      preparedOutput.temporaryIdentity = await verifyArtifactIdentity(artifact, temporary, false);
      await verifyArtifactIdentity(artifact, artifact.absolutePath, true);
    }
    const commit = async (): Promise<string[]> => {
      throwIfAborted(signal);
      commitStarted = true;
      for (let index = 0; index < prepared.length; index += 1) {
        const item = prepared[index];
        await assertCommitTargetUnchanged(item.target, item.expectedTarget);
        if (item.expectedTarget) {
          item.backup = path.join(destinationRoot, `.docwen-${transactionId}-${index}.bak`);
          await link(item.target, item.backup);
          const backupIdentity = await regularFileIdentity(item.backup);
          if (!sameFileIdentity(backupIdentity, item.expectedTarget)) {
            throw new Error(`Output target changed while its backup was being created: ${item.target}`);
          }
          await rm(item.target);
          const retainedIdentity = await regularFileIdentity(item.backup);
          if (!sameFileIdentity(retainedIdentity, item.expectedTarget)) {
            throw new Error(`Output backup changed while its target was being removed: ${item.target}`);
          }
        }
      }
      for (const item of prepared) {
        await link(item.temporary, item.target);
        committed.push({ identity: item.temporaryIdentity, target: item.target });
        const [targetIdentity, temporaryIdentity] = await Promise.all([
          regularFileIdentity(item.target),
          regularFileIdentity(item.temporary),
        ]);
        item.temporaryIdentity = temporaryIdentity;
        if (!sameFileIdentity(targetIdentity, temporaryIdentity)) {
          throw new Error(`Committed output identity does not match its prepared artifact: ${item.target}`);
        }
      }
      return targets.map(({ target }) => target);
    };
    checkingPublication = publish !== undefined;
    published = await publishOnce<string[]>(commit, publish);

  } catch (error) {
    const cleanupFailures: string[] = [];
    for (const item of committed.reverse()) {
      try {
        const current = await regularFileIdentity(item.target);
        if (!sameFileIdentity(current, item.identity)) {
          cleanupFailures.push(`committed output changed and was preserved: ${item.target}`);
          continue;
        }
        await rm(item.target);
      } catch (cleanupError) {
        if (!isErrno(cleanupError, "ENOENT")) cleanupFailures.push(errorMessage(cleanupError));
      }
    }
    for (const item of prepared.slice().reverse()) {
      try {
        const temporaryIdentity = await regularFileIdentity(item.temporary);
        if (sameFileIdentity(temporaryIdentity, item.temporaryIdentity)) await rm(item.temporary);
        else cleanupFailures.push(`prepared output changed and was preserved: ${item.temporary}`);
      } catch (cleanupError) {
        if (!isErrno(cleanupError, "ENOENT")) cleanupFailures.push(errorMessage(cleanupError));
      }
      if (item.backup) {
        try {
          const backupIdentity = await regularFileIdentity(item.backup);
          if (!sameFileIdentity(backupIdentity, item.expectedTarget!)) {
            cleanupFailures.push(`backup changed and was preserved: ${item.backup}`);
            continue;
          }
          let targetIdentity: FileIdentity | null;
          try {
            targetIdentity = await regularFileIdentity(item.target);
          } catch (targetError) {
            if (!isErrno(targetError, "ENOENT")) throw targetError;
            targetIdentity = null;
          }
          if (targetIdentity) {
            if (!sameFileIdentity(targetIdentity, item.expectedTarget!)) {
              cleanupFailures.push(`target changed and backup was preserved: ${item.target}`);
              continue;
            }
          } else {
            await link(item.backup, item.target);
            targetIdentity = await regularFileIdentity(item.target);
            if (!sameFileIdentity(targetIdentity, item.expectedTarget!)) {
              cleanupFailures.push(`restored target identity mismatch; backup preserved: ${item.target}`);
              continue;
            }
          }
          await rm(item.backup);
        } catch (cleanupError) {
          cleanupFailures.push(`backup retained at ${item.backup}: ${errorMessage(cleanupError)}`);
        }
      }
    }
    if (!commitStarted && cleanupFailures.length === 0
      && (checkingPublication || (error instanceof LocalCliError && error.code === "cli_cancelled"))) throw error;
    throw new LocalCliError("cli_commit_failed", "Unable to commit the DocWen Artifact Bundle.", {
      cause: errorMessage(error),
      outputState: cleanupFailures.length > 0 ? "unconfirmed" : "not_published",
      ...(cleanupFailures.length > 0 ? { cleanupFailures } : {}),
    });
  }
  // Every output is now authoritative. Cleanup cannot enter rollback.
  for (const item of prepared) {
    for (const [file, expected] of [[item.temporary, item.temporaryIdentity], [item.backup, item.expectedTarget]] as const) {
      if (!file || !expected) continue;
      try {
        const current = await regularFileIdentity(file);
        if (!sameFileIdentity(current, expected)) {
          throw new LocalCliError("cli_integrity_error", "Output cleanup identity changed; the file was preserved.");
        }
        await rm(file);
      } catch (error) {
        if (!isErrno(error, "ENOENT")) published.warnings.push(operationWarning("output_cleanup_failed", error));
      }
    }
  }
  return { outputs: published.value, warnings: published.warnings };
}

async function inspectCommitTarget(target: string, allowOverwrite: boolean): Promise<FileIdentity | null> {
  if (!path.basename(target)) {
    throw new LocalCliError("cli_commit_failed", "The output target must be a file path.", { target });
  }
  let identity: FileIdentity;
  try {
    identity = await regularFileIdentity(target);
  } catch (error) {
    if (isErrno(error, "ENOENT")) return null;
    throw error;
  }
  if (!allowOverwrite) {
    throw new LocalCliError("cli_commit_failed", "An output artifact already exists.", { target });
  }
  return identity;
}

async function assertCommitTargetUnchanged(target: string, expected: FileIdentity | null): Promise<void> {
  let current: FileIdentity | null;
  try {
    current = await regularFileIdentity(target);
  } catch (error) {
    if (!isErrno(error, "ENOENT")) throw error;
    current = null;
  }
  if (
    (expected === null && current !== null)
    || (expected !== null && (current === null || !sameFileIdentity(current, expected)))
  ) {
    throw new LocalCliError("cli_commit_failed", "An output target changed before commit.", { target });
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

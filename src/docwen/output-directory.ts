/** Publish the producer's complete logical directory through one rename. */
import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { copyFile, lstat, mkdir, mkdtemp, open, realpath, rename, rm } from "node:fs/promises";
import * as path from "node:path";
import { LocalCliError } from "./errors";
import type { ValidatedArtifactBundle } from "./machine-client";
import { isErrno, preferredArtifact, samePath, throwIfAborted, verifyArtifactIdentity } from "./output-integrity";

export type DirectoryPublication = <T>(outputRoot: string, commit: () => Promise<T>) => Promise<T>;

export interface OutputDirectorySnapshot {
  readonly path: string;
  assertCurrent(): Promise<void>;
}

export async function captureOutputDirectory(directory: string, signal?: AbortSignal): Promise<OutputDirectorySnapshot> {
  const selected = path.resolve(directory);
  throwIfAborted(signal);
  const expected = await directoryIdentity(selected);
  const canonical = await realpath(selected);
  const snapshot: OutputDirectorySnapshot = {
    path: canonical,
    async assertCurrent() {
      throwIfAborted(signal);
      const current = await directoryIdentity(selected);
      if (current.dev !== expected.dev || current.ino !== expected.ino || !samePath(await realpath(selected), canonical)) {
        throw new LocalCliError("cli_commit_failed", "The selected output directory changed during conversion.");
      }
      throwIfAborted(signal);
    },
  };
  await snapshot.assertCurrent();
  return snapshot;
}

async function directoryIdentity(directory: string) {
  const value = await lstat(directory);
  if (!value.isDirectory() || value.isSymbolicLink()) {
    throw new LocalCliError("cli_commit_failed", "The output parent must be an existing directory, not a link.");
  }
  return { dev: value.dev, ino: value.ino };
}

async function requireAbsent(target: string): Promise<void> {
  try {
    await lstat(target);
  } catch (error) {
    if (isErrno(error, "ENOENT")) return;
    throw error;
  }
  throw new LocalCliError("cli_commit_failed", "The result directory already exists. Run again to create a new result.", { target });
}

function logicalParts(value: string): string[] {
  const parts = value.split("/");
  if (parts.length < 2 || parts.some((part) =>
    !part || part === "." || part === ".." || /[\\:*?"<>|]/u.test(part)
    || Array.from(part).some((character) => character.charCodeAt(0) < 32)
    || /[. ]$/u.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part))) {
    throw new LocalCliError("cli_integrity_error", "Artifact logical paths must use portable result-directory names.");
  }
  return parts;
}

export async function atomicCommitDirectory(
  bundle: ValidatedArtifactBundle,
  parent: OutputDirectorySnapshot,
  signal?: AbortSignal,
  publish?: DirectoryPublication,
): Promise<{ output: string; outputs: string[] }> {
  throwIfAborted(signal);
  if (bundle.layout_schema !== "docwen.document_node.v1") {
    throw new LocalCliError("cli_integrity_error", "Conversion output requires the document-node layout.");
  }
  const preferred = preferredArtifact(bundle);
  const paths = bundle.artifacts.map((artifact) => ({ artifact, parts: logicalParts(artifact.logical_path) }));
  const roots = new Set(paths.map(({ parts }) => parts[0]));
  const rootName = paths[0]?.parts[0];
  if (!rootName || roots.size !== 1) throw new LocalCliError("cli_integrity_error", "A conversion must have one result root.");
  const names = paths.map(({ parts }) => parts.join("/").toLowerCase());
  if (new Set(names).size !== names.length) throw new LocalCliError("cli_integrity_error", "Artifact output paths collide.");
  const manifests = bundle.relations.filter((r) => r.type === "resource_of" && r.role === "manifest");
  const manifest = paths.find(({ artifact }) => artifact.artifact_id === manifests[0]?.source_artifact_id);
  if (manifests.length !== 1 || manifests[0].target_artifact_id !== preferred.artifact_id
    || manifest?.parts.join("/") !== `${rootName}/docwen-node.json`
    || manifest.artifact.media_type !== "application/vnd.docwen.document-node+json") {
    throw new LocalCliError("cli_integrity_error", "The result directory requires its bound manifest.");
  }
  await parent.assertCurrent();
  const finalRoot = path.join(parent.path, rootName);
  await requireAbsent(finalRoot);
  const temporary = await mkdtemp(path.join(parent.path, ".docwen-output-"));
  const temporaryIdentity = await directoryIdentity(temporary);
  let committed = false;
  try {
    for (const { artifact, parts } of paths) {
      throwIfAborted(signal);
      const destination = path.join(temporary, ...parts.slice(1));
      await mkdir(path.dirname(destination), { recursive: true });
      await verifyArtifactIdentity(artifact, artifact.absolutePath, true, signal);
      await copyFile(artifact.absolutePath, destination, fsConstants.COPYFILE_EXCL);
      await verifyArtifactIdentity(artifact, destination, false, signal);
      await verifyArtifactIdentity(artifact, artifact.absolutePath, true, signal);
    }
    // Finish all byte reads before the host validates the live source and editors.
    const prepared = await Promise.all(paths.map(async ({ artifact, parts }) => {
      const file = path.join(temporary, ...parts.slice(1));
      await verifyArtifactIdentity(artifact, file, false, signal);
      return { file, identity: await lstat(file, { bigint: true }) };
    }));
    const commit = async () => {
      if (committed) throw new LocalCliError("cli_commit_failed", "The conversion was already published.");
      await parent.assertCurrent();
      const currentTemporary = await directoryIdentity(temporary);
      if (currentTemporary.dev !== temporaryIdentity.dev || currentTemporary.ino !== temporaryIdentity.ino) {
        throw new LocalCliError("cli_integrity_error", "The prepared result directory changed before publication.");
      }
      for (const { file, identity } of prepared) {
        const current = await lstat(file, { bigint: true });
        if (!current.isFile() || current.isSymbolicLink()
          || current.dev !== identity.dev || current.ino !== identity.ino
          || current.size !== identity.size || current.mtimeNs !== identity.mtimeNs || current.ctimeNs !== identity.ctimeNs) {
          throw new LocalCliError("cli_integrity_error", "A prepared artifact changed during publication checks.");
        }
      }
      const digest = createHash("sha256").update(rootName.toLowerCase()).digest("hex").slice(0, 24);
      const lockPath = path.join(parent.path, `.docwen-output-${digest}.lock`);
      const lock = await open(lockPath, "wx");
      const lockIdentity = await lock.stat();
      try {
        await parent.assertCurrent();
        await requireAbsent(finalRoot);
        throwIfAborted(signal);
        await rename(temporary, finalRoot);
        committed = true;
      } finally {
        await lock.close().catch((error: unknown) => { if (!committed) throw error; });
        const currentLock = await lstat(lockPath).catch(() => null);
        if (currentLock?.dev === lockIdentity.dev && currentLock.ino === lockIdentity.ino) {
          await rm(lockPath).catch(() => undefined);
        }
      }
      const output = path.join(parent.path, ...logicalParts(preferred.logical_path));
      const outputs = [output, ...paths.filter(({ artifact }) =>
        artifact !== preferred && artifact !== manifest.artifact
        && (artifact.kind !== "resource" || bundle.entries.some((entry) => entry.artifact_id === artifact.artifact_id)))
        .map(({ parts }) => path.join(parent.path, ...parts))];
      return { output, outputs };
    };
    return await (publish ? publish(finalRoot, commit) : commit());
  } finally {
    if (!committed) {
      const current = await directoryIdentity(temporary).catch(() => null);
      if (current?.dev === temporaryIdentity.dev && current.ino === temporaryIdentity.ino) {
        await rm(temporary, { recursive: true, force: true });
      }
    }
  }
}

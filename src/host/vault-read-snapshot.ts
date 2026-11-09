import {
  buildDeclaredMarkdownInputs,
  logicalPathFor,
  type DeclaredMarkdownSnapshot,
} from "./declared-markdown-snapshot";
export type { DeclaredMarkdownSnapshot } from "./declared-markdown-snapshot";
import { operationWarning, recordFailureWarning, type Completed, type OperationWarning } from "../docwen/operation-outcome";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import type { App, TFile } from "obsidian";

import { mediaTypeForPath, sourceKindForPath, type TaskInput } from "../docwen";
import { bindAcceptedDetectedSource } from "../docwen/capability-service";
import type { FileInspection, RuntimeRoute } from "../docwen/client";
import {
  isSameOpenMarkdownTarget,
  locateOpenMarkdownTarget,
} from "./open-markdown-target";
import { VaultWriteError } from "./vault-write-transaction";

export interface IsolatedSnapshot {
  readonly inputPath: string;
  readonly contentSha256: string;
  readonly sourceInput: TaskInput;
  readonly inputs: readonly TaskInput[];
  /** Materialize an explicitly accepted format only inside this snapshot's ownership. */
  readonly getAcceptedDetectedSource: (
    inspection: FileInspection,
    route: RuntimeRoute,
    inspect: (input: TaskInput) => Promise<FileInspection>,
  ) => Promise<TaskInput>;
  readonly getDeclaredMarkdownInputs: () => Promise<DeclaredMarkdownSnapshot | undefined>;
  /** Validate the captured source immediately before publishing visible results. */
  readonly publish: <T>(commit: (assertIdentity: () => void) => Promise<T>) => Promise<T>;
}

/** Provides Core with an isolated copy of the current editor/Vault content. */
export class VaultReadSnapshot {
  constructor(private readonly app: App) {}

  async run<T>(
    file: TFile,
    signal: AbortSignal,
    work: (snapshot: IsolatedSnapshot) => Promise<T>,
  ): Promise<Completed<T>> {
    const initialStat = file.stat ? { ...file.stat } : undefined;
    let modified = false;
    const reference = this.app.vault.on?.("modify", (changed) => {
      if (changed === file) modified = true;
    });
    const assertRevision = (): void => {
      if (modified || (initialStat && (file.stat.mtime !== initialStat.mtime
        || file.stat.ctime !== initialStat.ctime || file.stat.size !== initialStat.size))) {
        throw new VaultWriteError("vault_content_conflict", "The Vault file changed during the DocWen operation.");
      }
    };
    try {
      return await this.runCaptured(file, signal, work, assertRevision);
    } finally {
      if (reference) this.app.vault.offref(reference);
    }
  }

  private async runCaptured<T>(
    file: TFile,
    signal: AbortSignal,
    work: (snapshot: IsolatedSnapshot) => Promise<T>,
    assertRevision: () => void,
  ): Promise<Completed<T>> {
    // Pin the path and Vault identity before any async source read. A rename,
    // delete, or replacement must never approve publication under a new owner.
    const originalPath = file.path;
    const assertSourceIdentity = (): void => {
      if (file.path !== originalPath) {
        throw new VaultWriteError("vault_target_changed", "The source path changed during the DocWen operation.");
      }
      if (this.app.vault.getFileByPath(originalPath) !== file) {
        throw new VaultWriteError("vault_target_changed", "The source file was deleted or replaced during the DocWen operation.");
      }
    };
    assertSourceIdentity();
    const targetLookup = locateOpenMarkdownTarget(this.app.workspace, originalPath);
    if (targetLookup.kind === "ambiguous") {
      throw new VaultWriteError(
        "vault_target_changed",
        "The source is open in multiple Markdown editors.",
      );
    }
    const target = targetLookup.kind === "open" ? targetLookup.target : null;
    if (target !== null && target.view.file !== file) {
      throw new VaultWriteError("vault_target_changed", "The Markdown editor belongs to a different file object.");
    }
    const editor = target?.editor ?? null;
    const original = editor ? editor.getValue() : await this.app.vault.readBinary(file);
    assertSourceIdentity();
    const authoredMarkdown = ["md", "markdown"].includes(file.extension.toLowerCase())
      ? decodeMarkdown(original)
      : null;
    const contentSha256 = sha256(original);
    let published = false;
    const assertPublicationIdentity = (): void => {
      throwIfAborted(signal);
      assertSourceIdentity();
      if (editor) {
        if (target === null || target.view.file !== file || !isSameOpenMarkdownTarget(this.app.workspace, originalPath, target)) {
          throw new VaultWriteError("vault_target_changed", "The Markdown editor changed during the DocWen operation.");
        }
        if (sha256(editor.getValue()) !== contentSha256) {
          throw new VaultWriteError("vault_content_conflict", "The editor changed during the DocWen operation.");
        }
      } else {
        assertNoOpenMarkdownTarget(this.app, originalPath);
        assertRevision();
      }
    };
    const assertCurrent = async (): Promise<void> => {
      assertPublicationIdentity();
      if (!editor) {
        const current = await this.app.vault.readBinary(file);
        assertPublicationIdentity();
        if (sha256(current) !== contentSha256) {
          throw new VaultWriteError("vault_content_conflict", "The Vault file changed during the DocWen operation.");
        }
      }
      throwIfAborted(signal);
    };
    const publish = async <U>(commit: (assertIdentity: () => void) => Promise<U>): Promise<U> => {
      await assertCurrent();
      const committed = await commit(assertPublicationIdentity);
      published = true;
      return committed;
    };
    const ownedWorkspace = await mkdtemp(path.join(tmpdir(), "docwen-assistant-snapshot-"));
    const extension = file.extension.replace(/[^a-z0-9]/giu, "") || "bin";
    let result: T;
    try {
      throwIfAborted(signal);
      // Core inspections return canonical paths, including for aliased TEMP parents.
      // Bind both snapshot copies to that spelling without relaxing inspection checks.
      const workspace = await realpath(ownedWorkspace);
      const inputPath = path.join(workspace, `source.${extension}`);
      await writeFile(inputPath, typeof original === "string" ? original : Buffer.from(original));
      const sourceInput: TaskInput = {
        path: inputPath,
        kind: sourceKindForPath(originalPath),
        role: "source",
        logicalPath: logicalPathFor(originalPath),
        mediaType: mediaTypeForPath(originalPath),
      };
      const getAcceptedDetectedSource: IsolatedSnapshot["getAcceptedDetectedSource"] = async (inspection, route, inspect) => {
        const bound = bindAcceptedDetectedSource(sourceInput, contentSha256, inspection, route);
        const format = inspection.detectedFormat;
        if (
          !/^[a-z0-9]{1,16}$/u.test(format)
          || inspection.mediaType === "application/octet-stream"
          || mediaTypeForPath(`source.${format}`) !== inspection.mediaType
          || sourceKindForPath(`source.${format}`) !== bound.kind
        ) {
          throw new VaultWriteError("vault_input_invalid", "The accepted format has no matching canonical snapshot extension.");
        }
        await assertCurrent();
        const acceptedPath = path.join(workspace, `accepted-source.${format}`);
        await writeFile(acceptedPath, typeof original === "string" ? original : Buffer.from(original), { flag: "wx" });
        if (sha256(await readFile(acceptedPath)) !== contentSha256) {
          throw new VaultWriteError("vault_input_invalid", "The accepted snapshot bytes changed.");
        }
        const accepted = { ...bound, path: acceptedPath };
        const verified = await inspect(accepted);
        if (
          verified.decision !== "allow"
          || verified.filePath !== accepted.path
          || verified.contentSha256 !== contentSha256
          || verified.sizeBytes !== inspection.sizeBytes
          || verified.detectedFormat !== format
          || verified.mediaType !== bound.mediaType
        ) {
          throw new VaultWriteError("vault_input_invalid", "The canonical snapshot does not match the accepted inspection.");
        }
        await assertCurrent();
        return accepted;
      };
      let declaredMarkdownInputs: Promise<DeclaredMarkdownSnapshot> | undefined;
      const getDeclaredMarkdownInputs = async (): Promise<DeclaredMarkdownSnapshot | undefined> => {
        if (authoredMarkdown === null) return undefined;
        await assertCurrent();
        declaredMarkdownInputs ??= buildDeclaredMarkdownInputs(this.app, file, authoredMarkdown, workspace, signal, sourceInput, contentSha256);
        const declared = await declaredMarkdownInputs;
        await assertCurrent();
        return declared;
      };
      result = await work({
        inputPath,
        contentSha256,
        publish,
        sourceInput,
        inputs: [sourceInput],
        getAcceptedDetectedSource,
        getDeclaredMarkdownInputs,
      });
      // After publication the source may legitimately change again. The
      // publication boundary above owns validation, so do not report a late
      // conflict after an output was already committed successfully.
      if (!published) await assertCurrent();
    } catch (primaryError) {
      await rm(ownedWorkspace, { recursive: true, force: true }).catch((cleanupError: unknown) => {
        recordFailureWarning(primaryError, operationWarning("input_cleanup_failed", cleanupError));
      });
      throw primaryError;
    }
    const warnings: OperationWarning[] = [];
    try {
      await rm(ownedWorkspace, { recursive: true, force: true });
    } catch (cleanupError) {
      warnings.push(operationWarning("input_cleanup_failed", cleanupError));
    }
    return { value: result, warnings };
  }

}

function assertNoOpenMarkdownTarget(app: App, path: string): void {
  if (locateOpenMarkdownTarget(app.workspace, path).kind !== "closed") {
    throw new VaultWriteError(
      "vault_target_changed",
      "The Markdown editor opened or became ambiguous during the DocWen operation.",
    );
  }
}

function decodeMarkdown(value: string | ArrayBuffer): string {
  if (typeof value === "string") return value;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(value);
  } catch (error) {
    throw new VaultWriteError(
      "vault_input_invalid",
      "The Markdown file is not valid UTF-8.",
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
}

function sha256(value: string | ArrayBuffer | Uint8Array): string {
  const bytes = typeof value === "string"
    ? Buffer.from(value, "utf8")
    : value instanceof ArrayBuffer
      ? Buffer.from(value)
      : Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  return createHash("sha256")
    .update(bytes)
    .digest("hex");
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new DOMException("Operation cancelled", "AbortError");
}

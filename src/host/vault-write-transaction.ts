import { readEditorInput, readVaultInput } from "./vault-input";
import { operationWarning, recordFailureWarning, type Completed, type OperationWarning } from "../docwen/operation-outcome";
import { createHash } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { createVaultWorkspace } from "./vault-workspace";
import * as path from "node:path";
import { TextDecoder } from "node:util";

import type { App, TFile } from "obsidian";

import {
  isSameOpenMarkdownTarget,
  locateOpenMarkdownTarget,
  type OpenMarkdownTarget,
} from "./open-markdown-target";

export type VaultWriteErrorCode =
  | "vault_target_changed"
  | "vault_content_conflict"
  | "vault_input_invalid"
  | "vault_reconciliation_failed";

export class VaultWriteError extends Error {
  constructor(
    readonly code: VaultWriteErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "VaultWriteError";
  }
}

export interface IsolatedMarkdownTransform {
  (
    inputPath: string,
    outputPath: string,
    originalSha256: string,
    signal: AbortSignal,
  ): Promise<void | readonly OperationWarning[]>;
}

/**
 * Transforms Vault Markdown through isolated files and commits only after a
 * fresh identity/content check. DocWenCLI never writes the Vault file itself.
 */
export class VaultWriteTransaction {
  constructor(private readonly app: App) {}

  async run(
    file: TFile,
    transform: IsolatedMarkdownTransform,
    signal: AbortSignal,
  ): Promise<OperationWarning[]> {
    const targetLookup = locateOpenMarkdownTarget(this.app.workspace, file.path);
    if (targetLookup.kind === "ambiguous") {
      throw new VaultWriteError(
        "vault_target_changed",
        "The source is open in multiple Markdown editors.",
      );
    }
    if (targetLookup.kind === "open") {
      return this.runEditor(file, targetLookup.target, transform, signal);
    }
    return this.runVault(file, transform, signal);
  }

  private async runEditor(
    file: TFile,
    target: OpenMarkdownTarget,
    transform: IsolatedMarkdownTransform,
    signal: AbortSignal,
  ): Promise<OperationWarning[]> {
    const originalFile = file;
    const originalPath = file.path;
    this.assertEditorTarget(originalFile, originalPath, target);
    const editor = target.editor;
    const original = readEditorInput(editor);
    const originalSha256 = sha256(original);
    const prepared = await withIsolatedMarkdown(original, originalPath, originalSha256, transform, signal);
    const output = prepared.value;
    try {
      throwIfAborted(signal);
      this.assertEditorTarget(originalFile, originalPath, target);
      if (editor.getValue() !== original) {
        throw new VaultWriteError("vault_content_conflict", "The Markdown editor changed during numbering.");
      }
    } catch (error) {
      for (const warning of prepared.warnings) recordFailureWarning(error, warning);
      throw error;
    }

    let transactionFailure: { error: unknown } | null = null;
    try {
      editor.transaction({
        changes: [{
          from: { line: 0, ch: 0 },
          to: editor.offsetToPos(original.length),
          text: output,
        }],
      }, "docwen-assistant-numbering");
    } catch (error) {
      transactionFailure = { error };
    }
    try {
      const current = editor.getValue();
      if (current !== output) {
        throw new VaultWriteError("vault_reconciliation_failed", "The editor write could not be confirmed.", {
          outputState: current === original ? "not_published" : "unconfirmed",
        });
      }
    } catch (error) {
      const failure = error instanceof VaultWriteError ? error : new VaultWriteError(
        "vault_reconciliation_failed", "The editor write could not be confirmed.", { outputState: "unconfirmed" },
      );
      for (const warning of prepared.warnings) recordFailureWarning(failure, warning);
      throw failure;
    }
    if (transactionFailure) prepared.warnings.push(operationWarning("post_publish_failed", transactionFailure.error));
    try {
      this.assertEditorTarget(originalFile, originalPath, target);
      target.view.requestSave();
    } catch (error) {
      prepared.warnings.push(operationWarning("post_publish_failed", error));
    }
    return prepared.warnings;
  }

  private async runVault(
    file: TFile,
    transform: IsolatedMarkdownTransform,
    signal: AbortSignal,
  ): Promise<OperationWarning[]> {
    const originalFile = file;
    const originalPath = file.path;
    this.assertVaultFileIdentity(originalFile, originalPath);
    const initialStat = file.stat ? { ...file.stat } : undefined;
    const sourceBytes = await readVaultInput(this.app.vault, file, signal);
    const original = decodeNumberingMarkdown(sourceBytes, "input");
    this.assertVaultFileIdentity(originalFile, originalPath);
    this.assertNoOpenMarkdownTarget(originalPath);
    const originalSha256 = sha256(original);
    const prepared = await withIsolatedMarkdown(original, originalPath, originalSha256, transform, signal);
    const output = prepared.value;
    try {
      throwIfAborted(signal);
      this.assertVaultFileIdentity(originalFile, originalPath);
      this.assertNoOpenMarkdownTarget(originalPath);
    } catch (error) {
      for (const warning of prepared.warnings) recordFailureWarning(error, warning);
      throw error;
    }

    let accepted = false;
    let published: string;
    try {
      // Vault.process decodes malformed bytes to the same character as a literal U+FFFD.
      if (original.includes("\uFFFD")) {
        const currentBytes = await readVaultInput(this.app.vault, originalFile, signal);
        if (!Buffer.from(currentBytes).equals(Buffer.from(sourceBytes))) {
          throw new VaultWriteError("vault_content_conflict", "The Vault file changed during numbering.");
        }
      }
      published = await this.app.vault.process(originalFile, (current) => {
        throwIfAborted(signal);
        this.assertVaultFileIdentity(originalFile, originalPath);
        this.assertNoOpenMarkdownTarget(originalPath);
        if ((initialStat && (file.stat.size !== initialStat.size || file.stat.mtime !== initialStat.mtime
          || file.stat.ctime !== initialStat.ctime)) || current !== original) {
          throw new VaultWriteError("vault_content_conflict", "The Vault file changed during numbering.");
        }
        accepted = true;
        return output;
      });
    } catch (error) {
      const failure = accepted ? new VaultWriteError(
        "vault_reconciliation_failed", "The Vault write could not be confirmed.", { outputState: "unconfirmed" },
      ) : error;
      for (const warning of prepared.warnings) recordFailureWarning(failure, warning);
      throw failure;
    }
    if (published !== output) {
      const failure = new VaultWriteError("vault_reconciliation_failed", "The Vault write could not be confirmed.", {
        outputState: "unconfirmed",
      });
      for (const warning of prepared.warnings) recordFailureWarning(failure, warning);
      throw failure;
    }
    try {
      this.assertVaultFileIdentity(originalFile, originalPath);
      this.assertNoOpenMarkdownTarget(originalPath);
    } catch (error) {
      prepared.warnings.push(operationWarning("post_publish_failed", error));
    }
    return prepared.warnings;
  }

  private assertEditorTarget(file: TFile, originalPath: string, target: OpenMarkdownTarget): void {
    this.assertVaultFileIdentity(file, originalPath);
    if (
      target.view.file !== file
      || !isSameOpenMarkdownTarget(this.app.workspace, originalPath, target)
    ) {
      throw new VaultWriteError("vault_target_changed", "The Markdown editor changed during numbering.");
    }
  }

  private assertVaultFileIdentity(originalFile: TFile, originalPath: string): void {
    if (
      originalFile.path !== originalPath
      || this.app.vault.getFileByPath(originalPath) !== originalFile
    ) {
      throw new VaultWriteError(
        "vault_target_changed",
        "The Vault file identity or path changed during numbering.",
      );
    }
  }

  private assertNoOpenMarkdownTarget(path: string): void {
    if (locateOpenMarkdownTarget(this.app.workspace, path).kind !== "closed") {
      throw new VaultWriteError(
        "vault_target_changed",
        "The Markdown editor opened or became ambiguous during numbering.",
      );
    }
  }
}

async function withIsolatedMarkdown(
  original: string,
  originalPath: string,
  originalSha256: string,
  transform: IsolatedMarkdownTransform,
  signal: AbortSignal,
): Promise<Completed<string>> {
  const workspace = await createVaultWorkspace("numbering");
  const extension = path.extname(originalPath) || ".bin";
  const inputPath = path.join(workspace, `input${extension}`);
  const outputPath = path.join(workspace, "output.md");
  let output: string;
  const warnings: OperationWarning[] = [];
  try {
    throwIfAborted(signal);
    await writeFile(inputPath, original, "utf8");
    warnings.push(...(await transform(inputPath, outputPath, originalSha256, signal) ?? []));
    throwIfAborted(signal);
    const bytes = await readFile(outputPath);
    output = decodeNumberingMarkdown(bytes, "output");
  } catch (primaryError) {
    for (const warning of warnings) recordFailureWarning(primaryError, warning);
    try {
      await rm(workspace, { recursive: true, force: true });
    } catch (cleanupError) {
      recordFailureWarning(primaryError, operationWarning("input_cleanup_failed", cleanupError));
    }
    throw primaryError;
  }
  try {
    await rm(workspace, { recursive: true, force: true });
  } catch (cleanupError) {
    warnings.push(operationWarning("input_cleanup_failed", cleanupError));
  }
  return { value: output, warnings };
}

function decodeNumberingMarkdown(bytes: ArrayBuffer | Uint8Array, role: "input" | "output"): string {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new VaultWriteError("vault_input_invalid", `Numbering ${role} is not valid UTF-8 Markdown.`);
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new DOMException("Operation cancelled", "AbortError");
}

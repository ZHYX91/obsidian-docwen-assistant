import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

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
  | "vault_reconciliation_failed"
  | "vault_temp_cleanup_failed";

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
  ): Promise<void>;
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
  ): Promise<void> {
    const targetLookup = locateOpenMarkdownTarget(this.app.workspace, file.path);
    if (targetLookup.kind === "ambiguous") {
      throw new VaultWriteError(
        "vault_target_changed",
        "The source is open in multiple Markdown editors.",
      );
    }
    if (targetLookup.kind === "open") {
      await this.runEditor(file, targetLookup.target, transform, signal);
      return;
    }
    await this.runVault(file, transform, signal);
  }

  private async runEditor(
    file: TFile,
    target: OpenMarkdownTarget,
    transform: IsolatedMarkdownTransform,
    signal: AbortSignal,
  ): Promise<void> {
    const editor = target.editor;
    const original = editor.getValue();
    const originalSha256 = sha256(original);
    const output = await withIsolatedMarkdown(original, originalSha256, transform, signal);
    throwIfAborted(signal);

    if (!isSameOpenMarkdownTarget(this.app.workspace, file.path, target)) {
      throw new VaultWriteError("vault_target_changed", "The Markdown editor changed during numbering.");
    }
    if (sha256(editor.getValue()) !== originalSha256) {
      throw new VaultWriteError("vault_content_conflict", "The Markdown editor changed during numbering.");
    }

    editor.transaction({
      changes: [{
        from: { line: 0, ch: 0 },
        to: editor.offsetToPos(original.length),
        text: output,
      }],
    }, "docwen-assistant-numbering");
    target.view.requestSave();
    if (sha256(editor.getValue()) !== sha256(output)) {
      throw new VaultWriteError("vault_reconciliation_failed", "The editor did not accept the numbered content.");
    }
  }

  private async runVault(
    file: TFile,
    transform: IsolatedMarkdownTransform,
    signal: AbortSignal,
  ): Promise<void> {
    const originalFile = file;
    const originalPath = file.path;
    this.assertVaultFileIdentity(originalFile, originalPath);
    const original = await this.app.vault.read(file);
    this.assertVaultFileIdentity(originalFile, originalPath);
    this.assertNoOpenMarkdownTarget(originalPath);
    const originalSha256 = sha256(original);
    const output = await withIsolatedMarkdown(original, originalSha256, transform, signal);
    throwIfAborted(signal);
    this.assertVaultFileIdentity(originalFile, originalPath);
    this.assertNoOpenMarkdownTarget(originalPath);

    const published = await this.app.vault.process(originalFile, (current) => {
      this.assertVaultFileIdentity(originalFile, originalPath);
      this.assertNoOpenMarkdownTarget(originalPath);
      if (sha256(current) !== originalSha256) {
        throw new VaultWriteError("vault_content_conflict", "The Vault file changed during numbering.");
      }
      return output;
    });
    this.assertVaultFileIdentity(originalFile, originalPath);
    this.assertNoOpenMarkdownTarget(originalPath);
    if (sha256(published) !== sha256(output)) {
      throw new VaultWriteError("vault_reconciliation_failed", "The Vault write did not publish the numbered content.");
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
  originalSha256: string,
  transform: IsolatedMarkdownTransform,
  signal: AbortSignal,
): Promise<string> {
  const workspace = await mkdtemp(path.join(tmpdir(), "docwen-assistant-numbering-"));
  const inputPath = path.join(workspace, "input.md");
  const outputPath = path.join(workspace, "output.md");
  let output: string;
  try {
    throwIfAborted(signal);
    await writeFile(inputPath, original, "utf8");
    await transform(inputPath, outputPath, originalSha256, signal);
    throwIfAborted(signal);
    output = await readFile(outputPath, "utf8");
  } catch (primaryError) {
    try {
      await rm(workspace, { recursive: true, force: true });
    } catch {
      // Preserve the primary operation failure; the workspace path is random
      // and outside the Vault, so cleanup failure cannot justify masking it.
    }
    throw primaryError;
  }
  try {
    await rm(workspace, { recursive: true, force: true });
  } catch (cleanupError) {
    throw new VaultWriteError(
      "vault_temp_cleanup_failed",
      "The isolated numbering workspace could not be removed.",
      { cause: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) },
    );
  }
  return output;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new DOMException("Operation cancelled", "AbortError");
}

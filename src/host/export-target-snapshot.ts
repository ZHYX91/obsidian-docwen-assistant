import { createHash } from "node:crypto";
import * as path from "node:path";
import type { App, MarkdownView } from "obsidian";
import { captureOutputTarget } from "../docwen";
import { resolveAbsoluteFilePath } from "./vault-files";
import { VaultWriteError } from "./vault-write-transaction";

/** Covers the destination's disk content and any open Markdown editor. */
export async function captureExportTarget(app: App, outputPath: string, signal: AbortSignal) {
  const matchingEditors = () => app.workspace.getLeavesOfType("markdown").flatMap((leaf) => {
    const view = leaf.view as MarkdownView;
    const absolutePath = view.file && resolveAbsoluteFilePath(app.vault, view.file);
    return absolutePath && samePath(absolutePath, outputPath) ? [{ leaf, view, editor: view.editor }] : [];
  });
  const editors = matchingEditors();
  if (editors.length > 1) throw conflict("The output is open in multiple Markdown editors.");
  const editorHash = editors[0] ? hash(editors[0].editor.getValue()) : null;
  const disk = await captureOutputTarget(outputPath, signal);
  if (editorHash !== null && editorHash !== disk.contentSha256) {
    throw conflict("The output has unsaved editor content. Save or choose another output first.");
  }
  const assertEditors = () => {
    const current = matchingEditors();
    if (current.length !== editors.length || current.some((item, index) =>
      item.leaf !== editors[index].leaf || item.view !== editors[index].view ||
      item.editor !== editors[index].editor || hash(item.editor.getValue()) !== editorHash)) {
      throw conflict("The output editor changed during conversion.");
    }
  };
  assertEditors();
  return {
    overwrite: disk.existed,
    async publish<T>(commit: () => Promise<T>): Promise<T> {
      if (signal.aborted) throw signal.reason ?? new DOMException("Operation cancelled", "AbortError");
      try {
        await disk.assertCurrent();
      } catch (error) {
        if (signal.aborted) throw signal.reason ?? new DOMException("Operation cancelled", "AbortError");
        throw conflict(error instanceof Error ? error.message : String(error));
      }
      assertEditors();
      return commit();
    },
  };
}

function conflict(message: string): VaultWriteError {
  return new VaultWriteError("vault_content_conflict", message);
}

function hash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function samePath(left: string, right: string): boolean {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

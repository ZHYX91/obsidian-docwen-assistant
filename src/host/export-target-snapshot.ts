import { lstat } from "node:fs/promises";
import * as path from "node:path";
import type { App, MarkdownView } from "obsidian";
import { captureOutputDirectory } from "../docwen";
import { isErrno, samePath } from "../docwen/output-integrity";
import { resolveAbsoluteFilePath } from "./vault-files";
import { VaultWriteError } from "./vault-write-transaction";

/** Preserve the selected parent and reject any editor inside the new result root. */
export async function captureExportTarget(app: App, directory: string, signal: AbortSignal) {
  const parent = await captureOutputDirectory(directory, signal);
  return {
    async publish<T>(outputRoot: string, commit: () => Promise<T>): Promise<T> {
      if (signal.aborted) throw signal.reason ?? new DOMException("Operation cancelled", "AbortError");
      try {
        await parent.assertCurrent();
      } catch (error) {
        if (signal.aborted) throw signal.reason ?? new DOMException("Operation cancelled", "AbortError");
        throw conflict(error instanceof Error ? error.message : String(error));
      }
      if (!samePath(path.dirname(outputRoot), parent.path)) throw conflict("The output root escapes the selected directory.");
      try {
        await lstat(outputRoot);
        throw conflict("The output root was created during conversion.");
      } catch (error) {
        if (!isErrno(error, "ENOENT")) throw error;
      }
      const openOutput = app.workspace.getLeavesOfType("markdown").some((leaf) => {
        const view = leaf.view as MarkdownView;
        const absolutePath = view.file && resolveAbsoluteFilePath(app.vault, view.file);
        if (!absolutePath) return false;
        const relative = path.relative(outputRoot, absolutePath);
        return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
      });
      if (openOutput) throw conflict("A file in the output root is open in an editor. Close it or choose another directory.");
      if (signal.aborted) throw signal.reason ?? new DOMException("Operation cancelled", "AbortError");
      return commit();
    },
  };
}

function conflict(message: string): VaultWriteError {
  return new VaultWriteError("vault_content_conflict", message);
}

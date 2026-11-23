import type { Editor, TFile, Vault } from "obsidian";
import { assertInputFileSize } from "../docwen/client";

export async function readVaultInput(vault: Vault, file: TFile, signal: AbortSignal): Promise<ArrayBuffer> {
  signal.throwIfAborted();
  if (file.stat) assertInputFileSize(file.stat.size);
  const bytes = await vault.readBinary(file);
  signal.throwIfAborted();
  assertInputFileSize(bytes.byteLength);
  return bytes;
}

export function readEditorInput(editor: Editor): string {
  const text = editor.getValue();
  assertInputFileSize(Buffer.byteLength(text, "utf8"));
  return text;
}

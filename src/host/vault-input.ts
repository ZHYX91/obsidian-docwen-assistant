import type { Editor, TFile, Vault } from "obsidian";
import { LocalCliError } from "../docwen/errors";
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
  // UTF-8 encoding would silently replace an unpaired UTF-16 code unit with U+FFFD.
  if (/[\uD800-\uDFFF]/u.test(text)) {
    throw new LocalCliError("cli_input_invalid", "The editor contains text that cannot be represented in UTF-8.");
  }
  return text;
}

import * as path from "path";

import { FileSystemAdapter, TAbstractFile, TFile, TFolder, type Vault } from "obsidian";

export function resolveAbsoluteVaultPath(vault: Vault, vaultPath: string): string | null {
  const adapter = vault.adapter;
  if (!(adapter instanceof FileSystemAdapter)) return null;
  return path.join(adapter.getBasePath(), vaultPath);
}

export function resolveAbsoluteFilePath(vault: Vault, file: TFile): string | null {
  return resolveAbsoluteVaultPath(vault, file.path);
}

export function resolveTargetFile(abstractFile: TAbstractFile): TFile | null {
  if (abstractFile instanceof TFile) return abstractFile;
  if (!(abstractFile instanceof TFolder)) return null;
  // Folder Nodes uses NFC and Unicode simple case folding for same-name notes.
  const name = abstractFile.name.normalize("NFC").replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const folderName = new RegExp(`^${name}$`, "iu");
  let candidate: TFile | null = null;
  for (const child of abstractFile.children) {
    if (!(child instanceof TFile) || child.extension.toLowerCase() !== "md"
      || !folderName.test(child.basename.normalize("NFC"))) continue;
    if (candidate !== null) return null;
    candidate = child;
  }
  return candidate;
}

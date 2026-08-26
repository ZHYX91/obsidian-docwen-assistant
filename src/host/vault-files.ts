import * as path from "path";

import { FileSystemAdapter, TAbstractFile, TFile, TFolder, type Vault } from "obsidian";

export function resolveAbsoluteFilePath(vault: Vault, file: TFile): string | null {
  const adapter = vault.adapter;
  if (!(adapter instanceof FileSystemAdapter)) return null;
  return path.join(adapter.getBasePath(), file.path);
}

export function resolveTargetFile(abstractFile: TAbstractFile): TFile | null {
  if (abstractFile instanceof TFile) return abstractFile;
  if (!(abstractFile instanceof TFolder)) return null;
  const candidate = abstractFile.children?.find(
    (child) =>
      child instanceof TFile &&
      child.basename === abstractFile.name &&
      child.extension === "md",
  );
  return candidate instanceof TFile ? candidate : null;
}

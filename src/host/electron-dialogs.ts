import { requireDesktopModule } from "./desktop-modules";

export interface ElectronSaveDialog {
  showSaveDialog(options: {
    title: string;
    defaultPath: string;
    filters: Array<{ name: string; extensions: string[] }>;
  }): Promise<{ canceled: boolean; filePath?: string }>;
}

export interface ElectronOpenDialog {
  showOpenDialog(options: {
    title: string;
    filters?: Array<{ name: string; extensions: string[] }>;
    properties: string[];
  }): Promise<{ canceled: boolean; filePaths: string[] }>;
}

export function getElectronSaveDialog(): ElectronSaveDialog | null {
  return getElectronDialogs().find(isElectronSaveDialog) ?? null;
}

export function getElectronOpenDialog(): ElectronOpenDialog | null {
  return getElectronDialogs().find(isElectronOpenDialog) ?? null;
}

function getElectronDialogs(): unknown[] {
  const dialogs: unknown[] = [];
  const electron = requireDesktopModule("electron");
  if (isRecord(electron)) {
    const remoteDialog = isRecord(electron.remote) ? electron.remote.dialog : null;
    if (isRecord(remoteDialog)) dialogs.push(remoteDialog);
    if (isRecord(electron.dialog)) dialogs.push(electron.dialog);
  }

  const remote = requireDesktopModule("@electron/remote");
  if (isRecord(remote) && isRecord(remote.dialog)) dialogs.push(remote.dialog);
  return dialogs;
}

function isElectronSaveDialog(value: unknown): value is ElectronSaveDialog {
  return isRecord(value) && typeof value.showSaveDialog === "function";
}

function isElectronOpenDialog(value: unknown): value is ElectronOpenDialog {
  return isRecord(value) && typeof value.showOpenDialog === "function";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

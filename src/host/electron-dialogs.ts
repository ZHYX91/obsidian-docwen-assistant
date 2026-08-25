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
  return getElectronDialog("showSaveDialog") as ElectronSaveDialog | null;
}

export function getElectronOpenDialog(): ElectronOpenDialog | null {
  return getElectronDialog("showOpenDialog") as ElectronOpenDialog | null;
}

function getElectronDialog(method: "showSaveDialog" | "showOpenDialog"): unknown {
  try {
    const electron = require("electron");
    const dialog = electron?.remote?.dialog ?? electron?.dialog ?? null;
    if (typeof dialog?.[method] === "function") return dialog;
  } catch {}
  try {
    const remote = require("@electron/remote");
    if (typeof remote?.dialog?.[method] === "function") return remote.dialog;
  } catch {}
  return null;
}

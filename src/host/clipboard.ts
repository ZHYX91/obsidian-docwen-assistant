import { requireDesktopModule } from "./desktop-modules";

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyTextWithElectron(text);
  }
}

function copyTextWithElectron(text: string): boolean {
  const electron = requireDesktopModule("electron");
  if (!hasClipboard(electron)) return false;
  try {
    electron.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function hasClipboard(value: unknown): value is {
  clipboard: { writeText: (text: string) => void };
} {
  if (!isRecord(value) || !isRecord(value.clipboard)) return false;
  return typeof value.clipboard.writeText === "function";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

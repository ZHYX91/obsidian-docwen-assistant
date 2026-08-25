export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {}
  try {
    const { clipboard } = require("electron");
    clipboard.writeText(text);
    return true;
  } catch {}
  return false;
}

import { Notice } from "obsidian";

export function showNotice(message: string, duration?: number): void {
  new Notice(message, duration);
}

import { Notice } from "obsidian";

export function showNotice(message: string, duration?: number): void {
  new Notice(message, duration);
}

export function showNoticeWithAction(message: string, action: string, selected: () => void): void {
  const content = createFragment();
  content.appendText(message);
  content.createEl("br");
  const button = content.createEl("button", { text: action, attr: { type: "button" } });
  const notice = new Notice(content, 0);
  button.addEventListener("click", () => {
    notice.hide();
    selected();
  });
}

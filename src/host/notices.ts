import { Notice } from "obsidian";

export function showNotice(message: string, duration?: number): void {
  new Notice(message, duration);
}

export interface NoticeAction {
  readonly label: string;
  readonly run: () => void;
}

export function showNoticeWithAction(message: string, action: string, selected: () => void, additional: readonly NoticeAction[] = []): void {
  const content = createFragment();
  content.appendText(message);
  content.createEl("br");
  const buttons = [{ label: action, run: selected }, ...additional].map((item) => ({
    item,
    button: content.createEl("button", { text: item.label, attr: { type: "button" } }),
  }));
  const notice = new Notice(content, 0);
  for (const { item, button } of buttons) {
    button.addEventListener("click", () => {
      notice.hide();
      item.run();
    });
  }
}

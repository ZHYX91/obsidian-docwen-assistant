import { Notice } from "obsidian";
import { t } from "../i18n";

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
  const group = content.createDiv({ cls: "docwen-notice-actions" });
  // Keep the controls themselves: Obsidian consumes the fragment on construction.
  const buttons = [{ label: action, run: selected }, ...additional].map(({ label, run }) => ({
    button: group.createEl("button", { text: label, attr: { type: "button" } }),
    run,
  }));
  const dismiss = additional.length ? group.createEl("button", { text: t("dialogDismissNotice"), attr: { type: "button" } }) : null;
  const notice = new Notice(content, 0);
  for (const { button, run } of buttons) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!dismiss) notice.hide();
      run();
    });
  }
  dismiss?.addEventListener("click", (event) => {
    event.stopPropagation();
    notice.hide();
  });
}

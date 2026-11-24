import { Notice } from "obsidian";
import { applyInterfaceLocale } from "./interface-locale";
import { t } from "../i18n";

export function showNotice(message: string, duration?: number): void {
  applyInterfaceLocale(new Notice(message, duration).messageEl);
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
  const dismiss = group.createEl("button", { text: t("dialogDismissNotice"), attr: { type: "button" } });
  const notice = new Notice(content, 0);
  applyInterfaceLocale(notice.messageEl);
  for (const { button, run } of buttons) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (buttons.length === 1) notice.hide();
      run();
    });
  }
  dismiss.addEventListener("click", (event) => {
    event.stopPropagation();
    notice.hide();
  });
}

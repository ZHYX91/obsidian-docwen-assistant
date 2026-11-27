import { getCurrentLocale } from "../i18n";

/** Mark plugin-owned text even when Obsidian uses a different interface language. */
export function applyInterfaceLocale(...elements: HTMLElement[]): void {
  const locale = getCurrentLocale();
  for (const element of elements) {
    element.setAttribute("lang", locale);
    element.setAttribute("dir", locale === "ar" ? "rtl" : "ltr");
  }
}

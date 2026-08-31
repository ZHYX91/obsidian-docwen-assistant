export function renderUsageList(containerEl: HTMLElement, markup: string): void {
  const list = containerEl.createEl("ul");
  for (const match of markup.matchAll(/<li>([\s\S]*?)<\/li>/gu)) {
    const itemMarkup = match[1]?.trim();
    if (!itemMarkup) continue;
    const item = list.createEl("li");
    for (const fragment of itemMarkup.split(/(<b>[\s\S]*?<\/b>)/gu)) {
      if (!fragment) continue;
      const strong = /^<b>([\s\S]*?)<\/b>$/u.exec(fragment);
      if (strong?.[1]) {
        item.createEl("strong", { text: strong[1] });
        continue;
      }
      const text = fragment.replace(/<[^>]*>/gu, "");
      if (text) item.createSpan({ text });
    }
  }
}

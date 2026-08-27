/**
 * DocWen Obsidian Plugin - Generic Picker Modal
 *
 * Provides a SuggestModal-based picker for selecting templates,
 * optimization types, and other list-based choices from the CLI.
 */

import { App, SuggestModal } from "obsidian";

export interface PickerItem {
  id: string;
  label: string;
  description?: string;
}

export class ItemPickerModal extends SuggestModal<PickerItem> {
  private items: PickerItem[];
  private onChoose: (item: PickerItem) => void;

  constructor(
    app: App,
    items: PickerItem[],
    placeholder: string,
    onChoose: (item: PickerItem) => void
  ) {
    super(app);
    this.items = items;
    this.onChoose = onChoose;
    this.setPlaceholder(placeholder);
  }

  getSuggestions(query: string): PickerItem[] {
    const lower = query.toLowerCase();
    return this.items.filter(
      (item) =>
        item.label.toLowerCase().includes(lower) ||
        (item.description || "").toLowerCase().includes(lower) ||
        item.id.toLowerCase().includes(lower)
    );
  }

  renderSuggestion(item: PickerItem, el: HTMLElement): void {
    el.createDiv({ text: item.label });
    if (item.description) {
      el.createEl("small", { text: item.description, cls: "suggestion-note" });
    }
  }

  onChooseSuggestion(item: PickerItem): void {
    this.onChoose(item);
  }
}

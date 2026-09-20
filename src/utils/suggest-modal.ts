/** A picker stays owned by its operation until selection, dismissal or cancellation. */
import { App, SuggestModal } from "obsidian";

export interface PickerItem {
  id: string;
  label: string;
  description?: string;
}

export function pickItem(
  app: App,
  items: PickerItem[],
  placeholder: string,
  signal: AbortSignal,
): Promise<PickerItem | null> {
  if (signal.aborted) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const picker = new ItemPickerModal(app, items, placeholder, signal, resolve);
    try {
      picker.start();
    } catch (error) {
      picker.dispose();
      reject(error instanceof Error ? error : new Error("Unable to open the item picker."));
    }
  });
}

class ItemPickerModal extends SuggestModal<PickerItem> {
  private settled = false;
  private readonly onAbort = () => this.cancel();

  constructor(
    app: App,
    private readonly items: PickerItem[],
    placeholder: string,
    private readonly signal: AbortSignal,
    private readonly resolve: (item: PickerItem | null) => void,
  ) {
    super(app);
    this.setPlaceholder(placeholder);
  }

  start(): void {
    this.signal.addEventListener("abort", this.onAbort, { once: true });
    if (this.signal.aborted) this.cancel();
    else this.open();
  }

  cancel(): void {
    this.finish(null);
    this.close();
  }

  dispose(): void {
    this.settled = true;
    this.signal.removeEventListener("abort", this.onAbort);
    this.close();
  }

  getSuggestions(query: string): PickerItem[] {
    const lower = query.toLowerCase();
    return this.items.filter((item) =>
      item.label.toLowerCase().includes(lower)
      || (item.description || "").toLowerCase().includes(lower)
      || item.id.toLowerCase().includes(lower));
  }

  renderSuggestion(item: PickerItem, el: HTMLElement): void {
    el.createDiv({ text: item.label });
    if (item.description) el.createEl("small", { text: item.description, cls: "suggestion-note" });
  }

  onChooseSuggestion(item: PickerItem): void {
    if (!this.signal.aborted && this.items.includes(item)) this.finish(item);
  }

  override onClose(): void {
    super.onClose();
    // SuggestModal may close before delivering the selection in the same event.
    queueMicrotask(() => this.finish(null));
  }

  private finish(item: PickerItem | null): void {
    if (this.settled) return;
    this.settled = true;
    this.signal.removeEventListener("abort", this.onAbort);
    this.resolve(item);
  }
}

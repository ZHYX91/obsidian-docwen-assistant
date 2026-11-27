class FakeItem {
  title = "";
  disabled = false;
  click: (() => void) | null = null;
  submenu: FakeMenu | null = null;

  setTitle(value: string): this {
    this.title = value;
    return this;
  }

  setIcon(): this {
    return this;
  }

  setDisabled(value: boolean): this {
    this.disabled = value;
    return this;
  }

  onClick(callback: () => void): this {
    this.click = callback;
    return this;
  }

  setSubmenu(): FakeMenu {
    this.submenu = new FakeMenu();
    return this.submenu;
  }
}

export class FakeMenu {
  readonly entries: Array<FakeItem | "separator"> = [];

  constructor(private readonly supportsSubmenu = true) {}

  get items(): FakeItem[] {
    return this.entries.filter((entry): entry is FakeItem => entry !== "separator");
  }

  addItem(builder: (item: FakeItem) => void): void {
    const item = new FakeItem();
    if (!this.supportsSubmenu) {
      Object.defineProperty(item, "setSubmenu", { value: undefined });
    }
    this.entries.push(item);
    builder(item);
  }

  addSeparator(): void {
    this.entries.push("separator");
  }
}

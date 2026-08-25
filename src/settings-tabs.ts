import type { SettingsPageDefinition, SettingsPageId } from "./settings-definitions";

let settingsTabsInstance = 0;

export interface SettingsTabsOptions {
  readonly ariaLabel: string;
  readonly containerEl: HTMLElement;
  readonly initialPageId: SettingsPageId;
  readonly pages: readonly SettingsPageDefinition[];
  readonly renderPage: (containerEl: HTMLElement, page: SettingsPageDefinition) => void;
}

/** Accessible top-tab navigation independent from the settings-row renderer. */
export class SettingsTabs {
  private activeIndex: number;
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly instanceId = ++settingsTabsInstance;
  private readonly panelEl: HTMLElement;
  private readonly tabListEl: HTMLElement;

  constructor(private readonly options: SettingsTabsOptions) {
    const initialIndex = options.pages.findIndex((page) => page.id === options.initialPageId);
    this.activeIndex = initialIndex < 0 ? 0 : initialIndex;

    const rootEl = options.containerEl.createDiv({ cls: "docwen-settings-root" });
    this.tabListEl = rootEl.createDiv({
      cls: "docwen-settings-tabs",
      attr: {
        "aria-label": options.ariaLabel,
        "aria-orientation": "horizontal",
        role: "tablist",
      },
    });
    this.panelEl = rootEl.createDiv({
      cls: "docwen-settings-panel",
      attr: { role: "tabpanel", tabindex: "0" },
    });

    options.pages.forEach((page, index) => this.createTab(page, index));
    this.activate(this.activeIndex, false);
  }

  get activePageId(): SettingsPageId {
    return this.options.pages[this.activeIndex]?.id ?? "general";
  }

  renderActivePage(): void {
    const page = this.options.pages[this.activeIndex];
    if (!page) return;
    this.panelEl.empty();
    this.panelEl.id = this.panelId(page.id);
    this.panelEl.setAttribute("aria-labelledby", this.buttons[this.activeIndex].id);
    this.options.renderPage(this.panelEl, page);
  }

  private createTab(page: SettingsPageDefinition, index: number): void {
    const tabId = `docwen-settings-tab-${this.instanceId}-${page.id}`;
    const button = this.tabListEl.createEl("button", {
      cls: "docwen-settings-tab",
      text: page.name,
      attr: {
        "aria-controls": this.panelId(page.id),
        "aria-selected": "false",
        id: tabId,
        role: "tab",
        tabindex: "-1",
        type: "button",
      },
    });
    button.addEventListener("click", () => this.activate(index, false));
    button.addEventListener("keydown", (event) => this.onKeyDown(event, index));
    this.buttons.push(button);
  }

  private activate(index: number, moveFocus: boolean): void {
    if (this.options.pages.length === 0) return;
    this.activeIndex = (index + this.options.pages.length) % this.options.pages.length;
    this.buttons.forEach((button, buttonIndex) => {
      const selected = buttonIndex === this.activeIndex;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    this.renderActivePage();

    const button = this.buttons[this.activeIndex];
    button.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (moveFocus) button.focus({ preventScroll: true });
  }

  private onKeyDown(event: KeyboardEvent, currentIndex: number): void {
    const isRtl = this.tabListEl.ownerDocument.defaultView
      ?.getComputedStyle(this.tabListEl).direction === "rtl";
    let targetIndex: number;
    switch (event.key) {
      case "ArrowLeft":
        targetIndex = currentIndex + (isRtl ? 1 : -1);
        break;
      case "ArrowRight":
        targetIndex = currentIndex + (isRtl ? -1 : 1);
        break;
      case "ArrowUp":
        targetIndex = currentIndex - 1;
        break;
      case "ArrowDown":
        targetIndex = currentIndex + 1;
        break;
      case "Home":
        targetIndex = 0;
        break;
      case "End":
        targetIndex = this.options.pages.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.activate(targetIndex, true);
  }

  private panelId(pageId: SettingsPageId): string {
    return `docwen-settings-panel-${this.instanceId}-${pageId}`;
  }
}

import { Window } from "happy-dom";
import { afterEach, beforeEach, vi } from "vitest";

/** Keep the normal Node test environment, with a fresh DOM for each UI test. */
export function useObsidianDom(): void {
  let dom: Window;
  beforeEach(() => {
    dom = new Window();
    vi.stubGlobal("window", dom);
    vi.stubGlobal("document", dom.document);
    vi.stubGlobal("HTMLElement", dom.HTMLElement);
    installObsidianDom();
  });
  afterEach(async () => {
    await dom.happyDOM.close();
    vi.unstubAllGlobals();
  });
}

/** Only Obsidian's DOM conveniences are mocked; focus, attributes and events use the DOM. */
export function installObsidianDom(): void {
  Object.assign(HTMLElement.prototype, {
    addClass(this: HTMLElement, ...names: string[]): void { this.classList.add(...names); },
    removeClass(this: HTMLElement, ...names: string[]): void { this.classList.remove(...names); },
    empty(this: HTMLElement): void { this.replaceChildren(); },
    setText(this: HTMLElement, text: string): void { this.textContent = text; },
    createEl<K extends keyof HTMLElementTagNameMap>(
      this: HTMLElement,
      tag: K,
      options: { cls?: string | string[]; text?: string; attr?: Record<string, string | number | boolean> } = {},
    ): HTMLElementTagNameMap[K] {
      const element = this.ownerDocument.createElement(tag);
      if (options.cls) element.className = Array.isArray(options.cls) ? options.cls.join(" ") : options.cls;
      if (options.text !== undefined) element.textContent = options.text;
      for (const [name, value] of Object.entries(options.attr ?? {})) {
        element.setAttribute(name, String(value));
      }
      this.append(element);
      return element;
    },
    createDiv(this: HTMLElement, options = {}): HTMLDivElement { return this.createEl("div", options); },
    createSpan(this: HTMLElement, options = {}): HTMLSpanElement { return this.createEl("span", options); },
  });
}

export class ItemView {
  readonly app: { vault: Record<string, unknown>; workspace: Record<string, unknown> };
  readonly containerEl: HTMLElement;
  constructor(public readonly leaf: { app?: ItemView["app"] }) {
    this.app = leaf.app ?? { vault: {}, workspace: {} };
    this.containerEl = document.createElement("div");
    this.containerEl.append(document.createElement("div"), document.createElement("div"));
    document.body.append(this.containerEl);
  }
  async open(): Promise<void> { await this.onOpen(); }
  async onOpen(): Promise<void> {}
}

export class Plugin {
  constructor(public app: unknown, public manifest: unknown) {}
}
export class App {}
export class PluginSettingTab {}
export class Setting {}
export class Modal {}
export class SuggestModal {}
export class MarkdownView {}
export class TAbstractFile {}
export class TFile extends TAbstractFile {}
export class TFolder extends TAbstractFile {}
export class WorkspaceLeaf {}
export class FileSystemAdapter {}
export class Notice {}
export function setIcon(element: HTMLElement, icon: string): void {
  element.setAttribute("data-icon", icon);
}
export function getLanguage(): string { return "en"; }
export function parseLinktext(text: string): { path: string; subpath: string } {
  const [path, ...rest] = text.split("#");
  return { path, subpath: rest.length ? `#${rest.join("#")}` : "" };
}

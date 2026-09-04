import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { SettingsPageDefinition } from "../src/settings-definitions";
import { SettingsTabs } from "../src/settings-tabs";

interface ElementOptions {
  attr?: Record<string, string>;
  cls?: string;
  text?: string;
}

class FakeElement {
  readonly attributes = new Map<string, string>();
  readonly children: FakeElement[] = [];
  readonly listeners = new Map<string, ((event: FakeEvent) => void)[]>();
  readonly ownerDocument: FakeDocument;
  focused = false;
  id = "";
  scrollCalls = 0;
  tabIndex = 0;
  textContent = "";

  constructor(ownerDocument: FakeDocument, readonly tagName = "div") {
    this.ownerDocument = ownerDocument;
  }

  addEventListener(type: string, listener: (event: FakeEvent) => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  createDiv(options?: ElementOptions): FakeElement {
    return this.append("div", options);
  }

  createEl(tagName: string, options?: ElementOptions): FakeElement {
    return this.append(tagName, options);
  }

  dispatch(type: string, key = ""): FakeEvent {
    const event = new FakeEvent(key);
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }

  empty(): void {
    this.children.length = 0;
  }

  focus(): void {
    this.focused = true;
  }

  scrollIntoView(): void {
    ++this.scrollCalls;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    if (name === "id") this.id = value;
    if (name === "tabindex") this.tabIndex = Number(value);
  }

  private append(tagName: string, options?: ElementOptions): FakeElement {
    const child = new FakeElement(this.ownerDocument, tagName);
    if (options?.text) child.textContent = options.text;
    if (options?.cls) child.setAttribute("class", options.cls);
    for (const [name, value] of Object.entries(options?.attr ?? {})) child.setAttribute(name, value);
    this.children.push(child);
    return child;
  }
}

class FakeDocument {
  direction: "ltr" | "rtl" = "ltr";
  readonly defaultView = {
    getComputedStyle: () => ({ direction: this.direction }),
  };
}

class FakeEvent {
  defaultPrevented = false;
  constructor(readonly key: string) {}
  preventDefault(): void { this.defaultPrevented = true; }
}

const pages: SettingsPageDefinition[] = [
  { id: "general", name: "General", items: [] },
  { id: "markdown", name: "To Markdown", items: [] },
  { id: "word", name: "To Word", items: [] },
  { id: "proofread", name: "Proofread", items: [] },
];

describe("settings top tabs", () => {
  it("renders complete tab semantics without a duplicate page heading", () => {
    const document = new FakeDocument();
    const container = new FakeElement(document);
    const renderPage = vi.fn();

    new SettingsTabs({
      ariaLabel: "DocWen Assistant settings",
      containerEl: container as unknown as HTMLElement,
      initialPageId: "general",
      pages,
      renderPage,
    });

    const root = container.children[0];
    const tabList = root.children[0];
    const panel = root.children[1];
    expect(tabList.attributes.get("role")).toBe("tablist");
    expect(tabList.attributes.get("aria-label")).toBe("DocWen Assistant settings");
    expect(tabList.attributes.get("aria-orientation")).toBe("horizontal");
    expect(tabList.children).toHaveLength(4);
    expect(tabList.children.map((tab) => tab.attributes.get("role"))).toEqual(Array(4).fill("tab"));
    expect(tabList.children.map((tab) => tab.tabIndex)).toEqual([0, -1, -1, -1]);
    expect(panel.attributes.get("role")).toBe("tabpanel");
    expect(panel.attributes.get("aria-labelledby")).toBe(tabList.children[0].id);
    expect(tabList.children[0].attributes.get("aria-controls")).toBe(panel.id);
    expect(root.children.some((child) => /^h[1-6]$/iu.test(child.tagName))).toBe(false);
    expect(renderPage).toHaveBeenCalledOnce();
    expect(renderPage.mock.calls[0][1].id).toBe("general");
  });

  it("supports roving focus, Home/End, wrapping arrows, and RTL direction", () => {
    const document = new FakeDocument();
    const container = new FakeElement(document);
    const tabs = new SettingsTabs({
      ariaLabel: "Settings",
      containerEl: container as unknown as HTMLElement,
      initialPageId: "general",
      pages,
      renderPage: vi.fn(),
    });
    const tabButtons = container.children[0].children[0].children;

    expect(tabButtons[0].dispatch("keydown", "ArrowLeft").defaultPrevented).toBe(true);
    expect(tabs.activePageId).toBe("proofread");
    expect(tabButtons[3].focused).toBe(true);

    tabButtons[3].dispatch("keydown", "Home");
    expect(tabs.activePageId).toBe("general");
    tabButtons[0].dispatch("keydown", "End");
    expect(tabs.activePageId).toBe("proofread");

    document.direction = "rtl";
    tabButtons[3].dispatch("keydown", "ArrowLeft");
    expect(tabs.activePageId).toBe("general");

    document.direction = "ltr";
    tabButtons[0].dispatch("keydown", "ArrowDown");
    expect(tabs.activePageId).toBe("markdown");
    tabButtons[1].dispatch("keydown", "ArrowUp");
    expect(tabs.activePageId).toBe("general");
    tabButtons[0].dispatch("keydown", "ArrowRight");
    expect(tabs.activePageId).toBe("markdown");
    expect(tabButtons[1].dispatch("keydown", "Escape").defaultPrevented).toBe(false);
    expect(tabButtons.map((tab) => tab.tabIndex)).toEqual([-1, 0, -1, -1]);
  });

  it("keeps the family tab styling resilient and responsive", () => {
    const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

    expect(css).toMatch(/\.docwen-settings-tabs\s*\{[^}]*overflow-x:\s*auto;/su);
    expect(css).toMatch(/button\.docwen-settings-tab\s*\{[^}]*font-size:\s*var\(--font-ui-small\)\s*!important;/su);
    expect(css).toMatch(/button\.docwen-settings-tab\[aria-selected="true"\]/u);
    expect(css).toMatch(/button\.docwen-settings-tab\[aria-selected="true"\]\s*\{[^}]*font-weight:\s*var\(--font-semibold\)\s*!important;/su);
    expect(css).toMatch(/\.docwen-settings-panel\s*\{[^}]*margin-block-start:\s*var\(--size-4-5\);/su);
    expect(css).toMatch(/@media \(pointer:\s*coarse\)[\s\S]*?min-block-size:\s*44px;/u);
    expect(css).toMatch(/\.docwen-settings-help\.setting-item\s*\{[^}]*border-inline-start:\s*3px solid var\(--interactive-accent\);/su);
    expect(css).toMatch(/\.docwen-settings-help-icon\s*\{[^}]*color:\s*var\(--interactive-accent\);/su);
    expect(css).not.toMatch(/\.docwen-settings-tab\s*\{[^}]*\n\s*height:/su);
  });
});

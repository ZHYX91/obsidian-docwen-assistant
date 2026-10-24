import { beforeEach, describe, expect, it, vi } from "vitest";
import { useObsidianDom } from "./helpers/obsidian-dom";

const state = vi.hoisted(() => ({ hidden: vi.fn() }));
vi.mock("obsidian", () => ({
  Notice: class Notice {
    readonly element = document.createElement("div");
    constructor(content: DocumentFragment) {
      // The real host consumes the fragment into its notice container.
      this.element.append(content);
      document.body.append(this.element);
    }
    hide(): void { state.hidden(); this.element.remove(); }
  },
}));
useObsidianDom();
beforeEach(() => {
  state.hidden.mockClear();
  vi.stubGlobal("createFragment", () => {
    const fragment = document.createDocumentFragment();
    Object.assign(fragment, {
      appendText: (value: string) => fragment.append(document.createTextNode(value)),
      createEl: (tag: string, options: { text?: string; attr?: Record<string, string> } = {}) => {
        const element = document.createElement(tag);
        if (options.text) element.textContent = options.text;
        for (const [key, value] of Object.entries(options.attr ?? {})) element.setAttribute(key, value);
        fragment.append(element);
        return element;
      },
    });
    return fragment;
  });
});

describe("completion notice actions", () => {
  it.each([0, 1])("keeps both Details and Open result folder after the host consumes the fragment (action %i)", async (index) => {
    const { showNoticeWithAction } = await import("../src/host/notices");
    const details = vi.fn();
    const folder = vi.fn();
    showNoticeWithAction("Exported with a cleanup warning", "Details", details, [{ label: "Open result folder", run: folder }]);
    const buttons = document.querySelectorAll("button");
    expect([...buttons].map((button) => button.textContent)).toEqual(["Details", "Open result folder"]);
    expect(details).not.toHaveBeenCalled();
    expect(folder).not.toHaveBeenCalled();
    buttons[index].click();
    expect([details, folder][index]).toHaveBeenCalledOnce();
    expect([details, folder][1 - index]).not.toHaveBeenCalled();
    expect(state.hidden).toHaveBeenCalledOnce();
  });
});

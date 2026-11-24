import { beforeEach, describe, expect, it, vi } from "vitest";
import { initI18n, t } from "../src/i18n";
import { useObsidianDom } from "./helpers/obsidian-dom";

const state = vi.hoisted(() => ({ hidden: vi.fn() }));
vi.mock("obsidian", () => ({
  Notice: class Notice {
    readonly element = document.createElement("div");
    constructor(content: DocumentFragment) {
      // The real host consumes the fragment into its notice container.
      this.element.append(content);
      this.element.addEventListener("click", () => this.hide());
      document.body.append(this.element);
    }
    hide(): void { state.hidden(); this.element.remove(); }
  },
}));
useObsidianDom();
beforeEach(() => {
  state.hidden.mockClear();
  initI18n("en");
  vi.stubGlobal("createFragment", () => {
    const fragment = document.createDocumentFragment();
    Object.assign(fragment, {
      appendText: (value: string) => fragment.append(document.createTextNode(value)),
      createDiv: (options: { cls: string }) => {
        const element = document.createElement("div");
        element.className = options.cls;
        fragment.append(element);
        return element;
      },
    });
    return fragment;
  });
});

describe("completion notice actions", () => {
  it.each([0, 1])("keeps both actions usable and provides keyboard dismissal (first action %i)", async (first) => {
    const { showNoticeWithAction } = await import("../src/host/notices");
    const details = vi.fn();
    const folder = vi.fn();
    showNoticeWithAction("Exported with a cleanup warning", "Details", details, [{ label: "Open result folder", run: folder }]);
    const buttons = document.querySelectorAll("button");
    expect([...buttons].map((button) => button.textContent)).toEqual(["Details", "Open result folder", t("dialogDismissNotice")]);
    buttons[first].click();
    expect([details, folder][first]).toHaveBeenCalledOnce();
    expect([details, folder][1 - first]).not.toHaveBeenCalled();
    expect(state.hidden).not.toHaveBeenCalled();
    buttons[1 - first].focus();
    expect(document.activeElement).toBe(buttons[1 - first]);
    buttons[1 - first].click();
    expect([details, folder][1 - first]).toHaveBeenCalledOnce();
    buttons[2].click();
    expect(state.hidden).toHaveBeenCalledOnce();
    expect(document.querySelector("button")).toBeNull();
  });

  it("dismisses a single-action notice immediately after selection", async () => {
    const { showNoticeWithAction } = await import("../src/host/notices");
    const open = vi.fn();
    showNoticeWithAction("Exported", "Open folder", open);
    document.querySelector<HTMLButtonElement>("button")!.click();
    expect(open).toHaveBeenCalledOnce();
    expect(state.hidden).toHaveBeenCalledOnce();
  });
});

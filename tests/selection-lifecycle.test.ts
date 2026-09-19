import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PickerItem } from "../src/utils/suggest-modal";

let pickItem: typeof import("../src/utils/suggest-modal").pickItem;
let confirmDetectedFormat: typeof import("../src/host/confirm").confirmDetectedFormat;

const state = vi.hoisted(() => ({ modals: [] as FakeModal[], failOpen: false }));
class FakeElement {
  children: FakeElement[] = [];
  text = "";
  click: (() => void) | null = null;
  createEl(_tag: string, options: { text?: string } = {}) {
    const child = new FakeElement();
    child.text = options.text ?? "";
    this.children.push(child);
    return child;
  }
  createDiv() { return this.createEl("div"); }
  addEventListener(_event: string, callback: () => void) { this.click = callback; }
  setText(text: string) { this.text = text; }
  empty() { this.children = []; }
}
class FakeModal {
  contentEl = new FakeElement();
  titleEl = new FakeElement();
  closed = false;
  placeholder = "";
  open() {
    if (state.failOpen) throw new Error("host unavailable");
    state.modals.push(this);
    this.onOpen();
  }
  close() { this.closed = true; this.onClose(); }
  onOpen() {}
  onClose() {}
  setPlaceholder(text: string) { this.placeholder = text; }
  onChooseSuggestion(_item: PickerItem) {}
}
vi.mock("obsidian", () => ({ Modal: FakeModal, SuggestModal: FakeModal }));
vi.mock("../src/i18n", () => ({ t: (key: string) => key }));
beforeEach(async () => {
  state.modals = [];
  state.failOpen = false;
  ({ pickItem } = await import("../src/utils/suggest-modal"));
  ({ confirmDetectedFormat } = await import("../src/host/confirm"));
});
const items = [{ id: "template.example", label: "Example", description: "Custom" }];

describe("owned picker lifecycle", () => {
  it.each(["choose-first", "close-first"])("settles a native selection once (%s)", async (order) => {
    const controller = new AbortController();
    const result = pickItem({} as never, items, "Choose", controller.signal);
    const modal = state.modals[0];
    if (order === "close-first") modal.close();
    modal.onChooseSuggestion(items[0]);
    if (order === "choose-first") modal.close();
    expect(await result).toBe(items[0]);
    modal.onChooseSuggestion(items[0]);
    controller.abort();
    expect(await result).toBe(items[0]);
  });

  it.each(["abort", "dismiss"])("ignores a selection delivered after %s", async (action) => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const result = pickItem({} as never, items, "Choose", controller.signal);
    const modal = state.modals[0];
    if (action === "abort") controller.abort();
    else modal.close();
    expect(await result).toBeNull();
    modal.onChooseSuggestion(items[0]);
    expect(await result).toBeNull();
    expect(modal.closed).toBe(true);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("does not open for a cancelled operation", async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await pickItem({} as never, items, "Choose", controller.signal)).toBeNull();
    expect(state.modals).toHaveLength(0);
  });

  it("preserves an opening failure and releases its listener", async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    state.failOpen = true;
    await expect(pickItem({} as never, items, "Choose", controller.signal)).rejects.toThrow("host unavailable");
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });
});

describe("owned detected-format confirmation", () => {
  it("uses localized controls and closes on cancellation before a late Continue", async () => {
    const controller = new AbortController();
    const result = confirmDetectedFormat({} as never, controller.signal);
    const modal = state.modals[0];
    const [cancel, proceed] = modal.contentEl.children[1].children;
    expect(cancel.text).toBe("operationCancel");
    expect(proceed.text).toBe("dialogContinue");
    controller.abort();
    expect(await result).toBe(false);
    expect(modal.closed).toBe(true);
    proceed.click!();
    expect(await result).toBe(false);
  });

  it("accepts one current confirmation and removes the abort listener", async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const result = confirmDetectedFormat({} as never, controller.signal);
    state.modals[0].contentEl.children[1].children[1].click!();
    expect(await result).toBe(true);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });
});

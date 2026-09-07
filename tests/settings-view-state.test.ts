import { describe, expect, it, vi } from "vitest";
import { preserveSettingsView } from "../src/settings-view-state";

function createView({ externalFocus = false, disabled = false, removed = false } = {}) {
  const parent = { parentElement: null, scrollTop: 420, scrollLeft: 12 };
  const originalControl = {};
  const focus = vi.fn();
  const replacement = { focus, matches: () => disabled };
  const row = {
    getAttribute: () => "markdown:4",
    querySelectorAll: () => [originalControl],
  };
  const active = Object.assign(originalControl, { closest: () => row });
  const container = {
    parentElement: parent,
    scrollTop: 24,
    scrollLeft: 0,
    ownerDocument: { activeElement: active },
    contains: () => !externalFocus,
    querySelectorAll: () => removed ? [] : [{
      getAttribute: () => "markdown:4",
      querySelectorAll: () => [replacement],
    }],
  };
  return { parent, container, focus };
}

describe("settings refresh view state", () => {
  it("restores nested scroll positions and the same control after a destructive page refresh", () => {
    const { parent, container, focus } = createView();
    preserveSettingsView(container as unknown as HTMLElement, () => {
      // Emptying a long panel clamps its scrolling ancestors before rows return.
      parent.scrollTop = 0;
      parent.scrollLeft = 0;
      container.scrollTop = 0;
    });
    expect(parent.scrollTop).toBe(420);
    expect(parent.scrollLeft).toBe(12);
    expect(container.scrollTop).toBe(24);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it.each([{ externalFocus: true }, { disabled: true }, { removed: true }])(
    "does not steal focus or focus unavailable controls: %j",
    (options) => {
      const { parent, container, focus } = createView(options);
      preserveSettingsView(container as unknown as HTMLElement, () => { parent.scrollTop = 0; });
      expect(parent.scrollTop).toBe(420);
      expect(focus).not.toHaveBeenCalled();
    },
  );

  it("restores the viewport when rendering throws without hiding the error", () => {
    const { parent, container } = createView();
    expect(() => preserveSettingsView(container as unknown as HTMLElement, () => {
      parent.scrollTop = 0;
      throw new Error("render failed");
    })).toThrow("render failed");
    expect(parent.scrollTop).toBe(420);
  });
});

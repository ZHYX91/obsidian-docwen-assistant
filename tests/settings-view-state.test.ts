import { describe, expect, it } from "vitest";
import { preserveSettingsView } from "../src/settings-view-state";
import { useObsidianDom } from "./helpers/obsidian-dom";

useObsidianDom();

function createView({ externalFocus = false, disabled = false, removed = false } = {}) {
  const parent = document.body.appendChild(document.createElement("div"));
  const container = parent.appendChild(document.createElement("div"));
  const external = document.body.appendChild(document.createElement("input"));
  const render = () => {
    container.replaceChildren();
    if (removed) return;
    const row = container.appendChild(document.createElement("div"));
    row.setAttribute("data-docwen-setting-key", "markdown:4");
    const control = row.appendChild(document.createElement("button"));
    control.disabled = disabled;
  };
  const row = container.appendChild(document.createElement("div"));
  row.setAttribute("data-docwen-setting-key", "markdown:4");
  const original = row.appendChild(document.createElement("button"));
  (externalFocus ? external : original).focus();
  parent.scrollTop = 420;
  parent.scrollLeft = 12;
  container.scrollTop = 24;
  return { parent, container, external, render };
}

describe("settings refresh view state", () => {
  it("restores keyboard focus to a help link after the settings surface is rebuilt", () => {
    const { container } = createView();
    const row = container.querySelector<HTMLElement>("[data-docwen-setting-key]")!;
    row.replaceChildren();
    const link = row.appendChild(document.createElement("a"));
    link.href = "https://github.com/ZHYX91/obsidian-docwen-assistant";
    link.textContent = "User guide";
    link.focus();
    preserveSettingsView(container, () => container.replaceChildren(row.cloneNode(true)));
    const replacement = container.querySelector("a");
    expect(replacement).not.toBe(link);
    expect(document.activeElement).toBe(replacement);
  });

  it("restores nested scroll positions and the same control after rebuilding the page", () => {
    const { parent, container, render } = createView();
    preserveSettingsView(container, () => {
      render();
      // Model the scroll clamping caused by removing a long panel in the host.
      parent.scrollTop = 0;
      parent.scrollLeft = 0;
      container.scrollTop = 0;
    });
    expect(parent.scrollTop).toBe(420);
    expect(parent.scrollLeft).toBe(12);
    expect(container.scrollTop).toBe(24);
    expect(document.activeElement).toBe(container.querySelector("button"));
  });

  it.each([{ externalFocus: true }, { disabled: true }, { removed: true }])(
    "does not steal focus or focus unavailable controls: %j",
    (options) => {
      const { parent, container, external, render } = createView(options);
      preserveSettingsView(container, () => { render(); parent.scrollTop = 0; });
      expect(parent.scrollTop).toBe(420);
      expect(container.contains(document.activeElement)).toBe(false);
      if (options.externalFocus) expect(document.activeElement).toBe(external);
    },
  );

  it("restores the viewport when rendering throws without hiding the error", () => {
    const { parent, container } = createView();
    expect(() => preserveSettingsView(container, () => {
      parent.scrollTop = 0;
      throw new Error("render failed");
    })).toThrow("render failed");
    expect(parent.scrollTop).toBe(420);
    expect(document.activeElement).toBe(container.querySelector("button"));
  });
});

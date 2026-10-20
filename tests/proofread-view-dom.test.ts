import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useObsidianDom } from "./helpers/obsidian-dom";
import DocWenPlugin from "../src/main";
import { ProofreadView } from "../src/proofread-view";
import { getCurrentLocale, initI18n, t } from "../src/i18n";
import { DEFAULT_SETTINGS } from "../src/settings-model";
import { OperationCoordinator } from "../src/runtime/operation-coordinator";
import { SettingsSaveCoordinator } from "../src/runtime/settings-save";
import type { ProofreadIssue } from "../src/docwen";

vi.mock("obsidian", async () => import("./helpers/obsidian-dom"));

const fixtures: Array<{ view: ProofreadView; operations: OperationCoordinator }> = [];
useObsidianDom();

beforeEach(() => {
  document.documentElement.dir = "ltr";
  initI18n("en");
});

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    await fixture.view.onClose();
    fixture.operations.dispose();
  }
});

async function createFixture() {
  const operations = new OperationCoordinator();
  const leaves: Array<{ view: ProofreadView }> = [];
  const app = { workspace: { getLeavesOfType: () => leaves }, vault: {} };
  const view = new ProofreadView({ app } as never, async () => {}, operations);
  leaves.push({ view });
  const saved: unknown[] = [];
  const plugin = new DocWenPlugin(app as never, { id: "docwen-assistant" } as never);
  plugin.settings = { ...DEFAULT_SETTINGS, language: "en" };
  Object.assign(plugin, {
    settingsSaves: new SettingsSaveCoordinator(async (snapshot) => { saved.push(snapshot); }),
  });
  await view.onOpen();
  const root = view.containerEl.children[1] as HTMLElement;
  fixtures.push({ view, operations });
  return { plugin, view, operations, root, saved };
}

function issue(text: string, offset: number, rule = "typo"): ProofreadIssue {
  return {
    rule_key: rule,
    matched_text: text,
    error_text: text,
    suggestion: "",
    error_type: "fixture",
    source: "fixture",
    range: {
      start: { offset, line: offset, column: 0 },
      end: { offset: offset + 1, line: offset, column: 1 },
    },
  };
}

describe("proofreading view DOM integration", () => {
  it("renders the initial empty state even when no operation is owned", async () => {
    const { root } = await createFixture();
    expect(root.querySelector('[role="status"]')?.textContent).toBe(t("proofreadOpenMdFile"));
  });

  it("updates an open report through saveSettings, including direction and accessible labels", async () => {
    const { plugin, view, root, saved } = await createFixture();
    view.updateResults([], "Note.md", "Note.md", "a".repeat(64));
    plugin.settings.language = "zh-CN";
    await plugin.saveSettings();
    expect(getCurrentLocale()).toBe("zh-cn");
    expect(root.querySelector(".docwen-proofread-status")?.textContent).toBe(t("proofreadNoIssues"));
    expect(root.querySelector("button")?.getAttribute("aria-label")).toBe(t("proofreadRefresh"));
    expect(root.getAttribute("lang")).toBe("zh-cn");
    expect(root.getAttribute("dir")).toBe("ltr");

    plugin.settings.language = "ar";
    await plugin.saveSettings();
    expect(root.querySelector(".docwen-proofread-status")?.textContent).toBe(t("proofreadNoIssues"));
    expect(root.getAttribute("lang")).toBe("ar");
    expect(root.getAttribute("dir")).toBe("rtl");
    expect(saved).toHaveLength(2);
  });

  it("does not replace controls or lose focus for another operation or an unchanged locale", async () => {
    const { plugin, view, operations, root } = await createFixture();
    view.updateResults([], "Note.md", "Note.md", "a".repeat(64));
    const refresh = root.querySelector<HTMLButtonElement>("button")!;
    refresh.focus();
    const unrelated = operations.begin({ key: "export:Other.md", kind: "export" });
    expect(refresh.isConnected).toBe(true);
    expect(document.activeElement).toBe(refresh);
    unrelated.finish();
    await plugin.saveSettings();
    expect(root.querySelector("button")).toBe(refresh);
    expect(document.activeElement).toBe(refresh);
  });

  it("updates running, cancelling and finished states for the same owned generation", async () => {
    const { view, root, operations } = await createFixture();
    const lease = operations.begin({ key: "proofread:Note.md", kind: "proofread" });
    view.ownOperation(lease);
    const cancel = root.querySelector<HTMLButtonElement>(".docwen-proofread-cancel")!;
    expect(cancel.disabled).toBe(false);
    expect(root.querySelector('[aria-busy="true"]')?.textContent).toBe(
      t("operationRunning", { operation: t("operationProofread") }),
    );
    cancel.click();
    expect(lease.signal.aborted).toBe(true);
    expect(root.querySelector<HTMLButtonElement>(".docwen-proofread-cancel")?.disabled).toBe(true);
    expect(root.querySelector('[aria-busy="true"]')?.textContent).toBe(t("operationCancelling"));
    lease.finish();
    expect(root.querySelector(".docwen-proofread-cancel")).toBeNull();
    expect(root.querySelector(".docwen-proofread-status")?.textContent).toBe(t("proofreadCancelled"));
  });

  it("preserves the focused issue and list scroll across a language change", async () => {
    const { plugin, view, root } = await createFixture();
    view.updateResults([issue("first", 1), issue("second", 2)], "Note.md", "Note.md", "a".repeat(64));
    root.querySelectorAll<HTMLButtonElement>(".docwen-proofread-item")[1].focus();
    const list = root.querySelector<HTMLElement>(".docwen-proofread-list")!;
    list.scrollTop = 120;
    plugin.settings.language = "zh-CN";
    await plugin.saveSettings();
    expect(document.activeElement?.textContent).toContain("second");
    expect(document.activeElement?.textContent).toContain(t("settingsProofreadTypo"));
    expect(root.querySelector<HTMLElement>(".docwen-proofread-list")?.scrollTop).toBe(120);
  });

  it("retains the sort control's keyboard focus after activation", async () => {
    const { view, root } = await createFixture();
    view.updateResults([issue("later", 2, "symbol_pair"), issue("earlier", 1)], "Note.md", "Note.md", "a".repeat(64));
    const sort = root.querySelectorAll<HTMLButtonElement>(".docwen-proofread-btn")[1];
    sort.focus();
    sort.click();
    expect(document.activeElement?.getAttribute("aria-label")).toBe(t("proofreadSortByLine"));
    expect(root.querySelector(".docwen-proofread-item")?.textContent).toContain("later");
  });

  it("does not take focus from settings or render a closed view on language changes", async () => {
    const { plugin, view, root } = await createFixture();
    const external = document.body.appendChild(document.createElement("input"));
    external.focus();
    plugin.settings.language = "ar";
    await plugin.saveSettings();
    expect(document.activeElement).toBe(external);
    await view.onClose();
    const closedContent = root.textContent;
    plugin.settings.language = "en";
    await plugin.saveSettings();
    expect(root.textContent).toBe(closedContent);
    await view.onOpen();
    expect(root.getAttribute("dir")).toBe("ltr");
    expect(root.getAttribute("lang")).toBe("en");
  });
});

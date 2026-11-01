import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Window } from "happy-dom";
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
  it("uses the report's document for keyboard focus in a popout", async () => {
    const { view, root } = await createFixture();
    const reportDocument = root.ownerDocument;
    const otherWindow = new Window();
    try {
      vi.stubGlobal("document", otherWindow.document);
      view.updateResults(Array.from({ length: 201 }, (_, index) => issue(`issue-${index}`, index)), "Note.md", "Note.md", "a".repeat(64));
      const more = root.querySelector<HTMLButtonElement>(".docwen-proofread-more")!;
      more.focus();
      more.click();
      expect(reportDocument.activeElement?.textContent).toContain("issue-200");
      expect(otherWindow.document.activeElement).toBe(otherWindow.document.body);
    } finally {
      vi.stubGlobal("document", reportDocument);
      await otherWindow.happyDOM.close();
    }
  });

  it("bounds the initial DOM for ten thousand issues and reports the full total", async () => {
    const { view, root } = await createFixture();
    view.updateResults(Array.from({ length: 10_000 }, (_, index) => issue(`issue-${index}`, index)), "Note.md", "Note.md", "a".repeat(64));
    expect(root.querySelectorAll(".docwen-proofread-item")).toHaveLength(200);
    expect(root.querySelector(".docwen-proofread-count")?.textContent).toBe(t("proofreadIssueCount", { shown: "200", total: "10000" }));
    expect(root.querySelector(".docwen-proofread-more")?.textContent).toBe(t("proofreadLoadMore", { count: "200" }));
  });

  it("makes every issue reachable, keeps scroll, and moves keyboard focus into each new batch", async () => {
    const { view, root } = await createFixture();
    view.updateResults(Array.from({ length: 401 }, (_, index) => issue(`issue-${index}`, index)), "Note.md", "Note.md", "a".repeat(64));
    const first = root.querySelector(".docwen-proofread-item");
    const sort = root.querySelectorAll(".docwen-proofread-btn")[1];
    for (const [count, firstNew] of [[400, 200], [401, 400]]) {
      root.querySelector<HTMLElement>(".docwen-proofread-list")!.scrollTop = 480;
      const more = root.querySelector<HTMLButtonElement>(".docwen-proofread-more")!;
      more.focus();
      more.click();
      expect(root.querySelectorAll(".docwen-proofread-item")).toHaveLength(count);
      expect(root.querySelector(".docwen-proofread-item")).toBe(first);
      expect(root.querySelectorAll(".docwen-proofread-btn")[1]).toBe(sort);
      expect(document.activeElement?.textContent).toContain(`issue-${firstNew}`);
      expect(root.querySelector<HTMLElement>(".docwen-proofread-list")?.scrollTop).toBe(480);
    }
    expect(root.querySelector(".docwen-proofread-more")).toBeNull();
    expect(root.querySelectorAll(".docwen-proofread-item")[400].textContent).toContain("issue-400");
  });

  it("retains loaded results across sorting and RTL locale changes, and resets for a new report", async () => {
    const { plugin, view, root } = await createFixture();
    const issues = Array.from({ length: 450 }, (_, index) => issue(`issue-${index}`, index, index === 449 ? "sensitive" : "typo"));
    view.updateResults(issues, "Note.md", "Note.md", "a".repeat(64));
    root.querySelector<HTMLButtonElement>(".docwen-proofread-more")!.click();
    root.querySelectorAll<HTMLButtonElement>(".docwen-proofread-btn")[1].click();
    expect(root.querySelectorAll(".docwen-proofread-item")).toHaveLength(400);
    expect(root.querySelector(".docwen-proofread-item")?.textContent).toContain("issue-449");
    const more = root.querySelector<HTMLButtonElement>(".docwen-proofread-more")!;
    more.focus();
    plugin.settings.language = "ar";
    await plugin.saveSettings();
    expect(root.getAttribute("dir")).toBe("rtl");
    expect(document.activeElement?.textContent).toBe(t("proofreadLoadMore", { count: "50" }));
    expect(root.querySelectorAll(".docwen-proofread-item")).toHaveLength(400);
    const obsolete = root.querySelector<HTMLButtonElement>(".docwen-proofread-more")!;
    view.updateResults(issues, "New.md", "New.md", "b".repeat(64));
    obsolete.click();
    expect(root.querySelectorAll(".docwen-proofread-item")).toHaveLength(200);
    const closed = root.querySelector<HTMLButtonElement>(".docwen-proofread-more")!;
    await view.onClose();
    closed.click();
    expect(root.querySelectorAll(".docwen-proofread-item")).toHaveLength(200);
  });

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

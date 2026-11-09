import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileSystemAdapter, type App, type TFile, type WorkspaceLeaf } from "obsidian";
import { AssistantView, ASSISTANT_VIEW_TYPE } from "../src/assistant-view";
import { createAssistantSidebarOpener, AssistantSidebarClosedError } from "../src/host/assistant-sidebar";
import { initI18n, t, getSupportedLocales } from "../src/i18n";
import { OperationCoordinator } from "../src/runtime/operation-coordinator";
import { createAssistantViewActions, useObsidianDom } from "./helpers/obsidian-dom";

vi.mock("obsidian", async () => import("./helpers/obsidian-dom"));
useObsidianDom();

const fixtures: Array<{ views: AssistantView[]; operations: OperationCoordinator }> = [];
beforeEach(() => initI18n("en"));
afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    for (const view of fixture.views) await view.onClose();
    fixture.operations.dispose();
  }
});

function createFixture() {
  const operations = new OperationCoordinator();
  const actions = createAssistantViewActions();
  const views: AssistantView[] = [];
  const leaves: WorkspaceLeaf[] = [];
  const current = { file: null as TFile | null, active: true };
  const app = {
    workspace: {
      getActiveFile: () => current.file,
      getLeavesOfType: vi.fn(() => leaves),
      getRightLeaf: vi.fn(() => makeLeaf()),
      revealLeaf: vi.fn(async (_leaf: WorkspaceLeaf) => {}),
    },
    vault: { adapter: Object.assign(new FileSystemAdapter(), { getBasePath: () => "/vault" }) },
  };
  function makeLeaf() {
    const leaf = {
      app,
      view: {} as AssistantView,
      isDeferred: false,
      setViewState: vi.fn(async () => {
        leaf.view = new AssistantView(leaf as never, async () => {}, operations, actions);
        views.push(leaf.view);
        leaves.push(leaf as unknown as WorkspaceLeaf);
        await leaf.view.onOpen();
      }),
      loadIfDeferred: vi.fn(async () => {}),
      detach: vi.fn(() => {
        const index = leaves.indexOf(leaf as unknown as WorkspaceLeaf);
        if (index !== -1) leaves.splice(index, 1);
        void leaf.view.onClose();
      }),
    };
    return leaf;
  }
  const open = createAssistantSidebarOpener(app as unknown as App, operations, () => current.active);
  fixtures.push({ views, operations });
  return { actions, app, current, leaves, makeLeaf, open, operations };
}

function file(name: string): TFile {
  return { name, path: `Notes/${name}`, extension: name.split(".").at(-1)! } as TFile;
}

function root(view: AssistantView): HTMLElement { return view.containerEl.children[1] as HTMLElement; }
function button(view: AssistantView, key: string): HTMLButtonElement {
  return root(view).querySelector<HTMLButtonElement>(`[data-docwen-view-key="${key}"]`)!;
}

describe("Assistant sidebar opening", () => {
  it("opens with no file or backend and only runs actions after an explicit button click", async () => {
    const fixture = createFixture();
    const view = await fixture.open();
    expect(view.getViewType()).toBe("docwen-proofread-view");
    expect(view.getDisplayText()).toBe("DocWen Assistant");
    expect(fixture.app.workspace.getRightLeaf).toHaveBeenCalledWith(false);
    expect(fixture.app.workspace.revealLeaf).toHaveBeenCalledOnce();
    expect(fixture.operations.getSnapshot().operations).toEqual([]);
    expect(button(view, "open-current-file").disabled).toBe(true);
    expect(button(view, "proofread-current-file").disabled).toBe(true);
    expect(root(view).textContent).toContain(t("sidebarNoFile"));
    for (const action of Object.values(fixture.actions)) expect(action).not.toHaveBeenCalled();
    button(view, "open-gui").click();
    expect(fixture.actions.openGui).toHaveBeenCalledOnce();
    expect(fixture.actions.openCurrentFile).not.toHaveBeenCalled();
    expect(fixture.actions.proofreadCurrentFile).not.toHaveBeenCalled();
  });

  it("coalesces rapid opens and preserves the existing report, DOM, focus and scroll", async () => {
    const fixture = createFixture();
    let complete!: () => void;
    const ready = new Promise<void>((resolve) => { complete = resolve; });
    const leaf = fixture.makeLeaf();
    const setViewState = leaf.setViewState.getMockImplementation()!;
    leaf.setViewState.mockImplementation(async () => { await ready; await setViewState(); });
    fixture.app.workspace.getRightLeaf.mockReturnValue(leaf);
    const first = fixture.open();
    expect(fixture.open()).toBe(first);
    complete();
    const view = await first;
    view.updateResults([], "Report.md", "Report.md", "a".repeat(64));
    const report = root(view).querySelector(".docwen-proofread-status");
    root(view).scrollTop = 82;
    button(view, "sort").focus();
    const focused = root(view).ownerDocument.activeElement;
    const update = vi.spyOn(view, "updateResults");
    expect(await fixture.open()).toBe(view);
    expect(fixture.leaves).toHaveLength(1);
    expect(leaf.setViewState).toHaveBeenCalledOnce();
    expect(fixture.app.workspace.revealLeaf).toHaveBeenCalledTimes(2);
    expect(root(view).querySelector(".docwen-proofread-status")).toBe(report);
    expect(root(view).scrollTop).toBe(82);
    expect(root(view).ownerDocument.activeElement).toBe(focused);
    expect(update).not.toHaveBeenCalled();
    for (const action of Object.values(fixture.actions)) expect(action).not.toHaveBeenCalled();
  });

  it("loads the host's deferred restored leaf without replacing its view state", async () => {
    const fixture = createFixture();
    const leaf = fixture.makeLeaf();
    leaf.isDeferred = true;
    fixture.leaves.push(leaf as unknown as WorkspaceLeaf);
    leaf.loadIfDeferred.mockImplementation(async () => {
      await leaf.setViewState();
      fixture.leaves.pop();
      leaf.isDeferred = false;
    });
    const view = await fixture.open();
    expect(view).toBe(leaf.view);
    expect(leaf.loadIfDeferred).toHaveBeenCalledOnce();
    expect(fixture.app.workspace.getRightLeaf).not.toHaveBeenCalled();
    expect(fixture.app.workspace.revealLeaf).toHaveBeenCalledWith(leaf);
    expect(fixture.leaves).toHaveLength(1);
  });

  it("clears a failed opening so a later explicit attempt can succeed", async () => {
    const fixture = createFixture();
    fixture.app.workspace.getRightLeaf.mockImplementationOnce(() => { throw new Error("host unavailable"); });
    await expect(fixture.open()).rejects.toThrow("host unavailable");
    await expect(fixture.open()).resolves.toBeInstanceOf(AssistantView);
    expect(fixture.leaves).toHaveLength(1);
  });

  it("does not detach a replacement view from a reloaded runtime when an older opening settles", async () => {
    const fixture = createFixture();
    const leaf = fixture.makeLeaf();
    const setViewState = leaf.setViewState.getMockImplementation()!;
    const replacementOperations = new OperationCoordinator();
    const replacement = new AssistantView(leaf as never, async () => {}, replacementOperations, createAssistantViewActions());
    fixtures.push({ views: [replacement], operations: replacementOperations });
    leaf.setViewState.mockImplementation(async () => {
      await setViewState();
      await leaf.view.onClose();
      fixture.current.active = false;
      leaf.view = replacement;
      await replacement.onOpen();
    });
    fixture.app.workspace.getRightLeaf.mockReturnValue(leaf);
    await expect(fixture.open()).rejects.toBeInstanceOf(AssistantSidebarClosedError);
    expect(leaf.detach).not.toHaveBeenCalled();
    expect(leaf.view).toBe(replacement);
    expect(replacement.captureLifetime()()).toBe(true);
    expect(fixture.leaves).toEqual([leaf]);
    expect(fixture.app.workspace.revealLeaf).not.toHaveBeenCalled();
  });

  it("does not reveal or leave a sidebar restored after plugin unload", async () => {
    const fixture = createFixture();
    const leaf = fixture.makeLeaf();
    const setViewState = leaf.setViewState.getMockImplementation()!;
    leaf.setViewState.mockImplementation(async () => {
      await setViewState();
      fixture.current.active = false;
    });
    fixture.app.workspace.getRightLeaf.mockReturnValue(leaf);
    await expect(fixture.open()).rejects.toBeInstanceOf(AssistantSidebarClosedError);
    expect(leaf.detach).toHaveBeenCalledOnce();
    expect(fixture.leaves).toEqual([]);
    expect(fixture.app.workspace.revealLeaf).not.toHaveBeenCalled();
    await expect(fixture.open()).rejects.toBeInstanceOf(AssistantSidebarClosedError);
    expect(fixture.app.workspace.getRightLeaf).toHaveBeenCalledOnce();
  });
});

describe("Assistant sidebar file controls", () => {
  it("reads the host's current file while the sidebar has focus and updates without replacing the report", async () => {
    const fixture = createFixture();
    const view = await fixture.open();
    view.updateResults([], "Original report.md", "Original report.md", "a".repeat(64));
    const report = root(view).querySelector(".docwen-proofread-status");
    fixture.current.file = file("First.md");
    view.refreshActiveFile();
    button(view, "open-current-file").focus();
    expect(button(view, "open-current-file").disabled).toBe(false);
    expect(button(view, "proofread-current-file").disabled).toBe(false);
    button(view, "open-current-file").click();
    button(view, "proofread-current-file").click();
    expect(fixture.actions.openCurrentFile).toHaveBeenCalledOnce();
    expect(fixture.actions.proofreadCurrentFile).toHaveBeenCalledWith(view);
    fixture.current.file = file("Second.pdf");
    view.refreshActiveFile();
    expect(button(view, "open-current-file").disabled).toBe(false);
    expect(button(view, "proofread-current-file").disabled).toBe(true);
    expect(root(view).textContent).toContain("Second.pdf");
    fixture.current.file = null;
    view.refreshActiveFile();
    expect(button(view, "open-current-file").disabled).toBe(true);
    expect(button(view, "proofread-current-file").disabled).toBe(true);
    expect(root(view).textContent).toContain(t("sidebarNoFile"));
    expect(root(view).querySelector(".docwen-proofread-status")).toBe(report);
    expect(root(view).textContent).toContain("Original report.md");
  });

  it("rechecks the file on click and ignores controls from a closed view lifetime", async () => {
    const fixture = createFixture();
    fixture.current.file = file("First.md");
    const view = await fixture.open();
    const openFile = button(view, "open-current-file");
    fixture.current.file = null;
    openFile.click();
    expect(fixture.actions.openCurrentFile).not.toHaveBeenCalled();
    const gui = button(view, "open-gui");
    await view.onClose();
    gui.click();
    await view.onOpen();
    gui.click();
    expect(fixture.actions.openGui).not.toHaveBeenCalled();
    button(view, "open-gui").click();
    expect(fixture.actions.openGui).toHaveBeenCalledOnce();
  });

  it("disables duplicate proofreading while preserving independent GUI access", async () => {
    const fixture = createFixture();
    fixture.current.file = file("First.md");
    const view = await fixture.open();
    const lease = fixture.operations.begin({ key: "proofread", kind: "proofread" });
    view.ownOperation(lease);
    expect(button(view, "proofread-current-file").disabled).toBe(true);
    expect(button(view, "open-gui").disabled).toBe(false);
    expect(button(view, "open-current-file").disabled).toBe(false);
    button(view, "proofread-current-file").click();
    expect(fixture.actions.proofreadCurrentFile).not.toHaveBeenCalled();
    lease.finish();
    expect(button(view, "proofread-current-file").disabled).toBe(false);
  });

  it.each(getSupportedLocales())("has named keyboard controls and correct text direction in %s", async (locale) => {
    initI18n(locale);
    const fixture = createFixture();
    const view = await fixture.open();
    const buttons = root(view).querySelectorAll<HTMLButtonElement>(".docwen-assistant-action");
    expect(buttons).toHaveLength(3);
    expect(Array.from(buttons, (item) => item.textContent)).toEqual([
      t("sidebarOpenGui"), t("commandLaunchWithFile"), t("commandProofread"),
    ]);
    expect(root(view).dir).toBe(locale === "ar" ? "rtl" : "ltr");
    expect(view.getViewType()).toBe(ASSISTANT_VIEW_TYPE);
    button(view, "open-gui").focus();
    expect(root(view).ownerDocument.activeElement).toBe(button(view, "open-gui"));
  });
});

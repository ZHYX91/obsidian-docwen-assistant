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
  const attached = new Set<WorkspaceLeaf>();
  const current = { file: null as TFile | null, active: true };
  const app = {
    workspace: {
      getActiveFile: () => current.file,
      getLeavesOfType: vi.fn(() => leaves),
      iterateAllLeaves: (visit: (leaf: WorkspaceLeaf) => void) => attached.forEach(visit),
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
        attached.delete(leaf as unknown as WorkspaceLeaf);
        const index = leaves.indexOf(leaf as unknown as WorkspaceLeaf);
        if (index !== -1) leaves.splice(index, 1);
        if (leaf.view instanceof AssistantView) void leaf.view.onClose();
      }),
    };
    attached.add(leaf as unknown as WorkspaceLeaf);
    return leaf;
  }
  const open = createAssistantSidebarOpener(app as unknown as App, operations, () => current.active);
  fixtures.push({ views, operations });
  return { actions, app, current, leaves, makeLeaf, open, operations, views };
}

function file(name: string): TFile {
  return { name, path: `Notes/${name}`, extension: name.split(".").at(-1)! } as TFile;
}

function root(view: AssistantView): HTMLElement { return view.containerEl.children[1] as HTMLElement; }
function button(view: AssistantView, key: string): HTMLButtonElement {
  return root(view).querySelector<HTMLButtonElement>(`[data-docwen-view-key="${key}"]`)!;
}

describe("Assistant sidebar opening", () => {
  it("enables first-run refresh only for eligible files, then keeps refresh bound to the report", async () => {
    const fixture = createFixture();
    const view = await fixture.open();
    const isDisabled = () => button(view, "refresh").disabled;
    expect(isDisabled()).toBe(true);
    fixture.current.file = file("B.md");
    view.refreshActiveFile();
    expect(isDisabled()).toBe(false);
    fixture.current.file = file("C.pdf");
    view.refreshActiveFile();
    expect(isDisabled()).toBe(true);
    view.updateResults([], "B.md", "Notes/B.md", "b".repeat(64));
    fixture.current.file = null;
    view.refreshActiveFile();
    expect(isDisabled()).toBe(false);
  });

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

  it.each([true, false])("distinguishes a detached new leaf from a failed live load (detached=%s)", async detached => {
    const f = createFixture();
    const leaf = f.makeLeaf();
    f.app.workspace.getRightLeaf.mockReturnValue(leaf);
    const error = new Error("host could not create the view");
    leaf.setViewState.mockImplementationOnce(async () => {
      if (detached) leaf.detach();
      throw error;
    });
    if (detached) await expect(f.open()).rejects.toBeInstanceOf(AssistantSidebarClosedError);
    else await expect(f.open()).rejects.toBe(error);
    expect(f.app.workspace.revealLeaf).not.toHaveBeenCalled();
  });

  it.each([
    ["synchronous", "resolve"], ["synchronous", "reject"], ["deferred", "resolve"], ["deferred", "reject"],
  ])("keeps the replacement view after a %s load and late %s", async (timing, outcome) => {
    const f = createFixture();
    const leaf = f.makeLeaf();
    f.app.workspace.getRightLeaf.mockReturnValue(leaf);
    const load = leaf.setViewState.getMockImplementation()!;
    let finish!: () => void;
    let opened!: () => void;
    const paused = new Promise<void>(resolve => { finish = resolve; });
    const firstOpen = new Promise<void>(resolve => { opened = resolve; });
    leaf.setViewState.mockImplementationOnce(async () => {
      if (timing === "deferred") await Promise.resolve();
      await load();
      opened();
      await paused;
      if (outcome === "reject") throw new Error("opening superseded");
    });
    const pending = f.open();
    await firstOpen;
    const old = leaf.view;
    await old.onClose();
    // The next view uses the same OperationCoordinator and the same workspace leaf.
    const replacement = new AssistantView(leaf as never, async () => {}, f.operations, createAssistantViewActions());
    f.views.push(replacement);
    leaf.view = replacement;
    await replacement.onOpen();
    finish();
    await expect(pending).rejects.toBeInstanceOf(AssistantSidebarClosedError);
    expect(f.app.workspace.revealLeaf).not.toHaveBeenCalled();
    expect(leaf.detach).not.toHaveBeenCalled();
    expect(replacement.captureLifetime()()).toBe(true);
  });

  it("keeps a live deferred-load error and treats a detached leaf as closed", async () => {
    const f = createFixture();
    const leaf = f.makeLeaf();
    leaf.isDeferred = true;
    f.leaves.push(leaf as unknown as WorkspaceLeaf);
    const failure = new Error("host could not restore the view");
    leaf.loadIfDeferred.mockRejectedValueOnce(failure);
    await expect(f.open()).rejects.toBe(failure);
    leaf.loadIfDeferred.mockImplementationOnce(async () => {
      leaf.detach();
      throw failure;
    });
    await expect(f.open()).rejects.toBeInstanceOf(AssistantSidebarClosedError);
    expect(f.app.workspace.revealLeaf).not.toHaveBeenCalled();
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

  it.each(["resolve", "reject"])("cleans the sidebar restored after unload when setViewState settles: %s", async outcome => {
    const fixture = createFixture();
    const leaf = fixture.makeLeaf();
    const setViewState = leaf.setViewState.getMockImplementation()!;
    leaf.setViewState.mockImplementation(async () => {
      await setViewState();
      fixture.current.active = false;
      if (outcome === "reject") throw new Error("opening interrupted");
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
    view.ownOperation(lease, "Proofread.md");
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
      t("commandProofread"), t("sidebarOpenGui"), t("commandLaunchWithFile"),
    ]);
    expect(root(view).dir).toBe(locale === "ar" ? "rtl" : "ltr");
    expect(view.getViewType()).toBe(ASSISTANT_VIEW_TYPE);
    button(view, "open-gui").focus();
    expect(root(view).ownerDocument.activeElement).toBe(button(view, "open-gui"));
  });
});

describe("Assistant sidebar tabs and exports", () => {
  it("switches accessible tabs without replacing the report or cancelling proofreading", async () => {
    const fixture = createFixture();
    fixture.current.file = file("Source.md");
    const view = await fixture.open();
    const lease = fixture.operations.begin({ key: "proofread", kind: "proofread" });
    view.ownOperation(lease, "Proofread.md");
    const proofread = root(view).querySelector<HTMLElement>('[role="tabpanel"]')!;
    const report = root(view).querySelector(".docwen-proofread-status");
    proofread.scrollTop = 90;
    button(view, "tab-actions").click();
    expect(button(view, "tab-actions").getAttribute("aria-selected")).toBe("true");
    expect(button(view, "tab-proofread").tabIndex).toBe(-1);
    expect(proofread.hidden).toBe(true);
    expect(lease.signal.aborted).toBe(false);
    expect(view.getState()).toEqual({ activeTab: "actions" });
    button(view, "tab-proofread").click();
    expect(root(view).querySelector(".docwen-proofread-status")).toBe(report);
    expect(proofread.scrollTop).toBe(90);
    expect(proofread.hidden).toBe(false);
    expect(lease.signal.aborted).toBe(false);
    lease.finish();
  });

  it.each(["en", "ar"])("supports keyboard tab navigation and unique panel associations in %s", async (locale) => {
    initI18n(locale);
    const fixture = createFixture();
    const view = await fixture.open();
    const press = (key: string) => {
      const selected = root(view).querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')!;
      selected.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }));
    };
    press("ArrowRight");
    expect(root(view).ownerDocument.activeElement).toBe(button(view, "tab-actions"));
    press("ArrowLeft");
    expect(view.getState().activeTab).toBe("proofread");
    press("End");
    expect(view.getState().activeTab).toBe("actions");
    press("Home");
    expect(view.getState().activeTab).toBe("proofread");
    for (const tab of root(view).querySelectorAll('[role="tab"]')) {
      const panel = root(view).ownerDocument.getElementById(tab.getAttribute("aria-controls")!);
      expect(panel?.getAttribute("aria-labelledby")).toBe(tab.id);
    }
    const second = new AssistantView({} as never, async () => {}, fixture.operations, fixture.actions);
    await second.onOpen();
    expect(button(second, "tab-actions").id).not.toBe(button(view, "tab-actions").id);
    await second.onClose();
  });

  it("restores the selected tab and keeps it when results arrive or the language changes", async () => {
    const fixture = createFixture();
    const view = await fixture.open();
    await view.setState({ activeTab: "actions" });
    view.updateResults([], "Source.md", "Notes/Source.md", "a".repeat(64));
    initI18n("zh-CN");
    view.refreshLocale();
    expect(view.getState().activeTab).toBe("actions");
    expect(button(view, "tab-actions").textContent).toBe("操作");
    expect(root(view).querySelector<HTMLElement>('[role="tabpanel"]')!.hidden).toBe(true);
    const lease = fixture.operations.begin({ key: "proofread", kind: "proofread" });
    view.ownOperation(lease, "Proofread.md");
    expect(view.getState().activeTab).toBe("proofread");
    lease.finish();
  });

  it("discovers only on Actions and exports the checked file through the existing action", async () => {
    const fixture = createFixture();
    fixture.current.file = file("Source.md");
    vi.mocked(fixture.actions.getExportTargets).mockResolvedValue(["docx"]);
    const view = await fixture.open();
    expect(fixture.actions.getExportTargets).not.toHaveBeenCalled();
    button(view, "tab-actions").click();
    await vi.waitFor(() => expect(button(view, "export-docx")).not.toBeNull());
    expect(button(view, "export-xlsx")).toBeNull();
    button(view, "export-docx").click();
    expect(fixture.actions.exportFile).toHaveBeenCalledWith(fixture.current.file, "docx");
    const previous = button(view, "export-docx");
    fixture.current.file = file("Different.pdf");
    previous.click();
    expect(fixture.actions.exportFile).toHaveBeenCalledTimes(1);
    expect(root(view).querySelectorAll(".docwen-assistant-filename")[1].textContent).toContain("Different.pdf");
    await vi.waitFor(() => expect(fixture.actions.getExportTargets).toHaveBeenCalledTimes(2));
  });

  it("ignores late discovery after a file switch, hide or close and cancels its signal", async () => {
    const fixture = createFixture();
    fixture.current.file = file("First.md");
    let complete!: (targets: readonly ["docx"]) => void;
    vi.mocked(fixture.actions.getExportTargets).mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    const view = await fixture.open();
    button(view, "tab-actions").click();
    const firstSignal = vi.mocked(fixture.actions.getExportTargets).mock.calls[0][1];
    fixture.current.file = file("Second.pdf");
    view.refreshActiveFile();
    complete(["docx"]);
    await vi.waitFor(() => expect(root(view).textContent).toContain(t("sidebarNoExports")));
    expect(firstSignal.aborted).toBe(true);
    expect(button(view, "export-docx")).toBeNull();
    vi.mocked(fixture.actions.getExportTargets).mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    button(view, "refresh-exports").click();
    const hiddenSignal = vi.mocked(fixture.actions.getExportTargets).mock.calls.at(-1)![1];
    button(view, "tab-proofread").click();
    expect(hiddenSignal.aborted).toBe(true);
    complete(["docx"]);
    button(view, "tab-actions").click();
    const closedSignal = vi.mocked(fixture.actions.getExportTargets).mock.calls.at(-1)![1];
    await view.onClose();
    expect(closedSignal.aborted).toBe(true);
    complete(["docx"]);
    await Promise.resolve();
    expect(button(view, "export-docx")).toBeNull();
  });

  it.each(["ready", "failed", "pending"])("rediscovers the same file after replacing a %s connection", async (state) => {
    const fixture = createFixture();
    fixture.current.file = file("Source.md");
    const discover = vi.mocked(fixture.actions.getExportTargets);
    let complete: (() => void) | undefined;
    if (state === "ready") discover.mockResolvedValueOnce(["docx"]);
    if (state === "failed") discover.mockRejectedValueOnce(new Error("Old connection"));
    if (state === "pending") discover.mockImplementationOnce(() => new Promise(resolve => {
      complete = () => resolve(["docx"]);
    }));
    discover.mockResolvedValueOnce(["xlsx"]);
    const view = await fixture.open();
    button(view, "tab-actions").click();
    if (state === "ready") await vi.waitFor(() => expect(button(view, "export-docx")).not.toBeNull());
    if (state === "failed") await vi.waitFor(() => expect(button(view, "export-retry")).not.toBeNull());

    view.refreshActiveFile(true);
    await vi.waitFor(() => expect(button(view, "export-xlsx")).not.toBeNull());
    if (complete) {
      expect(discover.mock.calls[0][1].aborted).toBe(true);
      complete();
      await Promise.resolve();
    }
    expect(discover).toHaveBeenCalledTimes(2);
    expect(button(view, "export-xlsx")).not.toBeNull();
    expect(button(view, "export-docx")).toBeNull();
    expect(button(view, "export-retry")).toBeNull();
  });

  it("shows query failures with retry and details while GUI actions remain available", async () => {
    const fixture = createFixture();
    fixture.current.file = file("Source.md");
    const error = new Error("private backend details");
    let complete!: (targets: Array<"md" | "xlsx">) => void;
    vi.mocked(fixture.actions.getExportTargets).mockRejectedValueOnce(error)
      .mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    const view = await fixture.open();
    button(view, "tab-actions").click();
    await vi.waitFor(() => expect(button(view, "export-retry")).not.toBeNull());
    expect(root(view).textContent).toContain(t("contextMenuCapabilityUnavailable"));
    expect(root(view).textContent).not.toContain(t("sidebarNoExports"));
    expect(root(view).textContent).not.toContain(error.message);
    button(view, "export-details").click();
    expect(fixture.actions.showExportFailure).toHaveBeenCalledWith(error);
    button(view, "open-gui").click();
    expect(fixture.actions.openGui).toHaveBeenCalledOnce();
    button(view, "export-retry").focus();
    button(view, "export-retry").click();
    expect(document.activeElement).toBe(button(view, "refresh-exports"));
    button(view, "open-gui").focus();
    complete(["md", "xlsx"]);
    await vi.waitFor(() => expect(button(view, "export-md")).not.toBeNull());
    expect(document.activeElement).toBe(button(view, "open-gui"));
    button(view, "export-xlsx").click();
    expect(fixture.actions.exportFile).toHaveBeenCalledWith(fixture.current.file, "xlsx");
  });

  it("discards a rejected query when the host file changes before its event arrives", async () => {
    const fixture = createFixture();
    fixture.current.file = file("First.md");
    let reject!: (error: Error) => void;
    vi.mocked(fixture.actions.getExportTargets)
      .mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }))
      .mockResolvedValue(["xlsx"]);
    const view = await fixture.open();
    button(view, "tab-actions").click();
    fixture.current.file = file("Second.csv");
    reject(new Error("first file failed"));
    await vi.waitFor(() => expect(button(view, "export-xlsx")).not.toBeNull());
    expect(button(view, "export-retry")).toBeNull();
    expect(root(view).querySelectorAll(".docwen-assistant-filename")[1].textContent).toContain("Second.csv");
    button(view, "export-xlsx").click();
    expect(fixture.actions.exportFile).toHaveBeenCalledWith(fixture.current.file, "xlsx");
  });
});

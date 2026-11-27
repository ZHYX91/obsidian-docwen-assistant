import { FileSystemAdapter, TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { ActionRunner } from "../src/actions/action-runner";
import { ProofreadActions } from "../src/actions/proofread-actions";
import { registerCommands } from "../src/app/register-commands";
import { registerFileMenu } from "../src/app/register-file-menu";
import { AssistantView } from "../src/assistant-view";
import { AssistantSidebarClosedError, createAssistantSidebarOpener } from "../src/host/assistant-sidebar";
import { t } from "../src/i18n";
import { FakeMenu } from "./helpers/file-menu";
import { OperationCoordinator } from "../src/runtime/operation-coordinator";
import { DEFAULT_SETTINGS } from "../src/settings-model";
import { createAssistantViewActions, useObsidianDom } from "./helpers/obsidian-dom";

vi.mock("obsidian", async () => import("./helpers/obsidian-dom"));
vi.mock("../src/host/vault-read-snapshot", () => ({
  VaultReadSnapshot: class {
    async run(_file: unknown, _signal: AbortSignal, work: (snapshot: unknown) => Promise<unknown>) {
      return { value: await work({
        inputs: [{ path: "snapshot.md" }], proofreadSourceDigest: () => "a".repeat(64),
        publish: (commit: () => Promise<unknown>) => commit(),
      }), warnings: [] };
    }
  },
}));
useObsidianDom();

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

/** Start a refresh from one view while a second view is the first host leaf. */
async function pendingRefresh() {
  const operations = new OperationCoordinator();
  const file = Object.assign(new TFile(), { name: "B.md", path: "Notes/B.md" });
  const report = { issues: [], warnings: [] };
  const started = deferred<AbortSignal>();
  const validation = deferred<typeof report>();
  const reveal = deferred<void>();
  const validate = vi.fn().mockResolvedValue(report).mockImplementationOnce((_input, _checks, signal: AbortSignal) => {
    started.resolve(signal);
    return validation.promise;
  });
  const leaves: Array<{ view: AssistantView }> = [];
  const app = {
    vault: { getFileByPath: () => file, adapter: Object.assign(new FileSystemAdapter(), { getBasePath: () => "/vault" }) },
    workspace: { getLeavesOfType: () => leaves, getActiveFile: () => file, revealLeaf: () => reveal.promise },
  };
  const openSidebar = createAssistantSidebarOpener(app as never, operations, () => true);
  const runner = new ActionRunner(app as never, operations);
  const completion = vi.spyOn(runner, "presentCompletion").mockImplementation(() => {});
  const failure = vi.spyOn(runner, "presentFailure").mockImplementation(() => {});
  const actions = new ProofreadActions(app as never, { validate } as never,
    { requireAction: async () => ({ admittedFormat: { binding: "original" } }) } as never,
    () => ({ ...DEFAULT_SETTINGS, proofreadPunct: true }), runner, openSidebar);
  let pending!: Promise<void>;
  const makeView = () => new AssistantView({} as never, (path, target) =>
    (pending = actions.refresh(path, target)), operations, createAssistantViewActions());
  const observer = makeView();
  const owner = makeView();
  leaves.push({ view: observer }, { view: owner });
  await observer.onOpen();
  await owner.onOpen();
  observer.updateResults([], "A.md", "Notes/A.md", "b".repeat(64));
  owner.updateResults([], file.name, file.path, "c".repeat(64));
  const updates = vi.spyOn(owner, "updateResults");
  const observerUpdates = vi.spyOn(observer, "updateResults");
  owner.containerEl.querySelector<HTMLElement>(".docwen-proofread-btn")!.click();
  const signal = await Promise.race([
    started.promise, pending.then(() => { throw new Error("Refresh ended before validation."); }),
  ]);

  async function replace(view: AssistantView) {
    const replacement = makeView();
    const leaf = leaves.find(item => item.view === view)!;
    leaf.view = replacement;
    await replacement.onOpen();
    return vi.spyOn(replacement, "updateResults");
  }
  async function finish(cancelled: boolean) {
    expect(validate).toHaveBeenCalledOnce();
    expect(observer.containerEl.querySelector(".docwen-proofread-cancel")).toBeNull();
    expect(signal.aborted).toBe(cancelled);
    validation.resolve(report);
    await pending;
    expect(observerUpdates).not.toHaveBeenCalled();
    if (cancelled) {
      expect(updates).not.toHaveBeenCalled();
      expect(completion).not.toHaveBeenCalled();
    } else {
      expect(updates).toHaveBeenCalledWith([], file.name, file.path, "a".repeat(64));
      expect(completion).toHaveBeenCalledOnce();
    }
    expect(operations.getSnapshot().operations).toEqual([]);
  }
  return { actions, app, failure, file, finish, leaves, observer, openSidebar, operations, owner, replace, reveal };
}

type Fixture = Awaited<ReturnType<typeof pendingRefresh>>;

function invokeCommand({ actions, app }: Fixture) {
  let invoke!: (checking: boolean) => boolean;
  registerCommands({ app, proofreadActions: actions, activeFileSupports: () => true,
    addLocalizedCommand: (key: string, command: { checkCallback: typeof invoke }) => {
      if (key === "commandProofread") invoke = command.checkCallback;
    },
  } as never);
  expect(invoke(false)).toBe(true);
}

function invokeMenu({ actions, app, file }: Fixture, submenu = true) {
  let dispose!: () => void;
  let handler!: (menu: FakeMenu, file: TFile) => void;
  registerFileMenu({ app: { ...app, workspace: { ...app.workspace,
    on: (_event: string, callback: typeof handler) => { handler = callback; },
  } }, register: (callback: () => void) => { dispose = callback; }, registerEvent: () => {},
  } as never, { proofread: actions,
    capabilities: { peek: () => ({ inspection: { supportedActions: ["validate"] } }),
      supportsAction: (_capability: unknown, action: string) => action === "validate", findConversionRoute: () => null },
  } as never);
  const menu = new FakeMenu(submenu);
  handler(menu, file);
  const items = submenu ? menu.items[0].submenu!.items : menu.items;
  const name = submenu ? t("contextMenuProofread") : t("contextMenuSubmenuTitle") + ": " + t("contextMenuProofread");
  const item = items.find(entry => entry.title === name);
  expect(item?.disabled).toBe(false);
  item!.click!();
  return dispose;
}

describe("proofreading refresh ownership", () => {
  it.each(["keep open", "close observer", "run from closed observer"])("publishes only to the owner: %s", async change => {
    const f = await pendingRefresh();
    if (change !== "keep open") await f.observer.onClose();
    if (change === "run from closed observer") await f.actions.run(f.file, f.observer);
    await f.finish(false);
  });

  it.each(["close", "reopen", "replace", "unload"])("cancels the owner's refresh on %s", async change => {
    const f = await pendingRefresh();
    if (change === "unload") f.operations.cancelAll();
    else await f.owner.onClose();
    if (change === "reopen") await f.owner.onOpen();
    const otherUpdates = change === "replace" ? await f.replace(f.owner) : null;
    await f.finish(true);
    if (otherUpdates) expect(otherUpdates).not.toHaveBeenCalled();
  });

  it.each(["close", "reopen", "replace", "detach"])("rejects a superseded sidebar opening on %s", async change => {
    const f = await pendingRefresh();
    const activation = f.openSidebar().then(view => f.actions.run(f.file, view));
    if (change === "close" || change === "reopen") await f.observer.onClose();
    if (change === "reopen") await f.observer.onOpen();
    if (change === "replace") await f.replace(f.observer);
    if (change === "detach") f.leaves.shift();
    f.reveal.resolve();
    await expect(activation).rejects.toBeInstanceOf(AssistantSidebarClosedError);
    await f.finish(false);
  });

  describe.each([
    { entry: "command", invoke: invokeCommand },
    { entry: "file submenu", invoke: invokeMenu },
    { entry: "flat file menu", invoke: (fixture: Fixture) => invokeMenu(fixture, false) },
  ])("$entry", ({ invoke }) => {
    it.each(["close", "replace"] as const)("keeps the other refresh on %s, even if the host rejects reveal", async change => {
      const f = await pendingRefresh();
      const activated = vi.spyOn(f.actions, "activateAndRun");
      invoke(f);
      if (change === "close") await f.observer.onClose();
      else await f.replace(f.observer);
      f.reveal.reject(new Error("host reveal failed"));
      await activated.mock.results[0].value;
      expect(f.failure).not.toHaveBeenCalled();
      await f.finish(false);
    });

    it.each(["close", "replace", "open with reveal error"])("handles activation with the sidebar %s", async change => {
      const f = await pendingRefresh();
      const activated = vi.spyOn(f.actions, "activateAndRun");
      invoke(f);
      const error = new Error("host reveal failed");
      if (change === "open with reveal error") f.reveal.reject(error);
      else {
        if (change === "close") await f.observer.onClose();
        else await f.replace(f.observer);
        f.reveal.resolve();
      }
      expect(activated).toHaveBeenCalledOnce();
      await activated.mock.results[0].value;
      if (change === "open with reveal error") expect(f.failure).toHaveBeenCalledWith("noticeProofreadFailed", error);
      else expect(f.failure).not.toHaveBeenCalled();
      await f.finish(false);
    });
  });

  it.each(["resolve", "reject"])("ignores an expired file menu when reveal settles: %s", async outcome => {
    const f = await pendingRefresh();
    const activated = vi.spyOn(f.actions, "activateAndRun");
    const dispose = invokeMenu(f);
    dispose();
    if (outcome === "resolve") f.reveal.resolve();
    else f.reveal.reject(new Error("host reveal failed"));
    await activated.mock.results[0].value;
    expect(f.failure).not.toHaveBeenCalled();
    await f.finish(false);
  });
});

import { FakeMenu } from "./helpers/file-menu";
import { beforeEach, describe, expect, it, vi } from "vitest";

const menuState = vi.hoisted(() => ({
  target: null as null | { path: string },
  pickers: [] as Array<{ items: Array<{ id: string; label: string }>; choose: (item: { id: string }) => void }>,
  notices: [] as string[],
}));

vi.mock("obsidian", () => ({ Modal: class {} }));
vi.mock("../src/host/notices", () => ({ showNotice: (message: string) => menuState.notices.push(message) }));
vi.mock("../src/utils/suggest-modal", () => ({
  pickItem: (_app: unknown, items: Array<{ id: string; label: string }>, _placeholder: string, signal: AbortSignal) =>
    new Promise((resolve) => {
      const cancel = () => resolve(null);
      signal.addEventListener("abort", cancel, { once: true });
      menuState.pickers.push({ items, choose: (item) => {
        signal.removeEventListener("abort", cancel);
        resolve(item);
      } });
    }),
}));
vi.mock("../src/i18n", () => ({
  t: (key: string, values?: { path?: string }) => values?.path ? `${key}:${values.path}` : key,
}));
vi.mock("../src/host/vault-files", () => ({
  resolveTargetFile: (file: { path: string }) => menuState.target ?? file,
  resolveAbsoluteFilePath: (_vault: unknown, file: { path: string }) => `D:\\Vault\\${file.path.replaceAll("/", "\\")}`,
}));

describe("file menu capability states", () => {
  beforeEach(() => {
    menuState.target = null;
    menuState.pickers = [];
    menuState.notices = [];
  });

  it("shows a concise cached failure and opens its detailed error", async () => {
    const failure = new Error("Core discovery unavailable");
    const present = vi.fn();
    const preload = vi.fn().mockResolvedValue(undefined);
    const { handler } = await register({
      peek: () => failure,
      preload,
    }, present);
    const menu = new FakeMenu();

    handler(menu, { path: "note.md" });
    const submenu = menu.items[0].submenu!;
    const errorItem = submenu.items[0];

    expect(errorItem.title).toBe("contextMenuCapabilityUnavailable");
    expect(errorItem.title).not.toContain(failure.message);
    expect(preload).toHaveBeenCalledWith("D:\\Vault\\note.md");
    errorItem.click?.();
    expect(present).toHaveBeenCalledWith(failure);
    expectValidSections(submenu);
  });

  it("offers an actionable picker while capabilities are being preloaded", async () => {
    const preload = vi.fn().mockResolvedValue(undefined);
    const { handler } = await register({ peek: () => null, preload });
    const menu = new FakeMenu();

    handler(menu, { path: "note.md" });
    const submenu = menu.items[0].submenu!;

    expect(submenu.items.map(({ title }) => title)).toEqual([
      "contextMenuChooseAction",
      "contextMenuOpenInDocWen",
    ]);
    expect(submenu.items[0].disabled).toBe(false);
    expect(preload).toHaveBeenCalledOnce();
    expectValidSections(submenu);
  });

  it("opens loaded operations on the first menu without requiring the user to reopen it", async () => {
    let cached: unknown = null;
    let finish!: () => void;
    const loading = new Promise<void>((resolve) => { finish = resolve; });
    const { handler, actions, operations } = await register({
      peek: () => cached,
      preload: () => loading,
      findConversionRoute: (_capability: unknown, target: string) => target === "md" ? {} : null,
    });
    const snapshots: string[][] = [];
    operations.subscribe(({ operations: active }) => snapshots.push(active.map(({ kind }) => kind)));
    actions.exports.toMarkdown.mockImplementation(() => actions.runner.run(
      { key: "export:note.docx", kind: "export" }, "noticeExportFailed", async () => undefined,
    ));
    const menu = new FakeMenu();
    handler(menu, { path: "note.docx" });
    menu.items[0].submenu!.items[0].click?.();
    expect(menuState.pickers).toHaveLength(0);
    cached = { inspection: { supportedActions: ["convert"] } };
    finish();
    await vi.waitFor(() => expect(menuState.pickers).toHaveLength(1));
    expect(menuState.pickers[0].items.map((item) => item.label)).toEqual(["contextMenuConvertToMd"]);
    menuState.pickers[0].choose({ id: "0" });
    await vi.waitFor(() => expect(actions.exports.toMarkdown).toHaveBeenCalledWith({ path: "note.docx" }));
    expect(snapshots).toEqual([[], ["choose-action"], [], ["export"], []]);
  });

  it.each(["empty", "error", "unload"])("keeps %s capability outcomes from producing fallback operations", async (outcome) => {
    let cached: unknown = null;
    let finish!: () => void;
    const loading = new Promise<void>((resolve) => { finish = resolve; });
    const present = vi.fn();
    const { handler, dispose } = await register({
      peek: () => cached,
      preload: () => loading,
      findConversionRoute: () => null,
    }, present);
    const menu = new FakeMenu();
    handler(menu, { path: "note.docx" });
    menu.items[0].submenu!.items[0].click?.();
    cached = outcome === "error" ? new Error("Unavailable") : { inspection: { supportedActions: [] } };
    if (outcome === "unload") dispose();
    finish();
    await loading;
    await Promise.resolve();
    expect(menuState.pickers).toHaveLength(0);
    expect(present).toHaveBeenCalledTimes(outcome === "error" ? 1 : 0);
    expect(menuState.notices.includes("contextMenuNoActions")).toBe(outcome === "empty");
  });

  it("groups conversion, numbering and proofreading, then keeps Open last", async () => {
    const capability = {
      inspection: { supportedActions: ["convert", "number markdown", "validate"] },
      source: { routes: [
        { action: "number markdown", available: true },
        { action: "validate", available: true },
      ] },
    };
    const findConversionRoute = vi.fn((_capability: unknown, target: string) =>
      target === "xlsx" ? null : { target });
    const { handler, actions } = await register({
      peek: () => capability,
      preload: vi.fn(),
      findConversionRoute,
    });
    const menu = new FakeMenu();

    handler(menu, { path: "note.md" });
    const submenu = menu.items[0].submenu!;

    expect(submenu.items.map(({ title }) => title)).toEqual([
      "contextMenuConvertToMd",
      "contextMenuConvertToDocx",
      "contextMenuAddNumbering",
      "contextMenuRemoveNumbering",
      "contextMenuProofread",
      "contextMenuOpenInDocWen",
    ]);
    expect(submenu.entries.filter((entry) => entry === "separator")).toHaveLength(2);
    submenu.items[4].click?.();
    await Promise.resolve();
    expect(actions.proofread.activateAndRun).toHaveBeenCalledOnce();
    expect(actions.proofread.activateAndRun).toHaveBeenCalledWith({ path: "note.md" }, expect.any(Function));
    expectValidSections(submenu);
  });

  it.each(["submenu", "fallback", "picker"])("does not offer generic DOCX validation without a Machine route (%s)", async (surface) => {
    const capability = {
      inspection: { supportedActions: ["convert", "validate"] },
      source: { routes: [{ operation: "conversion", action: null, target: "md", available: true }] },
    };
    let loaded = surface !== "picker";
    const { handler } = await register({
      peek: () => loaded ? capability : null,
      preload: async () => { loaded = true; },
      findConversionRoute: (_capability: unknown, target: string) => target === "md" ? {} : null,
    });
    const menu = new FakeMenu(surface !== "fallback");
    handler(menu, { path: "note.docx" });
    if (surface === "picker") {
      menu.items[0].submenu!.items[0].click?.();
      await vi.waitFor(() => expect(menuState.pickers).toHaveLength(1));
      expect(menuState.pickers[0].items.map(({ label }) => label)).toEqual(["contextMenuConvertToMd"]);
      return;
    }
    const items = surface === "fallback" ? menu.items : menu.items[0].submenu!.items;
    expect(items.some(({ title }) => title.includes("contextMenuProofread"))).toBe(false);
    expect(items.some(({ title }) => title.includes("contextMenuConvertToMd"))).toBe(true);
    expect(items.some(({ title }) => title.includes("contextMenuOpenInDocWen"))).toBe(true);
  });

  it.each([true, false])("does not invoke cached menu actions after unload (submenu=%s)", async (submenu) => {
    const { handler, actions, dispose } = await register({
      peek: () => ({
        inspection: { supportedActions: ["convert", "number markdown", "validate"] },
        source: { routes: [
          { action: "number markdown", available: true },
          { action: "validate", available: true },
        ] },
      }),
      findConversionRoute: () => ({}),
    });
    const menu = new FakeMenu(submenu);
    handler(menu, { path: "note.md" });
    const items = submenu ? menu.items[0].submenu!.items : menu.items;
    dispose();
    for (const item of items) item.click?.();
    await Promise.resolve();
    expect(actions.exports.toDocx).not.toHaveBeenCalled();
    expect(actions.exports.toMarkdown).not.toHaveBeenCalled();
    expect(actions.exports.toXlsx).not.toHaveBeenCalled();
    expect(actions.numbering.add).not.toHaveBeenCalled();
    expect(actions.numbering.remove).not.toHaveBeenCalled();
    expect(actions.proofread.activateAndRun).not.toHaveBeenCalled();
    expect(actions.gui.open).not.toHaveBeenCalled();
  });

  it.each([true, false])("refuses a replaced file before the GUI opens its old path (submenu=%s)", async (submenu) => {
    const { handler, actions, files } = await register({ peek: () => null, preload: vi.fn() });
    const menu = new FakeMenu(submenu);
    const file = { path: "Planning.md" };
    handler(menu, file);
    files.set(file.path, { path: file.path });
    const items = submenu ? menu.items[0].submenu!.items : menu.items;
    items.find(item => item.title.includes("contextMenuOpenInDocWen"))!.click!();
    expect(actions.gui.open).not.toHaveBeenCalled();
    expect(menuState.notices).toContain("contextMenuTargetChanged");
  });

  it.each(["loading", "choosing"])("refuses a renamed target while %s", async (stage) => {
    let finish!: () => void;
    const loading = new Promise<void>(resolve => { finish = resolve; });
    let cached: unknown = null;
    const { handler, actions, files } = await register({
      peek: () => cached,
      preload: () => loading,
      findConversionRoute: (_capability: unknown, target: string) => target === "md" ? {} : null,
    });
    const menu = new FakeMenu();
    const file = { path: "Planning.docx" };
    handler(menu, file);
    menu.items[0].submenu!.items[0].click!();
    cached = { inspection: { supportedActions: ["convert"] } };
    if (stage === "choosing") {
      finish();
      await vi.waitFor(() => expect(menuState.pickers).toHaveLength(1));
    }
    files.delete(file.path);
    file.path = "Archive/Planning.docx";
    files.set(file.path, file);
    if (stage === "loading") finish();
    else menuState.pickers[0].choose({ id: "0" });
    await vi.waitFor(() => expect(menuState.notices).toContain("contextMenuTargetChanged"));
    expect(menuState.pickers).toHaveLength(stage === "loading" ? 0 : 1);
    expect(actions.exports.toMarkdown).not.toHaveBeenCalled();
  });

  it.each(["cancel", "replace", "unload"])("checks the selected action at handoff (%s)", async (change) => {
    let loaded = false;
    const { handler, actions, operations, files, dispose } = await register({
      peek: () => loaded ? { inspection: { supportedActions: ["convert"] } } : null,
      preload: async () => undefined,
      findConversionRoute: (_capability: unknown, target: string) => target === "md" ? {} : null,
    });
    const menu = new FakeMenu();
    const file = { path: "Draft.docx" };
    handler(menu, file);
    loaded = true;
    menu.items[0].submenu!.items[0].click!();
    await vi.waitFor(() => expect(menuState.pickers).toHaveLength(1));
    // Model a host change exactly when the chooser gives up the status bar.
    const unsubscribe = operations.subscribe(({ operations: active }) => {
      if (active.length > 0) return;
      unsubscribe();
      if (change === "replace") files.set(file.path, { ...file });
      if (change === "unload") dispose();
    });
    if (change === "cancel") operations.cancelAll();
    menuState.pickers[0].choose({ id: "0" });
    await vi.waitFor(() => expect(operations.hasPendingWork).toBe(false));
    expect(actions.exports.toMarkdown).not.toHaveBeenCalled();
    expect(menuState.notices.includes("contextMenuTargetChanged")).toBe(change === "replace");
  });

  it("labels the Markdown file inferred from a folder context", async () => {
    menuState.target = { path: "Project/Project.md" };
    const { handler } = await register({ peek: () => null, preload: vi.fn() });
    const menu = new FakeMenu();

    handler(menu, { path: "Project" });
    const submenu = menu.items[0].submenu!;

    expect(submenu.items[0]).toMatchObject({
      title: "contextMenuFolderTarget:Project/Project.md",
      disabled: true,
    });
    expectValidSections(submenu);
  });

  it("falls back to prefixed top-level actions when setSubmenu is unavailable", async () => {
    const capability = {
      inspection: { supportedActions: ["convert"] },
      source: { routes: [] },
    };
    const { handler } = await register({
      peek: () => capability,
      preload: vi.fn(),
      findConversionRoute: vi.fn((_capability: unknown, target: string) =>
        target === "md" ? { target } : null),
    });
    const menu = new FakeMenu(false);

    expect(() => handler(menu, { path: "note.docx" })).not.toThrow();
    expect(menu.items.map(({ title }) => title)).toEqual([
      "contextMenuSubmenuTitle: contextMenuOpenInDocWen",
      "contextMenuSubmenuTitle: contextMenuConvertToMd",
    ]);
    expect(menu.entries).not.toContain("separator");
  });
});

async function register(
  capabilities: Record<string, unknown>,
  presentCapabilityFailure = vi.fn(),
) {
  const { registerFileMenu } = await import("../src/app/register-file-menu");
  const { DocWenCapabilityService } = await import("../src/docwen/capability-service");
  let handler!: (menu: FakeMenu, file: { path: string }) => void;
  const files = new Map<string, { path: string }>();
  let dispose!: () => void;
  const { ActionRunner } = await import("../src/actions/action-runner");
  const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
  const operations = new OperationCoordinator();
  const plugin = {
    app: {
      workspace: {
        on: (_event: string, callback: typeof handler) => {
          handler = (menu, file) => {
            const target = menuState.target ?? file;
            files.set(target.path, target);
            callback(menu, file);
          };
          return {};
        },
      },
      vault: { getFileByPath: (path: string) => files.get(path) ?? null },
    },
    registerEvent: () => undefined,
    register: (cleanup: () => void) => { dispose = () => { operations.dispose(); cleanup(); }; },
  };
  const actions = {
    runner: new ActionRunner(plugin.app as never, operations),
    exports: {
      toMarkdown: vi.fn().mockResolvedValue(undefined),
      toDocx: vi.fn().mockResolvedValue(undefined),
      toXlsx: vi.fn().mockResolvedValue(undefined),
    },
    gui: { open: vi.fn().mockResolvedValue(undefined) },
    numbering: {
      add: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    proofread: {
      activateAndRun: vi.fn().mockResolvedValue(undefined),
    },
    capabilities: { supportsAction: DocWenCapabilityService.prototype.supportsAction, ...capabilities },
    presentCapabilityFailure,
  };
  registerFileMenu(plugin as never, actions as never);
  return { actions, handler, dispose, files, operations };
}

function expectValidSections(menu: FakeMenu): void {
  expect(menu.entries[0]).not.toBe("separator");
  expect(menu.entries.at(-1)).not.toBe("separator");
  for (let index = 1; index < menu.entries.length; ++index) {
    expect(menu.entries[index] === "separator" && menu.entries[index - 1] === "separator").toBe(false);
  }
}

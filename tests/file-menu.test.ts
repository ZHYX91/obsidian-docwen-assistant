import { beforeEach, describe, expect, it, vi } from "vitest";

const menuState = vi.hoisted(() => ({ target: null as null | { path: string } }));

vi.mock("obsidian", () => ({}));
vi.mock("../src/i18n", () => ({
  t: (key: string, values?: { path?: string }) => values?.path ? `${key}:${values.path}` : key,
}));
vi.mock("../src/host/vault-files", () => ({
  resolveTargetFile: (file: { path: string }) => menuState.target ?? file,
  resolveAbsoluteFilePath: (_vault: unknown, file: { path: string }) => `D:\\Vault\\${file.path.replaceAll("/", "\\")}`,
}));

class FakeItem {
  title = "";
  disabled = false;
  click: (() => void) | null = null;
  submenu: FakeMenu | null = null;

  setTitle(value: string): this {
    this.title = value;
    return this;
  }

  setIcon(): this {
    return this;
  }

  setDisabled(value: boolean): this {
    this.disabled = value;
    return this;
  }

  onClick(callback: () => void): this {
    this.click = callback;
    return this;
  }

  setSubmenu(): FakeMenu {
    this.submenu = new FakeMenu();
    return this.submenu;
  }
}

class FakeMenu {
  readonly entries: Array<FakeItem | "separator"> = [];

  constructor(private readonly supportsSubmenu = true) {}

  get items(): FakeItem[] {
    return this.entries.filter((entry): entry is FakeItem => entry !== "separator");
  }

  addItem(builder: (item: FakeItem) => void): void {
    const item = new FakeItem();
    if (!this.supportsSubmenu) {
      Object.defineProperty(item, "setSubmenu", { value: undefined });
    }
    this.entries.push(item);
    builder(item);
  }

  addSeparator(): void {
    this.entries.push("separator");
  }
}

describe("file menu capability states", () => {
  beforeEach(() => {
    menuState.target = null;
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

  it("shows a disabled loading state while capabilities are being preloaded", async () => {
    const preload = vi.fn().mockResolvedValue(undefined);
    const { handler } = await register({ peek: () => null, preload });
    const menu = new FakeMenu();

    handler(menu, { path: "note.md" });
    const submenu = menu.items[0].submenu!;

    expect(submenu.items.map(({ title }) => title)).toEqual([
      "contextMenuLoading",
      "contextMenuOpenInDocWen",
    ]);
    expect(submenu.items[0].disabled).toBe(true);
    expect(preload).toHaveBeenCalledOnce();
    expectValidSections(submenu);
  });

  it("groups conversion, numbering and proofreading, then keeps Open last", async () => {
    const capability = {
      inspection: { supportedActions: ["convert", "number markdown", "validate"] },
      source: { routes: [] },
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
    expect(actions.proofread.activateView).toHaveBeenCalledOnce();
    expect(actions.proofread.run).toHaveBeenCalledOnce();
    expectValidSections(submenu);
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
  let handler!: (menu: FakeMenu, file: { path: string }) => void;
  const plugin = {
    app: {
      workspace: {
        on: (_event: string, callback: typeof handler) => {
          handler = callback;
          return {};
        },
      },
      vault: {},
    },
    registerEvent: () => undefined,
  };
  const actions = {
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
      activateView: vi.fn().mockResolvedValue(undefined),
      run: vi.fn().mockResolvedValue(undefined),
    },
    capabilities,
    presentCapabilityFailure,
  };
  registerFileMenu(plugin as never, actions as never);
  return { actions, handler };
}

function expectValidSections(menu: FakeMenu): void {
  expect(menu.entries[0]).not.toBe("separator");
  expect(menu.entries.at(-1)).not.toBe("separator");
  for (let index = 1; index < menu.entries.length; ++index) {
    expect(menu.entries[index] === "separator" && menu.entries[index - 1] === "separator").toBe(false);
  }
}

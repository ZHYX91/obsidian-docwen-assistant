import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({}));
vi.mock("../src/i18n", () => ({
  t: (key: string, values?: { error?: string }) => values?.error ? `${key}:${values.error}` : key,
}));
vi.mock("../src/host/vault-files", () => ({
  resolveTargetFile: (file: unknown) => file,
  resolveAbsoluteFilePath: () => "D:\\Vault\\note.md",
}));

class FakeItem {
  title = "";
  click: (() => void) | null = null;
  submenu: FakeMenu | null = null;
  setTitle(value: string): this {
    this.title = value;
    return this;
  }
  setIcon(): this {
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
  readonly items: FakeItem[] = [];
  addItem(builder: (item: FakeItem) => void): void {
    const item = new FakeItem();
    this.items.push(item);
    builder(item);
  }
  addSeparator(): void {}
}

describe("file menu capability failures", () => {
  it("keeps a typed discovery failure visible and user-openable", async () => {
    const { registerFileMenu } = await import("../src/app/register-file-menu");
    let handler!: (menu: FakeMenu, file: unknown) => void;
    const failure = new Error("Core discovery unavailable");
    const present = vi.fn();
    const plugin = {
      app: {
        workspace: { on: (_event: string, callback: typeof handler) => {
          handler = callback;
          return {};
        } },
        vault: {},
      },
      registerEvent: () => undefined,
    };
    registerFileMenu(plugin as never, {
      exports: {} as never,
      gui: { open: vi.fn() } as never,
      numbering: {} as never,
      proofread: {} as never,
      capabilities: { peek: () => failure, preload: vi.fn() } as never,
      presentCapabilityFailure: present,
    });
    const menu = new FakeMenu();

    handler(menu, { path: "note.md" });
    const errorItem = menu.items[0].submenu?.items[0];

    expect(errorItem?.title).toBe("noticeCapabilityFailed:Core discovery unavailable");
    errorItem?.click?.();
    expect(present).toHaveBeenCalledWith(failure);
  });
});

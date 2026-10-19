import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { MarkdownView, TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { useObsidianDom } from "./helpers/obsidian-dom";

useObsidianDom();

vi.mock("../src/host/notices", () => ({ showNotice: vi.fn() }));
vi.mock("../src/utils/suggest-modal", () => ({ pickItem: vi.fn() }));
vi.mock("../src/host/vault-files", () => ({
  resolveTargetFile: (file: unknown) => file,
  resolveAbsoluteFilePath: () => "D:/Vault/Notes/B.md",
}));
vi.mock("../src/host/vault-read-snapshot", () => ({
  VaultReadSnapshot: class {
    async run(_file: unknown, _signal: AbortSignal, work: (snapshot: unknown) => Promise<unknown>) {
      return { value: await work({
        inputs: [{ path: "snapshot.md" }], contentSha256: "a".repeat(64),
        publish: async (commit: () => Promise<unknown>) => commit(),
      }), warnings: [] };
    }
  },
}));

vi.mock("obsidian", async () => import("./helpers/obsidian-dom"));

describe("ProofreadView", () => {
  it("opens through the host view lifecycle without shadowing its open method", async () => {
    const { ProofreadView } = await import("../src/proofread-view");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    const view = new ProofreadView({} as never, async () => {}, new OperationCoordinator());
    const hostView = view as unknown as { open(): Promise<void> };
    await hostView.open();
    expect(view.captureLifetime()()).toBe(true);
    expect(findByClass(view.containerEl.children[1] as HTMLElement,
      "docwen-proofread-toolbar")).toBeDefined();
    await view.onClose();
    expect(view.captureLifetime()()).toBe(false);
  });

  it.each([
    "keep-open", "close-observer", "close-owner", "reopen-owner", "replace-owner", "unload",
    "activate-close", "activate-reopen", "activate-replace", "activate-detach", "closed-before-run",
    "command-close", "command-replace", "command-error", "menu-close", "menu-replace", "menu-error", "menu-dispose",
    "menu-dispose-error",
  ])(
    "routes a second view's refresh and cancellation by ownership: %s", async (change) => {
      const { ProofreadView } = await import("../src/proofread-view");
      const { ProofreadActions } = await import("../src/actions/proofread-actions");
      const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
      const operations = new OperationCoordinator();
      const file = { name: "B.md", path: "Notes/B.md" };
      let complete!: (report: unknown) => void;
      let signal!: AbortSignal;
      const validate = vi.fn((_input, _checks, receivedSignal: AbortSignal) => {
        // Keep B pending, but let an unexpected second request settle so failures
        // report cancellation/publication errors rather than a test timeout.
        if (validate.mock.calls.length > 1) return Promise.resolve({ issues: [], warnings: [] });
        signal = receivedSignal;
        return new Promise((resolve) => { complete = resolve; });
      });
      const completion = vi.fn();
      const presentFailure = vi.fn();
      const runner = {
        presentCompletion: completion,
        presentFailure,
        run: async (request: Parameters<typeof operations.begin>[0], _notice: string,
          work: (lease: ReturnType<typeof operations.begin>) => Promise<unknown>) => {
          const lease = operations.begin(request);
          try { return await work(lease); } finally { lease.finish(); }
        },
      };
      const leaves: Array<{ view: InstanceType<typeof ProofreadView> }> = [];
      let reveal!: () => void;
      let rejectReveal!: (error: Error) => void;
      const app = {
        vault: { getFileByPath: () => file },
        workspace: {
          getLeavesOfType: () => leaves, getActiveFile: () => file,
          revealLeaf: () => new Promise<void>((resolve, reject) => { reveal = resolve; rejectReveal = reject; }),
        },
      };
      const actions = new ProofreadActions({
        ...app,
      } as never, { validate } as never, { requireAction: async () => ({}) } as never,
      () => ({} as never), runner as never);
      let pending: Promise<void> | undefined;
      const refresh = (path: string, target: InstanceType<typeof ProofreadView>) => {
        pending = actions.refresh(path, target);
        return pending;
      };
      const a = new ProofreadView({} as never, refresh, operations);
      const b = new ProofreadView({} as never, refresh, operations);
      leaves.push({ view: a }, { view: b });
      await a.onOpen();
      await b.onOpen();
      a.updateResults([], "A.md", "Notes/A.md", digest("A"));
      b.updateResults([], file.name, file.path, digest("old B"));
      const updateA = vi.spyOn(a, "updateResults");
      const updateB = vi.spyOn(b, "updateResults");
      findByClass(b.containerEl.children[1] as HTMLElement,
        "docwen-proofread-btn")?.click();
      await vi.waitFor(() => expect(validate).toHaveBeenCalledOnce());
      if (change.startsWith("command-") || change.startsWith("menu-")) {
        const activated = vi.spyOn(actions, "activateAndRun");
        let dispose = () => {};
        if (change.startsWith("command-")) {
          const { registerCommands } = await import("../src/app/register-commands");
          let invoke!: (checking: boolean) => boolean;
          registerCommands({ app, proofreadActions: actions, activeFileSupports: () => true,
            addLocalizedCommand: (key: string, command: { checkCallback: typeof invoke }) => {
              if (key === "commandProofread") invoke = command.checkCallback;
            },
          } as never);
          expect(invoke(false)).toBe(true);
        } else {
          const { registerFileMenu } = await import("../src/app/register-file-menu");
          let handler!: (menu: unknown, file: unknown) => void;
          let invoke!: () => void;
          registerFileMenu({ app: { ...app, workspace: { ...app.workspace,
            on: (_event: string, callback: typeof handler) => { handler = callback; },
          } }, register: (callback: () => void) => { dispose = callback; }, registerEvent: () => {},
          } as never, { proofread: actions,
            capabilities: { peek: () => ({ inspection: { supportedActions: ["validate"] } }),
              findConversionRoute: () => null },
          } as never);
          handler({ addItem: (build: (item: unknown) => void) => {
            let icon = "";
            const item = { setTitle: () => item, setIcon: (value: string) => { icon = value; return item; },
              onClick: (callback: () => void) => { if (icon === "check-circle") invoke = callback; return item; },
              setDisabled: () => item };
            build(item);
          } }, file);
          invoke();
        }
        expect(activated).toHaveBeenCalledOnce();
        const activation = activated.mock.results[0].value;
        if (change.endsWith("close")) await a.onClose();
        if (change.endsWith("replace")) {
          const newView = new ProofreadView({} as never, refresh, operations);
          await newView.onOpen();
          leaves[0].view = newView;
        }
        if (change.startsWith("menu-dispose")) dispose();
        const failure = new Error("host reveal failed");
        if (change.endsWith("error")) rejectReveal(failure);
        else reveal();
        await expect(activation).resolves.toBeUndefined();
        if (change.endsWith("error") && !change.startsWith("menu-dispose")) {
          expect(presentFailure).toHaveBeenCalledWith("noticeProofreadFailed", failure);
        } else expect(presentFailure).not.toHaveBeenCalled();
      }
      if (change.startsWith("activate-")) {
        const rejected = vi.fn();
        const activation = actions.activateView().then((view) => actions.run(file as never, view)).catch(rejected);
        if (change === "activate-close" || change === "activate-reopen") await a.onClose();
        if (change === "activate-reopen") await a.onOpen();
        if (change === "activate-replace") {
          const replacement = new ProofreadView({} as never, refresh, operations);
          await replacement.onOpen();
          leaves[0].view = replacement;
        }
        if (change === "activate-detach") leaves.shift();
        reveal();
        await activation;
        expect.soft(rejected).toHaveBeenCalledOnce();
      }
      if (change === "closed-before-run") {
        await a.onClose();
        await actions.run(file as never, a);
      }
      expect.soft(validate).toHaveBeenCalledOnce();
      expect.soft(findByClass(a.containerEl.children[1] as HTMLElement,
        "docwen-proofread-cancel")).toBeUndefined();
      if (change === "close-observer") await a.onClose();
      const cancelled = ["close-owner", "reopen-owner", "replace-owner", "unload"].includes(change);
      if (cancelled && change !== "unload") await b.onClose();
      if (change === "reopen-owner") await b.onOpen();
      const replacement = new ProofreadView({} as never, refresh, operations);
      const updateReplacement = vi.spyOn(replacement, "updateResults");
      if (change === "replace-owner") {
        leaves[1] = { view: replacement };
        await replacement.onOpen();
      }
      if (change === "unload") operations.cancelAll();
      expect.soft(signal.aborted).toBe(cancelled);
      complete({ issues: [], warnings: [] });
      await pending;
      expect.soft(updateA).not.toHaveBeenCalled();
      expect(updateReplacement).not.toHaveBeenCalled();
      if (cancelled) {
        expect(updateB).not.toHaveBeenCalled();
        expect(completion).not.toHaveBeenCalled();
      } else {
        expect(updateB).toHaveBeenCalledWith([], file.name, file.path, "a".repeat(64));
        expect(completion).toHaveBeenCalledOnce();
      }
      expect(operations.getSnapshot().operations).toEqual([]);
    },
  );

  it("passes the displayed source path when refreshing a detached view", async () => {
    const { ProofreadView } = await import("../src/proofread-view");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    const refresh = vi.fn().mockResolvedValue(undefined);
    const view = new ProofreadView({} as never, refresh, new OperationCoordinator());
    view.updateResults([], "Source.md", "Notes/Source.md", digest("source"));
    const content = view.containerEl.children[1] as HTMLElement;
    findByClass(content, "docwen-proofread-btn")?.click();
    expect(refresh).toHaveBeenCalledWith("Notes/Source.md", view);
  });

  it("cancels only its owned proofread generation when the view closes", async () => {
    const { ProofreadView } = await import("../src/proofread-view");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    const operations = new OperationCoordinator();
    const proofread = operations.begin({ key: "proofread", kind: "proofread" });
    const exportLease = operations.begin({ key: "export", kind: "export" });
    const view = new ProofreadView({} as never, async () => undefined, operations);
    await view.onOpen();
    view.ownOperation(proofread);
    expect((view.containerEl.children[1] as HTMLElement).classList)
      .toContain("docwen-proofread-root");
    await view.onClose();
    view.ownOperation(proofread);
    expect((view.containerEl.children[1] as HTMLElement).classList)
      .not.toContain("docwen-proofread-root");
    expect(proofread.signal.aborted).toBe(true);
    expect(exportLease.signal.aborted).toBe(false);
  });

  it("shows a keyboard-operable cancel control until the lease finishes", async () => {
    const { ProofreadView } = await import("../src/proofread-view");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    const operations = new OperationCoordinator();
    const view = new ProofreadView({} as never, async () => undefined, operations);
    await view.onOpen();
    const lease = operations.begin({ key: "proofread", kind: "proofread" });
    view.ownOperation(lease);

    let content = view.containerEl.children[1] as HTMLElement;
    let cancel = findByClass(content, "docwen-proofread-cancel");
    expect(cancel?.tagName.toLowerCase()).toBe("button");
    expect(cancel?.getAttribute("type")).toBe("button");
    expect(cancel?.hasAttribute("disabled")).toBe(false);
    cancel?.click();

    expect(lease.signal.aborted).toBe(true);
    content = view.containerEl.children[1] as HTMLElement;
    cancel = findByClass(content, "docwen-proofread-cancel");
    expect(cancel?.getAttribute("type")).toBe("button");
    expect(cancel?.hasAttribute("disabled")).toBe(true);
    expect(operations.getSnapshot().operations[0].state).toBe("cancelling");

    lease.finish();
    expect(findByClass(
      view.containerEl.children[1] as HTMLElement,
      "docwen-proofread-cancel",
    )).toBeUndefined();
  });

  it("renders issues as native keyboard-operable buttons", async () => {
    const { ProofreadView } = await import("../src/proofread-view");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    const view = new ProofreadView({} as never, async () => undefined, new OperationCoordinator());
    view.updateResults([{
      range: {
        start: { offset: 0, line: 0, column: 0 },
        end: { offset: 3, line: 0, column: 3 },
      },
      matched_text: "bad",
      rule_key: "typo",
      error_text: "bad",
      suggestion: "good",
      fix: { kind: "replace_text", replacement: "good", applicable: true },
      error_type: "spacing",
      source: "fixture",
      }], "Proofread.md", "Proofread.md", digest("bad"));

    const content = (view.containerEl.children[1] as HTMLElement);
    const issue = findByClass(content, "docwen-proofread-item");
    expect(issue?.tagName.toLowerCase()).toBe("button");
    expect(issue?.getAttribute("type")).toBe("button");
    expect(issue?.getAttribute("aria-label")).toBe("L1 Typo check: bad → good");
    const filename = findByClass(content, "docwen-proofread-filename");
    expect(filename?.textContent).toBe("Proofread.md");
    expect(filename?.getAttribute("title")).toBe("Proofread.md");
  });

  it("keeps cancellation distinct from previous successful results until a new result arrives", async () => {
    const { ProofreadView } = await import("../src/proofread-view");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    const operations = new OperationCoordinator();
    const view = new ProofreadView({} as never, async () => undefined, operations);
    await view.onOpen();
    view.updateResults([], "Proofread.md", "Proofread.md", digest(""));
    const lease = operations.begin({ key: "proofread", kind: "proofread" });
    view.ownOperation(lease);
    operations.cancelGeneration(lease.generation);
    lease.finish();
    const content = view.containerEl.children[1] as HTMLElement;
    expect(findByClass(content, "docwen-proofread-status")?.textContent)
      .toBe("Proofreading cancelled. Run it again to update the results.");
    const unrelated = operations.begin({ key: "export", kind: "export" });
    unrelated.finish();
    expect(findByClass(content, "docwen-proofread-status")?.textContent)
      .toBe("Proofreading cancelled. Run it again to update the results.");
    const retry = operations.begin({ key: "proofread", kind: "proofread" });
    view.ownOperation(retry);
    view.updateResults([], "Proofread.md", "Proofread.md", digest(""));
    retry.finish();
    expect(findByClass(content, "docwen-proofread-status")?.textContent).toBe("No issues found");
  });

  it("keeps controls visible while long issue content scrolls and wraps", () => {
    const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

    expect(css).toMatch(/\.docwen-proofread-root\s*\{[^}]*display:\s*flex;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s);
    expect(css).toMatch(/\.docwen-proofread-list\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/s);
    expect(css).toMatch(/button\.docwen-proofread-item\s*\{[^}]*height:\s*auto;[^}]*overflow-wrap:\s*anywhere;[^}]*white-space:\s*normal;/s);
    expect(css).not.toMatch(/\.docwen-proofread-error\s*\{[^}]*text-decoration:/s);
  });

  it("localizes unmatched-symbol diagnostics without offering their explanation as replacement text", async () => {
    const { ProofreadView } = await import("../src/proofread-view");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    const { initI18n } = await import("../src/i18n");
    initI18n("zh-cn");
    try {
      const view = new ProofreadView({} as never, async () => undefined, new OperationCoordinator());
      view.updateResults([{
        range: { start: { offset: 0, line: 0, column: 0 }, end: { offset: 1, line: 0, column: 1 } },
        matched_text: "（", error_text: "（", rule_key: "symbol_pair",
        suggestion: "Unmatched Symbol", error_type: "symbol", source: "pairing",
      }], "中文.md", "中文.md", digest("（"));
      const content = view.containerEl.children[1] as HTMLElement;
      expect(findByClass(content, "docwen-proofread-rule")?.textContent).toBe("符号缺少配对");
      expect(findByClass(content, "docwen-proofread-item")?.getAttribute("aria-label"))
        .toBe("L1 符号缺少配对: （");
      expect(findByClass(content, "docwen-proofread-suggestion")).toBeUndefined();
    } finally {
      initI18n("en");
    }
  });

  it("converts Unicode code-point columns to Obsidian UTF-16 columns", async () => {
    const { unicodeColumnToUtf16Column } = await import("../src/proofread-view");

    expect(unicodeColumnToUtf16Column("A😀é", 0)).toBe(0);
    expect(unicodeColumnToUtf16Column("A😀é", 2)).toBe(3);
    expect(unicodeColumnToUtf16Column("A😀é", 4)).toBe(5);
  });

  it("navigates the unchanged report source with Unicode-aware columns", async () => {
    const f = await navigationFixture();
    f.clickIssue();
    await vi.waitFor(() => expect(f.editor.setSelection).toHaveBeenCalledWith(
      { line: 0, ch: 3 }, { line: 0, ch: 6 },
    ));
    expect(f.editor.scrollIntoView).toHaveBeenCalledOnce();
  });

  it("rejects edited content even when the reported substring is unchanged", async () => {
    const f = await navigationFixture();
    f.content.value += " changed after proofreading";
    f.clickIssue();
    expect(f.openFile).not.toHaveBeenCalled();
    expect(f.editor.setSelection).not.toHaveBeenCalled();
    expect(findByClass(f.root, "docwen-proofread-status")?.textContent)
      .toBe("The note or editor has changed. Refresh proofreading before locating an issue.");
    expect(findByClass(f.root, "docwen-proofread-item")).toBeUndefined();
    f.publishCurrent();
    f.clickIssue();
    await vi.waitFor(() => expect(f.editor.setSelection).toHaveBeenCalledOnce());
  });

  it.each(["content", "file", "ambiguous", "view"])("rechecks %s after asynchronous file opening", async (change) => {
    const f = await navigationFixture();
    let resume!: () => void;
    f.openFile.mockImplementationOnce(() => new Promise<void>((resolve) => { resume = resolve; }));
    f.clickIssue();
    if (change === "content") f.content.value = "prefix " + f.content.value;
    else if (change === "file") f.currentFile.value = Object.assign(new TFile(), { path: "Proofread.md" });
    else if (change === "ambiguous") f.leaves.push({ ...f.leaf });
    else f.leaf.view = Object.assign(new MarkdownView({} as never), { file: f.currentFile.value, editor: f.editor });
    resume();
    await vi.waitFor(() => expect(findByClass(f.root, "docwen-proofread-status")?.textContent)
      .toBe("The note or editor has changed. Refresh proofreading before locating an issue."));
    expect(f.editor.setSelection).not.toHaveBeenCalled();
  });

  it.each(["new-report", "close", "operation"])("does not navigate an obsolete callback after %s", async (change) => {
    const f = await navigationFixture();
    let resume!: () => void;
    f.openFile.mockImplementationOnce(() => new Promise<void>((resolve) => { resume = resolve; }));
    f.clickIssue();
    if (change === "new-report") f.publishCurrent();
    else if (change === "close") await f.view.onClose();
    else {
      const lease = f.operations.begin({ key: "proofread", kind: "proofread" });
      f.view.ownOperation(lease);
      lease.finish();
    }
    resume();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(f.editor.setSelection).not.toHaveBeenCalled();
  });

  it("contains file-open failure and asks to refresh instead of using another editor", async () => {
    const f = await navigationFixture();
    f.openFile.mockRejectedValueOnce(new Error("host file open failed"));
    f.clickIssue();
    await vi.waitFor(() => expect(findByClass(f.root, "docwen-proofread-status")?.textContent)
      .toBe("The note or editor has changed. Refresh proofreading before locating an issue."));
    expect(f.editor.setSelection).not.toHaveBeenCalled();
  });

  it("ignores a detached issue button after a newer report replaces it", async () => {
    const f = await navigationFixture();
    const oldClick = findByClass(f.root, "docwen-proofread-item");
    f.publishCurrent();
    oldClick?.click();
    expect(f.openFile).not.toHaveBeenCalled();
    expect(f.editor.setSelection).not.toHaveBeenCalled();
  });
});

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function navigationFixture() {
  const { ProofreadView } = await import("../src/proofread-view");
  const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
  const operations = new OperationCoordinator();
  const view = new ProofreadView({} as never, async () => undefined, operations);
  const content = { value: "A😀bad" };
  const currentFile = { value: Object.assign(new TFile(), { path: "Proofread.md" }) };
  const editor = {
    getValue: () => content.value,
    getLine: () => content.value,
    setSelection: vi.fn(),
    scrollIntoView: vi.fn(),
  };
  const openFile = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const leaf = { view: Object.assign(new MarkdownView({} as never), { file: currentFile.value, editor }), openFile };
  const leaves = [leaf];
  Object.assign(view.app.vault, { getAbstractFileByPath: () => currentFile.value });
  Object.assign(view.app.workspace, { getLeavesOfType: () => leaves, getLeaf: () => leaf });
  await view.onOpen();
  const publishCurrent = () => view.updateResults([{
    range: { start: { offset: 2, line: 0, column: 2 }, end: { offset: 5, line: 0, column: 5 } },
    matched_text: "bad", error_text: "bad", rule_key: "typo", suggestion: "good",
    error_type: "typo", source: "fixture",
  }], "Proofread.md", "Proofread.md", digest(content.value));
  publishCurrent();
  const root = view.containerEl.children[1] as HTMLElement;
  const clickIssue = () => {
    const item = findByClass(root, "docwen-proofread-item");
    expect(item).toBeDefined();
    item?.click();
  };
  return { view, operations, content, currentFile, editor, leaf, leaves, root, openFile, publishCurrent, clickIssue };
}

function findByClass(root: HTMLElement, className: string): HTMLElement | undefined {
  return root.querySelector<HTMLElement>(`.${className}`) ?? undefined;
}

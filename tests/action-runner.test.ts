import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  copied: [] as string[],
  modals: [] as Array<{ contentEl: FakeElement; titleEl: FakeElement }>,
  notices: [] as string[],
}));

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly listeners = new Map<string, () => void>();
  text = "";
  href = "";
  target = "";
  rel = "";

  createEl(_tag: string, options: { text?: string } = {}): FakeElement {
    const child = new FakeElement();
    child.text = options.text ?? "";
    this.children.push(child);
    return child;
  }

  createDiv(): FakeElement {
    return this.createEl("div");
  }

  addEventListener(name: string, listener: () => void): void {
    this.listeners.set(name, listener);
  }

  setText(value: string): void {
    this.text = value;
  }

  empty(): void {
    this.children.length = 0;
  }
}

vi.mock("obsidian", () => ({
  Modal: class Modal {
    readonly titleEl = new FakeElement();
    readonly contentEl = new FakeElement();
    constructor(_app: unknown) {}
    open(): void {
      state.modals.push(this);
      (this as { onOpen?: () => void }).onOpen?.();
    }
    close(): void {
      (this as { onClose?: () => void }).onClose?.();
    }
  },
}));
vi.mock("../src/host/notices", () => ({ showNotice: (message: string) => state.notices.push(message) }));
vi.mock("../src/host/clipboard", () => ({
  copyTextToClipboard: async (text: string) => {
    state.copied.push(text);
    return true;
  },
}));

describe("ActionRunner", () => {
  it("keeps failure details user-initiated instead of overwriting the clipboard", async () => {
    const { LocalCliError } = await import("../src/docwen");
    const { ActionRunner } = await import("../src/actions/action-runner");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    state.copied.length = 0;
    state.modals.length = 0;
    state.notices.length = 0;
    const runner = new ActionRunner({} as never, new OperationCoordinator());

    runner.presentFailure(
      "noticeDoctorFailed",
      new LocalCliError("cli_invalid_envelope", "Invalid response", { reason: "bad" }),
    );

    expect(state.notices).toHaveLength(1);
    expect(state.copied).toHaveLength(0);
    const button = state.modals[0].contentEl.children.at(-1);
    button?.listeners.get("click")?.();
    await vi.waitFor(() => expect(state.copied).toHaveLength(1));
    expect(button?.text).toBe("Copied");
  });

  it("suppresses user-facing failures for cancelled operations", async () => {
    const { LocalCliError } = await import("../src/docwen");
    const { ActionRunner } = await import("../src/actions/action-runner");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    state.notices.length = 0;
    const runner = new ActionRunner({} as never, new OperationCoordinator());

    await runner.run({ key: "proofread", kind: "proofread" }, "noticeProofreadFailed", async () => {
      throw new LocalCliError("cli_cancelled", "closed");
    });

    expect(state.notices).toHaveLength(0);
  });

  it("surfaces cleanup failures even when cancellation was the primary outcome", async () => {
    const { LocalCliError } = await import("../src/docwen");
    const { ActionRunner } = await import("../src/actions/action-runner");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    state.modals.length = 0;
    state.notices.length = 0;
    const runner = new ActionRunner({} as never, new OperationCoordinator());

    await runner.run({ key: "proofread", kind: "proofread" }, "noticeProofreadFailed", async () => {
      throw new LocalCliError("cli_cleanup_failed", "Temporary cleanup failed", {
        primaryCode: "cli_cancelled",
      });
    });

    expect(state.notices).toHaveLength(1);
    expect(state.modals).toHaveLength(1);
  });

  it("turns missing configuration into settings and download actions", async () => {
    const { LocalCliError } = await import("../src/docwen");
    const { ActionRunner } = await import("../src/actions/action-runner");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    state.modals.length = 0;
    state.notices.length = 0;
    const openSettings = vi.fn();
    const runner = new ActionRunner({} as never, new OperationCoordinator(), openSettings);

    runner.presentFailure(
      "noticeLaunchFailed",
      new LocalCliError("cli_path_not_configured", "DocWen location is not configured."),
    );

    expect(state.notices).toHaveLength(0);
    expect(state.modals).toHaveLength(1);
    expect(allText(state.modals[0].contentEl)).not.toContain("{}");
    const button = findByText(state.modals[0].contentEl, "Open DocWen settings");
    expect(button).toBeDefined();
    button?.listeners.get("click")?.();
    expect(openSettings).toHaveBeenCalledOnce();
  });

  it("does not open a details modal for an empty details object", async () => {
    const { LocalCliError } = await import("../src/docwen");
    const { ActionRunner } = await import("../src/actions/action-runner");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    state.modals.length = 0;
    state.notices.length = 0;
    const runner = new ActionRunner({} as never, new OperationCoordinator());

    runner.presentFailure(
      "noticeDoctorFailed",
      new LocalCliError("cli_invalid_envelope", "Invalid response"),
    );

    expect(state.notices).toHaveLength(1);
    expect(state.modals).toHaveLength(0);
  });
});

function allText(element: FakeElement): string {
  return [element.text, ...element.children.map(allText)].join(" ");
}

function findByText(element: FakeElement, value: string): FakeElement | undefined {
  if (element.text === value) return element;
  for (const child of element.children) {
    const match = findByText(child, value);
    if (match) return match;
  }
  return undefined;
}

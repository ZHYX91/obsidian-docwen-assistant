import { beforeEach, describe, expect, it, vi } from "vitest";
import { initI18n } from "../src/i18n";

const state = vi.hoisted(() => ({
  copied: [] as string[],
  modals: [] as Array<{ contentEl: FakeElement; titleEl: FakeElement }>,
  notices: [] as string[],
  noticeActions: [] as Array<() => void>,
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
vi.mock("../src/host/notices", () => ({
  showNotice: (message: string) => state.notices.push(message),
  showNoticeWithAction: (message: string, _label: string, selected: () => void) => {
    state.notices.push(message);
    state.noticeActions.push(selected);
  },
}));
vi.mock("../src/host/clipboard", () => ({
  copyTextToClipboard: async (text: string) => {
    state.copied.push(text);
    return true;
  },
}));

describe("ActionRunner", () => {
  beforeEach(() => {
    initI18n("en");
    state.copied.length = 0;
    state.modals.length = 0;
    state.notices.length = 0;
    state.noticeActions.length = 0;
  });

  it("offers warning details and copying only when requested", async () => {
    const { ActionRunner } = await import("../src/actions/action-runner");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    const runner = new ActionRunner({} as never, new OperationCoordinator());
    runner.presentCompletion("Exported result.md", [{ code: "output_cleanup_failed", phase: "cleanup", detailCode: "EACCES" }]);
    expect(state.notices).toHaveLength(1);
    expect(state.notices[0]).toContain("Exported result.md");
    expect(state.notices[0]).toContain("result is available");
    expect(state.modals).toHaveLength(0);
    expect(state.copied).toHaveLength(0);
    state.noticeActions[0]();
    expect(state.modals).toHaveLength(1);
    expect(allText(state.modals[0].contentEl)).toContain("completed_with_warnings");
    state.modals[0].contentEl.children.at(-1)?.listeners.get("click")?.();
    await vi.waitFor(() => expect(state.copied).toHaveLength(1));
    expect(JSON.parse(state.copied[0])).toMatchObject({ warnings: [{ detailCode: "EACCES" }] });
  });

  it("shows cleanup warnings on cancellation without claiming a result exists", async () => {
    const { LocalCliError } = await import("../src/docwen");
    const { recordFailureWarning } = await import("../src/docwen/operation-outcome");
    const { ActionRunner } = await import("../src/actions/action-runner");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    const runner = new ActionRunner({} as never, new OperationCoordinator());
    await runner.run({ key: "proofread", kind: "proofread" }, "noticeProofreadFailed", async () => {
      throw recordFailureWarning(new LocalCliError("cli_cancelled", "cancelled"), {
        code: "input_cleanup_failed", phase: "cleanup", detailCode: "EACCES",
      });
    });
    expect(state.notices).toHaveLength(1);
    expect(state.notices[0]).toContain("Temporary data cleanup");
    expect(state.notices[0]).not.toContain("result is available");
    state.noticeActions[0]();
    expect(allText(state.modals[0].contentEl)).toContain('"status": "cancelled"');
  });

  it("localizes incompatible-version failures while preserving their technical identity", async () => {
    const { LocalCliError } = await import("../src/docwen");
    const { ActionRunner } = await import("../src/actions/action-runner");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    initI18n("zh-cn");
    state.modals.length = 0;
    state.notices.length = 0;
    const runner = new ActionRunner({} as never, new OperationCoordinator());
    runner.presentFailure("noticeDoctorFailed", new LocalCliError(
      "cli_incompatible_version", "A stable DocWen 0.10.x version is required.",
      { actualProductVersion: "0.9.0" },
    ));
    expect(state.notices).toHaveLength(0);
    expect(state.modals).toHaveLength(1);
    expect(state.modals[0].contentEl.children[0].text).toContain("版本不兼容");
    expect(allText(state.modals[0].contentEl)).toContain("cli_incompatible_version");
    expect(allText(state.modals[0].contentEl)).toContain("0.9.0");
  });

  it("identifies an unconfirmed write and does not suggest automatic retry", async () => {
    const { ActionRunner } = await import("../src/actions/action-runner");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    const { VaultWriteError } = await import("../src/host/vault-write-transaction");
    new ActionRunner({} as never, new OperationCoordinator()).presentFailure("noticeNumberingFailed",
      new VaultWriteError("vault_reconciliation_failed", "write result unknown", { outputState: "unconfirmed" }));
    expect(state.modals).toHaveLength(1);
    expect(allText(state.modals[0].contentEl)).toContain("Check the destination before running again");
  });

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

    expect(state.notices).toHaveLength(0);
    expect(state.modals).toHaveLength(1);
    expect(state.copied).toHaveLength(0);
    const button = state.modals[0].contentEl.children.at(-1);
    button?.listeners.get("click")?.();
    await vi.waitFor(() => expect(state.copied).toHaveLength(1));
    expect(button?.text).toBe("Copied");
  });

  it("uses one redacted snapshot for preview and copying without serializing private details", async () => {
    const { LocalCliError } = await import("../src/docwen");
    const { ActionRunner } = await import("../src/actions/action-runner");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    const secret = "private-note token-example /home/user/notes/private.md";
    const details: Record<string, unknown> = {
      outputState: "unconfirmed", actualProductVersion: "0.11.0", expectedProductVersion: "0.12.0",
      exitCode: 7, timeoutMs: 2500, primaryCode: "cli_cancelled",
      path: "C:\\private\\note.md", stdout: secret, stderr: secret,
      cause: secret, config: { password: secret }, command: ["DocWenCLI", secret],
    };
    details.cycle = details;
    Object.defineProperty(details, "maxBytes", { get: () => { throw new Error(secret); } });
    new ActionRunner({} as never, new OperationCoordinator()).presentFailure(
      "noticeDoctorFailed", new LocalCliError("cli_protocol_error", secret, details),
    );
    expect(state.modals).toHaveLength(1);
    const preview = allText(state.modals[0].contentEl);
    expect(preview).not.toContain(secret);
    expect(preview).not.toContain("private");
    expect(preview).toContain("local paths and credentials are omitted");
    expect(state.copied).toHaveLength(0);
    state.modals[0].contentEl.children.at(-1)?.listeners.get("click")?.();
    await vi.waitFor(() => expect(state.copied).toHaveLength(1));
    const copied = JSON.parse(state.copied[0]);
    expect(copied).toMatchObject({ redacted: true, code: "cli_protocol_error", details: {
      outputState: "unconfirmed", actualProductVersion: "0.11.0", expectedProductVersion: "0.12.0",
      exitCode: 7, timeoutMs: 2500, primaryCode: "cli_cancelled",
    } });
    expect(Object.keys(copied.details)).toHaveLength(6);
    expect(state.copied[0]).not.toContain(secret);
    expect(details.cause).toBe(secret);
  });

  it("offers diagnostics for ordinary failures from the existing notice", async () => {
    const { LocalCliError } = await import("../src/docwen");
    const { ActionRunner } = await import("../src/actions/action-runner");
    const { OperationCoordinator } = await import("../src/runtime/operation-coordinator");
    new ActionRunner({} as never, new OperationCoordinator()).presentFailure(
      "noticeExportFailed", new LocalCliError("cli_input_invalid", "private document contents"),
    );
    expect(state.notices).toHaveLength(1);
    expect(state.modals).toHaveLength(0);
    state.noticeActions[0]();
    expect(state.modals).toHaveLength(1);
    expect(allText(state.modals[0].contentEl)).toContain("cli_input_invalid");
    expect(allText(state.modals[0].contentEl)).not.toContain("private document contents");
  });

  it("does not stringify unknown thrown values", async () => {
    const { getErrorDiagnostics } = await import("../src/actions/action-errors");
    const throwing = { toString: () => { throw new Error("must not serialize"); } };
    expect(getErrorDiagnostics(throwing)).toMatchObject({ code: "", redacted: true, details: {} });
    expect(JSON.stringify(getErrorDiagnostics("private note text"))).not.toContain("private note text");
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

    expect(state.notices).toHaveLength(0);
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

    state.modals.length = 0;
    runner.presentFailure(
      "noticeLaunchFailed",
      new LocalCliError("cli_alias_not_found", "DocWen alias is unavailable."),
    );
    expect(state.modals).toHaveLength(1);
    expect(allText(state.modals[0].contentEl)).toContain("Microsoft Store");
    expect(allText(state.modals[0].contentEl)).toContain("portable ZIP");
  });

  it("preserves the error code and localized summary without raw exception text", async () => {
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

    expect(state.notices).toHaveLength(0);
    expect(state.modals).toHaveLength(1);
    expect(allText(state.modals[0].contentEl)).toContain("cli_invalid_envelope");
    expect(allText(state.modals[0].contentEl)).not.toContain("Invalid response");
    expect(allText(state.modals[0].contentEl)).toContain("cli_invalid_envelope");
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

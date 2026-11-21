import type { TFile } from "obsidian";
import { t } from "./i18n";
import { preserveViewState } from "./settings-view-state";

export type AssistantExportTarget = "docx" | "xlsx" | "md";

export interface AssistantExportActions {
  getExportTargets(file: TFile, signal: AbortSignal): Promise<readonly AssistantExportTarget[]>;
  exportFile(file: TFile, target: AssistantExportTarget): Promise<void>;
  showExportFailure(error: unknown): void;
}

const labels = {
  docx: "sidebarExportDocx", xlsx: "sidebarExportXlsx", md: "sidebarExportMarkdown",
} as const;

/** Discovery belongs to the visible Actions panel; conversion remains an explicit file action. */
export class AssistantExports {
  private container: HTMLElement | null = null;
  private file: TFile | null = null;
  private signature = "";
  private enabled = false;
  private request: AbortController | null = null;
  private targets: readonly AssistantExportTarget[] | null = null;
  private failure: { error: unknown } | null = null;

  constructor(
    private readonly actions: AssistantExportActions,
    private readonly getFile: () => TFile | null,
    private readonly refreshContext: () => void,
  ) {}

  mount(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  dispose(): void {
    this.request?.abort();
    this.request = null;
    this.container = null;
    this.file = null;
    this.signature = "";
    this.targets = null;
    this.failure = null;
    this.enabled = false;
  }

  refresh(file: TFile | null, enabled: boolean, connectionChanged = false): void {
    const signature = fileSignature(file);
    const changed = connectionChanged || file !== this.file || signature !== this.signature;
    this.enabled = enabled;
    if (changed || !enabled) {
      this.request?.abort();
      this.request = null;
    }
    if (changed) {
      this.file = file;
      this.signature = signature;
      this.targets = null;
      this.failure = null;
    }
    if (changed) this.render();
    if (enabled && file && !this.request && this.targets === null && !this.failure) {
      void this.discover(file, signature);
    }
  }

  reload(): void {
    this.request?.abort();
    this.request = null;
    this.targets = null;
    this.failure = null;
    this.refreshContext();
  }

  private async discover(file: TFile, signature: string): Promise<void> {
    const request = new AbortController();
    this.request = request;
    this.render();
    try {
      const targets = await this.actions.getExportTargets(file, request.signal);
      if (request.signal.aborted || this.request !== request) return;
      if (this.getFile() !== file || fileSignature(file) !== signature) {
        this.refreshContext();
        return;
      }
      this.targets = targets;
    } catch (error) {
      if (request.signal.aborted || this.request !== request) return;
      if (this.getFile() !== file || fileSignature(file) !== signature) {
        this.refreshContext();
        return;
      }
      this.failure = { error };
    } finally {
      if (this.request === request) {
        this.request = null;
        this.render();
      }
    }
  }

  private render(): void {
    const container = this.container;
    if (!container) return;
    preserveViewState(container, () => {
      container.empty();
      container.setAttribute("aria-busy", String(this.request !== null));
      const status = (text: string): void => {
        container.createEl("p", { text, cls: "docwen-assistant-hint", attr: { role: "status" } });
      };
      const button = (text: string, key: string, action: () => void): void => {
        const control = container.createEl("button", {
          text, cls: "docwen-assistant-action",
          attr: { type: "button", "data-docwen-view-key": key },
        });
        control.addEventListener("click", () => {
          if (this.enabled && this.container === container && control.isConnected) action();
        });
      };
      if (!this.file) return;
      if (this.request) { status(t("contextMenuLoading")); return; }
      if (this.failure) {
        status(t("contextMenuCapabilityUnavailable"));
        const error = this.failure.error;
        button(t("settingsRetry"), "export-retry", () => this.reload());
        button(t("dialogDetails"), "export-details", () => this.actions.showExportFailure(error));
        return;
      }
      if (this.targets === null) return;
      if (this.targets.length === 0) { status(t("sidebarNoExports")); return; }
      const file = this.file;
      const signature = this.signature;
      for (const target of this.targets) {
        button(t(labels[target]), `export-${target}`, () => {
          const current = this.getFile();
          if (current !== file || fileSignature(current) !== signature) {
            this.refreshContext();
            return;
          }
          void this.actions.exportFile(current, target);
        });
      }
    }, "data-docwen-view-key");
  }
}

function fileSignature(file: TFile | null): string {
  return file ? `${file.path}:${file.stat?.mtime}:${file.stat?.size}` : "";
}

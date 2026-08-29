import { type App, Modal } from "obsidian";

import { DOCWEN_PRODUCT_NAME, DOCWEN_RELEASES_URL, DOCWEN_STORE_URL } from "../docwen/links";
import { copyTextToClipboard } from "../host/clipboard";
import { showNotice } from "../host/notices";
import { t, type Translations } from "../i18n";
import {
  OperationCoordinator,
  type OperationLease,
  type OperationRequest,
} from "../runtime/operation-coordinator";
import { getErrorDetails, getErrorMessage, getLocalErrorCode, isCancellationError } from "./action-errors";

type FailureNoticeKey = {
  [K in keyof Translations]: K extends `notice${string}Failed` ? K : never;
}[keyof Translations];

export class ActionRunner {
  constructor(
    private readonly app: App,
    private readonly operations: OperationCoordinator,
    private readonly openSettings: (() => void) | null = null,
  ) {}

  async run<T>(
    operation: OperationRequest,
    failureNotice: FailureNoticeKey,
    work: (lease: OperationLease) => Promise<T>,
  ): Promise<T | undefined> {
    const lease = this.operations.begin(operation);
    try {
      const result = await work(lease);
      return lease.isCurrent() ? result : undefined;
    } catch (error) {
      if (!isCancellationError(error)) this.presentFailure(failureNotice, error);
      return undefined;
    } finally {
      lease.finish();
    }
  }

  presentFailure(failureNotice: FailureNoticeKey, error: unknown): void {
    if ([
      "cli_path_not_configured",
      "cli_alias_not_found",
      "cli_platform_unsupported",
      "cli_not_found",
      "cli_not_file",
      "cli_not_executable",
      "cli_wrong_filename",
    ].includes(getLocalErrorCode(error) ?? "")) {
      new DocWenSetupModal(this.app, this.openSettings).open();
      return;
    }
    const summary = getErrorMessage(error);
    showNotice(t(failureNotice, { error: summary }));
    const detailsText = serializeErrorDetails(getErrorDetails(error));
    if (detailsText !== null) new FailureDetailsModal(this.app, summary, detailsText).open();
  }
}

class DocWenSetupModal extends Modal {
  constructor(app: App, private readonly openSettings: (() => void) | null) {
    super(app);
  }

  override onOpen(): void {
    this.titleEl.setText(t("dialogDocWenSetupTitle"));
    this.contentEl.createEl("p", { text: t("settingsDownloadDocWenDesc") });
    this.contentEl.createEl("p", { text: t("settingsConnectionModeDesc") });
    const actions = this.contentEl.createDiv({ cls: "docwen-modal-actions" });
    const settingsButton = actions.createEl("button", {
      text: t("dialogOpenSettings"),
      cls: "mod-cta",
      attr: { type: "button" },
    });
    settingsButton.addEventListener("click", () => {
      this.close();
      this.openSettings?.();
    });
    if (process.platform === "win32") {
      const storeLink = actions.createEl("a", { text: t("settingsGetFromStore") });
      storeLink.href = DOCWEN_STORE_URL;
      storeLink.target = "_blank";
      storeLink.rel = "noopener noreferrer";
    }
    const releasesLink = actions.createEl("a", { text: t("settingsDownloadPortable") });
    releasesLink.href = DOCWEN_RELEASES_URL;
    releasesLink.target = "_blank";
    releasesLink.rel = "noopener noreferrer";
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}

class FailureDetailsModal extends Modal {
  constructor(
    app: App,
    private readonly summary: string,
    private readonly detailsText: string,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.titleEl.setText(DOCWEN_PRODUCT_NAME);
    this.contentEl.createEl("p", { text: this.summary });
    this.contentEl.createEl("pre", { text: this.detailsText });
    const copy = this.contentEl.createEl("button", {
      text: t("dialogCopyDetails"),
      cls: "mod-cta",
      attr: { type: "button" },
    });
    copy.addEventListener("click", () => {
      void copyTextToClipboard(this.detailsText).then((copied) => {
        if (copied) copy.setText(t("dialogCopied"));
      });
    });
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}

function serializeErrorDetails(details: unknown): string | null {
  if (details === null || details === undefined) return null;
  const text = JSON.stringify(details, null, 2);
  if (!text || text === "{}" || text === "[]") return null;
  return text;
}

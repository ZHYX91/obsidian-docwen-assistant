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
import { getErrorDiagnostics, getErrorMessage, getLocalErrorCode, isCancellationError } from "./action-errors";

type FailureNoticeKey = {
  [K in keyof Translations]: K extends `notice${string}Failed` ? K : never;
}[keyof Translations];

const SETUP_ERROR_CODES = new Set([
  "cli_path_not_configured",
  "cli_alias_not_found",
  "cli_platform_unsupported",
  "cli_not_found",
  "cli_not_file",
  "cli_not_executable",
  "cli_wrong_filename",
]);

const TECHNICAL_DETAIL_CODES = new Set([
  "cli_incompatible_version",
  "cli_integrity_error",
  "cli_invalid_envelope",
  "cli_invalid_response",
  "cli_machine_protocol_error",
  "cli_protocol_error",
  "cli_cleanup_failed",
]);

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
    let lease: OperationLease | null = null;
    try {
      lease = this.operations.begin(operation);
      const result = await work(lease);
      return lease.isCurrent() ? result : undefined;
    } catch (error) {
      if (!isCancellationError(error)) this.presentFailure(failureNotice, error);
      return undefined;
    } finally {
      lease?.finish();
    }
  }

  presentFailure(failureNotice: FailureNoticeKey, error: unknown): void {
    const code = getLocalErrorCode(error) ?? "";
    if (SETUP_ERROR_CODES.has(code)) {
      new DocWenSetupModal(this.app, this.openSettings).open();
      return;
    }

    const summary = getErrorMessage(error);
    const notice = t(failureNotice, { error: summary });
    const showTechnicalDetails = code === "" || TECHNICAL_DETAIL_CODES.has(code);
    if (!showTechnicalDetails) {
      showNotice(notice);
      return;
    }

    // Internal/protocol failures get one detailed surface instead of a notice
    // immediately followed by a second modal for the same event.
    const detailsText = JSON.stringify(getErrorDiagnostics(error), null, 2);
    new FailureDetailsModal(this.app, notice, detailsText).open();
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
    const details = this.contentEl.createEl("details", { cls: "docwen-error-details" });
    details.createEl("summary", { text: t("dialogDetails") });
    details.createEl("pre", { text: this.detailsText });
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

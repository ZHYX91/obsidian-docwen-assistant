import { type App, type TFile } from "obsidian";

import { type DocWenClient, type DocWenCapabilityService } from "../docwen";
import { showNotice } from "../host/notices";
import { VaultReadSnapshot } from "../host/vault-read-snapshot";
import { t } from "../i18n";
import type { AssistantView } from "../assistant-view";
import { AssistantSidebarClosedError, type OpenAssistantSidebar } from "../host/assistant-sidebar";
import type { PluginSettings } from "../settings-model";
import { ActionRunner } from "./action-runner";
import { buildProofreadChecks } from "./conversion-options";

export class ProofreadActions {
  private readonly snapshots: VaultReadSnapshot;

  constructor(
    private readonly app: App,
    private readonly docwen: DocWenClient,
    private readonly capabilities: DocWenCapabilityService,
    private readonly getSettings: () => PluginSettings,
    private readonly runner: ActionRunner,
    private readonly openSidebar: OpenAssistantSidebar,
  ) {
    this.snapshots = new VaultReadSnapshot(app);
  }

  async runActive(view: AssistantView): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || activeFile.extension.toLowerCase() !== "md") {
      showNotice(t("noticeProofreadNoMdFile"));
      return;
    }
    await this.run(activeFile, view);
  }

  async refresh(vaultPath: string, view: AssistantView): Promise<void> {
    if (!vaultPath) {
      await this.runActive(view);
      return;
    }
    const file = this.app.vault.getFileByPath(vaultPath);
    if (!file) {
      showNotice(t("noticeProofreadNoMdFile"));
      return;
    }
    await this.run(file, view);
  }

  async run(file: TFile, view: AssistantView): Promise<void> {
    // No asynchronous gap before begin: a stale request must not replace live work.
    if (!view.captureLifetime()()) return;
    await this.runner.run(
      { key: "proofread", kind: "proofread" },
      "noticeProofreadFailed",
      async (lease) => {
        const canPublish = view.ownOperation(lease);
        if (!canPublish()) return null;
        const completed = await this.snapshots.run(file, lease.signal, async (snapshot) => {
          await this.capabilities.requireAction(snapshot.inputs[0], "validate", lease.signal);
          const report = await this.docwen.validate(
            snapshot.inputs[0],
            buildProofreadChecks(this.getSettings()),
            lease.signal,
          );
          if (!canPublish()) return null;
          return snapshot.publish(async () => {
            if (!canPublish()) return null;
            view.updateResults(report.issues, file.name, file.path, snapshot.contentSha256);
            return report;
          });
        });
        if (completed.value && canPublish()) {
          this.runner.presentCompletion(
            t("noticeProofreadSuccess", { count: String(completed.value.issues.length) }),
            [...completed.value.warnings, ...completed.warnings],
          );
        }
        return completed.value;
      },
    );
  }

  async activateAndRun(file: TFile, isActive: () => boolean = () => true): Promise<void> {
    try {
      if (!isActive()) return;
      const view = await this.openSidebar();
      if (isActive()) await this.run(file, view);
    } catch (error) {
      // Closing the requested view is a controlled cancellation. Other host
      // activation failures retain the normal proofreading error surface.
      if (isActive() && !(error instanceof AssistantSidebarClosedError)) {
        this.runner.presentFailure("noticeProofreadFailed", error);
      }
    }
  }

}

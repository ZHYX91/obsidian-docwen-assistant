import { type App, type TFile } from "obsidian";

import { type DocWenClient, type DocWenCapabilityService } from "../docwen";
import { showNotice } from "../host/notices";
import { VaultReadSnapshot } from "../host/vault-read-snapshot";
import { t } from "../i18n";
import { ProofreadView, PROOFREAD_VIEW_TYPE } from "../proofread-view";
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
  ) {
    this.snapshots = new VaultReadSnapshot(app);
  }

  async runActive(view: ProofreadView): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      showNotice(t("noticeProofreadNoMdFile"));
      return;
    }
    await this.run(activeFile, view);
  }

  async refresh(vaultPath: string, view: ProofreadView): Promise<void> {
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

  async run(file: TFile, view: ProofreadView): Promise<void> {
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

  async activateView(): Promise<ProofreadView> {
    let leaf = this.app.workspace.getLeavesOfType(PROOFREAD_VIEW_TYPE)[0];
    if (!leaf) {
      const rightLeaf = this.app.workspace.getRightLeaf(false);
      if (rightLeaf) {
        leaf = rightLeaf;
        await leaf.setViewState({ type: PROOFREAD_VIEW_TYPE, active: true });
      }
    }
    const view = leaf?.view;
    if (!leaf || !(view instanceof ProofreadView)) throw new Error("Proofread view is unavailable.");
    const isOpen = view.captureLifetime();
    await this.app.workspace.revealLeaf(leaf);
    if (!isOpen() || leaf.view !== view
      || !this.app.workspace.getLeavesOfType(PROOFREAD_VIEW_TYPE).includes(leaf)) {
      throw new Error("Proofread view is unavailable.");
    }
    return view;
  }

}

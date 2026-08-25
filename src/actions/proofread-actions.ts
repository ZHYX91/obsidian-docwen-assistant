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

  async runActive(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      showNotice(t("noticeProofreadNoMdFile"));
      return;
    }
    await this.run(activeFile);
  }

  async run(file: TFile): Promise<void> {
    const view = this.getView();
    await this.runner.run(
      { key: "proofread", kind: "proofread" },
      "noticeProofreadFailed",
      async ({ signal, isCurrent }) => this.snapshots.run(file, signal, async (snapshot) => {
        await this.capabilities.requireAction(snapshot.inputs[0]!, "validate", signal);
        const report = await this.docwen.validate(
          snapshot.inputs[0]!,
          buildProofreadChecks(this.getSettings()),
          signal,
        );
        if (!isCurrent()) return null;
        view?.updateResults(report.issues, report.file || file.name, file.path);
        showNotice(t("noticeProofreadSuccess", { count: String(report.issues.length) }));
        return report;
      }),
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
    if (leaf) this.app.workspace.revealLeaf(leaf);
    const view = this.getView();
    if (!view) throw new Error("Proofread view is unavailable.");
    return view;
  }

  private getView(): ProofreadView | null {
    const leaf = this.app.workspace.getLeavesOfType(PROOFREAD_VIEW_TYPE)[0];
    return leaf ? (leaf.view as ProofreadView) : null;
  }
}

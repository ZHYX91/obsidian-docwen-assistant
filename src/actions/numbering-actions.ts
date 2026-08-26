import { type App, type TFile } from "obsidian";

import {
  type DocWenClient,
  type DocWenCapabilityService,
  LocalCliError,
  type NumberingSchemeItem,
} from "../docwen";
import { showNotice } from "../host/notices";
import { VaultWriteTransaction } from "../host/vault-write-transaction";
import { t } from "../i18n";
import { ItemPickerModal, type PickerItem } from "../utils/suggest-modal";
import { ActionRunner } from "./action-runner";

export class NumberingActions {
  private readonly writer: VaultWriteTransaction;

  constructor(
    private readonly app: App,
    private readonly docwen: DocWenClient,
    private readonly capabilities: DocWenCapabilityService,
    private readonly runner: ActionRunner,
  ) {
    this.writer = new VaultWriteTransaction(app);
  }

  schemes(signal?: AbortSignal): Promise<NumberingSchemeItem[]> {
    return this.docwen.numberingSchemes(signal);
  }

  async add(file: TFile): Promise<void> {
    await this.runner.run(
      { key: "numbering-schemes", kind: "numbering" },
      "noticeNumberingFailed",
      async ({ signal, isCurrent }) => {
        const schemes = await this.docwen.numberingSchemes(signal);
        if (!isCurrent()) return;
        if (schemes.length === 0) {
          showNotice(t("settingsNumberingSchemeError"));
          return;
        }
        const items: PickerItem[] = schemes.map((scheme) => ({
          id: scheme.id,
          label: scheme.name,
          description: scheme.description,
        }));
        new ItemPickerModal(
          this.app,
          items,
          t("pickerNumberingSchemePlaceholder"),
          async (chosen) => this.execute(file, "add", chosen.id),
        ).open();
      },
    );
  }

  async remove(file: TFile): Promise<void> {
    await this.execute(file, "remove");
  }

  private async execute(
    file: TFile,
    operation: "add" | "remove",
    scheme?: string,
  ): Promise<void> {
    await this.runner.run(
      { key: `numbering:${file.path}`, kind: "numbering" },
      "noticeNumberingFailed",
      async ({ signal }) => {
        await this.writer.run(
          file,
          async (inputPath, outputPath, originalSha256, transformSignal) => {
            const capability = await this.capabilities.requireAction(
              inputPath,
              "number markdown",
              transformSignal,
            );
            if (capability.inspection.contentSha256 !== originalSha256) {
              throw new LocalCliError(
                "cli_invalid_envelope",
                "DocWen inspection hash does not match the isolated editor snapshot.",
                {
                  expected: originalSha256,
                  actual: capability.inspection.contentSha256,
                },
              );
            }
            await this.docwen.numberMarkdown(
              inputPath,
              outputPath,
              operation,
              scheme,
              transformSignal,
              file.path,
            );
          },
          signal,
        );
        showNotice(t("noticeNumberingSuccess", { filename: file.name }));
      },
    );
  }
}

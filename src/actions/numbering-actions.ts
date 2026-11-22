import { type App, type TFile } from "obsidian";

import {
  type DocWenClient,
  type DocWenCapabilityService,
  LocalCliError,
  type NumberingSchemeItem,
} from "../docwen";
import { sourceFormatForPath, CONVERSION_MEDIA_TYPES } from "../docwen/formats";
import { materializeDetectedSource } from "../host/detected-source";
import { admittedActionInput } from "./admitted-input";
import { showNotice } from "../host/notices";
import { VaultWriteTransaction } from "../host/vault-write-transaction";
import { t } from "../i18n";
import { pickItem, type PickerItem } from "../utils/suggest-modal";
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
      { key: `numbering:${file.path}`, kind: "numbering" },
      "noticeNumberingFailed",
      async (lease) => {
        const schemes = await this.docwen.numberingSchemes(lease.signal);
        if (!lease.isCurrent()) return;
        if (schemes.length === 0) {
          showNotice(t("settingsNumberingSchemeError"));
          return;
        }
        const items: PickerItem[] = schemes.map((scheme) => ({
          id: scheme.id,
          label: scheme.name,
          description: scheme.description,
        }));
        const chosen = await pickItem(this.app, items, t("pickerNumberingSchemePlaceholder"), lease.signal);
        if (chosen && lease.isCurrent()) await this.execute(file, "add", lease.signal, chosen.id);
      },
    );
  }

  async remove(file: TFile): Promise<void> {
    await this.runner.run(
      { key: `numbering:${file.path}`, kind: "numbering" },
      "noticeNumberingFailed",
      async (lease) => this.execute(file, "remove", lease.signal),
    );
  }

  private async execute(
    file: TFile,
    operation: "add" | "remove",
    signal: AbortSignal,
    scheme?: string,
  ): Promise<void> {
    let diagnostics: readonly unknown[] = [];
    const warnings = await this.writer.run(
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
        const source = { path: inputPath, ...sourceFormatForPath(inputPath), role: "source" as const, logicalPath: file.path };
        const admitted = await admittedActionInput(this.app, source, capability, "number markdown", transformSignal, route =>
          materializeDetectedSource(source, originalSha256, capability.inspection, route,
            input => this.docwen.inspect(input, transformSignal), () => transformSignal.throwIfAborted()));
        if (!admitted) throw new DOMException("Numbering cancelled", "AbortError");
        if (admitted.mediaType !== CONVERSION_MEDIA_TYPES.md) {
          throw new LocalCliError("cli_input_invalid", "Heading numbering requires Markdown input.");
        }
        const outcome = await this.docwen.numberMarkdown(
          admitted.path,
          outputPath,
          operation,
          scheme,
          transformSignal,
          file.path,
        );
        diagnostics = outcome.diagnostics;
        return outcome.warnings;
      },
      signal,
    );
    this.runner.presentCompletion(t("noticeNumberingSuccess", { filename: file.name }), warnings, diagnostics);
  }
}

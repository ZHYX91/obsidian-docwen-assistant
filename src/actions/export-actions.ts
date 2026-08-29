import * as path from "node:path";

import { type App, type TFile } from "obsidian";

import {
  type ConvertOptions,
  type ConvertTarget,
  type DocWenClient,
  type DocWenCapabilityService,
  type TaskInput,
  LocalCliError,
} from "../docwen";
import { confirmDetectedFormat } from "../host/confirm";
import { getElectronSaveDialog } from "../host/electron-dialogs";
import { pathExists } from "../host/file-system";
import { showNotice } from "../host/notices";
import {
  assertRoundTripSidecarTargetAvailable,
  publishRoundTripSidecar,
} from "../host/round-trip-sidecar";
import { VaultReadSnapshot } from "../host/vault-read-snapshot";
import { resolveAbsoluteFilePath } from "../host/vault-files";
import { t } from "../i18n";
import type { PluginSettings } from "../settings-model";
import { ItemPickerModal, type PickerItem } from "../utils/suggest-modal";
import { isCancellationError } from "./action-errors";
import { ActionRunner } from "./action-runner";
import {
  buildHeadingMergeOptions,
  buildMarkdownExportOptions,
  buildNumberingOptions,
  buildProofreadChecks,
} from "./conversion-options";

export class ExportActions {
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

  toDocx(file: TFile): Promise<void> {
    return this.prepare(file, "docx");
  }

  toXlsx(file: TFile): Promise<void> {
    return this.prepare(file, "xlsx");
  }

  toMarkdown(file: TFile): Promise<void> {
    return this.prepare(file, "md");
  }

  private async prepare(file: TFile, target: ConvertTarget): Promise<void> {
    await this.runner.run(
      { key: `export-prepare:${file.path}:${target}`, kind: "export" },
      "noticeExportFailed",
      async ({ signal }) => {
        await this.snapshots.run(file, signal, async (snapshot) => {
          const sourceInput = snapshot.sourceInput ?? snapshot.inputs[0];
          const capability = await this.capabilities.requireAction(sourceInput, "convert", signal);
          const route = this.capabilities.requireConversionRoute(capability, target);
          const requiresTemplate = route.options.includes("template_name");
          if (requiresTemplate) {
            const templates = await this.docwen.templates(target, signal);
            if (templates.length === 0) {
              showNotice(t("noticeNoTemplatesAvailable"));
              return;
            }
            this.openPicker(templates, t("pickerTemplatePlaceholder"), (template) => {
              void this.execute(file, target, { template: template.id });
            });
            return;
          }

          const optimizationActionIds = this.capabilities.optimizationActionIds(capability, target);
          const optimizationResources = optimizationActionIds.length > 0
            ? await this.docwen.optimizations(signal)
            : [];
          const optimizations = this.capabilities.findApplicableOptimizations(
            capability,
            optimizationResources,
            target,
          );
          if (optimizations.length === 0) {
            await this.execute(file, target);
            return;
          }
          const items: PickerItem[] = [
            { id: "__none__", label: t("pickerNoOptimization") },
            ...optimizations.map((item) => ({ id: item.id, label: item.name, description: item.description })),
          ];
          new ItemPickerModal(
            this.app,
            items,
            t("pickerOptimizationPlaceholder"),
            (chosen) => {
              void this.execute(
                file,
                target,
                { optimization: chosen.id === "__none__" ? undefined : chosen.id },
              );
            },
          ).open();
        });
      },
    );
  }

  private openPicker(
    items: Array<{ id: string; name: string; description?: string }>,
    placeholder: string,
    select: (item: { id: string }) => void,
  ): void {
    new ItemPickerModal(
      this.app,
      items.map((item) => ({ id: item.id, label: item.name, description: item.description })),
      placeholder,
      select,
    ).open();
  }

  private async execute(
    file: TFile,
    target: ConvertTarget,
    selected: Pick<ConvertOptions, "template" | "optimization"> = {},
  ): Promise<void> {
    const filePath = resolveAbsoluteFilePath(this.app.vault, file);
    if (!filePath) {
      this.runner.presentFailure(
        "noticeExportFailed",
        new LocalCliError("cli_not_file", "The selected Vault file has no local filesystem path."),
      );
      return;
    }
    const outputPath = await pickExportOutput(filePath, target);
    if (!outputPath) return;

    await this.runner.run(
      { key: `export:${file.path}`, kind: "export" },
      "noticeExportFailed",
      async ({ signal }) => {
        await this.snapshots.run(file, signal, async (snapshot) => {
          const sourceInput = snapshot.sourceInput ?? snapshot.inputs[0];
          const capability = await this.capabilities.requireAction(sourceInput, "convert", signal);
          const route = this.capabilities.requireConversionRoute(capability, target);
          const useDetectedFormat = this.capabilities.requiresDetectedFormatAcceptance(capability.inspection);
          if (useDetectedFormat) {
            const accepted = await confirmDetectedFormat(
              this.app,
              capability.inspection.reasonCode || capability.inspection.warningCode ||
                "DocWen detected content that differs from the filename. Continue with detected content?",
            );
            if (!accepted) return;
          }

          const settings = this.getSettings();
          const options: ConvertOptions = { target, ...selected, useDetectedFormat };
          if (target === "md") {
            Object.assign(options, buildMarkdownExportOptions(settings));
            if (capability.source.category === "document") {
              Object.assign(
                options,
                buildNumberingOptions(
                  settings,
                  settings.docToMdCleanNumbering,
                  settings.docToMdAddNumbering,
                ),
              );
            }
          }
          if (capability.source.category === "markdown") {
            if (settings.proofreadOnConvert) {
              await this.runAdvisoryProofread(sourceInput, settings, signal);
            }
            Object.assign(options, buildHeadingMergeOptions(settings));
          }

          const taskInputs = target === "docx" && snapshot.resolvedMarkdownInputs
            ? snapshot.resolvedMarkdownInputs
            : snapshot.inputs;
          this.capabilities.requireTaskInputs(route, taskInputs);
          if (target === "docx" && snapshot.resolvedMarkdownInputs) {
            await assertRoundTripSidecarTargetAvailable(outputPath);
          }

          const outcome = await this.docwen.convert({
            ...options,
            inputs: taskInputs,
            sourceInput,
            outputPath,
            overwrite: pathExists(outputPath),
            capabilityId: route.capabilityId,
          }, signal);
          const output = outcome.output;
          showNotice(t("noticeExportSuccess", { filename: portableBasename(output) }));
          if (
            target === "docx"
            && snapshot.resolvedMarkdownInputs
            && snapshot.resolvedMarkdownSourcePath
          ) {
            try {
              await publishRoundTripSidecar(output, {
                neutralDocumentPath: snapshot.resolvedMarkdownInputs[0].path,
                numberingExportPlanPath: snapshot.resolvedMarkdownInputs[1].path,
                authoredSourcePath: snapshot.resolvedMarkdownSourcePath,
              });
            } catch (error) {
              this.runner.presentFailure("noticeRoundTripSidecarFailed", error);
            }
          }
        });
      },
    );
  }

  private async runAdvisoryProofread(
    input: TaskInput,
    settings: PluginSettings,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      await this.capabilities.requireAction(input.path, "validate", signal);
      const report = await this.docwen.validate(
        input,
        buildProofreadChecks(settings),
        signal,
      );
      showNotice(t("noticeProofreadSuccess", { count: String(report.issues.length) }));
    } catch (error) {
      if (isCancellationError(error)) throw error;
      this.runner.presentFailure("noticeProofreadFailed", error);
    }
  }
}

function portableBasename(filePath: string): string {
  return path.posix.basename(filePath.replace(/\\/gu, "/"));
}

async function pickExportOutput(filePath: string, target: ConvertTarget): Promise<string | null> {
  const dialog = getElectronSaveDialog();
  if (!dialog) throw new LocalCliError("cli_spawn_failed", "Save dialog is unavailable.");
  const inputExtension = path.extname(filePath).toLowerCase();
  const outputExtension = `.${target}`;
  const stem = path.basename(filePath, inputExtension);
  const outputStem = inputExtension === outputExtension ? `${stem}-converted` : stem;
  const result = await dialog.showSaveDialog({
    title: `DocWen — ${target.toUpperCase()}`,
    defaultPath: path.join(path.dirname(filePath), `${outputStem}${outputExtension}`),
    filters: [
      { name: target.toUpperCase(), extensions: [target] },
      { name: "All files", extensions: ["*"] },
    ],
  });
  return result.canceled || !result.filePath ? null : path.resolve(result.filePath);
}

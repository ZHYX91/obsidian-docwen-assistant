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
import { getElectronOpenDialog } from "../host/electron-dialogs";
import { captureExportTarget } from "../host/export-target-snapshot";
import { showNotice } from "../host/notices";
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
        const selection = await this.snapshots.run(file, signal, async (snapshot) => {
          const sourceInput = snapshot.sourceInput ?? snapshot.inputs[0];
          const capability = await this.capabilities.requireAction(sourceInput, "convert", signal);
          const route = this.capabilities.requireConversionRoute(capability, target);
          if (route.options.includes("template_name")) {
            return { kind: "template" as const, items: await this.docwen.templates(target, signal) };
          }
          const actionIds = this.capabilities.optimizationActionIds(capability, target);
          const resources = actionIds.length > 0 ? await this.docwen.optimizations(signal) : [];
          return {
            kind: "optimization" as const,
            items: this.capabilities.findApplicableOptimizations(capability, resources, target),
          };
        });
        if (selection.kind === "template") {
          if (target === "xlsx") {
            if (selection.items.length === 0) {
              await this.execute(file, target);
              return;
            }
            const direct: PickerItem = { id: "", label: t("pickerNoSpreadsheetTemplate") };
            new ItemPickerModal(
              this.app,
              [direct, ...selection.items.map((item) => ({
                id: item.id, label: item.name, description: item.description,
              }))],
              t("pickerTemplatePlaceholder"),
              (chosen) => {
                void this.execute(file, target, chosen === direct ? {} : { template: chosen.id });
              },
            ).open();
            return;
          }
          if (selection.items.length === 0) {
            showNotice(t("noticeNoTemplatesAvailable"));
            return;
          }
          this.openPicker(selection.items, t("pickerTemplatePlaceholder"), (template) => {
            void this.execute(file, target, { template: template.id });
          });
          return;
        }
        if (selection.items.length === 0) {
          await this.execute(file, target);
          return;
        }
        const items: PickerItem[] = [
          { id: "__none__", label: t("pickerNoOptimization") },
          ...selection.items.map((item) => ({ id: item.id, label: item.name, description: item.description })),
        ];
        new ItemPickerModal(
          this.app,
          items,
          t("pickerOptimizationPlaceholder"),
          (chosen) => {
            void this.execute(file, target, {
              optimization: chosen.id === "__none__" ? undefined : chosen.id,
            });
          },
        ).open();
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
    const outputDirectory = await pickExportOutput(filePath, target);
    if (!outputDirectory) return;

    await this.runner.run(
      { key: `export:${file.path}`, kind: "export" },
      "noticeExportFailed",
      async ({ signal }) => {
        const destination = await captureExportTarget(this.app, outputDirectory, signal);
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
          const options: ConvertOptions = {
            target,
            ...selected,
            useDetectedFormat,
            supportedOptions: route.options,
          };
          if (target === "md") {
            Object.assign(options, buildMarkdownExportOptions(settings));
            if (route.options.some((name) => ["remove_numbering", "add_numbering", "numbering_scheme"].includes(name))) {
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

          const taskInputs = target === "docx"
            ? await snapshot.getResolvedMarkdownInputs() ?? snapshot.inputs
            : snapshot.inputs;
          this.capabilities.requireTaskInputs(route, taskInputs);

          const outcome = await this.docwen.convert({
            ...options,
            inputs: taskInputs,
            sourceInput,
            outputDirectory,
            capabilityId: route.capabilityId,
            publish: (root, commit) => snapshot.publish(() => destination.publish(root, commit)),
          }, signal);
          const output = outcome.output;
          showNotice(t("noticeExportSuccess", { filename: portableBasename(output) }));
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
  const dialog = getElectronOpenDialog();
  if (!dialog) throw new LocalCliError("cli_spawn_failed", "Directory dialog is unavailable.");
  const result = await dialog.showOpenDialog({
    title: `DocWen — ${target.toUpperCase()} — ${t("dialogExportDirectory")}`,
    defaultPath: path.dirname(filePath),
    properties: ["openDirectory", "createDirectory"],
  });
  return result.canceled || result.filePaths.length !== 1 ? null : path.resolve(result.filePaths[0]);
}

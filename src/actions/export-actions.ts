import * as path from "node:path";

import { type App, type TFile } from "obsidian";

import {
  type ConvertOptions,
  type ConvertTarget,
  type DocWenClient,
  type DocWenCapabilityService,
  type TaskInput,
  type TemplateItem,
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
import { pickItem, type PickerItem } from "../utils/suggest-modal";
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
      { key: `export:${file.path}`, kind: "export" },
      "noticeExportFailed",
      async (lease) => {
        const { signal } = lease;
        const prepared = await this.snapshots.run(file, signal, async (snapshot) => {
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
        if (!lease.isCurrent()) return;
        this.runner.presentWarnings(prepared.warnings);
        const selection = prepared.value;
        const selected: Pick<ConvertOptions, "template" | "optimization"> = {};
        if (selection.kind === "template") {
          if (selection.items.length === 0 && target !== "xlsx") {
            showNotice(t("noticeNoTemplatesAvailable"));
            return;
          }
          if (selection.items.length > 0) {
            const direct: PickerItem = { id: "", label: t("pickerNoSpreadsheetTemplate") };
            const items = selection.items.map(templatePickerItem);
            if (target === "xlsx") items.unshift(direct);
            const chosen = await pickItem(this.app, items, t("pickerTemplatePlaceholder"), signal);
            if (!chosen || !lease.isCurrent()) return;
            if (chosen !== direct) selected.template = chosen.id;
          }
        } else if (selection.items.length > 0) {
          const items: PickerItem[] = [
            { id: "__none__", label: t("pickerNoOptimization") },
            ...selection.items.map((item) => ({ id: item.id, label: item.name, description: item.description })),
          ];
          const chosen = await pickItem(this.app, items, t("pickerOptimizationPlaceholder"), signal);
          if (!chosen || !lease.isCurrent()) return;
          if (chosen.id !== "__none__") selected.optimization = chosen.id;
        }
        if (lease.isCurrent()) await this.execute(file, target, selected, signal);
      },
    );
  }

  private async execute(
    file: TFile,
    target: ConvertTarget,
    selected: Pick<ConvertOptions, "template" | "optimization">,
    signal: AbortSignal,
  ): Promise<void> {
    const filePath = resolveAbsoluteFilePath(this.app.vault, file);
    if (!filePath) {
      throw new LocalCliError("cli_not_file", "The selected Vault file has no local filesystem path.");
    }
    const outputDirectory = await pickExportOutput(filePath, target);
    if (!outputDirectory || signal.aborted) return;

    const destination = await captureExportTarget(this.app, outputDirectory, signal);
    const completed = await this.snapshots.run(file, signal, async (snapshot) => {
      const sourceInput = snapshot.sourceInput ?? snapshot.inputs[0];
      const capability = await this.capabilities.requireAction(sourceInput, "convert", signal);
      const route = this.capabilities.requireConversionRoute(capability, target, selected.optimization);
      const useDetectedFormat = this.capabilities.requiresDetectedFormatAcceptance(capability.inspection);
      if (useDetectedFormat) {
        const accepted = await confirmDetectedFormat(this.app, signal);
        if (!accepted || signal.aborted) return;
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

      return this.docwen.convert({
        ...options,
        inputs: taskInputs,
        sourceInput,
        outputDirectory,
        capabilityId: route.capabilityId,
        selectedCapability: route.capability,
        publish: (root, commit) => snapshot.publish(() => destination.publish(root, commit)),
      }, signal);
    });
    if (completed.value) {
      this.runner.presentCompletion(
        t("noticeExportSuccess", { filename: portableBasename(completed.value.output) }),
        [...completed.value.warnings, ...completed.warnings],
        completed.value.diagnostics,
      );
    } else {
      this.runner.presentWarnings(completed.warnings);
    }
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
      this.runner.presentCompletion(t("noticeProofreadSuccess", { count: String(report.issues.length) }), report.warnings);
    } catch (error) {
      if (isCancellationError(error)) throw error;
      this.runner.presentFailure("noticeProofreadFailed", error);
    }
  }
}

function templatePickerItem(item: TemplateItem): PickerItem {
  const origin = item.origin === "builtin" ? t("pickerTemplateBuiltin") : t("pickerTemplateCustom");
  const status = item.isDefault ? `${origin} · ${t("pickerTemplateDefault")}` : origin;
  return {
    id: item.id,
    label: item.isDefault ? `★ ${item.name}` : item.name,
    description: item.description ? `${status} · ${item.description}` : status,
  };
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

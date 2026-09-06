import { type Menu, type Plugin, type TAbstractFile } from "obsidian";

import type { ExportActions } from "../actions/export-actions";
import type { GuiActions } from "../actions/gui-actions";
import type { NumberingActions } from "../actions/numbering-actions";
import type { ProofreadActions } from "../actions/proofread-actions";
import { type DocWenCapabilityService, type FileCapability } from "../docwen";
import { resolveAbsoluteFilePath, resolveTargetFile } from "../host/vault-files";
import { showNotice } from "../host/notices";
import { t } from "../i18n";
import { ItemPickerModal } from "../utils/suggest-modal";

type MenuItemWithOptionalSubmenu = { setSubmenu?: () => Menu };

type MenuEntry = {
  readonly title: string;
  readonly icon: string;
  readonly action?: () => Promise<void> | void;
};

export interface FileMenuActions {
  readonly exports: ExportActions;
  readonly gui: GuiActions;
  readonly numbering: NumberingActions;
  readonly proofread: ProofreadActions;
  readonly capabilities: DocWenCapabilityService;
  readonly presentCapabilityFailure: (error: Error) => void;
}

export function registerFileMenu(plugin: Plugin, actions: FileMenuActions): void {
  let disposed = false;
  plugin.register(() => { disposed = true; });
  plugin.registerEvent(
    plugin.app.workspace.on("file-menu", (menu: Menu, abstractFile: TAbstractFile) => {
      const targetFile = resolveTargetFile(abstractFile);
      if (!targetFile) return;
      const filePath = resolveAbsoluteFilePath(plugin.app.vault, targetFile);
      if (!filePath) return;

      const cached = actions.capabilities.peek(filePath);
      if (!cached || cached instanceof Error) void actions.capabilities.preload(filePath);
      const folderTargetPath = targetFile === abstractFile ? null : targetFile.path;
      const chooseActions = async (): Promise<void> => {
        showNotice(t("contextMenuLoading"));
        try {
          await actions.capabilities.preload(filePath);
          if (disposed) return;
          const current = actions.capabilities.peek(filePath);
          if (current instanceof Error) {
            actions.presentCapabilityFailure(current);
            return;
          }
          if (!current) return;
          const available = actionSections(current, targetFile, folderTargetPath, actions, chooseActions)
            .flat().filter((entry) => entry.action !== undefined);
          if (available.length === 0) {
            showNotice(t("contextMenuNoActions"));
            return;
          }
          new ItemPickerModal(
            plugin.app,
            available.map((entry, index) => ({
              id: String(index), label: entry.title, description: targetFile.path,
            })),
            t("contextMenuChooseAction"),
            ({ id }) => {
              if (!disposed) void available[Number(id)]?.action?.();
            },
          ).open();
        } catch (error) {
          if (!disposed) actions.presentCapabilityFailure(error instanceof Error ? error : new Error(String(error)));
        }
      };
      let usedFallback = false;

      menu.addItem((item) => {
        const optional = item as unknown as MenuItemWithOptionalSubmenu;
        if (typeof optional.setSubmenu === "function") {
          item.setTitle(t("contextMenuSubmenuTitle")).setIcon("file-text");
          renderSubmenu(optional.setSubmenu(), cached, targetFile, filePath, folderTargetPath, actions, chooseActions);
          return;
        }

        usedFallback = true;
        item
          .setTitle(prefixed(t("contextMenuOpenInDocWen")))
          .setIcon("external-link")
          .onClick(() => void actions.gui.open(filePath));
      });

      if (usedFallback) {
        for (const section of actionSections(cached, targetFile, folderTargetPath, actions, chooseActions)) {
          for (const action of section) addEntry(menu, action, true);
        }
      }
    }),
  );
}

function renderSubmenu(
  menu: Menu,
  cached: FileCapability | Error | null,
  file: NonNullable<ReturnType<typeof resolveTargetFile>>,
  filePath: string,
  folderTargetPath: string | null,
  actions: FileMenuActions,
  chooseActions: () => Promise<void>,
): void {
  const sections = actionSections(cached, file, folderTargetPath, actions, chooseActions);
  sections.push([{
    title: t("contextMenuOpenInDocWen"),
    icon: "external-link",
    action: () => actions.gui.open(filePath),
  }]);
  sections.forEach((section, index) => {
    if (index > 0) menu.addSeparator();
    for (const action of section) addEntry(menu, action, false);
  });
}

function actionSections(
  cached: FileCapability | Error | null,
  file: NonNullable<ReturnType<typeof resolveTargetFile>>,
  folderTargetPath: string | null,
  actions: FileMenuActions,
  chooseActions: () => Promise<void>,
): MenuEntry[][] {
  const sections: MenuEntry[][] = [];
  if (folderTargetPath !== null) {
    sections.push([{
      title: t("contextMenuFolderTarget", { path: folderTargetPath }),
      icon: "file-symlink",
    }]);
  }
  if (cached instanceof Error) {
    sections.push([{
      title: t("contextMenuCapabilityUnavailable"),
      icon: "alert-triangle",
      action: () => actions.presentCapabilityFailure(cached),
    }, {
      title: t("contextMenuChooseAction"),
      icon: "list",
      action: chooseActions,
    }]);
    return sections;
  }
  if (!cached) {
    sections.push([{ title: t("contextMenuChooseAction"), icon: "list", action: chooseActions }]);
    return sections;
  }

  const conversion: MenuEntry[] = [];
  const canConvert = (target: "md" | "docx" | "xlsx") =>
    actions.capabilities.findConversionRoute(cached, target) !== null;
  if (canConvert("md")) {
    conversion.push(actionEntry("contextMenuConvertToMd", "file-text", () => actions.exports.toMarkdown(file)));
  }
  if (canConvert("docx")) {
    conversion.push(actionEntry("contextMenuConvertToDocx", "file-output", () => actions.exports.toDocx(file)));
  }
  if (canConvert("xlsx")) {
    conversion.push(actionEntry("contextMenuConvertToXlsx", "table", () => actions.exports.toXlsx(file)));
  }
  if (conversion.length > 0) sections.push(conversion);

  const editing: MenuEntry[] = [];
  if (cached.inspection.supportedActions.includes("number markdown")) {
    editing.push(actionEntry("contextMenuAddNumbering", "list-ordered", () => actions.numbering.add(file)));
    editing.push(actionEntry("contextMenuRemoveNumbering", "list-x", () => actions.numbering.remove(file)));
  }
  if (cached.inspection.supportedActions.includes("validate")) {
    editing.push(actionEntry("contextMenuProofread", "check-circle", async () => {
      await actions.proofread.activateView();
      await actions.proofread.run(file);
    }));
  }
  if (editing.length > 0) sections.push(editing);
  return sections;
}

function actionEntry(
  title: Parameters<typeof t>[0],
  icon: string,
  action: () => Promise<void>,
): MenuEntry {
  return { title: t(title), icon, action };
}

function addEntry(menu: Menu, entry: MenuEntry, withPrefix: boolean): void {
  menu.addItem((item) => {
    item.setTitle(withPrefix ? prefixed(entry.title) : entry.title).setIcon(entry.icon);
    if (entry.action) item.onClick(() => void entry.action?.());
    else item.setDisabled(true);
  });
}

function prefixed(title: string): string {
  return `${t("contextMenuSubmenuTitle")}: ${title}`;
}

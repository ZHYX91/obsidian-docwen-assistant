import { type Menu, type Plugin, type TAbstractFile } from "obsidian";

import type { ExportActions } from "../actions/export-actions";
import type { GuiActions } from "../actions/gui-actions";
import type { NumberingActions } from "../actions/numbering-actions";
import type { ProofreadActions } from "../actions/proofread-actions";
import { type DocWenCapabilityService, type FileCapability } from "../docwen";
import { resolveAbsoluteFilePath, resolveTargetFile } from "../host/vault-files";
import { t } from "../i18n";

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
  plugin.registerEvent(
    plugin.app.workspace.on("file-menu", (menu: Menu, abstractFile: TAbstractFile) => {
      const targetFile = resolveTargetFile(abstractFile);
      if (!targetFile) return;
      const filePath = resolveAbsoluteFilePath(plugin.app.vault, targetFile);
      if (!filePath) return;

      const cached = actions.capabilities.peek(filePath);
      if (!cached || cached instanceof Error) void actions.capabilities.preload(filePath);
      const folderTargetPath = targetFile === abstractFile ? null : targetFile.path;
      let usedFallback = false;

      menu.addItem((item) => {
        const optional = item as unknown as MenuItemWithOptionalSubmenu;
        if (typeof optional.setSubmenu === "function") {
          item.setTitle(t("contextMenuSubmenuTitle")).setIcon("file-text");
          renderSubmenu(optional.setSubmenu(), cached, targetFile, filePath, folderTargetPath, actions);
          return;
        }

        usedFallback = true;
        item
          .setTitle(prefixed(t("contextMenuOpenInDocWen")))
          .setIcon("external-link")
          .onClick(() => void actions.gui.open(filePath));
      });

      if (usedFallback) {
        for (const section of actionSections(cached, targetFile, folderTargetPath, actions)) {
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
): void {
  const sections = actionSections(cached, file, folderTargetPath, actions);
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
    }]);
    return sections;
  }
  if (!cached) {
    sections.push([{ title: t("contextMenuLoading"), icon: "loader" }]);
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

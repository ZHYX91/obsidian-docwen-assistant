import { type Menu, type Plugin, type TAbstractFile } from "obsidian";

import type { ExportActions } from "../actions/export-actions";
import type { GuiActions } from "../actions/gui-actions";
import type { NumberingActions } from "../actions/numbering-actions";
import type { ProofreadActions } from "../actions/proofread-actions";
import { type DocWenCapabilityService, type FileCapability } from "../docwen";
import { resolveAbsoluteFilePath, resolveTargetFile } from "../host/vault-files";
import { t } from "../i18n";

type MenuItemWithSubmenu = { setSubmenu(): Menu };

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

      menu.addItem((item) => {
        item.setTitle(t("contextMenuSubmenuTitle")).setIcon("file-text");
        const submenu = (item as unknown as MenuItemWithSubmenu).setSubmenu();
        if (cached instanceof Error) {
          submenu.addItem((errorItem) => {
            errorItem
              .setTitle(t("noticeCapabilityFailed", { error: cached.message }))
              .setIcon("alert-triangle")
              .onClick(() => actions.presentCapabilityFailure(cached));
          });
          submenu.addSeparator();
        } else if (cached) {
          addCapabilityActions(submenu, cached, targetFile, actions);
          submenu.addSeparator();
        }
        addAction(submenu, "contextMenuOpenInDocWen", "external-link", () =>
          actions.gui.open(filePath));
      });
    }),
  );
}

function addCapabilityActions(
  menu: Menu,
  capability: FileCapability,
  file: NonNullable<ReturnType<typeof resolveTargetFile>>,
  actions: FileMenuActions,
): void {
  const canConvert = (target: "md" | "docx" | "xlsx") =>
    actions.capabilities.findConversionRoute(capability, target) !== null;
  if (canConvert("md")) {
    addAction(menu, "contextMenuConvertToMd", "file-text", () => actions.exports.toMarkdown(file));
  }
  if (canConvert("docx")) {
    addAction(menu, "contextMenuConvertToDocx", "file-output", () => actions.exports.toDocx(file));
  }
  if (canConvert("xlsx")) {
    addAction(menu, "contextMenuConvertToXlsx", "table", () => actions.exports.toXlsx(file));
  }
  if (capability.inspection.supportedActions.includes("number markdown")) {
    addAction(menu, "contextMenuAddNumbering", "list-ordered", () => actions.numbering.add(file));
    addAction(menu, "contextMenuRemoveNumbering", "list-x", () => actions.numbering.remove(file));
  }
  if (capability.inspection.supportedActions.includes("validate")) {
    addAction(menu, "contextMenuProofread", "check-circle", async () => {
      await actions.proofread.activateView();
      await actions.proofread.run(file);
    });
  }
}

function addAction(
  menu: Menu,
  title: Parameters<typeof t>[0],
  icon: string,
  action: () => Promise<void>,
): void {
  menu.addItem((item) => {
    item.setTitle(t(title)).setIcon(icon).onClick(() => void action());
  });
}

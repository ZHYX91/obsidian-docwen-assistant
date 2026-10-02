import type { App, Command } from "obsidian";
import type { Translations } from "../i18n";
import type { DocWenCapabilityService, FileCapability } from "../docwen";
import type { NumberingActions } from "../actions/numbering-actions";
import type { ProofreadActions } from "../actions/proofread-actions";
import type { OperationCoordinator } from "../runtime/operation-coordinator";

type CommandActions = {
  app: App;
  addLocalizedCommand: (key: keyof Translations, command: Omit<Command, "name">) => void;
  launchOrSendFile: () => Promise<void>;
  activeFileSupports: (predicate: (capability: FileCapability) => boolean) => boolean;
  capabilities: DocWenCapabilityService;
  exportCurrentFileToDocx: () => Promise<void>;
  exportCurrentFileToXlsx: () => Promise<void>;
  exportCurrentFileToMarkdown: () => Promise<void>;
  numberingActions: NumberingActions;
  runDoctorCheck: () => Promise<void>;
  proofreadActions: ProofreadActions;
  operations: OperationCoordinator;
};

export function registerCommands(actions: CommandActions): void {
  // Add command palette commands
  actions.addLocalizedCommand("commandLaunch", {
    id: "launch-docwen",
    callback: () => {
      void actions.launchOrSendFile();
    },
  });

  actions.addLocalizedCommand("commandLaunchWithFile", {
    id: "launch-docwen-with-file",
    checkCallback: (checking: boolean) => {
      const activeFile = actions.app.workspace.getActiveFile();
      if (activeFile) {
        if (!checking) {
          void actions.launchOrSendFile();
        }
        return true;
      }
      return false;
    },
  });

  actions.addLocalizedCommand("commandExportDocx", {
    id: "export-docx-background",
    checkCallback: (checking: boolean) => {
      const activeFile = actions.app.workspace.getActiveFile();
      if (activeFile && actions.activeFileSupports((capability) =>
        actions.capabilities.findConversionRoute(capability, "docx") !== null)) {
        if (!checking) {
          void actions.exportCurrentFileToDocx();
        }
        return true;
      }
      return false;
    },
  });

  actions.addLocalizedCommand("commandExportXlsx", {
    id: "export-xlsx-background",
    checkCallback: (checking: boolean) => {
      const activeFile = actions.app.workspace.getActiveFile();
      if (activeFile && actions.activeFileSupports((capability) =>
        actions.capabilities.findConversionRoute(capability, "xlsx") !== null)) {
        if (!checking) {
          void actions.exportCurrentFileToXlsx();
        }
        return true;
      }
      return false;
    },
  });

  actions.addLocalizedCommand("commandExportMd", {
    id: "export-md-background",
    checkCallback: (checking: boolean) => {
      const activeFile = actions.app.workspace.getActiveFile();
      if (activeFile && actions.activeFileSupports((capability) =>
        actions.capabilities.findConversionRoute(capability, "md") !== null)) {
        if (!checking) {
          void actions.exportCurrentFileToMarkdown();
        }
        return true;
      }
      return false;
    },
  });

  actions.addLocalizedCommand("commandAddNumbering", {
    id: "add-numbering",
    checkCallback: (checking: boolean) => {
      const activeFile = actions.app.workspace.getActiveFile();
      if (activeFile && actions.activeFileSupports((capability) =>
        capability.inspection.supportedActions.includes("number markdown"))) {
        if (!checking) {
          void actions.numberingActions.add(activeFile);
        }
        return true;
      }
      return false;
    },
  });

  actions.addLocalizedCommand("commandRemoveNumbering", {
    id: "remove-numbering",
    checkCallback: (checking: boolean) => {
      const activeFile = actions.app.workspace.getActiveFile();
      if (activeFile && actions.activeFileSupports((capability) =>
        capability.inspection.supportedActions.includes("number markdown"))) {
        if (!checking) {
          void actions.numberingActions.remove(activeFile);
        }
        return true;
      }
      return false;
    },
  });

  actions.addLocalizedCommand("commandDoctor", {
    id: "doctor-check",
    callback: () => {
      void actions.runDoctorCheck();
    },
  });

  actions.addLocalizedCommand("commandProofread", {
    id: "proofread-md",
    checkCallback: (checking: boolean) => {
      const activeFile = actions.app.workspace.getActiveFile();
      if (activeFile && actions.activeFileSupports((capability) =>
        capability.inspection.supportedActions.includes("validate"))) {
        if (!checking) {
          void actions.proofreadActions.activateView().then(() => {
            void actions.proofreadActions.runActive();
          });
        }
        return true;
      }
      return false;
    },
  });

  actions.addLocalizedCommand("operationCancel", {
    id: "cancel-active-operation",
    checkCallback: (checking: boolean) => {
      const active = actions.operations.getSnapshot().operations;
      const latest = active[active.length - 1];
      if (!latest) return false;
      if (!checking) actions.operations.cancelGeneration(latest.generation);
      return true;
    },
  });

  actions.addLocalizedCommand("operationCancelAll", {
    id: "cancel-all-operations",
    checkCallback: (checking: boolean) => {
      if (actions.operations.getSnapshot().operations.length === 0) return false;
      if (!checking) actions.operations.cancelAll();
      return true;
    },
  });
}

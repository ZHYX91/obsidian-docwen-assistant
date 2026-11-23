import type { App, WorkspaceLeaf } from "obsidian";

import { AssistantView, ASSISTANT_VIEW_TYPE } from "../assistant-view";
import type { AssistantExportActions } from "../assistant-exports";
import type { ActionRunner } from "../actions/action-runner";
import type { ExportActions } from "../actions/export-actions";
import type { DocWenCapabilityService } from "../docwen";
import type { OperationCoordinator } from "../runtime/operation-coordinator";
import { resolveAbsoluteFilePath } from "./vault-files";

/** Closing the requested sidebar or unloading the plugin is a controlled cancellation. */
export class AssistantSidebarClosedError extends Error {}

export type OpenAssistantSidebar = () => Promise<AssistantView>;

/** Connect sidebar export discovery and execution to the existing file-action boundaries. */
export function createAssistantExportActions(
  app: App, capabilities: DocWenCapabilityService, exports: ExportActions, runner: ActionRunner,
): AssistantExportActions {
  return {
    getExportTargets: async (file, signal, refresh) => {
      const path = resolveAbsoluteFilePath(app.vault, file);
      if (!path) return [];
      const capability = await capabilities.previewFile(path, signal, refresh);
      return (["docx", "xlsx", "md"] as const).filter((target) =>
        capabilities.findConversionRoute(capability, target) !== null);
    },
    exportFile: (file, target) => {
      if (target === "docx") return exports.toDocx(file);
      if (target === "xlsx") return exports.toXlsx(file);
      return exports.toMarkdown(file);
    },
    showExportFailure: (error) => runner.presentFailure("noticeCapabilityFailed", error),
  };
}

/** A single host entry for opening/revealing the sidebar, without starting a user operation. */
export function createAssistantSidebarOpener(
  app: App, operations: OperationCoordinator, isActive: () => boolean,
): OpenAssistantSidebar {
  let pending: Promise<AssistantView> | null = null;
  const requireActive = (): void => {
    if (!isActive()) throw new AssistantSidebarClosedError("Assistant sidebar is no longer available.");
  };
  const activate = async (): Promise<AssistantView> => {
    requireActive();
    let leaf: WorkspaceLeaf | undefined = app.workspace.getLeavesOfType(ASSISTANT_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = app.workspace.getRightLeaf(false) ?? undefined;
      if (leaf) await leaf.setViewState({ type: ASSISTANT_VIEW_TYPE, active: true });
    } else if (leaf.isDeferred) {
      await leaf.loadIfDeferred();
    }
    const view = leaf?.view;
    const isOpen = view instanceof AssistantView ? view.captureLifetime() : () => false;
    // Cleanup owns only this runtime's captured view and its still-open lifetime.
    // An older opening must never detach a replacement created after reload.
    if (!isActive() && leaf && view instanceof AssistantView && view.belongsToRuntime(operations)
      && isOpen() && leaf.view === view
      && app.workspace.getLeavesOfType(ASSISTANT_VIEW_TYPE).includes(leaf)) leaf.detach();
    requireActive();
    if (!leaf || !(view instanceof AssistantView)) throw new Error("Assistant sidebar is unavailable.");
    if (!view.belongsToRuntime(operations)) throw new AssistantSidebarClosedError("Assistant runtime was replaced.");
    if (!isOpen()) throw new AssistantSidebarClosedError("Assistant sidebar was closed.");
    await app.workspace.revealLeaf(leaf);
    requireActive();
    if (!isOpen() || leaf.view !== view
      || !app.workspace.getLeavesOfType(ASSISTANT_VIEW_TYPE).includes(leaf)) {
      throw new AssistantSidebarClosedError("Assistant sidebar was closed.");
    }
    return view;
  };
  return () => {
    if (pending) return pending;
    const opening = activate();
    pending = opening;
    const clear = (): void => { if (pending === opening) pending = null; };
    void opening.then(clear, clear);
    return opening;
  };
}

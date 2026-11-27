import type { App } from "obsidian";

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
    showExportFailure: (error) => runner.presentFailure("noticeCapabilityFailed", error, "details"),
  };
}

/** Obsidian may reject a pending load or reveal after the user closes its leaf. */
async function awaitSidebarStep(work: () => Promise<unknown>, checkCurrent: () => void): Promise<void> {
  try { await work(); }
  catch (error) {
    checkCurrent();
    throw error;
  }
  checkCurrent();
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
    const existing = app.workspace.getLeavesOfType(ASSISTANT_VIEW_TYPE)[0];
    const leaf = existing ?? app.workspace.getRightLeaf(false);
    if (!leaf) throw new Error("Assistant sidebar is unavailable.");
    const load = !existing ? () => leaf.setViewState({ type: ASSISTANT_VIEW_TYPE, active: true })
      : leaf.isDeferred ? () => leaf.loadIfDeferred() : null;
    if (load) {
      const sameOpening = AssistantView.captureLeafOpening(leaf);
      await awaitSidebarStep(load, () => {
        const current = leaf.view;
        const registered = app.workspace.getLeavesOfType(ASSISTANT_VIEW_TYPE).includes(leaf);
        const replaced = !sameOpening();
        if (!isActive() && !replaced && registered && current instanceof AssistantView
          && current.belongsToRuntime(operations) && current.captureLifetime()()) leaf.detach();
        requireActive();
        if (replaced) throw new AssistantSidebarClosedError("Assistant sidebar was replaced.");
        if (!registered) {
          if (existing) throw new AssistantSidebarClosedError("Assistant sidebar was closed.");
          // A newly allocated right leaf belongs to the workspace even before it has a view type.
          let attached = false;
          app.workspace.iterateAllLeaves(candidate => { if (candidate === leaf) attached = true; });
          if (!attached) throw new AssistantSidebarClosedError("Assistant sidebar was closed.");
        }
        if (current instanceof AssistantView && !current.belongsToRuntime(operations)) {
          throw new AssistantSidebarClosedError("Assistant runtime was replaced.");
        }
      });
    }
    const view = leaf.view;
    if (!(view instanceof AssistantView)) throw new Error("Assistant sidebar is unavailable.");
    if (!view.belongsToRuntime(operations)) throw new AssistantSidebarClosedError("Assistant runtime was replaced.");
    const isOpen = view.captureLifetime();
    if (!isOpen()) throw new AssistantSidebarClosedError("Assistant sidebar was closed.");
    await awaitSidebarStep(() => app.workspace.revealLeaf(leaf), () => {
      requireActive();
      if (!isOpen() || leaf.view !== view || !app.workspace.getLeavesOfType(ASSISTANT_VIEW_TYPE).includes(leaf)) {
        throw new AssistantSidebarClosedError("Assistant sidebar was closed.");
      }
    });
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

import type { Editor, MarkdownView, Workspace, WorkspaceLeaf } from "obsidian";

export interface OpenMarkdownTarget {
  readonly leaf: WorkspaceLeaf;
  readonly view: MarkdownView;
  readonly editor: Editor;
}

export type OpenMarkdownTargetLookup =
  | { readonly kind: "closed" }
  | { readonly kind: "open"; readonly target: OpenMarkdownTarget }
  | { readonly kind: "ambiguous" };

export function locateOpenMarkdownTarget(
  workspace: Workspace,
  path: string,
): OpenMarkdownTargetLookup {
  const matches: OpenMarkdownTarget[] = [];
  for (const leaf of workspace.getLeavesOfType("markdown")) {
    const view = leaf.view as MarkdownView;
    if (view.file?.path === path) matches.push({ leaf, view, editor: view.editor });
  }
  if (matches.length === 0) return { kind: "closed" };
  if (matches.length > 1) return { kind: "ambiguous" };
  return { kind: "open", target: matches[0]! };
}

export function isSameOpenMarkdownTarget(
  workspace: Workspace,
  path: string,
  expected: OpenMarkdownTarget,
): boolean {
  const current = locateOpenMarkdownTarget(workspace, path);
  return current.kind === "open"
    && current.target.leaf === expected.leaf
    && current.target.view === expected.view
    && current.target.editor === expected.editor;
}

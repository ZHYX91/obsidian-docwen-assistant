import { MarkdownView, TFile, type App, type Editor, type EditorPosition, type WorkspaceLeaf } from "obsidian";
import type { ProofreadIssue } from "../docwen";
import { locateOpenMarkdownTarget, type OpenMarkdownTarget } from "./open-markdown-target";
import { normalizeProofreadText, proofreadSourceDigest } from "./proofread-source";

type NavigationResult = "selected" | "stale" | "needs-editor" | "superseded";

// A second click during a view transition must not start another transition that
// could restore its own cursor after the latest issue has already been selected.
const transitions = new WeakMap<WorkspaceLeaf, { file: TFile; ready: Promise<void> }>();

function shareTransition(leaf: WorkspaceLeaf, file: TFile, begin: () => Promise<void>): Promise<void> {
  const pending = transitions.get(leaf);
  if (pending?.file === file) return pending.ready;
  const ready = begin().finally(() => {
    if (transitions.get(leaf)?.ready === ready) transitions.delete(leaf);
  });
  transitions.set(leaf, { file, ready });
  return ready;
}

function sourceText(target: OpenMarkdownTarget): string {
  return target.view.getMode() === "preview" ? target.view.getViewData() : target.editor.getValue();
}

export async function selectProofreadIssue(
  app: App, path: string, digest: string, issue: ProofreadIssue, isCurrent: () => boolean,
): Promise<NavigationResult> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile) || !/^[a-f0-9]{64}$/u.test(digest)) return "stale";
  const original = locateOpenMarkdownTarget(app.workspace, path);
  if (original.kind === "ambiguous") return "stale";
  const existing = original.kind === "open" ? original.target : null;
  if (!existing && !path.toLowerCase().endsWith(".md")) return "needs-editor";
  const leaf = existing?.leaf ?? app.workspace.getLeaf(false);
  const transition = transitions.get(leaf);
  const pending = transition?.file === file ? transition.ready : null;
  if (existing && (existing.view.file !== file || (!pending && proofreadSourceDigest(sourceText(existing)) !== digest))) {
    return "stale";
  }
  const currentTarget = (): OpenMarkdownTarget | null => {
    if (file.path !== path || app.vault.getAbstractFileByPath(path) !== file) return null;
    const current = locateOpenMarkdownTarget(app.workspace, path);
    return current.kind === "open" && current.target.leaf === leaf && current.target.view instanceof MarkdownView
      && current.target.view.file === file ? current.target : null;
  };
  if (pending) await pending;
  else if (existing) await app.workspace.revealLeaf(leaf);
  else await shareTransition(leaf, file, () => leaf.openFile(file, { active: true, state: { mode: "source" } }));
  if (!isCurrent()) return "superseded";

  let target = currentTarget();
  if (!target || (existing && !pending && (existing.view !== target.view || existing.editor !== target.editor))) return "stale";
  if (target.view.getMode() === "preview") {
    if (proofreadSourceDigest(sourceText(target)) !== digest) return "stale";
    await shareTransition(leaf, file, () => {
      const state = leaf.getViewState();
      return leaf.setViewState({ ...state, state: { ...state.state, file: path, mode: "source" } });
    });
    if (!isCurrent()) return "superseded";
    // A deliberate mode switch may replace the editor. Reacquire it only from
    // this exact leaf and file, with the same unambiguous report source.
    target = currentTarget();
  }
  if (!target || target.view.getMode() !== "source" || proofreadSourceDigest(target.editor.getValue()) !== digest) return "stale";
  const { editor } = target;
  const from = editorPosition(editor, issue.range.start);
  const to = editorPosition(editor, issue.range.end);
  if (!from || !to || normalizeProofreadText(editor.getRange(from, to)) !== normalizeProofreadText(issue.matched_text)) {
    return "stale";
  }
  editor.focus();
  editor.setSelection(from, to);
  editor.scrollIntoView({ from, to }, true);
  return "selected";
}

function editorPosition(editor: Editor, { line, column }: ProofreadIssue["range"]["start"]): EditorPosition | null {
  if (line >= editor.lineCount()) return null;
  const ch = unicodeColumnToUtf16Column(editor.getLine(line), column);
  return ch === null ? null : { line, ch };
}

/** The report parser guarantees nonnegative integers. Refuse a position past end of line. */
export function unicodeColumnToUtf16Column(line: string, column: number): number | null {
  let offset = 0;
  for (const codePoint of line) {
    if (column === 0) break;
    offset += codePoint.length;
    column--;
  }
  return column === 0 ? offset : null;
}

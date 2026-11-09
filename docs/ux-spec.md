---
source_language: zh-CN
translation_of: ux-spec.zh-CN.md
translation_status: synced
---

# DocWen Assistant — UX specification

[简体中文源文](ux-spec.zh-CN.md)

## Entry points

The ribbon icon and independent Open DocWen Assistant sidebar command only open or focus the general Assistant sidebar. Opening it starts no GUI action, proofreading, capability discovery or connection check. It remains available without a current file or configured DocWen installation. Concurrent or repeated opens reuse one leaf and retain the report, focus and scroll.

The sidebar provides three explicit buttons: Open DocWen, Open current file in DocWen, and Proofread current Markdown file. Without a local file, the latter two are disabled; for a non-Markdown file only proofreading is disabled. While this sidebar owns a running proofreading task, repeat proofreading is disabled and GUI controls remain independently available. File actions read the host's current file again when clicked and never cache a TFile. Obsidian's getActiveFile returns the most recently active file when the active view is not a FileView, so focusing the sidebar does not invalidate file actions. The host's new state after switching, closing, renaming or deleting a file governs the next action. Updating file context does not replace the existing report, whose refresh remains bound to its original source.

The file explorer **DocWen** submenu and Command Palette continue to expose independent actions. Export menu availability follows current-file inspection and Machine capabilities rather than extension guesses. Sidebar file eligibility does not replace execution-time inspection, capability checks or source-identity validation.

When inspection and discovery succeed but no available Machine capability matches the file, explain that the feature is unsupported or unavailable in the current environment, rather than reporting a malformed response. Actual query failures remain failures and are never disguised as an empty capability list.

## Export flow

Export first inspects the source and available capabilities, then offers the target format, template, or supported optimization. Choose an output folder, then review the captured source, format, destination and applicable options before choosing Export. The template row shows the selected resource name and its built-in or custom origin; conversion still sends the stable resource ID. Direct spreadsheet export has no template row. The summary uses the same capability-filtered conversion request, including Word export proofreading rules; omitted options follow DocWen configuration. Cancel starts no conversion or proofreading. When enabled for Markdown-to-Word, the four selected rules override DocWen defaults and run on the generated Word document with Word comments, without proofreading or changing the Markdown source. Spreadsheet export never invokes proofreading or shows proofreading options. Older backends without the required document-proofreading capability stop before export and explain how to upgrade DocWen or disable Word export proofreading. Disabling it preserves ordinary conversion compatibility. A single DOCX or XLSX is saved directly in the selected folder when DocWen returns one file. Markdown and grouped outputs retain their own result folder, preserving generated filenames, linked resources and attachments. Names include the source name, timestamp and input format. Existing output files and result folders are never overwritten. Completion offers Open result folder for the containing folder, including when cleanup warnings also offer Details. A failed native folder-open action leaves the export successful and shows the folder for manual opening.

Template, optimization and numbering choices remain part of the active operation and can be cancelled. Cancelling or replacing that operation closes its plugin picker; an old choice cannot start a conversion. Detected-format confirmation shows the captured source, declared format and detected format, and states that continuing reads the file as the detected format. A missing declared format has an explicit localized unknown value. The dialog uses localized Cancel and Continue controls and closes when its operation is cancelled. The export-review dialog has the same cancellation ownership.

## Numbering and proofreading

Heading numbering runs against an isolated copy and rechecks the uniquely path-matched Markdown leaf, view, editor, and source snapshot before commit; multiple matching views fail closed. Proofreading appears in a sidebar and never rewrites the note directly. Issue items are keyboard-operable controls, and closing the view cancels only the proofreading generation owned by that view. GUI control belongs to its independent action, while plugin unload disposes all owned operations. Issue navigation is bound to the source digest captured for the report; content and editor identity are checked around file opening, and changes or ambiguity require a refresh instead of applying old positions. A new report, view closure, or new proofreading operation invalidates pending navigation from the old report.

The sidebar reacts only to its own operation’s generation, kind and state. Unrelated background work leaves its DOM and keyboard focus intact. Sorting or changing the interface language retains the focused control and issue-list scroll when the same item remains available; a new report does not reuse a stale issue target.

Reports initially render up to 200 issues and show the displayed and total counts. Show more adds up to 200 issues without dropping results; keyboard activation focuses the first newly displayed issue. Sorting and language changes retain the loaded count, focus and scroll. A new report resets the displayed count, and controls from an older report or closed view cannot expand it.

Ordinary batch loading appends only new issue controls and reuses the current report/sort order. Existing issue buttons and toolbar controls stay connected, so reading all batches does not repeatedly recreate earlier results.

## States and recovery

Long-running actions expose running and cancellation states. A settings-save failure preserves the user's changed model and offers retry. Machine, automatic-alias, manual-path, conflict, and protocol failures show a stable user-facing summary with sanitizable technical details instead of appearing as a successful empty result. A Machine mismatch names the protocol actually sent by Assistant and the protocol supported by DocWen; an old product shows both the minimum and actual version. Background integration failure must not incorrectly disable the independent Launch/Open DocWen entry point.

Completion waits for owned cleanup. If a result was published but cleanup or a follow-up step fails, one notice retains the successful result and offers Details; it does not open a second error dialog automatically. Details can be inspected and copied on request. Preparation and cancelled-operation cleanup warnings do not claim that a result exists. An unconfirmed write asks the user to check the destination before running again. Warning diagnostics contain codes and phases, not raw exception text or document content.

Error-detail previews and copies use the same redacted data: stable codes, user summaries, confirmed states, compatibility versions, counts and timeouts. Arbitrary exception text, underlying responses, document content, local paths, command lines and credentials are excluded; unknown fields are not serialized. Ordinary failures also offer Details from the same notice and never overwrite the clipboard automatically.

## Settings surface

The four top tabs are General, Export to Markdown, Export to Word, and Proofreading; there is no standalone Usage tab. Short help cards live on the relevant tabs and follow the same information icon, accent border, and theme-variable treatment as sibling plugins. General defaults to automatic Microsoft Store discovery, shows a verified connection status, and reveals path controls only for a manual portable installation. Assistant settings override individual tasks started by Assistant and never rewrite DocWen's own saved settings. The Obsidian 1.13 surface renders the tabs from one shared page model. Building the top tabs performs no filesystem or process work; the General status row may start one silent bounded connection check after it is rendered. When persisted settings declare an invalid or newer schema, a prominent incompatibility notice identifies the stored and supported versions, every settings control is disabled, and no retry or save path may rewrite the data. In manual mode, the installation location appears immediately below the connection method. The connection card keeps application control and background integration distinct and stacks native Check, Launch DocWen and Details buttons in that order. Repeated clicks on a pending action do not start another copy; completion cannot update a dismissed settings surface. Background-check failure leaves Launch available.

General includes User guide and Report a problem links. The guide opens the selected language’s README. Ordinary controls follow the host cursor preference.

## Localization

The UI, notices, and resource queries use one resolved locale. The default follows Obsidian and users can select a supported language explicitly. Open proofreading reports update their text, accessible labels, language and direction immediately when settings select a different effective locale. Saving other settings leaves the report intact. Locale changes never alter capability, path, or write semantics.

## Accessibility and layout

The tab list exposes complete tab, tabpanel, selection, and roving-tabindex semantics. Left/Right honor RTL, Up/Down move between tabs, Home/End jump to boundaries, and the active tab scrolls into view. The active tab combines an accent underline with a semibold label, and stable space separates the baseline from the content panel. Tabs tolerate 20 px UI text, narrow widths, third-party themes, and 44 px coarse-pointer targets. A tab is the page heading, so its panel never repeats the same title. Cancel, retry, and issue controls remain keyboard operable and use native Obsidian controls and theme variables.

The Assistant sidebar uses focusable native buttons for its three actions, with visible localized labels and targets at least 44 px high. Long labels, filenames and RTL text wrap in narrow sidebars; controls use theme colors and focus outlines. Short sidebars allow the entire content to scroll, and long reports retain a separate scrollable list.

## Safety feedback

The UI makes the destination visible before a write and refuses to commit if source or target identity changes. Logs, errors, and public support material must not expose private text, Vault paths, CLI paths, or credentials.

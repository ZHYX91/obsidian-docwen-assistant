---
source_language: zh-CN
translation_of: ux-spec.zh-CN.md
translation_status: synced
---

# DocWen Assistant — UX specification

See the [shared plugin interface](https://github.com/ZHYX91/obsidian-property-order/blob/main/docs/shared-ui.md) for cross-plugin interaction and visual conventions.

[简体中文源文](ux-spec.zh-CN.md)

## Entry points

The ribbon icon and independent Open DocWen Assistant sidebar command only open or focus the general Assistant sidebar, without starting a GUI action, proofreading or conversion. A new sidebar defaults to Proofreading and starts no capability discovery or connection check; the selected tab is saved in leaf state. It remains available without a current file or configured DocWen installation. Concurrent or repeated opens reuse one leaf and retain the report, selected tab, focus and scroll.

The sidebar has two internal tabs, Proofreading and Actions. Proofreading shows the current Markdown file, a start button and a source-labelled report with refresh, sorting, progress and cancellation. Actions shows the current filename and path, applicable export formats, then Open DocWen and Open current file in DocWen. Without a local file, file actions are disabled; non-Markdown files disable proofreading. While this sidebar owns a running proofreading task, repeat proofreading is disabled and GUI controls remain independently available. File actions read the host's current file again when clicked rather than substituting a previously displayed file object for the new state. Obsidian's getActiveFile returns the most recently active file when the active view is not a FileView, so focusing the sidebar does not invalidate file actions. The host's new state after switching, closing, renaming or deleting a file governs the next action. Updating file context does not replace the existing report, whose refresh remains bound to its original source.

Switching tabs retains the report, task and each panel's scroll position without cancelling proofreading. Proofreading started from the context menu or Command Palette selects Proofreading; completion must not switch away from Actions if the user subsequently chose it. Entering Actions or explicitly refreshing its export list discovers available export formats through current-file inspection and Machine capabilities, without starting conversion. A file change invalidates the previous query; leaving Actions or closing the sidebar cancels that panel's pending query, whose late results must not update another file or a closed view. A successful query with no export formats shows an unavailable-format message. An actual query failure shows a failure state with retry and diagnostic details. Background-integration failure leaves the independent GUI actions available.

The file explorer **DocWen** submenu and Command Palette continue to expose independent actions. Export menu availability follows current-file inspection and Machine capabilities rather than extension guesses. Sidebar file eligibility does not replace execution-time inspection, capability checks or source-identity validation.

When inspection and discovery succeed but no available Machine capability matches the file, explain that the feature is unsupported or unavailable in the current environment, rather than reporting a malformed response. Actual query failures remain failures and are never disguised as an empty capability list.

## Export flow

Export first inspects the source and available capabilities, then offers the target format, template, or supported optimization. Choose an output folder, then review the captured source, format, destination and applicable options before choosing Export. The template row shows the selected resource name and its built-in or custom origin; conversion still sends the stable resource ID. Direct spreadsheet export has no template row. The summary uses the same capability-filtered conversion request, including Word export proofreading rules; omitted options follow DocWen configuration. Cancel starts no conversion or proofreading. When enabled for Markdown-to-Word, the four selected rules override DocWen defaults and run on the generated Word document with Word comments, without proofreading or changing the Markdown source. Spreadsheet export never invokes proofreading or shows proofreading options. Older backends without the required document-proofreading capability stop before export and explain how to upgrade DocWen or disable Word export proofreading. Disabling it preserves ordinary conversion compatibility. A single DOCX or XLSX is saved directly in the selected folder when DocWen returns one file. Markdown and grouped outputs retain their own result folder, preserving generated filenames, linked resources and attachments. Names include the source name, timestamp and input format. Existing output files and result folders are never overwritten. Completion offers Open result folder for the containing folder, including when cleanup warnings also offer Details. A failed native folder-open action leaves the export successful and shows the folder for manual opening.

Template, optimization and numbering choices remain part of the active operation and can be cancelled. Cancelling or replacing that operation closes its plugin picker; an old choice cannot start a conversion. Detected-format confirmation shows the captured source, declared format and detected format, and states that continuing reads the file as the detected format. A missing declared format has an explicit localized unknown value. The dialog uses localized Cancel and Continue controls and closes when its operation is cancelled. The export-review dialog has the same cancellation ownership.

## Numbering and proofreading

Heading numbering runs against an isolated copy and rechecks the uniquely path-matched Markdown leaf, view, editor, and source snapshot before commit; multiple matching views fail closed. Proofreading appears in a sidebar and never rewrites the note directly. Issue items are keyboard-operable controls, and closing the view cancels only the proofreading generation owned by that view. GUI control belongs to its independent action, while plugin unload disposes all owned operations. Issue navigation is bound to the source digest captured for the report; content and editor identity are checked around file opening, and changes or ambiguity require a refresh instead of applying old positions. When issue selections overlap, only the most recent selection can move the editor or mark the report stale. A new report, view closure, or new proofreading operation invalidates pending navigation from the old report.

The sidebar reacts only to its own operation’s generation, kind and state. Unrelated background work leaves its DOM and keyboard focus intact. Sorting or changing the interface language retains the focused control and issue-list scroll when the same item remains available; a new report does not reuse a stale issue target.

Reports initially render up to 200 issues and show the displayed and total counts. Show more adds up to 200 issues without dropping results; keyboard activation focuses the first newly displayed issue. Sorting and language changes retain the loaded count, focus and scroll. A new report resets the displayed count, and controls from an older report or closed view cannot expand it.

Ordinary batch loading appends only new issue controls and reuses the current report/sort order. Existing issue buttons and toolbar controls stay connected, so reading all batches does not repeatedly recreate earlier results.

## States and recovery

Long-running actions announce running and cancellation states. The status bar keeps the cancel control focused when the number of operations changes. Cancel all applies to operations active when the user invokes it. A settings-save failure preserves the user's changed model and offers retry. Machine, automatic-alias, manual-path, conflict, and protocol failures show a stable user-facing summary with sanitizable technical details instead of appearing as a successful empty result. A Machine mismatch names the protocol actually sent by Assistant and the protocol supported by DocWen; an old product shows both the minimum and actual version. Background integration failure must not incorrectly disable the independent Launch/Open DocWen entry point.

Completion waits for owned cleanup. If a result was published but cleanup or a follow-up step fails, one notice retains the successful result and offers Details; it does not open a second error dialog automatically. Details can be inspected and copied on request. Preparation and cancelled-operation cleanup warnings do not claim that a result exists. An unconfirmed write asks the user to check the destination before running again. Warning diagnostics contain codes and phases, not raw exception text or document content.

Error-detail previews and copies use the same redacted data: stable codes, user summaries, confirmed states, compatibility versions, counts and timeouts. Arbitrary exception text, underlying responses, document content, local paths, command lines and credentials are excluded; unknown fields are not serialized. Ordinary failures also offer Details from the same notice and never overwrite the clipboard automatically.

Report navigation treats LF, CRLF and CR as equivalent line boundaries and checks the full content, including text outside the selected issue.

## Settings surface

The four top tabs are General, Export to Markdown, Export to Word, and Proofreading; there is no standalone Usage tab. Brief guidance appears as a single muted paragraph on its tab. The Word tab opens with a “How to export to Word” disclosure. The guide has separate sections on choosing a template, enabling input extensions and setting numbering. General defaults to automatic Microsoft Store discovery, shows a verified connection status, and reveals path controls only for a manual portable installation. Assistant settings override individual tasks started by Assistant and never rewrite DocWen's own saved settings. The Obsidian 1.13 surface renders the tabs from one shared page model. Building the top tabs performs no filesystem or process work; the General status row may start one silent bounded connection check after it is rendered. When persisted settings declare an invalid or newer schema, a prominent incompatibility notice identifies the stored and supported versions, every settings control is disabled, and no retry or save path may rewrite the data. In manual mode, the installation location appears immediately below the connection method. The connection card keeps application control and background integration distinct and stacks native Check, Launch DocWen and Details buttons in that order. Repeated clicks on a pending action do not start another copy; completion cannot update a dismissed settings surface. Background-check failure leaves Launch available.

General includes User guide and Report a problem links. The guide opens the selected language’s README. Ordinary controls follow the host cursor preference.

## Localization

The UI, notices, and resource queries use one resolved locale. The default follows Obsidian and users can select a supported language explicitly. Open proofreading reports update their text, accessible labels, language and direction immediately when settings select a different effective locale. Saving other settings leaves the report intact. Locale changes never alter capability, path, or write semantics.

## Accessibility and layout

The settings tab list exposes complete tab, tabpanel, selection, and roving-tabindex semantics. Left/Right honor RTL, Up/Down retain native page scrolling, Home/End jump to boundaries, and the active tab scrolls into view. When tabs extend beyond the settings bar, a theme-accent chevron appears at each edge with hidden tabs. Clicking it scrolls the bar without changing the selected page. The controls disappear when all tabs fit and have 44 px targets on touch screens. The active tab combines an accent underline with a semibold label, and stable space separates the baseline from the content panel. Tabs tolerate 20 px UI text, narrow widths, third-party themes, and 44 px coarse-pointer targets. A tab is the page heading, so its panel never repeats the same title. Cancel, retry, and issue controls remain keyboard operable and use native Obsidian controls and theme variables.

The Assistant sidebar follows Number Suite and Link Integrity's equal-width two-tab layout: muted inactive labels, a semibold active label with a 2 px theme-accent underline, a light hover background, and a focus outline that preserves the selected marker. Tabs expose tablist, tab, tabpanel, aria-controls, aria-labelledby and roving-tabindex semantics; Left/Right honor RTL and Home/End select the boundaries. The sidebar does not repeat the plugin or tab title above its contents. Filenames, muted paths, section labels and whitespace establish hierarchy; actions use vertically stacked native buttons with consistent spacing, and the proofreading toolbar stays compact. Fonts, colors, radii and spacing use Obsidian theme variables. Long labels, filenames and RTL text wrap in narrow sidebars; coarse-pointer targets are at least 44 px. Short sidebars allow panel scrolling, and long reports retain a separate scrollable list.

## Safety feedback

The UI makes the destination visible before a write and refuses to commit if source or target identity changes. Logs, errors, and public support material must not expose private text, Vault paths, CLI paths, or credentials.

## Instruction versus operation state

General scope, Markdown source-format and proofread report boundaries remain short always-visible Setting descriptions. The Word format/preset/numbering guidance is a low-emphasis native details tutorial, collapsed by default, expanded only for the current settings-window session, and reset on hide. The card has a faint theme-accent background and a neutral border in both states. Its chevron and the reading-edge line beside the expanded instructions share the theme accent. The inset narrows with the settings pane. Actual template choices, CLI location/status, connection diagnostics, check actions, save failures and unsupported-format warnings remain visible; they are operational controls, not tutorial content. No persisted setting or process protocol changes.

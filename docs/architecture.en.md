---
source_language: zh-CN
translation_of: architecture.zh-CN.md
translation_status: synced
---

# DocWen Assistant — Architecture

[简体中文源文](architecture.zh-CN.md)

## Layers

`src/main.ts` owns only plugin composition and lifecycle. `src/actions/` orchestrates user operations; `src/docwen/` owns path, Machine protocol, and Artifact Bundle boundaries; `src/host/` adapts Obsidian, Electron, and the filesystem; `src/runtime/` manages concurrency and disposal. The top-tab settings surface uses one shared page model without depending on sibling repositories. Settings persistence uses schema v1: unversioned data is normalized once into an owned snapshot, while an invalid or newer explicit schema is opened read-only and is never rewritten. Localization uses one shared model.

## DocWen process boundary

The child inherits the platform profile-directory variables and explicit `DOCWEN_DATA_DIR`, `DOCWEN_CONFIG_DIR`, `DOCWEN_LOG_DIR` and truthy `DOCWEN_LOG_TO_TEMP` within a bounded environment. DATA selects a whole profile; CONFIG and LOG are component overrides. Relative selectors resolve against the parent working directory before spawning. Unrelated variables and credentials are excluded.

Windows automatic mode directly starts the fixed `%LOCALAPPDATA%\\Microsoft\\WindowsApps\\docwen.exe` execution alias from a safe temporary working directory; it never resolves a bare command through `PATH` or discovers or stores the versioned Microsoft Store package path. Manual mode resolves a selected DocWen folder, `DocWen.exe`, or `DocWenCLI.exe` to the exact sibling CLI on Windows, and a selected folder, `DocWen`, or `DocWenCLI` to the exact CLI on Linux; Linux does not use automatic alias discovery. Content operations such as conversion, proofreading, numbering, discovery, and connection checks start `serve --stdio` with `shell: false`, canonical `Content-Length` framing, and JSON-RPC 2.0, then verify DocWen 0.13.0 or later, Machine Protocol 2.0, Artifact Bundle v3, and server identity. Product versions are bound to their session and may be pinned exactly for candidate acceptance. Application status and launch/open use the independent local `gui status --json` and `gui open --json` control commands and validates its CLI protocol-3 success envelope without first negotiating Machine, so background protocol incompatibility cannot prevent opening the desktop app.

## Request data flow

Optimizer selection joins resource IDs to executable `transform` capabilities by `optimization_id`,
typed input shape, output media type, and availability. `conversion-selection.ts` validates the exact
selected capability against the prepared input handles. Actions pass their discovered capability to
execution; unavailable or ambiguous optimizers cannot fall back to ordinary conversion. The selected
capability owns its option set, while Core rechecks the complete preconversion chain at acceptance.

An action first captures an isolated snapshot from the uniquely path-matched open Markdown editor, including a background split, or from the Vault file when no such editor is open. More than one open editor for the same path fails closed. The action then creates input handles with kind, media type, canonical logical path, size, and SHA-256. Inspection and capability facts decide whether an action is supported. Plan and execute use the same capability and input facts without inferring support from extensions or route IDs.

For Markdown-to-DOCX, the Assistant always uses DocWen's source-native Markdown capability. The isolated authored Markdown remains the authoritative source. Images explicitly embedded by that note are resolved through Obsidian's metadata cache and supplied as declared `linked_resource` inputs (PNG, JPEG, GIF, BMP, or WebP) with canonical logical paths, bytes, media types, sizes, and SHA-256 identities. Short Wiki links, cross-folder links, and filenames containing spaces follow Obsidian's own resolution result. The Assistant neither enumerates the Vault nor scans for same-named files, and DocWen never searches the Vault for a resource.

The Assistant does not use Number Suite runtime state to decide conversion semantics or numbering. Installing, disabling, or removing Number Suite therefore cannot change a Word export for the same authored Markdown, the same declared resources, the same DocWen Markdown-extension configuration, and the same request-scoped export preferences. Number Suite syntax is interpreted by DocWen's own source consumer. The optional `number-suite.interop.v2` compatibility code is not an export authority and is not consulted by the Word-export action.

Word numbering is request-scoped. The Assistant forwards its explicit Markdown-to-Word clean/add-numbering preferences, selected DocWen numbering-scheme ID, and heading-numbering render mode only when the selected source-native capability advertises those options. It does not copy Number Suite's current `enabled`, `derivedNumber`, display template, or other private plugin state into the request. Omitting a preference leaves the corresponding DocWen capability/config default in control. Markdown-extension choices likewise remain owned by DocWen; the Assistant does not silently force `captions_references` or another dialect on.

Declared Markdown inputs are built lazily, once per snapshot, only when the selected Word export needs them. Raw-source actions do not read Number Suite semantic metadata. Deferred construction retains cancellation and source-conflict checks.

## Artifacts and commit

DocWen writes only to a request-owned staging directory. Assistant validates Bundle v3 identity, graph, logical paths, roles, relations, regular-file identity, sizes and SHA-256 hashes. Conversion requires `docwen.document_node.v1`. The complete logical directory is prepared beside the chosen parent and published with one atomic no-replace directory rename; an existing result root, including an empty or non-empty root created by an external writer after the final collision check, is never replaced. Windows uses the operating system's no-replace directory rename behavior. Linux x64 uses a minimal `renameat2(RENAME_NOREPLACE)` Node-API 8 boundary whose bytes are embedded in `main.js`, SHA-256-verified before loading, and add no new plugin runtime asset or sibling-repository runtime dependency. Unsupported Linux architectures, runtimes, kernels, or filesystems fail closed before publication. Ordinary conversion requires no node JSON; sizes, hashes and relations come from the validated Bundle. The UI lists business outputs and excludes bound layout manifests and image resources from its output count.

Source-native Markdown-to-DOCX contains one preferred DOCX and one primary entry with size and SHA-256 in the validated Bundle. Ordinary conversion does not require a node JSON. No original-source companion is used. Reverse conversion reads the independent DOCX. Valid unnumbered references retain their resolved target with an empty cached_number, displaying Alias or the current title.

`output-files` owns file publication and rollback; `output-directory` owns complete result directories. `operation-outcome` permits one owned commit attempt. A host callback cannot report success without committing, trigger another commit, or turn an established publication into rollback. Backup, lock, task-staging and input-snapshot cleanup failures accompany the completed result as structured warnings. Changed cleanup targets are preserved. Cleanup never replaces the primary failure before publication.

## Vault writes

Export captures the chosen parent directory identity before conversion. Publication rechecks the parent, source snapshot and prepared bytes, rejects an existing result root or an editor open inside that root, and checks cancellation before the atomic no-replace rename. The final collision check is only an early diagnostic; safety does not depend on there being no external writer between that check and publication. Unrelated files and editors in the chosen parent do not block export.

Proofreading only reads a report. Numbering is generated in an isolated file, and `VaultWriteTransaction` compares the original snapshot with the uniquely path-matched Markdown leaf, view, and editor state. It commits once through the Editor or Vault API only when all still match. A second matching view, an open/closed transition, plugin unload, view closure, or a conflict cancels or refuses the write.

Once the editor buffer or Vault API confirms the expected content, save scheduling or subsequent identity changes produce warnings. If the host accepts content but does not confirm the write, the result is explicitly unconfirmed and is never retried automatically. This does not claim that an editor buffer has already been persisted to disk.

## Lifecycle and resources

Content-operation inspection, capability discovery when needed, planning and execution share one initialized Machine process. Preparation queries retain a 30-second response deadline within the ten-minute operation budget. The process closes after validation and is not cached across operations; input and publication integrity checks remain in place.

Tasks have timeouts, protocol frame and queue limits, a stderr cap, and explicit cancellation. Asynchronous Machine stdin Writable failures, including delayed `EPIPE` after the peer closes its read end, enter the same session failure queue, reject waiters, and trigger idempotent bounded process-tree cleanup; cancellation that arrives after `stdin.end()` does not write to an ended stream. Cancellation after task acceptance sends `task/cancel` and terminates the owned process tree when necessary. Changing the DocWen target cancels active work and resets connection checks, capability projection, file caches, and pending preloads as one generation; invalidated requests cannot restore stale state. The runtime disposer, operation coordinator, and settings-save queue stop observers, release views, and settle or terminate owned work during unload.

On Windows, Machine lifetime is owned by an x64 controller embedded in `main.js` and verified at runtime by SHA-256 and PE identity. The controller creates a Job with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` and uses `PROC_THREAD_ATTRIBUTE_JOB_LIST` to assign the suspended DocWen process atomically during `CreateProcessW`; descendants with independent stdio therefore remain under the same owner even when the direct DocWen process exits normally first, and are collected before the controller exits. Abnormal cleanup terminates only the currently held controller process, with the closing Job handle supplying termination authority; it never cleans by historical PID, process name, or ordinary-user process scan and never falls back to bare `spawn`/`taskkill`. Owner materialization or identity failure fails closed before DocWen starts. Linux keeps the existing procfs identity and process-group evidence chain.

An export or numbering operation owns its picker through the eventual write; selecting an item never starts a detached task. Cancellation, replacement and unload close plugin pickers and format confirmations and invalidate queued choices. Native directory dialogs may stay open until dismissed, but their returned paths are ignored after cancellation. File-menu discovery uses the same coordinator, and menu callbacks cannot invoke actions after unload.

Normal host exit registers cancelled-operation settlement with Obsidian's public `Workspace.quit` task collector. Settlement is tracked until each action's `finally` completes, including superseded operations and leases cancelled by earlier disposal. The wait is bounded to ten seconds so an unresolved native dialog or filesystem operation cannot hold the host indefinitely. Exceeding that deadline is logged; forced termination, a missing quit event or power loss cannot guarantee temporary-file cleanup.

## Trust boundaries

Obsidian documents, user paths, Machine messages, staging files, and GitHub release assets are all untrusted inputs. The product does not trust extensions, relative paths, symlinks, existing targets, unbound diagnostics, or a version string shown only in the UI. Release construction and publication are outside the product runtime: a thin repository adapter pins a self-contained vendored core by exact version and SHA-256, while acceptance and manual authorization remain external evidence. The public repository never imports its parent workspace or a sibling path.

## Subordinate protocol contract

The [Machine integration contract](cli-integration.md) freezes exact methods, capabilities, limits, and Bundle-consumption rules. This architecture document owns component boundaries; a change to either must keep both consistent in the same revision.

Settings show application control and background integration separately. Details identify the loaded manifest and compiled runtime versions, the initialization phase, sent and received protocols, and bounded server identity. Cancelling GUI control waits for the owned CLI process to close, escalates only that process after a grace period, and reports unconfirmed cleanup; it never terminates the desktop application.

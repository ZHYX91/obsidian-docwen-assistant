---
source_language: zh-CN
translation_of: architecture.zh-CN.md
translation_status: synced
---

# DocWen Assistant — Architecture

[简体中文源文](architecture.zh-CN.md)

## Layers

`src/main.ts` owns only plugin composition and lifecycle. `src/actions/` orchestrates user operations; `src/docwen/` owns path, Machine protocol, and Artifact Bundle boundaries; `src/host/` adapts Obsidian, Electron, and the filesystem; `src/runtime/` manages concurrency and disposal. The top-tab settings surface uses one shared page model without depending on sibling repositories. Localization uses one shared model.

## DocWen process boundary

Automatic mode directly starts the fixed `%LOCALAPPDATA%\\Microsoft\\WindowsApps\\docwen.exe` execution alias from a safe temporary working directory; it never resolves a bare command through `PATH` or discovers or stores the versioned Microsoft Store package path. Manual mode resolves a selected DocWen folder, `DocWen.exe`, or `DocWenCLI.exe` to the exact sibling CLI. Each operation starts `serve --stdio` with `shell: false`, canonical `Content-Length` framing, and JSON-RPC 2.0, then verifies Machine v1, server identity, and a stable 0.9.x product version.

## Request data flow

An action first captures an isolated snapshot from the uniquely path-matched open Markdown editor, including a background split, or from the Vault file when no such editor is open. More than one open editor for the same path fails closed. The action then creates input handles with kind, media type, canonical logical path, size, and SHA-256. Inspection and capability facts decide whether an action is supported. Plan and execute use the same capability and input facts without inferring support from extensions or route IDs.

For Markdown-to-DOCX, the original snapshot is used only for inspection, proofreading, and conflict validation. The Assistant resolves images explicitly embedded by that note through Obsidian's metadata cache and supports PNG, JPEG, GIF, BMP, and WebP. Short Wiki links, cross-folder links, and filenames containing spaces follow Obsidian's own resolution result. The Assistant neither enumerates the Vault nor scans for same-named files. It packages each occurrence, authored token, media type, bytes, size, and SHA-256 into a `resolved_document`. It also authenticates DocWen's complete heading inventory, levels 1 through 9, and marks those headings explicitly unnumbered in the consumer-neutral `numbering_export_plan`; it neither guesses nor adds numbering. DocWen does not read the Vault or search for the image again.

When Number Suite is loaded at runtime and exposes `number-suite.interop.v2`, the Assistant validates
the plain-data snapshot's schema, ranges, targets, references, and counter consistency. The v2
contract carries H1-H9 targets, exactly nine counter values, and H1-H9 display segments, including
the shared Number Suite/DocWen H7-H9 extension. The Assistant then lowers
its effective enabled heading and caption numbers plus same-file references into DocWen's
`resolved_document` and exact-two `numbering_export_plan`. There is no build-time sibling-repository
dependency. If the plugin is absent, the explicit unnumbered plan remains the fallback. A malformed
API, source-conflicting facts, or numbering that cannot be represented safely fails closed; visible
text is never used to guess a number.

## Artifacts and commit

DocWen writes only to a request-owned staging directory. The Assistant accepts and validates only Artifact Bundle v2; every other Bundle schema fails closed. Validation covers Bundle identity, layout, logical paths, graph, roles, relations, physical paths, regular-file status, sizes, and hashes. The preferred artifact maps to the user-confirmed target and related resources use safe names. Commit uses exclusive creation, no-clobber links, backup, and rollback, while the CLI never receives a Vault target.

For the resolved-document route, DocWen's Machine Bundle must contain exactly one preferred DOCX and
one `application/vnd.docwen.round-trip-sidecar+zip` resource. The resource must have the sole
`resource_of(role=manifest, ordinal=0)` relation to that DOCX and the suggested name
`<DOCX suggested name>.docwen`. DocWen owns and creates the single-file sidecar; the Assistant never
reconstructs it from private inputs. The Assistant revalidates both staged files and commits them as
one adjacent pair, mapping the sidecar to the user-selected DOCX path plus `.docwen`. A missing,
damaged, additional, or ambiguously related sidecar fails before either output is published. When an
existing DOCX replacement is explicitly confirmed, its regular-file sidecar may be replaced in the
same rollback-safe transaction. During reverse conversion, missing or mismatched sidecar evidence
disables exact-source restoration while authenticated semantic recovery continues as canonical
Markdown.

## Vault writes

Proofreading only reads a report. Numbering is generated in an isolated file, and `VaultWriteTransaction` compares the original snapshot with the uniquely path-matched Markdown leaf, view, and editor state. It commits once through the Editor or Vault API only when all still match. A second matching view, an open/closed transition, plugin unload, view closure, or a conflict cancels or refuses the write.

## Lifecycle and resources

Tasks have timeouts, protocol frame and queue limits, a stderr cap, and explicit cancellation. Cancellation after task acceptance sends `task/cancel` and terminates the owned process tree when necessary. Changing the DocWen target cancels active work and resets connection checks, capability projection, file caches, and pending preloads as one generation; invalidated requests cannot restore stale state. The runtime disposer, operation coordinator, and settings-save queue stop observers, release views, and settle or terminate owned work during unload.

## Trust boundaries

Obsidian documents, user paths, Machine messages, staging files, and GitHub release assets are all untrusted inputs. The product does not trust extensions, relative paths, symlinks, existing targets, unbound diagnostics, or a version string shown only in the UI. Release construction and publication are outside the product runtime: a thin repository adapter pins a self-contained vendored core by exact version and SHA-256, while acceptance and manual authorization remain external evidence. The public repository never imports its parent workspace or a sibling path.

## Subordinate protocol contract

The [Machine integration contract](cli-integration.md) freezes exact methods, capabilities, limits, and Bundle-consumption rules. This architecture document owns component boundaries; a change to either must keep both consistent in the same revision.

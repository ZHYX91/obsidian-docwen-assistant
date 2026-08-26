---
source_language: zh-CN
translation_of: testing-strategy.zh-CN.md
translation_status: synced
---

# DocWen Assistant — Testing strategy

[简体中文源文](testing-strategy.zh-CN.md)

## Principles

Tests are separated by the evidence they can support. Source unit tests, mocked process integration, a fixed DocWen package, a real Obsidian host, manual Office checks, and public release state do not substitute for one another. Skips and external prerequisites remain unproven.

## Automated source tests

Vitest covers framing, Machine processes, cancellation, Bundle v2 validation and rejection of other schemas, capability projection, actions, Vault snapshots and transactions, settings, localization, runtime disposal, and release governance. Resource tests cover cross-folder short Wiki links, filenames with spaces, repeated-occurrence deduplication, UTF-16-to-Unicode-code-point coordinates, missing/unsupported/over-budget resources, and the exact `neutral_document + numbering_export_plan` pair. Negative cases prove failure before task planning or writes and verify resource cleanup afterward.

## Repository quality gate

Under the pinned toolchain, `npm run check` runs runtime verification, lint, formatting, README and stable-document contracts, coverage, type checking, build, artifact checks, and the high-severity dependency audit. Formatting and bilingual scripts read real repository content and are not placeholder no-ops.

## Fixed DocWen package

`npm run acceptance:docwen-package` accepts only a full DocWen Windows package bound to a version, candidate identity, and digest. It verifies Machine health, capabilities, the exact v4 input pair, DocWen heading levels 1 through 9, both current footnote forms and the current endnote form, Obsidian-resolved embedded resources, Unicode/space paths, actual DOCX image bytes, the `docwen.document_node.v1` manifest, and Bundle v2 write boundaries. Without an exact receipt it skips or fails closed and cannot be reported as source-suite success.

## Obsidian host

Real host acceptance covers the top-tab surface on the minimum Obsidian 1.12.7 host and a current 1.13.x host, each in a fresh isolated Vault and profile. It checks default and third-party themes, 16/20 px UI text, English and Chinese labels, narrow layouts, keyboard and RTL navigation, save-failure recovery, entry points, sidebar cancellation, file menus, zero process residue, and `data.json` preservation. Automated DOM tests do not replace those observations.

## Manual compatibility matrix

Windows manual checks cover DocWen GUI activation, native save dialogs, Word/Excel/Markdown outputs, numbering conflicts, and visible proofreading. When Office or real-document rendering matters, the application version, sample, candidate digest, and human conclusion are recorded separately.

## Safe fixtures

Tests use synthetic files, temporary directories, and dedicated Vaults only. An ordinary or production Vault is never a test target, and real `data.json` is never deleted, overwritten, or reconstructed. Logs and failure fixtures sanitize paths, document text, executable locations, and credentials.

## Release evidence

Two clean builds, the candidate ZIP, SHA256SUMS, attestations, tag identity, an immutable GitHub Release, and remote byte readback are release evidence. Workflow source or governance mock tests prove only that the contract exists, not that GitHub executed it successfully for the revision or that Community Plugins accepted it.

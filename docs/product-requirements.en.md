---
source_language: zh-CN
translation_of: product-requirements.zh-CN.md
translation_status: synced
---

# DocWen Assistant — Product requirements

[简体中文源文](product-requirements.zh-CN.md)

## Product position

DocWen Assistant is a Windows desktop Obsidian plugin that connects the current note or an explicitly selected Vault file to local DocWen. It serves users who want to launch DocWen, convert documents, manage heading numbering within one file, and review proofreading advice without leaving Obsidian.

## Compatibility prerequisites

The plugin requires Windows, Obsidian 1.12.7 or later, and either a Microsoft Store installation or a fully extracted portable package of stable DocWen 0.9.x. It accepts `docwen.machine.v1` and `docwen.artifact_bundle.v2`; other Bundle schemas and incompatible process envelopes fail closed.

## Core capabilities

- Launch or activate DocWen and optionally open the current file.
- Offer Word, Excel, and Markdown export according to file inspection and Machine capabilities.
- Add or remove heading numbering within one Markdown file.
- Show Markdown proofreading results in a read-only sidebar.
- Check the DocWen connection and expose a failure state when the installation, protocol, health, or a capability is unavailable.

## Data and write boundaries

The plugin creates an isolated snapshot only for a user-selected file, using its uniquely path-matched open Markdown editor content, including unsaved text in a background split, or the Vault file when it is closed. Multiple open editors for the same path fail closed. It does not enumerate the Vault for DocWen or upload documents. For Markdown-to-DOCX it resolves only image embeds explicitly present in that note's metadata cache and packages Obsidian's chosen file bytes as neutral resources. Missing, oversized, or unsupported images fail closed. Export targets are explicit, proofreading does not rewrite the source, and the separate numbering action commits once through the Obsidian Editor or Vault API only while the source snapshot and target identity still match. The CLI never writes a Vault path directly.

## Failure semantics

An operation fails closed when the registered DocWen alias or manual location, Machine response, input snapshot, Artifact Bundle, editor state, or target identity cannot be verified. Capability-query failures never masquerade as an empty supported set, and existing outputs are never silently replaced without confirmation.

## Non-goals

The plugin does not download DocWen, inspect the versioned Microsoft Store package path, recursively search for executables, support mobile, provide an alternate process protocol, or treat the Vault as a bulk-scan directory. It does not define cross-file composition numbering. Markdown-to-DOCX exposes no source heading-number controls; users use the separate numbering action when they need to change source Markdown heading numbers. There is no special Markdown syntax for starting, stopping, or resetting numbering within one file; embedded files retain their own real numbering; and the plugin adds no numbering- or OCR-specific YAML fields.

## Acceptance boundary

Source tests, fixed DocWen package tests, real minimum Obsidian 1.12.7 and current 1.13.x host acceptance, Windows manual checks, and public release are separate evidence layers. Passing a lower layer does not substitute for candidate or host evidence.

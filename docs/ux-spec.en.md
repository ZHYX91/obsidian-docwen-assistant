---
source_language: zh-CN
translation_of: ux-spec.zh-CN.md
translation_status: synced
---

# DocWen Assistant — UX specification

[简体中文源文](ux-spec.zh-CN.md)

## Entry points

Users can start actions from the ribbon icon, the file explorer **DocWen** submenu, and the Command Palette. Menu availability follows current-file inspection and Machine capabilities rather than extension guesses.

## Export flow

Export first inspects the source and available capabilities, then offers the target format, template, or supported optimization. The user explicitly selects a destination through the native save dialog. Format-extension conflicts and an existing preferred target require confirmation, while related resources never overwrite existing files.

## Numbering and proofreading

Heading numbering runs against an isolated copy and rechecks the uniquely path-matched Markdown leaf, view, editor, and source snapshot before commit; multiple matching views fail closed. Proofreading appears in a sidebar and never rewrites the note directly. Issue items are keyboard-operable controls, and closing the view cancels only the proofreading generation observed by that view.

## States and recovery

Long-running actions expose running and cancellation states. A settings-save failure preserves the user's changed model and offers retry. Machine, path, conflict, and protocol failures show a stable summary with sanitizable details instead of appearing as a successful empty result.

## Settings surface

The five top tabs are General, Export to Markdown, Export to Word, Proofreading, and Usage. The Obsidian 1.13 surface renders them from one shared page model. Building the top tabs must not access the filesystem or start the CLI.

## Localization

The UI, notices, and resource queries use one resolved locale. The default follows Obsidian and users can select a supported language explicitly. Locale changes never alter capability, path, or write semantics.

## Accessibility and layout

The tab list exposes complete tab, tabpanel, selection, and roving-tabindex semantics. Left/Right honor RTL, Up/Down move between tabs, Home/End jump to boundaries, and the active tab scrolls into view. The active tab combines an accent underline with a semibold label, and stable space separates the baseline from the content panel. Tabs tolerate 20 px UI text, narrow widths, third-party themes, and 44 px coarse-pointer targets. A tab is the page heading, so its panel never repeats the same title. Cancel, retry, and issue controls remain keyboard operable and use native Obsidian controls and theme variables.

## Safety feedback

The UI makes the destination visible before a write and refuses to commit if source or target identity changes. Logs, errors, and public support material must not expose private text, Vault paths, CLI paths, or credentials.

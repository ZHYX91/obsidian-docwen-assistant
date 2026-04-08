# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

DocWen Assistant — an Obsidian plugin (desktop-only, Windows) that integrates the DocWen document converter into Obsidian. It launches DocWen GUI, sends files via file-based IPC, and runs background CLI operations for format conversion and heading numbering.

## Commands

```bash
npm run dev          # Watch mode (esbuild only, no type-check)
npm run build        # Full build: tsc --noEmit (type-check) + esbuild (minified bundle)
npm run build:quick  # Fast build: esbuild only, skip type-check
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
npm run release      # Clean + full build + package to release/docwen-assistant/
```

No test framework — no test commands.

## Architecture

### Plugin lifecycle (Obsidian API)

`DocWenPlugin` (in `src/main.ts`) extends `Plugin`. On `onload()` it:
1. Initializes i18n from `document.documentElement.lang`
2. Loads persisted settings
3. Registers: ribbon icon, 8 command-palette commands, file-menu (right-click) context submenu

### Two execution modes for DocWen

- **GUI mode**: Spawns `DocWen.exe` as a detached child process. Single-instance detection uses a `status.json` PID file in `os.tmpdir()/docwen/`. IPC sends JSON command files to `os.tmpdir()/docwen/commands/`.
- **CLI mode**: Spawns `DocWenCLI.exe` synchronously (via `runCliJson`) with `--json --quiet` flags. Parses stdout as JSON. Used for: `convert`, `templates list`, `list optimizations`, `numbering-schemes list`, `md-numbering`, `doctor`.

Both executable paths are resolved with cross-correction (if user puts CLI path in GUI field or vice versa, plugin auto-detects the sibling exe).

### Settings flow

`PluginSettings` interface in `src/settings.ts` → `DEFAULT_SETTINGS` → `SettingTab` renders Obsidian settings UI. Settings include GUI/CLI paths, MD export options (extract images, OCR), and bidirectional numbering options (clean/add) for both doc→md and md→doc conversions. Numbering scheme dropdowns are populated asynchronously from CLI.

### i18n

`src/i18n.ts` contains a single `translations` record with 11 locale keys. Translation keys are defined by the `Translations` interface (~108 keys). `initI18n(locale)` resolves locale via direct match → alias → base language → fallback to English. All user-facing strings use `t(key, params?)` with `{placeholder}` interpolation.

When adding a new user-facing string: add the key to the `Translations` interface, then add translations for all 11 locales (zh-cn, zh-tw, en, de, fr, ru, pt, ja, ko, es, vi).

### Suggest modal

`src/utils/suggest-modal.ts` provides a generic `ItemPickerModal` (extends `SuggestModal<PickerItem>`) used for template selection, optimization type selection, and numbering scheme selection.

## Build

- Bundler: esbuild. Entry: `src/main.ts` → `dist/main.js`
- Externals: `obsidian`, `electron`, `@electron/remote` (not bundled)
- Path alias: `@/*` → `src/*` (tsconfig paths + esbuild)
- Release script (`scripts/build.js`): cleans dist/release, runs full build, copies `main.js` + `manifest.json` + optional `styles.css` + docs to `release/docwen-assistant/`

## Versioning

`npm version [major|minor|patch]` triggers `version-bump.js` which updates both `manifest.json` and `versions.json`, then git-adds them.

## Key conventions

- ESLint: flat config (`eslint.config.cjs`), `@typescript-eslint` recommended. `no-explicit-any` is warn-only. Empty catches allowed.
- TypeScript: `strictNullChecks: true`, `noImplicitAny: true`, target ES6. Not full `strict` mode.
- CLI JSON envelope: `{ success: boolean, data?: {...}, error?: { error_code, message, details } }` — check `result.success` first, error details may be in `result.error` (v2) or at top level (v1 fallback).
- Context menu actions mirror command-palette actions but accept a `filePath` argument (resolved from right-clicked `TAbstractFile`, with Folder Note convention support).

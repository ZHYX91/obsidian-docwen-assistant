[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md) | [Español](README_es-ES.md) | [한국어](README_ko-KR.md) | [Tiếng Việt](README_vi-VN.md)

# DocWen Assistant

Obsidian plugin for launching DocWen converter.

## Installation

1. Copy this folder to your Obsidian vault's `.obsidian/plugins/` directory
2. Reload plugins in Obsidian settings
3. Enable "DocWen Assistant" plugin
4. Configure `DocWen.exe` or `DocWenCLI.exe` path in plugin settings (either one is enough)

## Usage

- Click the document icon in the left sidebar to launch DocWen
- Use the command palette (Ctrl/Cmd + P) and search for "DocWen"
- If a file is currently open, its path will be automatically passed to DocWen

### Background Export (requires DocWenCLI.exe)

- “Export to Word (Docx) in background” — for `.md`/`.markdown`/`.txt` files, select a template
- “Export to Excel (XLSX) in background” — for `.md`/`.markdown`/`.txt` files, select a template
- “Export to Markdown (MD) in background” — select an optimization type if available (or skip)

### Heading Numbering (requires DocWenCLI.exe)

- “Add numbering to Markdown headings” — select a numbering scheme
- “Remove numbering from Markdown headings”

Only available for `.md` files.

### Diagnostics (requires DocWenCLI.exe)

- “DocWen doctor check” — check environment and dependencies

## Files Included

- `main.js` - Plugin core code
- `manifest.json` - Plugin manifest
- `styles.css` - Styles (if present)
- `README*.md` - Documentation

For more information, see the plugin settings page.

## Links

- Plugin repo: https://github.com/ZHYX91/docwen-obsidian
- DocWen repo: https://github.com/ZHYX91/docwen

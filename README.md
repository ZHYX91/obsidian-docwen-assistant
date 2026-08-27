# DocWen Assistant

[English](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/README.md) · [简体中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-CN.md) · [繁體中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-TW.md) · [Deutsch](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.de-DE.md) · [Français](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.fr-FR.md) · [Русский](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ru-RU.md) · [Português](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.pt-BR.md) · [日本語](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ja-JP.md) · [Español](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.es-ES.md) · [한국어](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ko-KR.md) · [Tiếng Việt](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.vi-VN.md)

DocWen Assistant connects Obsidian to the local [DocWen](https://github.com/ZHYX91/docwen) desktop application through the public `DocWenCLI.exe` protocol.

> **DocWen is required.** Install and fully extract a compatible [DocWen 0.9.x Windows package](https://github.com/ZHYX91/docwen/releases) before enabling the plugin.

## Screenshots

These screenshots show the packaged plugin running in desktop Obsidian with DocWen CLI.

### Proofreading sidebar

Review issues by line or rule and jump back to the matching source range without rewriting the note.

![DocWen proofreading sidebar](https://raw.githubusercontent.com/ZHYX91/obsidian-docwen-assistant/main/docs/assets/docwen-assistant-proofread-en.png)

### Top-tab settings and CLI capabilities

Use the five top tabs to select the exact DocWen runtime, tune conversions and proofreading, and verify Machine capabilities.

![DocWen Assistant top-tab settings](https://raw.githubusercontent.com/ZHYX91/obsidian-docwen-assistant/main/docs/assets/docwen-assistant-settings-en.png)

### Capability-selected export

Choose an available conversion route and an explicit output location while keeping the source note unchanged.

![DocWen Assistant capability-selected export](https://raw.githubusercontent.com/ZHYX91/obsidian-docwen-assistant/main/docs/assets/docwen-assistant-export-en.png)

## Features

- Open the active Obsidian file in DocWen or activate the DocWen window.
- Export to Word, Excel, or Markdown with an explicit output location.
- Add or remove Markdown heading numbering.
- Proofread Markdown in an Obsidian sidebar.
- Run DocWen doctor diagnostics.
- Use file-explorer context menu actions.
- Use localized UI in 11 languages.

## Requirements and compatibility

- Windows and Obsidian 1.12.7 or later. The plugin is desktop-only.
- A fully extracted Windows full package from the matching published numeric DocWen 0.9.x release. The plugin does not download DocWen automatically.
- The plugin requires `docwen.machine.v1` and `docwen.artifact_bundle.v2`; incompatible DocWen versions fail validation instead of using a fallback protocol.

Users may select the fully extracted DocWen folder, `DocWen.exe`, or `DocWenCLI.exe`. The plugin resolves that choice to the exact sibling `DocWenCLI.exe`, stores one validated absolute CLI path, and uses only `DocWenCLI.exe serve --stdio`. It does not execute the GUI as a CLI, recursively search for executables, exchange command files, download software, or fall back to an older protocol.

## Installation

### Install DocWen and the plugin

1. Download a compatible stable `DocWen-windows-x64.zip` package from [DocWen Releases](https://github.com/ZHYX91/docwen/releases), and download `docwen-assistant-x.y.z.zip` from [DocWen Assistant Releases](https://github.com/ZHYX91/obsidian-docwen-assistant/releases).
2. Fully extract both archives.
3. Copy `main.js`, `manifest.json`, and `styles.css` into `<Vault>/.obsidian/plugins/docwen-assistant/`.
4. Reload Community plugins and enable DocWen Assistant.
5. In the DocWen settings page, choose the extracted folder, `DocWen.exe`, or `DocWenCLI.exe`. The plugin stores the resolved CLI path and runs doctor automatically.

### Installation safety

The release package contains only `main.js`, `manifest.json`, and `styles.css`; it never contains, replaces, or deletes `data.json`. Keep `data.json` and replace only the three runtime files. The fixed `manifest.id` is `docwen-assistant`, which fixes the installed-plugin identity and settings-file location. Delete `data.json` only when you explicitly want to reset all plugin preferences.

## Usage

Use the ribbon icon, file-explorer **DocWen** submenu, or Command Palette:

- **Launch DocWen** / **Launch DocWen with current file**
- **Export to Word (Docx) in background**
- **Export to Excel (XLSX) in background**
- **Export to Markdown (MD) in background**
- **Add numbering to Markdown headings**
- **Remove numbering from Markdown headings**
- **Proofread current Markdown file**
- **DocWen doctor check**

Background export always asks for an output file. Existing output is overwritten only after the native save dialog confirms the target.

## Settings

- Obsidian 1.12.7 or later uses five horizontally scrollable top tabs: **General**, **Export to Markdown**, **Export to Word**, **Proofreading**, and **Usage**.
- Plugin language defaults to **Follow Obsidian** and can be overridden with any of DocWen Assistant's 11 languages. Resource discovery receives the same resolved locale.
- Tabs support arrow keys (including RTL direction), Home/End, visible keyboard focus, 20 px UI text, and coarse-pointer targets. Runtime numbering schemes are queried only when their tab is rendered.

## Limitations

- DocWen Assistant is Windows desktop-only and requires a compatible local DocWen installation.
- It accepts only the selected DocWen folder, `DocWen.exe`, or `DocWenCLI.exe`; it does not recursively search arbitrary folders.
- Background export requires an explicit output file, and proofreading does not rewrite the source note.
- A command is rejected when the CLI response, source snapshot, editor state, or target cannot be verified safely.

## Privacy and security

The plugin takes a snapshot of the current Obsidian editor buffer (including unsaved text) or Vault file and gives DocWen only isolated temporary inputs. It intentionally accesses files outside the Vault only to run the `DocWenCLI.exe` selected by the user, manage isolated temporary inputs and validated artifacts, and write to an output path explicitly chosen by the user; this access is required for local conversion and export. For Markdown-to-DOCX, Obsidian resolves image embeds explicitly present in that note, including cross-folder short Wiki links and filenames with spaces; the plugin authenticates and embeds those bytes in a neutral request. It never scans the Vault for matching filenames. Conversion commits the validated preferred output to the user-confirmed target and any validated related resources beside it under safe names. Proofreading is read-only. Numbering is produced in an isolated output, then committed once through the current Obsidian editor or Vault API only if the source snapshot still matches. The plugin does not upload documents or enumerate the Vault for DocWen operations.

The CLI boundary uses JSON-RPC 2.0 with canonical `Content-Length` framing. Every task uses integrity-pinned input handles and a request-owned staging directory; every returned Artifact Bundle is graph-, path-, size-, and SHA-256-validated before the plugin commits outputs atomically. Calls have timeouts, task cancellation, output limits, and child-process cleanup.

See [Machine integration contract](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/cli-integration.md) for the exact methods, capabilities, and Bundle rules.

## Development

Use Node.js 24.19.0 and npm 11.17.0.

```bash
npm ci
npm run check
npm run release
```

Runtime source is under `src/`; the DocWen boundary is under `src/docwen/`; tests are under `tests/`. Generated `dist/` and `release/` files are not source.

Stable documents: [Product requirements](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/product-requirements.en.md) · [UX specification](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/ux-spec.en.md) · [Architecture](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/architecture.en.md) · [Testing strategy](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/testing-strategy.en.md) · [Release procedure](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/release.en.md)

Repository governance: [Changelog](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/CHANGELOG.md) · [Contributing](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/CONTRIBUTING.md) · [Security](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/SECURITY.md)

## Support

- Use [General](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/general) for workflow ideas and general feedback.
- Use [Q&A](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/q-a) for usage and configuration questions.
- Use the structured [DocWen Assistant issue forms](https://github.com/ZHYX91/obsidian-docwen-assistant/issues/new/choose) for reproducible Obsidian integration bugs and concrete feature requests.
- [DocWen core issues](https://github.com/ZHYX91/docwen/issues): conversion, OCR, proofreading, or CLI behavior outside Obsidian.
- Report vulnerabilities privately through the repository's [security policy](https://github.com/ZHYX91/obsidian-docwen-assistant/security/policy).

Remove private document content, file and Vault paths, CLI logs, executable locations, and credentials before posting publicly.

## License

MIT © ZhengYX

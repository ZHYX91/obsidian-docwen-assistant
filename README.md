# DocWen Assistant

[English](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/README.md) · [简体中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-CN.md) · [繁體中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-TW.md) · [Deutsch](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.de-DE.md) · [Français](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.fr-FR.md) · [Русский](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ru-RU.md) · [Português](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.pt-BR.md) · [日本語](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ja-JP.md) · [Español](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.es-ES.md) · [한국어](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ko-KR.md) · [Tiếng Việt](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.vi-VN.md) · [العربية](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ar.md)

Use DocWen without leaving Obsidian. Export notes to Word or Excel, convert documents to Markdown, check text for problems, and number headings. The work is done by [DocWen](https://github.com/ZHYX91/docwen) installed on your computer; this plugin is the connection between the two.

> **DocWen is required.** Install a compatible DocWen 0.17.0 or later version from [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97), or fully extract the portable package from [DocWen Releases](https://github.com/ZHYX91/docwen/releases).

## Screenshots

These are the main places you will use the plugin in desktop Obsidian.

### Proofreading sidebar

Read the issues found during proofreading and jump to the relevant line in your note. Proofreading never edits the note.

![DocWen proofreading sidebar](https://raw.githubusercontent.com/ZHYX91/obsidian-docwen-assistant/main/docs/assets/docwen-assistant-proofread-en.png)

### Top-tab settings and DocWen connection

Check the connection to DocWen and set up export or proofreading in the four settings tabs.

![DocWen Assistant top-tab settings](https://raw.githubusercontent.com/ZHYX91/obsidian-docwen-assistant/main/docs/assets/docwen-assistant-settings-en.png)

### Capability-selected export

Choose the output format and where to save it. Your original note stays untouched.

![DocWen Assistant capability-selected export](https://raw.githubusercontent.com/ZHYX91/obsidian-docwen-assistant/main/docs/assets/docwen-assistant-export-en.png)

## Features

- Open the active Obsidian file in DocWen or activate the DocWen window.
- Export to Word, Excel, or Markdown with an explicit output location.
- Add or remove Markdown heading numbering.
- Proofread Markdown in an Obsidian sidebar.
- Check the local DocWen connection.
- Use file-explorer context menu actions.
- Choose from 12 interface languages, including Arabic.

## Requirements and compatibility

- Obsidian Desktop 1.12.7 or later on Windows or Linux. Mobile Obsidian is not supported.
- On Windows, use a compatible DocWen 0.17.0 or later installation from Microsoft Store or a fully extracted portable package. On Linux, use a compatible fully extracted package and select it manually. Linux result-directory export requires x64 and an atomic no-replace filesystem. The plugin does not download DocWen automatically.
- Export, proofreading, and numbering require DocWen's Machine Protocol v2 and Artifact Bundle v3. If your DocWen version is incompatible, the plugin explains what needs updating rather than attempting an older protocol.
- Launching/opening the DocWen desktop app uses the public local `gui open` CLI control surface, so a Machine negotiation failure does not prevent opening DocWen itself.

If the Windows Store installation does not meet these requirements, use a compatible portable package and select it with Manual installation. Linux always uses Manual installation.

On Windows, the plugin can detect the Microsoft Store installation using the registered `docwen.exe` app alias. For a portable Windows installation or Linux, select the extracted DocWen folder or executable manually. Windows accepts `DocWen.exe` or `DocWenCLI.exe`; Linux accepts `DocWen` or `DocWenCLI`. The plugin does not search your disk for programs or download DocWen for you.

## Installation

### Install DocWen and the plugin

1. On Windows, install a compatible DocWen 0.17.0 or later version from [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97) or fully extract the portable Windows package from [DocWen Releases](https://github.com/ZHYX91/docwen/releases). On Linux x64, fully extract a compatible Linux package from the same Releases page.
2. Install DocWen Assistant from Obsidian Community Plugins. For manual installation, download `docwen-assistant-x.y.z.zip` from [DocWen Assistant Releases](https://github.com/ZHYX91/obsidian-docwen-assistant/releases), then copy `main.js`, `manifest.json`, and `styles.css` into `<Vault>/.obsidian/plugins/docwen-assistant/`.
3. Reload Community plugins and enable DocWen Assistant.
4. On Windows, automatic detection needs no file selection. Portable Windows users and all Linux users should open **Settings → DocWen Assistant → General**, choose **Manual installation**, and select the extracted DocWen folder or executable.

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
- **Check DocWen connection**

Choose an output folder. Each conversion creates its own result folder, preserving the generated filenames and linked resources. Names include the source name, timestamp and input format. Existing result folders are never overwritten.

Word export saves a separate DOCX inside the result folder; it does not replace your Markdown note. You can convert a DOCX back to Markdown without keeping its original source. Some formatting or whitespace can change during conversion, especially when optional Markdown syntax is involved.

Word export interprets the public Number Suite caption/reference dialect directly from the Markdown source. Installing Number Suite is optional and does not change export semantics; heading/caption numbering for this export is controlled by the explicit Word-export numbering settings.

## Settings

To keep merged Structural Tables, Number Suite captions and cross-references, H7–H9 headings, or typed endnotes when exporting Word, open **DocWen → Settings → Markdown syntax** and enable the matching **input** extensions (or the **Use Obsidian extensions** input preset). Optional extensions are off in a new DocWen installation. Converting Word back into extended Markdown also requires the relevant **output** extensions. DocWen's Word-export numbering options—not Number Suite's display-only numbers—control the exported document; review the resulting table and reference formatting.

- Obsidian 1.12.7 or later uses four horizontally scrollable top tabs: **General**, **Export to Markdown**, **Export to Word**, and **Proofreading**. Contextual help appears on the relevant tab instead of a separate Usage page.
- Plugin language defaults to **Follow Obsidian**. You can choose one of 12 languages manually, including Arabic. Arabic settings use right-to-left layout. Resource discovery receives the same resolved locale.
- **Connection method** defaults to **Detect automatically** for Windows Microsoft Store installs. Linux users must choose **Manual installation**; the same manual picker also supports portable Windows packages. The status row checks the product identity, minimum supported version, Machine protocol, Bundle contract, and health without exposing package paths; protocol conflicts show the Assistant request and DocWen-supported versions separately.
- Tabs support arrow keys (including RTL direction), Home/End, visible keyboard focus, 20 px UI text, and coarse-pointer targets. Runtime numbering schemes are queried only when their tab is rendered.

## Limitations

- DocWen Assistant supports Windows and Linux desktop hosts and requires a compatible local DocWen installation. Linux result-directory export requires x64; unsupported filesystems fail closed rather than falling back to check-then-rename.
- Windows automatic mode uses only the fixed registered `docwen.exe` alias. Manual mode accepts the selected DocWen folder/`DocWen.exe`/`DocWenCLI.exe` on Windows and folder/`DocWen`/`DocWenCLI` on Linux; neither mode searches arbitrary folders.
- Background export requires an explicit output folder, and proofreading does not rewrite the source note.
- A command is rejected when the CLI response, source snapshot, editor state, or target cannot be verified safely.

## Privacy and security

**Your documents stay on your computer.** The plugin does not upload them to a conversion service. Proofreading reads the note without changing it. Export saves files only to a folder you choose.

For an operation, the plugin uses the current Obsidian text (including unsaved changes), or the saved Vault file, in an isolated temporary workspace. It can read images explicitly linked from the note, even when their paths contain spaces or point to another Vault folder. It does **not** search the entire Vault for matching files or send unrelated notes to DocWen.

When you add or remove heading numbers, the plugin writes changes back only if the note has not changed since the operation began. It checks conversion results before saving them and never overwrites new destination data silently. Outside the Vault, it accesses only the chosen DocWen executable, temporary files, and the destination folder you approve. The Microsoft Store package's private installation path is not stored.

Content operations use JSON-RPC 2.0 Machine Protocol with canonical `Content-Length` framing. Every task uses integrity-pinned input handles and a request-owned staging directory; every returned Artifact Bundle is graph-, path-, size-, and SHA-256-validated before the plugin commits outputs atomically. Launch/open is intentionally separate: the plugin runs the fixed local `gui open --json` control command and validates its bounded CLI protocol-3 success envelope without negotiating Machine first. Both process paths use fixed launch targets, bounded environments, timeouts, output limits, and cleanup.

See [Machine integration contract](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/cli-integration.md) for the exact methods, capabilities, and Bundle rules.

## Development

Use Node.js 24.19.0 and npm 11.17.0.

```bash
npm ci
npm run check
npm run release
```

Runtime source is under `src/`; the DocWen boundary is under `src/docwen/`; tests are under `tests/`. Generated `dist/` and `release/` files are not source.

Stable documents: [Product requirements](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/product-requirements.en.md) · [UX specification](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/ux-spec.en.md) · [Architecture](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/architecture.en.md) · [Testing strategy](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/testing-strategy.en.md)

Repository governance: [Changelog](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/CHANGELOG.md) · [Contributing](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/CONTRIBUTING.md) · [Security](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/SECURITY.md)

## Support

- [Q&A](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/q-a): Usage and configuration questions.
- [Ideas](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/ideas): Early feature and workflow ideas.
- [Show and tell](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/show-and-tell): Tips, workflows, and reference implementations.
- Use the structured [DocWen Assistant issue forms](https://github.com/ZHYX91/obsidian-docwen-assistant/issues/new/choose) for reproducible Obsidian integration bugs and concrete feature requests.
- [DocWen core issues](https://github.com/ZHYX91/docwen/issues): conversion, OCR, proofreading, or CLI behavior outside Obsidian.
- Report vulnerabilities privately through the repository's [security policy](https://github.com/ZHYX91/obsidian-docwen-assistant/security/policy).

Remove private document content, file and Vault paths, CLI logs, executable locations, and credentials before posting publicly.

## License

MIT © ZhengYX

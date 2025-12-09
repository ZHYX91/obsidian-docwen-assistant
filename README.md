[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md)

# DocWen Assistant - Obsidian Plugin

An Obsidian plugin for the [DocWen](https://github.com/ZHYX91/docwen) desktop application.

## ✨ Features

### Core Features
- ✅ **Sidebar Quick Launch**: Add an icon to the Obsidian sidebar for one-click launch
- ✅ **Automatic File Passing**: Automatically pass the currently open file path to DocWen
- ✅ **Command Palette Integration**: Quick access via Ctrl/Cmd + P
- ✅ **Path Validation**: Real-time validation of executable path
- ✅ **File Browser**: Easily select executable file via browse dialog
- ✅ **Success Feedback**: Friendly notifications on launch
- ✅ **Single Instance Management**: Automatically sends file to running instance
- ✅ **Multi-language Support**: Supports 8 languages (zh-CN, zh-TW, en, de, fr, ru, pt, ja)

---

## 📦 Quick Start

### Prerequisites

1. **Install Node.js**
   - Visit [Node.js Official Website](https://nodejs.org/)
   - Download and install the LTS version
   - Verify installation: `node -v` and `npm -v`

2. **Install Dependencies**
   ```bash
   npm install
   ```

### Development Mode

Use watch mode during development for automatic recompilation on code changes:

```bash
npm run dev
```

### Build Plugin

#### Quick Build (no type checking)
```bash
npm run build:quick
```

#### Full Build (with type checking and minification)
```bash
npm run build
```

#### Release Build (auto-package)
```bash
npm run release
# Or run directly: node scripts/build.js
```

This command will:
1. Compile TypeScript code
2. Create release directory
3. Copy required files
4. Generate usage instructions

---

## 🚀 Install to Obsidian

### Method 1: Using Release Script (Recommended)

1. Run release build:
   ```bash
   npm run release
   ```

2. Copy the `release/docwen-assistant` folder to:
   ```
   <Your Vault>/.obsidian/plugins/
   ```

3. In Obsidian:
   - Open `Settings` → `Community plugins`
   - Click `Reload plugins`
   - Enable `DocWen Assistant`

### Method 2: Manual Installation

1. Build the plugin:
   ```bash
   npm run build
   ```

2. Create plugin directory:
   ```
   <Your Vault>/.obsidian/plugins/docwen-assistant/
   ```

3. Copy these files to the directory:
   - `main.js`
   - `manifest.json`

4. Reload and enable the plugin in Obsidian

---

## ⚙️ Configuration

1. Open Obsidian `Settings` → `Community plugins` → `DocWen Assistant`

2. Configure executable path:
   - **Option 1**: Enter path directly
   - **Option 2**: Click `Browse...` button to select file

3. Path validation:
   - ✓ Green indicates valid path
   - ✗ Red indicates invalid path or file not found

---

## 📖 Usage

### Launch DocWen

Three ways to launch:

1. **Sidebar Icon**
   - Click the document icon in the left sidebar

2. **Command Palette**
   - Press `Ctrl/Cmd + P` to open command palette
   - Search for "Launch DocWen"

3. **Launch with Current File**
   - Search "Launch DocWen with current file" in command palette
   - Only available when a file is open

### Automatic File Passing

- If a Markdown file is open, the plugin automatically passes its full path to DocWen
- If no file is open, only launches the DocWen program

### Single Instance Management

- **First Click** → Launch DocWen and pass current file
- **Click Again (with file)** → Replace with new file (Single File Mode)
- **Click Again (no file)** → Activate DocWen window

---

## 🛠️ Development Scripts

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Development mode (watch) |
| `npm run build` | Full build (type check + minify) |
| `npm run build:quick` | Quick build (no type check) |
| `node version-bump.js [patch\|minor\|major]` | Update version number |
| `npm run release` | Build release package |

### Version Management

Update version number:

```bash
# Patch version (1.0.0 → 1.0.1)
node version-bump.js patch

# Minor version (1.0.0 → 1.1.0)
node version-bump.js minor

# Major version (1.0.0 → 2.0.0)
node version-bump.js major
```

---

## 📁 Project Structure

```
docwen-obsidian/
├── src/                 # 📁 Source code directory
│   ├── main.ts          # Plugin main logic
│   ├── settings.ts      # Settings page
│   ├── i18n.ts          # Internationalization module
│   ├── utils/           # Utility functions (future)
│   ├── types/           # Type definitions (future)
│   └── commands/        # Command modules (future)
├── dist/                # 🔨 Build output directory
│   └── main.js          # Compiled code
├── scripts/             # 📜 Build scripts
│   ├── build.bat        # Windows one-click build
│   ├── build.js         # Cross-platform build script
│   └── README.md        # Script usage guide
├── release/             # 📦 Release artifacts
├── .vscode/             # 🛠️ Editor configuration
│   └── settings.json    # VS Code settings
├── manifest.json        # Plugin manifest
├── package.json         # Project configuration
├── tsconfig.json        # TypeScript configuration
├── .eslintrc.json       # ESLint configuration
├── .gitignore          # Git ignore file
├── version-bump.js     # Version management script
├── README.md           # This document (English)
└── README_zh-CN.md     # Chinese documentation
```

---

## 🐛 Troubleshooting

### Plugin Won't Load

1. Check if `main.js` and `manifest.json` are correctly copied
2. Click `Reload plugins` in Obsidian
3. Check developer console (`Ctrl/Cmd + Shift + I`) for errors

### Cannot Launch DocWen

1. Check if executable path is correct
2. Confirm path status shows green ✓
3. Confirm executable has proper permissions

### File Path Not Passed

1. Confirm a file is currently open
2. Check if file path contains special characters
3. Check console logs for passed arguments

---

## 📜 License

This project is licensed under the ISC License.

### Contact

- **GitHub**: https://github.com/ZHYX91/docwen-obsidian
- **DocWen Main Project**: https://github.com/ZHYX91/docwen
- **Contact Author**: zhengyx91@hotmail.com

---

**Author**: ZhengYX

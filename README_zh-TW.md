[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md) | [Español](README_es-ES.md) | [한국어](README_ko-KR.md) | [Tiếng Việt](README_vi-VN.md)

# DocWen 助手 - Obsidian 外掛程式

為 [DocWen](https://github.com/ZHYX91/docwen) 桌面應用開發的配套 Obsidian 外掛程式。

## ✨ 功能特性

### 核心功能
- ✅ **側邊欄快捷啟動**: 在 Obsidian 左側欄新增圖示，一鍵啟動 DocWen
- ✅ **自動檔案傳遞**: 自動將目前開啟的檔案路徑傳遞給 DocWen
- ✅ **命令面板整合**: 透過 Ctrl/Cmd + P 快速存取外掛功能
- ✅ **背景匯出（CLI）**: 透過 DocWenCLI.exe 在背景匯出為 Word/Excel/Markdown（需要時會彈出選擇器）
- ✅ **標題序號（CLI）**: 透過 DocWenCLI.exe 為 Markdown 標題添加/清理序號
- ✅ **doctor 自檢（CLI）**: 一鍵檢查 DocWen 環境與依賴
- ✅ **路徑驗證**: 即時驗證可執行檔路徑的有效性
- ✅ **檔案選擇器**: 透過瀏覽對話框輕鬆選擇可執行檔
- ✅ **成功回饋**: 啟動時顯示友善的通知訊息
- ✅ **右鍵選單**: 在檔案列表中右鍵任意檔案 → DocWen 子選單（格式轉換、序號管理、用 DocWen 開啟）
- ✅ **單一實例管理**: 自動向執行中的實例傳送檔案
- ✅ **多語言支援**: 支援 11 種語言（簡中、繁中、英、德、法、俄、葡、日、韓、西、越）

---

## 📦 快速開始

### 環境準備

1. **安裝 Node.js**
   - 造訪 [Node.js 官網](https://nodejs.org/)
   - 下載並安裝 LTS 版本
   - 驗證安裝: `node -v` 和 `npm -v`

2. **安裝相依套件**
   ```bash
   npm install
   ```

### 開發模式

開發時使用 watch 模式，程式碼修改後自動重新編譯：

```bash
npm run dev
```

### 建置外掛

#### 快速建置（不含型別檢查）
```bash
npm run build:quick
```

#### 完整建置（含型別檢查和程式碼壓縮）
```bash
npm run build
```

#### 發布建置（自動打包）
```bash
npm run release
# 或直接執行: node scripts/build.js
```

此命令會：
1. 編譯 TypeScript 程式碼
2. 建立 release 目錄
3. 複製必要檔案
4. 產生使用說明

---

## 🚀 安裝到 Obsidian

### 方法一：下載發布包（建議）

1. 前往 [GitHub Releases](https://github.com/ZHYX91/docwen-obsidian/releases) 頁面
2. 下載並解壓縮最新版本
3. 將 `docwen-assistant` 資料夾複製到 `<你的 Vault>/.obsidian/plugins/`
4. 在 Obsidian 中：`設定` → `第三方外掛` → `重新載入外掛` → 啟用 `DocWen Assistant`

### 方法二：從原始碼建置

1. 安裝相依套件並建置:
   ```bash
   npm install
   npm run release
   ```
2. 將 `release/docwen-assistant` 資料夾複製到 `<你的 Vault>/.obsidian/plugins/`
3. 在 Obsidian 中重新載入並啟用外掛

---

## ⚙️ 設定

1. 開啟 Obsidian `設定` → `第三方外掛` → `DocWen Assistant`

2. 設定可執行檔路徑（二選一即可）:
   - `DocWen.exe` 的完整路徑，或 `DocWenCLI.exe` 的完整路徑
   - 若只填其中一個，外掛會嘗試從同目錄自動識別另一個

3. 路徑驗證:
   - ✓ 綠色表示路徑有效
   - ✗ 紅色表示路徑無效或檔案不存在

---

## 📖 使用方法

### 啟動 DocWen

有三種方式啟動:

1. **側邊欄圖示**
   - 點擊左側欄的文件圖示

2. **命令面板**
   - 按 `Ctrl/Cmd + P` 開啟命令面板
   - 搜尋「啟動 DocWen」

3. **目前檔案啟動**
   - 在命令面板搜尋「使用目前檔案啟動 DocWen」
   - 僅在有開啟檔案時可用

### 背景匯出（不彈出 GUI）

在命令面板中搜尋：
- 「背景匯出為 Word（Docx）」 — 對 `.md`/`.markdown`/`.txt` 檔案會彈出模板選擇器
- 「背景匯出為 Excel（XLSX）」 — 對 `.md`/`.markdown`/`.txt` 檔案會彈出模板選擇器
- 「背景匯出為 Markdown（MD）」 — 若目前檔案類型與語言下有可用的優化類型，會彈出選擇器供選擇（也可跳過不選）

需要 `DocWenCLI.exe`。

### 右鍵選單

在檔案列表中右鍵任意檔案，可以看到 **DocWen** 子選單。可用操作取決於檔案類型：

- **轉為 Markdown** — 適用於 docx、xlsx、pdf、圖片等檔案
- **轉為 Word（Docx）** / **轉為 Excel（XLSX）** — 適用於 `.md`/`.markdown`/`.txt` 檔案
- **添加/清理標題序號** — 僅適用於 `.md` 檔案
- **用 DocWen 開啟** — 所有檔案均可用

### 標題序號（CLI）

在命令面板中搜尋：
- 「為 Markdown 標題添加序號」 — 從選擇器中選擇序號方案
- 「清理 Markdown 標題序號」

僅在開啟 `.md` 檔案時可用。需要 `DocWenCLI.exe`。

### doctor 自檢

在命令面板中搜尋：
- 「DocWen doctor 自我檢查」

需要 `DocWenCLI.exe`。

### 自動檔案傳遞

- 如果有開啟檔案，外掛會自動將完整路徑傳遞給 DocWen
- 如果沒有開啟檔案，僅啟動 DocWen 程式

### 單一實例管理

- **首次點擊** → 啟動 DocWen 並傳遞目前檔案
- **再次點擊（有檔案）** → 替換為新檔案（單一檔案模式）
- **再次點擊（無檔案）** → 啟用 DocWen 視窗

---

## 🛠️ 開發腳本

### 可用命令

| 命令 | 說明 |
|------|------|
| `npm run dev` | 開發模式（watch） |
| `npm run build` | 完整建置（型別檢查 + 壓縮） |
| `npm run build:quick` | 快速建置（無型別檢查） |
| `npm run lint` | ESLint 檢查 |
| `npm run lint:fix` | ESLint 自動修復 |
| `node version-bump.js [patch\|minor\|major]` | 更新版本號 |
| `npm run release` | 建置發布套件 |

### 版本管理

更新版本號:

```bash
# 修補版本 (1.0.0 → 1.0.1)
node version-bump.js patch

# 次要版本 (1.0.0 → 1.1.0)
node version-bump.js minor

# 主要版本 (1.0.0 → 2.0.0)
node version-bump.js major
```

---

## 📁 專案結構

```
docwen-obsidian/
├── src/                 # 📁 原始碼目錄
│   ├── main.ts          # 外掛主邏輯
│   ├── settings.ts      # 設定頁面
│   ├── i18n.ts          # 國際化模組
│   └── utils/           # 工具模組
│       └── suggest-modal.ts # 選擇器彈窗
├── dist/                # 🔨 建置輸出目錄
│   └── main.js          # 編譯後的程式碼
├── docs/                # 📄 文件
│   └── plugin-readme/    # 使用者文件（多語言）
├── scripts/             # 📜 建置腳本
│   ├── build.bat        # Windows 一鍵建置
│   ├── build.js         # 跨平台建置腳本
│   └── README.md        # 腳本使用說明
├── release/             # 📦 發布產物
├── .vscode/             # 🛠️ 編輯器設定
│   └── settings.json    # VS Code 設定
├── manifest.json        # 外掛清單
├── package.json         # 專案設定
├── tsconfig.json        # TypeScript 設定
├── eslint.config.cjs    # ESLint 設定
├── .gitignore          # Git 忽略檔案
├── version-bump.js     # 版本管理腳本
├── README.md           # 英文文件
└── README_zh-TW.md     # 本文件（繁體中文）
```

---

## 🐛 故障排除

### 外掛無法載入

1. 檢查是否正確複製了 `main.js` 和 `manifest.json`
2. 在 Obsidian 中點擊 `重新載入外掛`
3. 查看開發者主控台 (`Ctrl/Cmd + Shift + I`) 中的錯誤訊息

### 無法啟動 DocWen

1. 檢查可執行檔路徑是否正確
2. 確認路徑狀態顯示為綠色 ✓
3. 確認可執行檔有執行權限

### 檔案路徑未傳遞

1. 確認目前有開啟的檔案
2. 檢查檔案路徑是否包含特殊字元
3. 查看主控台日誌確認傳遞的參數

---

## 📜 授權條款

本專案使用 MIT 授權條款。

### 聯絡方式

- **GitHub**: https://github.com/ZHYX91/docwen-obsidian
- **DocWen 主專案**: https://github.com/ZHYX91/docwen
- **聯絡作者**: zhengyx91@hotmail.com

---

**作者**: ZhengYX

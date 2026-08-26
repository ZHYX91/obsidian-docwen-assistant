# DocWen Assistant

[English](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/README.md) · [简体中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-CN.md) · [繁體中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-TW.md) · [Deutsch](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.de-DE.md) · [Français](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.fr-FR.md) · [Русский](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ru-RU.md) · [Português](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.pt-BR.md) · [日本語](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ja-JP.md) · [Español](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.es-ES.md) · [한국어](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ko-KR.md) · [Tiếng Việt](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.vi-VN.md)

DocWen Assistant 透過公開的 `DocWenCLI.exe` 協定，將 Obsidian 連接到本機 [DocWen](https://github.com/ZHYX91/docwen)。需要 Windows、Obsidian 1.12.7 以上及 DocWen 0.9.x 穩定版。

> **必須安裝 DocWen 本體。** 啟用外掛前，請先安裝並完整解壓縮相容的 [DocWen 0.9.x Windows 完整套件](https://github.com/ZHYX91/docwen/releases)。

## 螢幕截圖

以下截圖展示打包後的外掛與 DocWen CLI 在桌面版 Obsidian 中執行的介面。

### 校對側邊欄

依行或規則檢查問題，並跳回對應的來源範圍，不改寫筆記。

![DocWen 校對側邊欄](../assets/docwen-assistant-proofread-en.png)

### 頂部分頁設定與 CLI 能力

使用五個頂部分頁選擇正確的 DocWen 執行環境、調整轉換與校對，並驗證 Machine 能力。

![DocWen Assistant 頂部分頁設定](../assets/docwen-assistant-settings-en.png)

### 依能力選擇匯出

選擇目前可用的轉換路徑和明確的輸出位置，同時保持來源筆記不變。

![DocWen Assistant 依能力選擇匯出](../assets/docwen-assistant-export-en.png)

## 功能

- 在 DocWen 開啟目前檔案或啟動 DocWen 視窗；
- 匯出 Word、Excel、Markdown，並明確選擇輸出檔案；
- 新增或移除 Markdown 標題編號；
- 在 Obsidian 側邊欄校對 Markdown；
- 執行 doctor 自我檢查及檔案右鍵選單命令。

## 使用要求與相容性

- 需要 Windows 和 Obsidian 1.12.7 或以上版本；外掛僅支援桌面端；
- 需要完整解壓縮的 DocWen 0.9.x 穩定版 Windows 完整套件；外掛不會自動下載 DocWen；
- 外掛需要 `docwen.machine.v1` 與 `docwen.artifact_bundle.v2`；DocWen 版本不相容時會停止並提示，不會改用其他協定。

使用者可選擇完整解壓縮的 DocWen 資料夾、`DocWen.exe` 或 `DocWenCLI.exe`。外掛會嚴格解析為同目錄的 `DocWenCLI.exe`，只儲存並呼叫這一個經驗證的絕對路徑；不會把 GUI 當成 CLI 執行、遞迴搜尋程式、自動下載軟體或退回舊協定。

## 安裝

### 安裝 DocWen 與外掛

1. 先在 [DocWen Releases](https://github.com/ZHYX91/docwen/releases) 與 [DocWen Assistant Releases](https://github.com/ZHYX91/obsidian-docwen-assistant/releases) 確認相符的純數字版本都已發布；
2. 下載並完整解壓縮 `DocWen-windows-x64.zip`，再下載相符的外掛套件；
3. 將 `main.js`、`manifest.json` 和 `styles.css` 複製到 `<Vault>/.obsidian/plugins/docwen-assistant/`，重新載入並啟用外掛；
4. 在設定中選擇 DocWen 資料夾、`DocWen.exe` 或 `DocWenCLI.exe`，外掛會自動執行 doctor。

### 安裝安全界線

發行套件只包含 `main.js`、`manifest.json` 和 `styles.css`，不會包含、覆蓋或刪除 `data.json`。只有明確要清除全部偏好時才刪除 `data.json`；啟用外掛後再選擇 DocWen 位置。

## 使用

可從側邊欄圖示、檔案清單的 **DocWen** 子選單或命令面板啟動 DocWen、匯出 Word／Excel／Markdown、新增或移除標題編號、校對目前 Markdown，以及執行 doctor。背景匯出一定會要求明確選擇輸出檔案。

## 設定

Obsidian 1.12.7 以上使用五個可水平捲動的頂部頁籤：一般、轉為 Markdown、轉為 Word、校對和使用方法。頁籤支援方向鍵（包括 RTL）、Home/End、20 px 介面文字和粗指標點擊區。外掛語言預設「跟隨 Obsidian」，也可選擇 11 種語言之一；介面、通知與資源查詢使用相同結果。

## 限制

- 僅支援 Windows 桌面端，且本機必須安裝相容的 DocWen；
- 只接受選定的 DocWen 資料夾、`DocWen.exe` 或 `DocWenCLI.exe`，不會遞迴搜尋任意目錄；
- 無法安全核驗 CLI 回應、來源快照、編輯器狀態或輸出目標時，操作會被拒絕。

## 隱私與安全性

外掛會為目前編輯器內容（包括未儲存文字）或 Vault 檔案建立隔離快照，再交給本機 CLI。轉換會將通過驗證的首選輸出提交到使用者確認的目標，並以安全名稱將通過驗證的關聯資源提交到同一目錄。它不會上傳文件或替 DocWen 列舉整個 Vault。完整協定請參閱 [CLI integration contract](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/cli-integration.md)。

## 開發

使用 Node.js 24.19.0 與 npm 11.17.0。執行 `npm ci`、`npm run check` 和 `npm run release`。執行時原始碼位於 `src/`，測試位於 `tests/`；產生的 `dist/` 與 `release/` 不是原始碼。

穩定文件：[產品需求](../product-requirements.en.md) · [UX 規格](../ux-spec.en.md) · [架構](../architecture.en.md) · [測試策略](../testing-strategy.en.md) · [發佈流程](../release.en.md)

儲存庫治理：[變更記錄](../../CHANGELOG.md) · [貢獻指南](../../CONTRIBUTING.md) · [安全性](../../SECURITY.md)

## 支援

- 工作流程想法和一般意見請發布到 [General](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/general)；
- 使用和設定問題請發布到 [Q&A](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/q-a)；
- 可重現的 Obsidian 整合錯誤和明確功能建議請使用結構化的 [DocWen Assistant Issue 表單](https://github.com/ZHYX91/obsidian-docwen-assistant/issues/new/choose)；
- Obsidian 以外的轉換、OCR、校對或 CLI 行為請提交到 [DocWen Core Issues](https://github.com/ZHYX91/docwen/issues)；
- 安全性漏洞請依照儲存庫的[安全性政策](https://github.com/ZHYX91/obsidian-docwen-assistant/security/policy)私下回報。

公開發布前請移除私人文件內容、檔案和 Vault 路徑、CLI 記錄、執行檔位置及認證資訊。

## 授權

MIT © ZhengYX

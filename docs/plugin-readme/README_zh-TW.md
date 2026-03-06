[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md) | [Español](README_es-ES.md) | [한국어](README_ko-KR.md) | [Tiếng Việt](README_vi-VN.md)

# DocWen Assistant

用於啟動 DocWen 轉換器的 Obsidian 外掛程式。

## 安裝方法

1. 將此資料夾複製到 Obsidian 庫的 `.obsidian/plugins/` 目錄下
2. 在 Obsidian 設定中重新載入外掛程式
3. 啟用「DocWen Assistant」外掛程式
4. 在外掛程式設定中配置 `DocWen.exe` 或 `DocWenCLI.exe` 路徑（二選一即可）

## 使用方法

- 點擊左側欄的文件圖示啟動 DocWen
- 使用命令面板 (Ctrl/Cmd + P) 搜尋「DocWen」
- 如果目前有開啟的檔案，會自動傳遞檔案路徑給 DocWen

### 背景匯出（需要 DocWenCLI.exe）

- 「背景匯出為 Word（Docx）」 — 對 `.md`/`.markdown`/`.txt` 檔案，選擇一個模板
- 「背景匯出為 Excel（XLSX）」 — 對 `.md`/`.markdown`/`.txt` 檔案，選擇一個模板
- 「背景匯出為 Markdown（MD）」 — 若有可用的優化類型則選擇一個（也可跳過不選）

### 標題序號（需要 DocWenCLI.exe）

- 「為 Markdown 標題添加序號」 — 選擇一個序號方案
- 「清理 Markdown 標題序號」

僅對 `.md` 檔案可用。

### 診斷（需要 DocWenCLI.exe）

- 「DocWen doctor 自我檢查」 — 檢查環境與依賴

## 包含檔案

- `main.js` - 外掛程式核心程式碼
- `manifest.json` - 外掛程式清單
- `styles.css` - 樣式檔案（如有）
- `README*.md` - 說明文件

更多資訊請查看外掛程式設定頁面。

## 連結

- 外掛倉庫：https://github.com/ZHYX91/docwen-obsidian
- DocWen 倉庫：https://github.com/ZHYX91/docwen

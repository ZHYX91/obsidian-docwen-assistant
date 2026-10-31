# DocWen Assistant

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md)

DocWen Assistant 將 Obsidian 連接到本機 [DocWen](https://github.com/ZHYX91/docwen)。需要 Windows 或 Linux、Obsidian 1.12.7 以上及 DocWen 0.17.0 或更新的穩定版本。

> **必須安裝 DocWen 本體。** 請從 [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97) 安裝相容版本，或完整解壓縮 [DocWen Releases](https://github.com/ZHYX91/docwen/releases) 提供的 ZIP 可攜版。

介面語言只改變 Assistant 本身的文字與版面。轉換語言、範本與 OCR 由工作選項及 DocWen 設定控制。

## 螢幕截圖

桌面介面範例。校對範例使用合成筆記。

### 校對側邊欄

依行或規則檢查問題，並跳回對應的來源範圍，不改寫筆記。

![DocWen 校對側邊欄](../assets/docwen-assistant-proofread-en.png)

### 設定與 DocWen 連線

在四個設定分頁中檢查 DocWen 連線，選擇轉換與校對選項。

![DocWen Assistant 頂部分頁設定](../assets/docwen-assistant-settings-en.png)

### 匯出檔案

選擇輸出格式、確認本次設定，再指定結果的儲存位置。

![DocWen Assistant 匯出檔案](../assets/docwen-assistant-export-en.png)

## 功能

- 在 DocWen 開啟目前檔案或啟動 DocWen 視窗；
- 匯出 Word、Excel、Markdown，並明確選擇輸出資料夾；
- 新增或移除 Markdown 標題編號；
- 在 Obsidian 側邊欄校對 Markdown；
- 檢查 DocWen 連線及使用檔案右鍵選單命令。

## 使用要求與相容性

- 需要 Windows 或 Linux 和 Obsidian 1.12.7 或以上版本；外掛僅支援桌面端；
- Windows 可使用 Microsoft Store 安裝版或完整解壓縮的可攜版 DocWen 0.17.0 或更新版本；Linux 使用手動選取的完整解壓縮套件。Linux 匯出需要 x64，以及能安全儲存新結果資料夾而不覆蓋既有資料的檔案系統；外掛不會自動下載 DocWen；
- 外掛需要 `docwen.machine.v2` 與 `docwen.artifact_bundle.v3`；DocWen 版本不相容時會停止並提示，不會改用其他協定。
- 即使背景轉換介面不相容，仍可嘗試單獨開啟 DocWen 桌面應用。

Windows 商店安裝版不符合以上要求時，請使用相容的可攜包並透過「手動選擇安裝位置」選取；Linux 一律使用「手動選擇安裝位置」。

自動偵測僅適用於 Windows，並使用已註冊的 `docwen.exe` 別名，Microsoft Store 更新後仍可使用。手動安裝在 Windows 接受解壓縮後的 DocWen 資料夾、`DocWen.exe` 或 `DocWenCLI.exe`，在 Linux 接受資料夾、`DocWen` 或 `DocWenCLI`。外掛不會在硬碟上搜尋其他程式，也不會自動下載軟體。

## 安裝

### 安裝 DocWen 與外掛

1. Windows 可從 [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97) 安裝相容的 DocWen 0.17.0 或更新版本，或從 [DocWen Releases](https://github.com/ZHYX91/docwen/releases) 下載並完整解壓縮 Windows 可攜版。Linux x64 請從同一頁面下載並解壓縮 Linux 套件。
2. 從 Community Plugins 安裝 DocWen Assistant。手動安裝時，從[外掛發行頁](https://github.com/ZHYX91/obsidian-docwen-assistant/releases)下載 `docwen-assistant-x.y.z.zip`，將 `main.js`、`manifest.json`、`styles.css` 複製到 `<Vault>/.obsidian/plugins/docwen-assistant/`。
3. 重新載入 Community Plugins 並啟用 DocWen Assistant。
4. Windows 商店版可自動偵測。Windows 可攜版與 Linux 使用者請開啟 **設定 → DocWen Assistant → 一般**，選擇**手動選擇安裝位置**，再選取解壓縮後的資料夾或執行檔。

### 更新時保留設定

手動更新時只替換 `main.js`、`manifest.json` 和 `styles.css`。保留 `data.json` 才能保留設定；只有想重設設定時才刪除。外掛資料夾名稱保持為 `docwen-assistant`。

## 使用

**先確認目前檔案支援哪些操作。** 匯出命令由檔案內容和本機 DocWen 提供的功能決定是否顯示；匯出會在指定目錄儲存獨立輸出，校對不會改動筆記。**新增／移除標題編號會修改 Markdown 原文**，寫入前會核對目前編輯器或已儲存檔案的內容；同一路徑有多個無法唯一判定的編輯器時會停止。

可從側邊欄圖示、檔案清單的 **DocWen** 子選單或命令面板啟動 DocWen、匯出 Word／Excel／Markdown、新增或移除標題編號、校對目前 Markdown，以及檢查 DocWen 連線。

若出現範本或轉換預設選項，先完成選擇，再指定輸出目錄。確認來源檔案、格式、儲存位置和本次選項後，按下**匯出**。確認視窗使用本次工作已取得的設定，取消不會開始轉換。DocWen 傳回單一 DOCX 或 XLSX 時，直接儲存在所選目錄；Markdown 和組合輸出仍使用獨立結果資料夾，保留圖片與附件。完成後可在通知中選擇**開啟結果資料夾**，既有檔案與資料夾不會被覆寫；此操作會開啟輸出所在的資料夾。

## 設定

匯出 Word 前，請在 **DocWen → 設定 → Markdown 語法**啟用需要的**輸入擴充**。新安裝時預設關閉，也可選擇輸入方向的 **Obsidian 擴充**預設。

| 筆記內容或操作 | DocWen 對應設定 |
| --- | --- |
| Structural Tables 合併儲存格 | Structural Tables 輸入擴充 |
| Number Suite 題註與交互參照 | 題註與交互參照輸入擴充 |
| H7–H9 標題／類型化尾註 | 相應的標題／尾註輸入擴充 |
| Word 轉回擴充 Markdown | 相應的輸出擴充 |

即使未安裝 Number Suite，Word 匯出也能讀取 Markdown 中的相關語法。輸出編號由 DocWen 選項決定，不直接複製 Number Suite 的純顯示編號。獨立的「新增／移除標題編號」命令會修改來源筆記，匯出不會。

**各專案會改動什麼**

| 專案與用法 | 顯示、原文修改與輸出 |
| --- | --- |
| [DocWen (Core)](https://github.com/ZHYX91/docwen/blob/main/docs/user-guides/README.zh-TW.md) | 產生轉換後的檔案。輸入擴充解讀原文語法，匯出設定控制輸出及其編號。 |
| [DocWen Assistant](../product-requirements.zh-CN.md) | 匯出會儲存獨立輸出，校對僅讀取內容；明確執行標題編號操作時會修改原始 Markdown。 |
| [Chrono Notes](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/docs/i18n/README.zh-TW.md) | 日曆與任務檢視讀取索引。勾選任務或調整日期會更新原始 Markdown，建立操作會新增筆記。 |
| [Property Order](https://github.com/ZHYX91/obsidian-property-order/blob/main/docs/i18n/README.zh-TW.md) | 候選設定改變選單。重排或移動值會修改相關 YAML 清單，也可能把非文字值轉成字串。 |
| [Link Integrity](https://github.com/ZHYX91/obsidian-link-integrity/blob/main/docs/i18n/README.zh-TW.md) | 規則篩選分析結果，或改變參與分析的圖連線；不會重寫筆記中的連結。 |
| [Folder Nodes](https://github.com/ZHYX91/obsidian-folder-nodes/blob/main/docs/i18n/README.zh-TW.md) | 檢視顯示節點結構。建立、移動、重新命名、合併和刪除操作會改動筆記、資料夾或結構屬性。 |
| [Number Suite](https://github.com/ZHYX91/obsidian-number-suite/blob/main/docs/i18n/README.zh-TW.md) | 虛擬編號改變顯示。單篇筆記的設定會儲存屬性；寫入、移除或重新編號會修改標題文字。 |
| [Structural Tables](https://github.com/ZHYX91/obsidian-structural-tables/blob/main/docs/i18n/README.zh-TW.md) | 查看表格和外觀範例不修改筆記。編輯表格會寫入 Markdown，轉換為 Base 會建立記錄檔案。 |

設定分為四頁：一般、轉為 Markdown、轉為 Word、校對。每頁都有相關說明，分頁也可水平捲動。介面語言預設「跟隨 Obsidian」，也可以在「一般」頁手動選擇。Windows 的 Microsoft Store 版可自動偵測；Linux 與 Windows 可攜版需要手動選擇安裝位置。可用方向鍵及 Home/End 切換分頁。

## 限制

- 支援 Windows 與 Linux 桌面端，且本機必須安裝相容的 DocWen；Linux 匯出需要 x64；如果檔案系統無法安全儲存結果，外掛會停止並提示你選擇其他目錄；
- Windows 自動模式使用系統註冊的 Microsoft Store 安裝版；手動模式在 Windows 接受 DocWen 資料夾、`DocWen.exe` 或 `DocWenCLI.exe`，在 Linux 接受資料夾、`DocWen` 或 `DocWenCLI`；兩種模式都不會搜尋任意目錄；
- 筆記在處理中發生變化，或結果無法安全儲存時，操作會停止並提示你檢查。

Word 往返轉換有保真範圍：可轉回受支援的可見內容，但不能視為 Markdown 原文的精確備份。未支援的語法、嵌入筆記展開與部分版式可能無法保留；請保留來源筆記並檢查轉回的文件。

## 隱私與安全性

文件留在你的電腦上。外掛將所選檔案的暫存副本交給本機 DocWen；若筆記有唯一對應的編輯器，也會包含尚未儲存的文字。只處理筆記明確引用的圖片，不會掃描 Vault 尋找無關檔案，也不會上傳文件。

匯出寫入你選擇的目錄，校對不修改筆記。標題編號只有在原筆記仍位於原路徑且正文未變時才寫回；處理期間若重新命名或替換了筆記，請對目前筆記重新執行。外掛設定不儲存商店套件安裝路徑。開發者可參閱[整合說明](../cli-integration.md)。

## 開發

使用 Node.js 24.19.0 與 npm 11.17.0。執行 `npm ci`、`npm run check` 和 `npm run release`。執行時原始碼位於 `src/`，測試位於 `tests/`；產生的 `dist/` 與 `release/` 不是原始碼。

穩定文件：[產品需求](../product-requirements.en.md) · [UX 規格](../ux-spec.en.md) · [架構](../architecture.en.md) · [測試策略](../testing-strategy.en.md)

儲存庫治理：[變更記錄](../../CHANGELOG.md) · [貢獻指南](../../CONTRIBUTING.md) · [安全性](../../SECURITY.md)

## 支援

在 Obsidian 內需要協助時，開啟**一般 → 說明**，選擇**使用指南**或**回報問題**。

- [Q&A](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/q-a)：使用和設定問題。
- [Ideas](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/ideas)：尚待討論的功能與工作流程想法。
- [Show and tell](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/show-and-tell)：技巧、工作流程和參考實作。
- 可重現的 Obsidian 整合錯誤和明確功能建議請使用結構化的 [DocWen Assistant Issue 表單](https://github.com/ZHYX91/obsidian-docwen-assistant/issues/new/choose)；
- Obsidian 以外的轉換、OCR、校對或 CLI 行為請提交到 [DocWen Core Issues](https://github.com/ZHYX91/docwen/issues)；
- 安全性漏洞請依照儲存庫的[安全性政策](https://github.com/ZHYX91/obsidian-docwen-assistant/security/policy)私下回報。

公開發布前請移除私人文件內容、檔案和 Vault 路徑、CLI 記錄、執行檔位置及認證資訊。

## 授權

MIT © ZhengYX

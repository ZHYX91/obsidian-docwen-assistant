/**
 * DocWen Obsidian Plugin - Internationalization Module
 * 
 * Supports 11 languages matching the main DocWen application:
 * - zh-cn: Simplified Chinese
 * - zh-tw: Traditional Chinese
 * - en: English
 * - de: German
 * - fr: French
 * - ru: Russian
 * - pt: Portuguese (Brazil)
 * - ja: Japanese
 * - ko: Korean
 * - es: Spanish
 * - vi: Vietnamese
 */

// Translation type definition
interface Translations {
  // Ribbon & Commands
  ribbonTooltip: string;
  commandLaunch: string;
  commandLaunchWithFile: string;
  commandExportDocx: string;
  commandExportMd: string;
  commandExportXlsx: string;
  commandDoctor: string;

  // Context Menu (file-menu)
  contextMenuSubmenuTitle: string;
  contextMenuConvertToMd: string;
  contextMenuConvertToDocx: string;
  contextMenuConvertToXlsx: string;
  contextMenuAddNumbering: string;
  contextMenuRemoveNumbering: string;
  contextMenuOpenInDocWen: string;
  
  // Settings
  settingsTitle: string;
  settingsGuiPath: string;
  settingsGuiPathDesc: string;
  settingsGuiPathPlaceholder: string;
  settingsCliPath: string;
  settingsCliPathDesc: string;
  settingsCliPathPlaceholder: string;
  settingsBrowse: string;
  settingsPathStatus: string;
  settingsCliPathStatus: string;
  settingsPathValid: string;
  settingsPathInvalid: string;
  settingsPathNotSet: string;
  settingsCliPathNotSet: string;
  settingsAutoDetectedSuffix: string;
  settingsPathNotExe: string;
  settingsPathNotFile: string;
  settingsUsageTitle: string;
  settingsUsageList: string;
  
  // Notices
  noticePathNotSet: string;
  noticePathNotExist: string;
  noticeLaunchFailed: string;
  noticeLaunched: string;
  noticeLaunchedWithFile: string;
  noticeFileAdded: string;
  noticeWindowActivated: string;
  noticeCommandFailed: string;
  noticePathUpdated: string;
  noticeCliNotFound: string;
  noticeCliInvalidJson: string;
  noticeExportSuccess: string;
  noticeExportFailed: string;
  noticeExportFailedCopied: string;
  noticeDoctorSuccess: string;
  noticeDoctorFailed: string;
  noticeDoctorFailedCopied: string;
  
  // Picker
  pickerTemplatePlaceholder: string;
  pickerOptimizationPlaceholder: string;
  pickerNoOptimization: string;
  noticeNoTemplatesAvailable: string;

  // Export to MD options
  settingsExportMdTitle: string;
  settingsExtractImages: string;
  settingsExtractImagesDesc: string;
  settingsEnableOcr: string;
  settingsEnableOcrDesc: string;
  settingsExportDocTitle: string;
  settingsCleanNumbering: string;
  settingsCleanNumberingDesc: string;
  settingsAddNumbering: string;
  settingsAddNumberingDesc: string;
  settingsNumberingDefault: string;
  settingsNumberingRemove: string;
  settingsNumberingKeep: string;
  settingsNumberingNone: string;
  settingsNumberingSchemeError: string;
  
  // Numbering
  commandAddNumbering: string;
  commandRemoveNumbering: string;
  pickerNumberingSchemePlaceholder: string;
  noticeNumberingSuccess: string;
  noticeNumberingFailed: string;
  noticeNumberingFailedCopied: string;
}

// All translations
const translations: Record<string, Translations> = {
  // Simplified Chinese
  "zh-cn": {
    ribbonTooltip: "启动 DocWen",
    commandLaunch: "启动 DocWen",
    commandLaunchWithFile: "使用当前文件启动 DocWen",
    commandExportDocx: "后台导出为 Word（Docx）",
    commandExportMd: "后台导出为 Markdown（MD）",
    commandExportXlsx: "后台导出为 Excel（XLSX）",
    commandDoctor: "DocWen doctor 自检",

    contextMenuSubmenuTitle: "DocWen",
    contextMenuConvertToMd: "转为 Markdown（MD）",
    contextMenuConvertToDocx: "转为 Word（Docx）",
    contextMenuConvertToXlsx: "转为 Excel（XLSX）",
    contextMenuAddNumbering: "为标题添加序号",
    contextMenuRemoveNumbering: "清理标题序号",
    contextMenuOpenInDocWen: "用 DocWen 打开",
    
    settingsTitle: "DocWen 助手设置",
    settingsGuiPath: "DocWen 图形界面路径",
    settingsGuiPathDesc: "DocWen.exe 的完整路径。只需填写一个路径即可，插件会自动识别另一个。",
    settingsGuiPathPlaceholder: "例如：C:\\Users\\YourName\\Desktop\\DocWen.exe",
    settingsCliPath: "DocWen 命令行路径（可选）",
    settingsCliPathDesc: "DocWenCLI.exe 的完整路径。只需填写一个路径即可，插件会自动识别另一个。",
    settingsCliPathPlaceholder: "例如：C:\\Users\\YourName\\Desktop\\DocWenCLI.exe",
    settingsBrowse: "浏览...",
    settingsPathStatus: "GUI 路径状态",
    settingsCliPathStatus: "CLI 路径状态",
    settingsPathValid: "✓ 路径有效",
    settingsPathInvalid: "✗ 错误: 文件不存在",
    settingsPathNotSet: "未设置路径",
    settingsCliPathNotSet: "未设置 CLI 路径（若已设置 GUI 将自动识别）",
    settingsAutoDetectedSuffix: "（自动识别）",
    settingsPathNotExe: "⚠ 警告: 文件扩展名不是 .exe",
    settingsPathNotFile: "✗ 错误: 路径指向的不是文件",
    settingsUsageTitle: "使用方法",
    settingsUsageList: `
      <ul>
        <li>点击左侧栏的文档图标，启动 DocWen 或将当前文件发送给 DocWen</li>
        <li>在文件列表中右键文件，选择 <b>DocWen</b> 子菜单：转换格式、添加/清理序号、用 DocWen 打开</li>
        <li>使用命令面板 (Ctrl/Cmd + P) 搜索 <b>DocWen</b>，可使用启动、导出、序号、自检等命令</li>
        <li>打开文件时，文件路径会自动传递给 DocWen</li>
      </ul>
    `,
    
    noticePathNotSet: "请先在插件设置中指定可执行文件路径。",
    noticePathNotExist: "可执行文件不存在，请检查路径设置。",
    noticeLaunchFailed: "启动失败：{error}",
    noticeLaunched: "已启动 DocWen",
    noticeLaunchedWithFile: "已启动 DocWen（带文件: {filename}）",
    noticeFileAdded: "已添加文件: {filename}",
    noticeWindowActivated: "已激活 DocWen 窗口",
    noticeCommandFailed: "发送命令失败，请检查 DocWen 程序",
    noticePathUpdated: "路径已更新",
    noticeCliNotFound: "未找到 DocWenCLI.exe，请在设置中指定或放在 DocWen.exe 同目录。",
    noticeCliInvalidJson: "DocWenCLI 输出不是有效 JSON，请升级 CLI 或检查 --quiet/--json 支持。",
    noticeExportSuccess: "已导出：{filename}",
    noticeExportFailed: "导出失败：{error}",
    noticeExportFailedCopied: "导出失败（详情已复制）：{error}",
    noticeDoctorSuccess: "doctor 自检通过",
    noticeDoctorFailed: "doctor 自检失败：{error}",
    noticeDoctorFailedCopied: "doctor 自检失败（详情已复制）：{error}",
    pickerTemplatePlaceholder: "选择模板…",
    pickerOptimizationPlaceholder: "选择优化类型…",
    pickerNoOptimization: "不使用优化",
    noticeNoTemplatesAvailable: "无可用模板，请先在 DocWen 中配置模板。",
    settingsExportMdTitle: "转为 Markdown 选项",
    settingsExtractImages: "提取图片",
    settingsExtractImagesDesc: "转换为 Markdown 时，将文档中的图片提取并嵌入到输出中。",
    settingsEnableOcr: "图片文字识别（OCR）",
    settingsEnableOcrDesc: "转换为 Markdown 时，对图片进行 OCR 识别并将识别的文字插入到输出中。",
    settingsExportDocTitle: "转为文档选项",
    settingsCleanNumbering: "清理序号",
    settingsCleanNumberingDesc: "转换时是否清理原始文档中的标题序号",
    settingsAddNumbering: "新增序号",
    settingsAddNumberingDesc: "转换时是否为标题添加新的序号",
    settingsNumberingDefault: "跟随 DocWen 配置",
    settingsNumberingRemove: "清理序号",
    settingsNumberingKeep: "保持原样",
    settingsNumberingNone: "不新增",
    settingsNumberingSchemeError: "无法获取序号方案，请检查 CLI 路径设置",
    commandAddNumbering: "为 Markdown 标题添加序号",
    commandRemoveNumbering: "清理 Markdown 标题序号",
    pickerNumberingSchemePlaceholder: "选择序号方案…",
    noticeNumberingSuccess: "序号处理完成：{filename}",
    noticeNumberingFailed: "序号处理失败：{error}",
    noticeNumberingFailedCopied: "序号处理失败（详情已复制）：{error}",
  },
  
  // Traditional Chinese
  "zh-tw": {
    ribbonTooltip: "啟動 DocWen",
    commandLaunch: "啟動 DocWen",
    commandLaunchWithFile: "使用當前檔案啟動 DocWen",
    commandExportDocx: "背景匯出為 Word（Docx）",
    commandExportMd: "背景匯出為 Markdown（MD）",
    commandExportXlsx: "背景匯出為 Excel（XLSX）",
    commandDoctor: "DocWen doctor 自我檢查",

    contextMenuSubmenuTitle: "DocWen",
    contextMenuConvertToMd: "轉為 Markdown（MD）",
    contextMenuConvertToDocx: "轉為 Word（Docx）",
    contextMenuConvertToXlsx: "轉為 Excel（XLSX）",
    contextMenuAddNumbering: "為標題添加序號",
    contextMenuRemoveNumbering: "清理標題序號",
    contextMenuOpenInDocWen: "用 DocWen 開啟",
    
    settingsTitle: "DocWen 助手設定",
    settingsGuiPath: "DocWen 圖形介面路徑",
    settingsGuiPathDesc: "DocWen.exe 的完整路徑。只需填寫一個路徑即可，外掛會自動識別另一個。",
    settingsGuiPathPlaceholder: "例如：C:\\Users\\YourName\\Desktop\\DocWen.exe",
    settingsCliPath: "DocWen 命令列路徑（可選）",
    settingsCliPathDesc: "DocWenCLI.exe 的完整路徑。只需填寫一個路徑即可，外掛會自動識別另一個。",
    settingsCliPathPlaceholder: "例如：C:\\Users\\YourName\\Desktop\\DocWenCLI.exe",
    settingsBrowse: "瀏覽...",
    settingsPathStatus: "GUI 路徑狀態",
    settingsCliPathStatus: "CLI 路徑狀態",
    settingsPathValid: "✓ 路徑有效",
    settingsPathInvalid: "✗ 錯誤: 檔案不存在",
    settingsPathNotSet: "未設定路徑",
    settingsCliPathNotSet: "未設定 CLI 路徑（若已設定 GUI 將自動識別）",
    settingsAutoDetectedSuffix: "（自動識別）",
    settingsPathNotExe: "⚠ 警告: 檔案副檔名不是 .exe",
    settingsPathNotFile: "✗ 錯誤: 路徑指向的不是檔案",
    settingsUsageTitle: "使用方法",
    settingsUsageList: `
      <ul>
        <li>點擊左側欄的文件圖示，啟動 DocWen 或將當前檔案傳送給 DocWen</li>
        <li>在檔案列表中右鍵檔案，選擇 <b>DocWen</b> 子選單：轉換格式、添加/清理序號、用 DocWen 開啟</li>
        <li>使用命令面板 (Ctrl/Cmd + P) 搜尋 <b>DocWen</b>，可使用啟動、匯出、序號、自檢等命令</li>
        <li>開啟檔案時，檔案路徑會自動傳遞給 DocWen</li>
      </ul>
    `,
    
    noticePathNotSet: "請先在插件設定中指定可執行檔路徑。",
    noticePathNotExist: "可執行檔不存在，請檢查路徑設定。",
    noticeLaunchFailed: "啟動失敗：{error}",
    noticeLaunched: "已啟動 DocWen",
    noticeLaunchedWithFile: "已啟動 DocWen（帶檔案: {filename}）",
    noticeFileAdded: "已添加檔案: {filename}",
    noticeWindowActivated: "已啟動 DocWen 視窗",
    noticeCommandFailed: "傳送命令失敗，請檢查 DocWen 程式",
    noticePathUpdated: "路徑已更新",
    noticeCliNotFound: "找不到 DocWenCLI.exe，請在設定中指定或放在 DocWen.exe 同目錄。",
    noticeCliInvalidJson: "DocWenCLI 輸出不是有效 JSON，請升級 CLI 或檢查 --quiet/--json 支援。",
    noticeExportSuccess: "已匯出：{filename}",
    noticeExportFailed: "匯出失敗：{error}",
    noticeExportFailedCopied: "匯出失敗（詳情已複製）：{error}",
    noticeDoctorSuccess: "doctor 自我檢查通過",
    noticeDoctorFailed: "doctor 自我檢查失敗：{error}",
    noticeDoctorFailedCopied: "doctor 自我檢查失敗（詳情已複製）：{error}",
    pickerTemplatePlaceholder: "選擇模板…",
    pickerOptimizationPlaceholder: "選擇優化類型…",
    pickerNoOptimization: "不使用優化",
    noticeNoTemplatesAvailable: "無可用模板，請先在 DocWen 中設定模板。",
    settingsExportMdTitle: "轉為 Markdown 選項",
    settingsExtractImages: "提取圖片",
    settingsExtractImagesDesc: "轉換為 Markdown 時，將文件中的圖片提取並嵌入到輸出中。",
    settingsEnableOcr: "圖片文字辨識（OCR）",
    settingsEnableOcrDesc: "轉換為 Markdown 時，對圖片進行 OCR 辨識並將辨識的文字插入到輸出中。",
    settingsExportDocTitle: "轉為文件選項",
    settingsCleanNumbering: "清理序號",
    settingsCleanNumberingDesc: "轉換時是否清理原始文件中的標題序號",
    settingsAddNumbering: "新增序號",
    settingsAddNumberingDesc: "轉換時是否為標題新增新的序號",
    settingsNumberingDefault: "跟隨 DocWen 設定",
    settingsNumberingRemove: "清理序號",
    settingsNumberingKeep: "保持原樣",
    settingsNumberingNone: "不新增",
    settingsNumberingSchemeError: "無法取得序號方案，請檢查 CLI 路徑設定",
    commandAddNumbering: "為 Markdown 標題添加序號",
    commandRemoveNumbering: "清理 Markdown 標題序號",
    pickerNumberingSchemePlaceholder: "選擇序號方案…",
    noticeNumberingSuccess: "序號處理完成：{filename}",
    noticeNumberingFailed: "序號處理失敗：{error}",
    noticeNumberingFailedCopied: "序號處理失敗（詳情已複製）：{error}",
  },
  
  // English
  "en": {
    ribbonTooltip: "Launch DocWen",
    commandLaunch: "Launch DocWen",
    commandLaunchWithFile: "Launch DocWen with current file",
    commandExportDocx: "Export to Word (Docx) in background",
    commandExportMd: "Export to Markdown (MD) in background",
    commandExportXlsx: "Export to Excel (XLSX) in background",
    commandDoctor: "DocWen doctor check",

    contextMenuSubmenuTitle: "DocWen",
    contextMenuConvertToMd: "Convert to Markdown (MD)",
    contextMenuConvertToDocx: "Convert to Word (Docx)",
    contextMenuConvertToXlsx: "Convert to Excel (XLSX)",
    contextMenuAddNumbering: "Add heading numbering",
    contextMenuRemoveNumbering: "Remove heading numbering",
    contextMenuOpenInDocWen: "Open in DocWen",
    
    settingsTitle: "DocWen Assistant Settings",
    settingsGuiPath: "DocWen GUI Path",
    settingsGuiPathDesc: "Full path to DocWen.exe. You only need to set one path; the plugin will auto-detect the other.",
    settingsGuiPathPlaceholder: "e.g., C:\\Users\\YourName\\Desktop\\DocWen.exe",
    settingsCliPath: "DocWen CLI Path (Optional)",
    settingsCliPathDesc: "Full path to DocWenCLI.exe. You only need to set one path; the plugin will auto-detect the other.",
    settingsCliPathPlaceholder: "e.g., C:\\Users\\YourName\\Desktop\\DocWenCLI.exe",
    settingsBrowse: "Browse...",
    settingsPathStatus: "GUI Path Status",
    settingsCliPathStatus: "CLI Path Status",
    settingsPathValid: "✓ Path is valid",
    settingsPathInvalid: "✗ Error: File does not exist",
    settingsPathNotSet: "Path not set",
    settingsCliPathNotSet: "CLI path not set (auto-detects if GUI is set)",
    settingsAutoDetectedSuffix: "(auto-detected)",
    settingsPathNotExe: "⚠ Warning: File extension is not .exe",
    settingsPathNotFile: "✗ Error: Path does not point to a file",
    settingsUsageTitle: "Usage",
    settingsUsageList: `
      <ul>
        <li>Click the document icon in the left sidebar to launch DocWen or send the current file</li>
        <li>Right-click a file in the file list and use the <b>DocWen</b> submenu: convert formats, manage numbering, or open in DocWen</li>
        <li>Use the command palette (Ctrl/Cmd + P) and search <b>DocWen</b> for all available commands: launch, export, numbering, doctor check</li>
        <li>When a file is open, its path is automatically passed to DocWen</li>
      </ul>
    `,
    
    noticePathNotSet: "Please set the executable path in the plugin settings first.",
    noticePathNotExist: "Executable file does not exist. Please check the path settings.",
    noticeLaunchFailed: "Launch failed: {error}",
    noticeLaunched: "DocWen launched",
    noticeLaunchedWithFile: "DocWen launched (with file: {filename})",
    noticeFileAdded: "File added: {filename}",
    noticeWindowActivated: "DocWen window activated",
    noticeCommandFailed: "Failed to send command. Please check the DocWen program.",
    noticePathUpdated: "Path updated",
    noticeCliNotFound: "DocWenCLI.exe not found. Set it in settings or place it next to DocWen.exe.",
    noticeCliInvalidJson: "DocWenCLI output is not valid JSON. Please update CLI or verify --json/--quiet support.",
    noticeExportSuccess: "Exported: {filename}",
    noticeExportFailed: "Export failed: {error}",
    noticeExportFailedCopied: "Export failed (details copied): {error}",
    noticeDoctorSuccess: "Doctor check passed",
    noticeDoctorFailed: "Doctor check failed: {error}",
    noticeDoctorFailedCopied: "Doctor check failed (details copied): {error}",
    pickerTemplatePlaceholder: "Select template…",
    pickerOptimizationPlaceholder: "Select optimization…",
    pickerNoOptimization: "No optimization",
    noticeNoTemplatesAvailable: "No templates available. Please configure templates in DocWen first.",
    settingsExportMdTitle: "Export to Markdown Options",
    settingsExtractImages: "Extract images",
    settingsExtractImagesDesc: "Extract and embed images from the document when converting to Markdown.",
    settingsEnableOcr: "Image text recognition (OCR)",
    settingsEnableOcrDesc: "Perform OCR on images and insert recognized text into the Markdown output.",
    settingsExportDocTitle: "Export to Document Options",
    settingsCleanNumbering: "Clean numbering",
    settingsCleanNumberingDesc: "Whether to clean heading numbering from the source during conversion",
    settingsAddNumbering: "Add numbering",
    settingsAddNumberingDesc: "Whether to add new heading numbering during conversion",
    settingsNumberingDefault: "Follow DocWen config",
    settingsNumberingRemove: "Clean numbering",
    settingsNumberingKeep: "Keep as-is",
    settingsNumberingNone: "Don't add",
    settingsNumberingSchemeError: "Failed to load numbering schemes. Check CLI path settings.",
    commandAddNumbering: "Add numbering to Markdown headings",
    commandRemoveNumbering: "Remove numbering from Markdown headings",
    pickerNumberingSchemePlaceholder: "Select numbering scheme…",
    noticeNumberingSuccess: "Numbering done: {filename}",
    noticeNumberingFailed: "Numbering failed: {error}",
    noticeNumberingFailedCopied: "Numbering failed (details copied): {error}",
  },
  
  // German
  "de": {
    ribbonTooltip: "DocWen starten",
    commandLaunch: "DocWen starten",
    commandLaunchWithFile: "DocWen mit aktueller Datei starten",
    commandExportDocx: "Als Word (Docx) im Hintergrund exportieren",
    commandExportMd: "Als Markdown (MD) im Hintergrund exportieren",
    commandExportXlsx: "Als Excel (XLSX) im Hintergrund exportieren",
    commandDoctor: "DocWen doctor prüfen",

    contextMenuSubmenuTitle: "DocWen",
    contextMenuConvertToMd: "In Markdown (MD) konvertieren",
    contextMenuConvertToDocx: "In Word (Docx) konvertieren",
    contextMenuConvertToXlsx: "In Excel (XLSX) konvertieren",
    contextMenuAddNumbering: "Überschriften nummerieren",
    contextMenuRemoveNumbering: "Überschriften-Nummerierung entfernen",
    contextMenuOpenInDocWen: "In DocWen öffnen",
    
    settingsTitle: "DocWen-Assistent Einstellungen",
    settingsGuiPath: "DocWen GUI-Pfad",
    settingsGuiPathDesc: "Vollständiger Pfad zu DocWen.exe. Es reicht, einen Pfad zu setzen; der andere wird automatisch erkannt.",
    settingsGuiPathPlaceholder: "z.B. C:\\Users\\IhrName\\Desktop\\DocWen.exe",
    settingsCliPath: "DocWen CLI-Pfad (optional)",
    settingsCliPathDesc: "Vollständiger Pfad zu DocWenCLI.exe. Es reicht, einen Pfad zu setzen; der andere wird automatisch erkannt.",
    settingsCliPathPlaceholder: "z.B. C:\\Users\\IhrName\\Desktop\\DocWenCLI.exe",
    settingsBrowse: "Durchsuchen...",
    settingsPathStatus: "GUI-Pfadstatus",
    settingsCliPathStatus: "CLI-Pfadstatus",
    settingsPathValid: "✓ Pfad ist gültig",
    settingsPathInvalid: "✗ Fehler: Datei existiert nicht",
    settingsPathNotSet: "Pfad nicht festgelegt",
    settingsCliPathNotSet: "CLI-Pfad nicht festgelegt (automatisch, wenn GUI gesetzt ist)",
    settingsAutoDetectedSuffix: "(automatisch erkannt)",
    settingsPathNotExe: "⚠ Warnung: Dateierweiterung ist nicht .exe",
    settingsPathNotFile: "✗ Fehler: Pfad zeigt nicht auf eine Datei",
    settingsUsageTitle: "Verwendung",
    settingsUsageList: `
      <ul>
        <li>Klicken Sie auf das Dokumentsymbol in der linken Seitenleiste, um DocWen zu starten oder die aktuelle Datei zu senden</li>
        <li>Rechtsklicken Sie auf eine Datei in der Dateiliste und verwenden Sie das <b>DocWen</b>-Untermenü: Formate konvertieren, Nummerierung verwalten oder in DocWen öffnen</li>
        <li>Verwenden Sie die Befehlspalette (Strg/Cmd + P) und suchen Sie nach <b>DocWen</b> für alle verfügbaren Befehle</li>
        <li>Wenn eine Datei geöffnet ist, wird ihr Pfad automatisch an DocWen übergeben</li>
      </ul>
    `,
    
    noticePathNotSet: "Bitte legen Sie zuerst den Pfad zur ausführbaren Datei in den Plugin-Einstellungen fest.",
    noticePathNotExist: "Ausführbare Datei existiert nicht. Bitte überprüfen Sie die Pfadeinstellungen.",
    noticeLaunchFailed: "Start fehlgeschlagen: {error}",
    noticeLaunched: "DocWen gestartet",
    noticeLaunchedWithFile: "DocWen gestartet (mit Datei: {filename})",
    noticeFileAdded: "Datei hinzugefügt: {filename}",
    noticeWindowActivated: "DocWen-Fenster aktiviert",
    noticeCommandFailed: "Befehl konnte nicht gesendet werden. Bitte überprüfen Sie das DocWen-Programm.",
    noticePathUpdated: "Pfad aktualisiert",
    noticeCliNotFound: "DocWenCLI.exe nicht gefunden. In den Einstellungen angeben oder neben DocWen.exe ablegen.",
    noticeCliInvalidJson: "DocWenCLI-Ausgabe ist kein gültiges JSON. Bitte CLI aktualisieren oder --json/--quiet prüfen.",
    noticeExportSuccess: "Exportiert: {filename}",
    noticeExportFailed: "Export fehlgeschlagen: {error}",
    noticeExportFailedCopied: "Export fehlgeschlagen (Details kopiert): {error}",
    noticeDoctorSuccess: "Doctor-Prüfung bestanden",
    noticeDoctorFailed: "Doctor-Prüfung fehlgeschlagen: {error}",
    noticeDoctorFailedCopied: "Doctor-Prüfung fehlgeschlagen (Details kopiert): {error}",
    pickerTemplatePlaceholder: "Vorlage auswählen…",
    pickerOptimizationPlaceholder: "Optimierung auswählen…",
    pickerNoOptimization: "Keine Optimierung",
    noticeNoTemplatesAvailable: "Keine Vorlagen verfügbar. Bitte konfigurieren Sie Vorlagen zuerst in DocWen.",
    settingsExportMdTitle: "Markdown-Exportoptionen",
    settingsExtractImages: "Bilder extrahieren",
    settingsExtractImagesDesc: "Bilder aus dem Dokument extrahieren und in die Markdown-Ausgabe einbetten.",
    settingsEnableOcr: "Bildtexterkennung (OCR)",
    settingsEnableOcrDesc: "OCR auf Bilder anwenden und erkannten Text in die Markdown-Ausgabe einfügen.",
    settingsExportDocTitle: "Optionen: Export in Dokument",
    settingsCleanNumbering: "Nummerierung bereinigen",
    settingsCleanNumberingDesc: "Beim Konvertieren die ursprüngliche Überschriftennummerierung entfernen",
    settingsAddNumbering: "Nummerierung hinzufügen",
    settingsAddNumberingDesc: "Beim Konvertieren neue Überschriftennummerierung hinzufügen",
    settingsNumberingDefault: "DocWen-Konfiguration folgen",
    settingsNumberingRemove: "Nummerierung bereinigen",
    settingsNumberingKeep: "Unverändert lassen",
    settingsNumberingNone: "Nicht hinzufügen",
    settingsNumberingSchemeError: "Nummerierungsschemata konnten nicht geladen werden. CLI-Pfad prüfen.",
    commandAddNumbering: "Nummerierung zu Markdown-Überschriften hinzufügen",
    commandRemoveNumbering: "Nummerierung aus Markdown-Überschriften entfernen",
    pickerNumberingSchemePlaceholder: "Nummerierungsschema auswählen…",
    noticeNumberingSuccess: "Nummerierung abgeschlossen: {filename}",
    noticeNumberingFailed: "Nummerierung fehlgeschlagen: {error}",
    noticeNumberingFailedCopied: "Nummerierung fehlgeschlagen (Details kopiert): {error}",
  },
  
  // French
  "fr": {
    ribbonTooltip: "Lancer DocWen",
    commandLaunch: "Lancer DocWen",
    commandLaunchWithFile: "Lancer DocWen avec le fichier actuel",
    commandExportDocx: "Exporter en Word (Docx) en arrière-plan",
    commandExportMd: "Exporter en Markdown (MD) en arrière-plan",
    commandExportXlsx: "Exporter en Excel (XLSX) en arrière-plan",
    commandDoctor: "Vérification doctor DocWen",

    contextMenuSubmenuTitle: "DocWen",
    contextMenuConvertToMd: "Convertir en Markdown (MD)",
    contextMenuConvertToDocx: "Convertir en Word (Docx)",
    contextMenuConvertToXlsx: "Convertir en Excel (XLSX)",
    contextMenuAddNumbering: "Numéroter les titres",
    contextMenuRemoveNumbering: "Supprimer la numérotation des titres",
    contextMenuOpenInDocWen: "Ouvrir dans DocWen",
    
    settingsTitle: "Paramètres de l'assistant DocWen",
    settingsGuiPath: "Chemin GUI de DocWen",
    settingsGuiPathDesc: "Chemin complet vers DocWen.exe. Il suffit de définir un seul chemin ; l'autre sera détecté automatiquement.",
    settingsGuiPathPlaceholder: "par ex. C:\\Users\\VotreNom\\Desktop\\DocWen.exe",
    settingsCliPath: "Chemin CLI de DocWen (optionnel)",
    settingsCliPathDesc: "Chemin complet vers DocWenCLI.exe. Il suffit de définir un seul chemin ; l'autre sera détecté automatiquement.",
    settingsCliPathPlaceholder: "par ex. C:\\Users\\VotreNom\\Desktop\\DocWenCLI.exe",
    settingsBrowse: "Parcourir...",
    settingsPathStatus: "État du chemin GUI",
    settingsCliPathStatus: "État du chemin CLI",
    settingsPathValid: "✓ Chemin valide",
    settingsPathInvalid: "✗ Erreur : Le fichier n'existe pas",
    settingsPathNotSet: "Chemin non défini",
    settingsCliPathNotSet: "Chemin CLI non défini (détection auto si GUI défini)",
    settingsAutoDetectedSuffix: "(détecté automatiquement)",
    settingsPathNotExe: "⚠ Avertissement : L'extension du fichier n'est pas .exe",
    settingsPathNotFile: "✗ Erreur : Le chemin ne pointe pas vers un fichier",
    settingsUsageTitle: "Utilisation",
    settingsUsageList: `
      <ul>
        <li>Cliquez sur l'icône de document dans la barre latérale gauche pour lancer DocWen ou envoyer le fichier actuel</li>
        <li>Faites un clic droit sur un fichier dans la liste et utilisez le sous-menu <b>DocWen</b> : convertir, numéroter ou ouvrir dans DocWen</li>
        <li>Utilisez la palette de commandes (Ctrl/Cmd + P) et recherchez <b>DocWen</b> pour toutes les commandes disponibles</li>
        <li>Si un fichier est ouvert, son chemin sera automatiquement transmis à DocWen</li>
      </ul>
    `,
    
    noticePathNotSet: "Veuillez d'abord définir le chemin de l'exécutable dans les paramètres du plugin.",
    noticePathNotExist: "Le fichier exécutable n'existe pas. Veuillez vérifier les paramètres du chemin.",
    noticeLaunchFailed: "Échec du lancement : {error}",
    noticeLaunched: "DocWen lancé",
    noticeLaunchedWithFile: "DocWen lancé (avec fichier : {filename})",
    noticeFileAdded: "Fichier ajouté : {filename}",
    noticeWindowActivated: "Fenêtre DocWen activée",
    noticeCommandFailed: "Échec de l'envoi de la commande. Veuillez vérifier le programme DocWen.",
    noticePathUpdated: "Chemin mis à jour",
    noticeCliNotFound: "DocWenCLI.exe introuvable. Définissez-le dans les paramètres ou placez-le à côté de DocWen.exe.",
    noticeCliInvalidJson: "La sortie de DocWenCLI n'est pas un JSON valide. Mettez à jour la CLI ou vérifiez --json/--quiet.",
    noticeExportSuccess: "Exporté : {filename}",
    noticeExportFailed: "Échec de l'export : {error}",
    noticeExportFailedCopied: "Échec de l'export (détails copiés) : {error}",
    noticeDoctorSuccess: "Vérification doctor réussie",
    noticeDoctorFailed: "Vérification doctor échouée : {error}",
    noticeDoctorFailedCopied: "Vérification doctor échouée (détails copiés) : {error}",
    pickerTemplatePlaceholder: "Choisir un modèle…",
    pickerOptimizationPlaceholder: "Choisir une optimisation…",
    pickerNoOptimization: "Pas d'optimisation",
    noticeNoTemplatesAvailable: "Aucun modèle disponible. Veuillez d'abord configurer des modèles dans DocWen.",
    settingsExportMdTitle: "Options d'export Markdown",
    settingsExtractImages: "Extraire les images",
    settingsExtractImagesDesc: "Extraire et intégrer les images du document lors de la conversion en Markdown.",
    settingsEnableOcr: "Reconnaissance de texte (OCR)",
    settingsEnableOcrDesc: "Effectuer l'OCR sur les images et insérer le texte reconnu dans la sortie Markdown.",
    settingsExportDocTitle: "Options : Exporter en document",
    settingsCleanNumbering: "Nettoyer la numérotation",
    settingsCleanNumberingDesc: "Nettoyer la numérotation des titres à partir de la source lors de la conversion",
    settingsAddNumbering: "Ajouter une numérotation",
    settingsAddNumberingDesc: "Ajouter une nouvelle numérotation des titres lors de la conversion",
    settingsNumberingDefault: "Suivre la config DocWen",
    settingsNumberingRemove: "Nettoyer la numérotation",
    settingsNumberingKeep: "Conserver tel quel",
    settingsNumberingNone: "Ne pas ajouter",
    settingsNumberingSchemeError: "Impossible de charger les schémas. Vérifiez le chemin CLI.",
    commandAddNumbering: "Ajouter la numérotation aux titres Markdown",
    commandRemoveNumbering: "Supprimer la numérotation des titres Markdown",
    pickerNumberingSchemePlaceholder: "Choisir un schéma de numérotation…",
    noticeNumberingSuccess: "Numérotation terminée : {filename}",
    noticeNumberingFailed: "Numérotation échouée : {error}",
    noticeNumberingFailedCopied: "Numérotation échouée (détails copiés) : {error}",
  },
  
  // Russian
  "ru": {
    ribbonTooltip: "Запустить DocWen",
    commandLaunch: "Запустить DocWen",
    commandLaunchWithFile: "Запустить DocWen с текущим файлом",
    commandExportDocx: "Экспорт в Word (Docx) в фоне",
    commandExportMd: "Экспорт в Markdown (MD) в фоне",
    commandExportXlsx: "Экспорт в Excel (XLSX) в фоне",
    commandDoctor: "Проверка doctor DocWen",

    contextMenuSubmenuTitle: "DocWen",
    contextMenuConvertToMd: "Конвертировать в Markdown (MD)",
    contextMenuConvertToDocx: "Конвертировать в Word (Docx)",
    contextMenuConvertToXlsx: "Конвертировать в Excel (XLSX)",
    contextMenuAddNumbering: "Добавить нумерацию заголовков",
    contextMenuRemoveNumbering: "Удалить нумерацию заголовков",
    contextMenuOpenInDocWen: "Открыть в DocWen",
    
    settingsTitle: "Настройки помощника DocWen",
    settingsGuiPath: "Путь к GUI DocWen",
    settingsGuiPathDesc: "Полный путь к DocWen.exe. Достаточно указать один путь; другой будет найден автоматически.",
    settingsGuiPathPlaceholder: "например, C:\\Users\\ВашеИмя\\Desktop\\DocWen.exe",
    settingsCliPath: "Путь к CLI DocWen (необязательно)",
    settingsCliPathDesc: "Полный путь к DocWenCLI.exe. Достаточно указать один путь; другой будет найден автоматически.",
    settingsCliPathPlaceholder: "например, C:\\Users\\ВашеИмя\\Desktop\\DocWenCLI.exe",
    settingsBrowse: "Обзор...",
    settingsPathStatus: "Статус пути GUI",
    settingsCliPathStatus: "Статус пути CLI",
    settingsPathValid: "✓ Путь действителен",
    settingsPathInvalid: "✗ Ошибка: Файл не существует",
    settingsPathNotSet: "Путь не задан",
    settingsCliPathNotSet: "Путь CLI не задан (авто-поиск, если задан GUI)",
    settingsAutoDetectedSuffix: "(обнаружено автоматически)",
    settingsPathNotExe: "⚠ Предупреждение: Расширение файла не .exe",
    settingsPathNotFile: "✗ Ошибка: Путь не указывает на файл",
    settingsUsageTitle: "Использование",
    settingsUsageList: `
      <ul>
        <li>Нажмите на значок документа на левой боковой панели, чтобы запустить DocWen или отправить текущий файл</li>
        <li>Щёлкните правой кнопкой мыши по файлу в списке и используйте подменю <b>DocWen</b>: конвертировать, нумеровать или открыть в DocWen</li>
        <li>Используйте палитру команд (Ctrl/Cmd + P) и найдите <b>DocWen</b> для всех доступных команд</li>
        <li>Если файл открыт, его путь будет автоматически передан в DocWen</li>
      </ul>
    `,
    
    noticePathNotSet: "Сначала укажите путь к исполняемому файлу в настройках плагина.",
    noticePathNotExist: "Исполняемый файл не существует. Проверьте настройки пути.",
    noticeLaunchFailed: "Не удалось запустить: {error}",
    noticeLaunched: "DocWen запущен",
    noticeLaunchedWithFile: "DocWen запущен (с файлом: {filename})",
    noticeFileAdded: "Файл добавлен: {filename}",
    noticeWindowActivated: "Окно DocWen активировано",
    noticeCommandFailed: "Не удалось отправить команду. Проверьте программу DocWen.",
    noticePathUpdated: "Путь обновлён",
    noticeCliNotFound: "DocWenCLI.exe не найден. Укажите в настройках или поместите рядом с DocWen.exe.",
    noticeCliInvalidJson: "Вывод DocWenCLI не является корректным JSON. Обновите CLI или проверьте --json/--quiet.",
    noticeExportSuccess: "Экспортировано: {filename}",
    noticeExportFailed: "Ошибка экспорта: {error}",
    noticeExportFailedCopied: "Ошибка экспорта (детали скопированы): {error}",
    noticeDoctorSuccess: "Проверка doctor пройдена",
    noticeDoctorFailed: "Проверка doctor не пройдена: {error}",
    noticeDoctorFailedCopied: "Проверка doctor не пройдена (детали скопированы): {error}",
    pickerTemplatePlaceholder: "Выберите шаблон…",
    pickerOptimizationPlaceholder: "Выберите оптимизацию…",
    pickerNoOptimization: "Без оптимизации",
    noticeNoTemplatesAvailable: "Нет доступных шаблонов. Сначала настройте шаблоны в DocWen.",
    settingsExportMdTitle: "Параметры экспорта в Markdown",
    settingsExtractImages: "Извлечь изображения",
    settingsExtractImagesDesc: "Извлекать и встраивать изображения из документа при конвертации в Markdown.",
    settingsEnableOcr: "Распознавание текста (OCR)",
    settingsEnableOcrDesc: "Выполнять OCR на изображениях и вставлять распознанный текст в вывод Markdown.",
    settingsExportDocTitle: "Параметры: Экспорт в документ",
    settingsCleanNumbering: "Очистить нумерацию",
    settingsCleanNumberingDesc: "Очищать нумерацию заголовков из источника при конвертации",
    settingsAddNumbering: "Добавить нумерацию",
    settingsAddNumberingDesc: "Добавлять новую нумерацию заголовков при конвертации",
    settingsNumberingDefault: "Следовать конфигурации DocWen",
    settingsNumberingRemove: "Очистить нумерацию",
    settingsNumberingKeep: "Оставить как есть",
    settingsNumberingNone: "Не добавлять",
    settingsNumberingSchemeError: "Не удалось загрузить схемы. Проверьте путь CLI.",
    commandAddNumbering: "Добавить нумерацию к заголовкам Markdown",
    commandRemoveNumbering: "Удалить нумерацию из заголовков Markdown",
    pickerNumberingSchemePlaceholder: "Выберите схему нумерации…",
    noticeNumberingSuccess: "Нумерация завершена: {filename}",
    noticeNumberingFailed: "Ошибка нумерации: {error}",
    noticeNumberingFailedCopied: "Ошибка нумерации (детали скопированы): {error}",
  },
  
  // Portuguese (Brazil)
  "pt": {
    ribbonTooltip: "Iniciar DocWen",
    commandLaunch: "Iniciar DocWen",
    commandLaunchWithFile: "Iniciar DocWen com arquivo atual",
    commandExportDocx: "Exportar para Word (Docx) em segundo plano",
    commandExportMd: "Exportar para Markdown (MD) em segundo plano",
    commandExportXlsx: "Exportar para Excel (XLSX) em segundo plano",
    commandDoctor: "Verificação doctor do DocWen",

    contextMenuSubmenuTitle: "DocWen",
    contextMenuConvertToMd: "Converter para Markdown (MD)",
    contextMenuConvertToDocx: "Converter para Word (Docx)",
    contextMenuConvertToXlsx: "Converter para Excel (XLSX)",
    contextMenuAddNumbering: "Adicionar numeração aos títulos",
    contextMenuRemoveNumbering: "Remover numeração dos títulos",
    contextMenuOpenInDocWen: "Abrir no DocWen",
    
    settingsTitle: "Configurações do Assistente DocWen",
    settingsGuiPath: "Caminho do GUI DocWen",
    settingsGuiPathDesc: "Caminho completo para DocWen.exe. Basta definir um caminho; o outro será detectado automaticamente.",
    settingsGuiPathPlaceholder: "ex: C:\\Users\\SeuNome\\Desktop\\DocWen.exe",
    settingsCliPath: "Caminho do CLI DocWen (Opcional)",
    settingsCliPathDesc: "Caminho completo para DocWenCLI.exe. Basta definir um caminho; o outro será detectado automaticamente.",
    settingsCliPathPlaceholder: "ex: C:\\Users\\SeuNome\\Desktop\\DocWenCLI.exe",
    settingsBrowse: "Procurar...",
    settingsPathStatus: "Status do Caminho (GUI)",
    settingsCliPathStatus: "Status do Caminho CLI",
    settingsPathValid: "✓ Caminho válido",
    settingsPathInvalid: "✗ Erro: Arquivo não existe",
    settingsPathNotSet: "Caminho não definido",
    settingsCliPathNotSet: "Caminho do CLI não definido (detecção automática se GUI definido)",
    settingsAutoDetectedSuffix: "(detectado automaticamente)",
    settingsPathNotExe: "⚠ Aviso: Extensão do arquivo não é .exe",
    settingsPathNotFile: "✗ Erro: Caminho não aponta para um arquivo",
    settingsUsageTitle: "Uso",
    settingsUsageList: `
      <ul>
        <li>Clique no ícone de documento na barra lateral esquerda para iniciar o DocWen ou enviar o arquivo atual</li>
        <li>Clique com o botão direito em um arquivo na lista e use o submenu <b>DocWen</b>: converter formatos, gerenciar numeração ou abrir no DocWen</li>
        <li>Use a paleta de comandos (Ctrl/Cmd + P) e pesquise <b>DocWen</b> para todos os comandos disponíveis</li>
        <li>Se um arquivo estiver aberto, seu caminho será automaticamente passado para o DocWen</li>
      </ul>
    `,
    
    noticePathNotSet: "Por favor, defina o caminho do executável nas configurações do plugin primeiro.",
    noticePathNotExist: "O arquivo executável não existe. Verifique as configurações do caminho.",
    noticeLaunchFailed: "Falha ao iniciar: {error}",
    noticeLaunched: "DocWen iniciado",
    noticeLaunchedWithFile: "DocWen iniciado (com arquivo: {filename})",
    noticeFileAdded: "Arquivo adicionado: {filename}",
    noticeWindowActivated: "Janela do DocWen ativada",
    noticeCommandFailed: "Falha ao enviar comando. Verifique o programa DocWen.",
    noticePathUpdated: "Caminho atualizado",
    noticeCliNotFound: "DocWenCLI.exe não encontrado. Defina nas configurações ou coloque ao lado do DocWen.exe.",
    noticeCliInvalidJson: "A saída do DocWenCLI não é um JSON válido. Atualize o CLI ou verifique --json/--quiet.",
    noticeExportSuccess: "Exportado: {filename}",
    noticeExportFailed: "Falha ao exportar: {error}",
    noticeExportFailedCopied: "Falha ao exportar (detalhes copiados): {error}",
    noticeDoctorSuccess: "Verificação doctor aprovada",
    noticeDoctorFailed: "Verificação doctor falhou: {error}",
    noticeDoctorFailedCopied: "Verificação doctor falhou (detalhes copiados): {error}",
    pickerTemplatePlaceholder: "Selecionar modelo…",
    pickerOptimizationPlaceholder: "Selecionar otimização…",
    pickerNoOptimization: "Sem otimização",
    noticeNoTemplatesAvailable: "Nenhum modelo disponível. Configure modelos no DocWen primeiro.",
    settingsExportMdTitle: "Opções de exportação para Markdown",
    settingsExtractImages: "Extrair imagens",
    settingsExtractImagesDesc: "Extrair e incorporar imagens do documento ao converter para Markdown.",
    settingsEnableOcr: "Reconhecimento de texto (OCR)",
    settingsEnableOcrDesc: "Realizar OCR nas imagens e inserir o texto reconhecido na saída Markdown.",
    settingsExportDocTitle: "Opções de exportação para documento",
    settingsCleanNumbering: "Limpar numeração",
    settingsCleanNumberingDesc: "Limpar a numeração de títulos da origem durante a conversão",
    settingsAddNumbering: "Adicionar numeração",
    settingsAddNumberingDesc: "Adicionar nova numeração de títulos durante a conversão",
    settingsNumberingDefault: "Seguir config do DocWen",
    settingsNumberingRemove: "Limpar numeração",
    settingsNumberingKeep: "Manter como está",
    settingsNumberingNone: "Não adicionar",
    settingsNumberingSchemeError: "Falha ao carregar esquemas. Verifique o caminho do CLI.",
    commandAddNumbering: "Adicionar numeração aos títulos Markdown",
    commandRemoveNumbering: "Remover numeração dos títulos Markdown",
    pickerNumberingSchemePlaceholder: "Selecionar esquema de numeração…",
    noticeNumberingSuccess: "Numeração concluída: {filename}",
    noticeNumberingFailed: "Falha na numeração: {error}",
    noticeNumberingFailedCopied: "Falha na numeração (detalhes copiados): {error}",
  },
  
  // Japanese
  "ja": {
    ribbonTooltip: "DocWen を起動",
    commandLaunch: "DocWen を起動",
    commandLaunchWithFile: "現在のファイルで DocWen を起動",
    commandExportDocx: "バックグラウンドで Word（Docx）へ書き出し",
    commandExportMd: "バックグラウンドで Markdown（MD）へ書き出し",
    commandExportXlsx: "バックグラウンドで Excel（XLSX）へ書き出し",
    commandDoctor: "DocWen doctor チェック",

    contextMenuSubmenuTitle: "DocWen",
    contextMenuConvertToMd: "Markdown（MD）に変換",
    contextMenuConvertToDocx: "Word（Docx）に変換",
    contextMenuConvertToXlsx: "Excel（XLSX）に変換",
    contextMenuAddNumbering: "見出しに番号を付ける",
    contextMenuRemoveNumbering: "見出しの番号を削除",
    contextMenuOpenInDocWen: "DocWen で開く",
    
    settingsTitle: "DocWen アシスタント設定",
    settingsGuiPath: "DocWen GUI パス",
    settingsGuiPathDesc: "DocWen.exe のフルパス。どちらか一方を設定するだけで、もう一方は自動検出されます。",
    settingsGuiPathPlaceholder: "例：C:\\Users\\YourName\\Desktop\\DocWen.exe",
    settingsCliPath: "DocWen CLI パス（任意）",
    settingsCliPathDesc: "DocWenCLI.exe のフルパス。どちらか一方を設定するだけで、もう一方は自動検出されます。",
    settingsCliPathPlaceholder: "例：C:\\Users\\YourName\\Desktop\\DocWenCLI.exe",
    settingsBrowse: "参照...",
    settingsPathStatus: "GUI パスの状態",
    settingsCliPathStatus: "CLI パスの状態",
    settingsPathValid: "✓ パスは有効です",
    settingsPathInvalid: "✗ エラー：ファイルが存在しません",
    settingsPathNotSet: "パスが設定されていません",
    settingsCliPathNotSet: "CLI パスが設定されていません（GUI 設定時は自動検出）",
    settingsAutoDetectedSuffix: "（自動検出）",
    settingsPathNotExe: "⚠ 警告：ファイル拡張子が .exe ではありません",
    settingsPathNotFile: "✗ エラー：パスがファイルを指していません",
    settingsUsageTitle: "使用方法",
    settingsUsageList: `
      <ul>
        <li>左サイドバーのドキュメントアイコンをクリックして DocWen を起動、または現在のファイルを送信</li>
        <li>ファイルリストでファイルを右クリックし、<b>DocWen</b> サブメニューを使用：形式変換、番号管理、DocWen で開く</li>
        <li>コマンドパレット (Ctrl/Cmd + P) で <b>DocWen</b> を検索し、すべてのコマンドを利用</li>
        <li>ファイルが開いている場合、そのパスは自動的に DocWen に渡されます</li>
      </ul>
    `,
    
    noticePathNotSet: "プラグイン設定で実行ファイルのパスを先に設定してください。",
    noticePathNotExist: "実行ファイルが存在しません。パス設定を確認してください。",
    noticeLaunchFailed: "起動に失敗しました：{error}",
    noticeLaunched: "DocWen を起動しました",
    noticeLaunchedWithFile: "DocWen を起動しました（ファイル：{filename}）",
    noticeFileAdded: "ファイルを追加しました：{filename}",
    noticeWindowActivated: "DocWen ウィンドウをアクティブにしました",
    noticeCommandFailed: "コマンドの送信に失敗しました。DocWen プログラムを確認してください。",
    noticePathUpdated: "パスを更新しました",
    noticeCliNotFound: "DocWenCLI.exe が見つかりません。設定で指定するか DocWen.exe の隣に配置してください。",
    noticeCliInvalidJson: "DocWenCLI の出力が有効な JSON ではありません。CLI を更新するか --json/--quiet を確認してください。",
    noticeExportSuccess: "書き出しました：{filename}",
    noticeExportFailed: "書き出しに失敗しました：{error}",
    noticeExportFailedCopied: "書き出しに失敗しました（詳細をコピーしました）：{error}",
    noticeDoctorSuccess: "doctor チェックに合格しました",
    noticeDoctorFailed: "doctor チェックに失敗しました：{error}",
    noticeDoctorFailedCopied: "doctor チェックに失敗しました（詳細をコピーしました）：{error}",
    pickerTemplatePlaceholder: "テンプレートを選択…",
    pickerOptimizationPlaceholder: "最適化を選択…",
    pickerNoOptimization: "最適化なし",
    noticeNoTemplatesAvailable: "利用可能なテンプレートがありません。先に DocWen でテンプレートを設定してください。",
    settingsExportMdTitle: "Markdown エクスポート設定",
    settingsExtractImages: "画像を抽出",
    settingsExtractImagesDesc: "Markdown に変換する際、ドキュメントから画像を抽出して出力に埋め込みます。",
    settingsEnableOcr: "画像テキスト認識（OCR）",
    settingsEnableOcrDesc: "Markdown に変換する際、画像に OCR を実行して認識されたテキストを出力に挿入します。",
    settingsExportDocTitle: "文書へ変換オプション",
    settingsCleanNumbering: "番号をクリーン",
    settingsCleanNumberingDesc: "変換時に元の見出し番号を削除するかどうか",
    settingsAddNumbering: "番号を追加",
    settingsAddNumberingDesc: "変換時に新しい見出し番号を追加するかどうか",
    settingsNumberingDefault: "DocWen 設定に従う",
    settingsNumberingRemove: "番号をクリーン",
    settingsNumberingKeep: "そのまま保持",
    settingsNumberingNone: "追加しない",
    settingsNumberingSchemeError: "スキームを取得できません。CLI パス設定を確認してください。",
    commandAddNumbering: "Markdown 見出しに番号を付ける",
    commandRemoveNumbering: "Markdown 見出しの番号を削除",
    pickerNumberingSchemePlaceholder: "番号スキームを選択…",
    noticeNumberingSuccess: "番号処理完了：{filename}",
    noticeNumberingFailed: "番号処理に失敗：{error}",
    noticeNumberingFailedCopied: "番号処理に失敗（詳細をコピー）：{error}",
  },

  "ko": {
    ribbonTooltip: "DocWen 실행",
    commandLaunch: "DocWen 실행",
    commandLaunchWithFile: "현재 파일로 DocWen 실행",
    commandExportDocx: "백그라운드에서 Word(Docx)로 내보내기",
    commandExportMd: "백그라운드에서 Markdown(MD)로 내보내기",
    commandExportXlsx: "백그라운드에서 Excel(XLSX)로 내보내기",
    commandDoctor: "DocWen doctor 검사",

    contextMenuSubmenuTitle: "DocWen",
    contextMenuConvertToMd: "Markdown(MD)로 변환",
    contextMenuConvertToDocx: "Word(Docx)로 변환",
    contextMenuConvertToXlsx: "Excel(XLSX)로 변환",
    contextMenuAddNumbering: "제목 번호 추가",
    contextMenuRemoveNumbering: "제목 번호 제거",
    contextMenuOpenInDocWen: "DocWen에서 열기",

    settingsTitle: "DocWen Assistant 설정",
    settingsGuiPath: "DocWen GUI 경로",
    settingsGuiPathDesc: "DocWen.exe의 전체 경로입니다. 하나만 설정하면 다른 하나는 자동으로 감지됩니다.",
    settingsGuiPathPlaceholder: "예: C:\\Users\\YourName\\Desktop\\DocWen.exe",
    settingsCliPath: "DocWen CLI 경로(선택)",
    settingsCliPathDesc: "DocWenCLI.exe의 전체 경로입니다. 하나만 설정하면 다른 하나는 자동으로 감지됩니다.",
    settingsCliPathPlaceholder: "예: C:\\Users\\YourName\\Desktop\\DocWenCLI.exe",
    settingsBrowse: "찾아보기...",
    settingsPathStatus: "GUI 경로 상태",
    settingsCliPathStatus: "CLI 경로 상태",
    settingsPathValid: "✓ 경로가 유효합니다",
    settingsPathInvalid: "✗ 오류: 파일이 존재하지 않습니다",
    settingsPathNotSet: "경로가 설정되지 않았습니다",
    settingsCliPathNotSet: "CLI 경로가 설정되지 않았습니다(GUI 설정 시 자동 감지)",
    settingsAutoDetectedSuffix: "(자동 감지)",
    settingsPathNotExe: "⚠ 경고: 파일 확장자가 .exe가 아닙니다",
    settingsPathNotFile: "✗ 오류: 경로가 파일을 가리키지 않습니다",
    settingsUsageTitle: "사용 방법",
    settingsUsageList: `
      <ul>
        <li>왼쪽 사이드바의 문서 아이콘을 클릭하여 DocWen을 실행하거나 현재 파일을 전송</li>
        <li>파일 목록에서 파일을 우클릭하고 <b>DocWen</b> 하위 메뉴 사용: 형식 변환, 번호 관리, DocWen에서 열기</li>
        <li>명령 팔레트 (Ctrl/Cmd + P)에서 <b>DocWen</b>을 검색하여 모든 명령 사용</li>
        <li>열려 있는 파일이 있으면 해당 경로가 자동으로 DocWen에 전달됩니다</li>
      </ul>
    `,

    noticePathNotSet: "플러그인 설정에서 실행 파일 경로를 먼저 지정하세요.",
    noticePathNotExist: "실행 파일이 존재하지 않습니다. 경로 설정을 확인하세요.",
    noticeLaunchFailed: "실행 실패: {error}",
    noticeLaunched: "DocWen을 실행했습니다",
    noticeLaunchedWithFile: "DocWen을 실행했습니다(파일: {filename})",
    noticeFileAdded: "파일 추가됨: {filename}",
    noticeWindowActivated: "DocWen 창을 활성화했습니다",
    noticeCommandFailed: "명령 전송 실패. DocWen 프로그램을 확인하세요.",
    noticePathUpdated: "경로가 업데이트되었습니다",
    noticeCliNotFound: "DocWenCLI.exe를 찾을 수 없습니다. 설정에서 지정하거나 DocWen.exe와 같은 폴더에 두세요.",
    noticeCliInvalidJson: "DocWenCLI 출력이 유효한 JSON이 아닙니다. CLI를 업데이트하거나 --json/--quiet 지원을 확인하세요.",
    noticeExportSuccess: "내보냄: {filename}",
    noticeExportFailed: "내보내기 실패: {error}",
    noticeExportFailedCopied: "내보내기 실패(상세가 복사됨): {error}",
    noticeDoctorSuccess: "doctor 검사 통과",
    noticeDoctorFailed: "doctor 검사 실패: {error}",
    noticeDoctorFailedCopied: "doctor 검사 실패(상세가 복사됨): {error}",
    pickerTemplatePlaceholder: "템플릿 선택…",
    pickerOptimizationPlaceholder: "최적화 선택…",
    pickerNoOptimization: "최적화 없음",
    noticeNoTemplatesAvailable: "사용 가능한 템플릿이 없습니다. 먼저 DocWen에서 템플릿을 설정하세요.",
    settingsExportMdTitle: "Markdown 내보내기 옵션",
    settingsExtractImages: "이미지 추출",
    settingsExtractImagesDesc: "Markdown으로 변환할 때 문서에서 이미지를 추출하여 출력에 포함합니다.",
    settingsEnableOcr: "이미지 텍스트 인식(OCR)",
    settingsEnableOcrDesc: "Markdown으로 변환할 때 이미지에 OCR을 수행하고 인식된 텍스트를 출력에 삽입합니다.",
    settingsExportDocTitle: "문서로 변환 옵션",
    settingsCleanNumbering: "번호 정리",
    settingsCleanNumberingDesc: "변환 시 원본 제목 번호를 정리할지 여부",
    settingsAddNumbering: "번호 추가",
    settingsAddNumberingDesc: "변환 시 제목에 새 번호를 추가할지 여부",
    settingsNumberingDefault: "DocWen 설정 따름",
    settingsNumberingRemove: "번호 정리",
    settingsNumberingKeep: "그대로 유지",
    settingsNumberingNone: "추가 안 함",
    settingsNumberingSchemeError: "스킴을 불러올 수 없습니다. CLI 경로 설정을 확인하세요.",
    commandAddNumbering: "Markdown 제목에 번호 추가",
    commandRemoveNumbering: "Markdown 제목 번호 제거",
    pickerNumberingSchemePlaceholder: "번호 체계 선택…",
    noticeNumberingSuccess: "번호 처리 완료: {filename}",
    noticeNumberingFailed: "번호 처리 실패: {error}",
    noticeNumberingFailedCopied: "번호 처리 실패(상세 복사됨): {error}",
  },

  "es": {
    ribbonTooltip: "Iniciar DocWen",
    commandLaunch: "Iniciar DocWen",
    commandLaunchWithFile: "Iniciar DocWen con el archivo actual",
    commandExportDocx: "Exportar a Word (Docx) en segundo plano",
    commandExportMd: "Exportar a Markdown (MD) en segundo plano",
    commandExportXlsx: "Exportar a Excel (XLSX) en segundo plano",
    commandDoctor: "Comprobación doctor de DocWen",

    contextMenuSubmenuTitle: "DocWen",
    contextMenuConvertToMd: "Convertir a Markdown (MD)",
    contextMenuConvertToDocx: "Convertir a Word (Docx)",
    contextMenuConvertToXlsx: "Convertir a Excel (XLSX)",
    contextMenuAddNumbering: "Agregar numeración a títulos",
    contextMenuRemoveNumbering: "Eliminar numeración de títulos",
    contextMenuOpenInDocWen: "Abrir en DocWen",

    settingsTitle: "Ajustes del asistente DocWen",
    settingsGuiPath: "Ruta GUI de DocWen",
    settingsGuiPathDesc: "Ruta completa a DocWen.exe. Basta con configurar una ruta; la otra se detectará automáticamente.",
    settingsGuiPathPlaceholder: "p. ej., C:\\Users\\YourName\\Desktop\\DocWen.exe",
    settingsCliPath: "Ruta CLI de DocWen (opcional)",
    settingsCliPathDesc: "Ruta completa a DocWenCLI.exe. Basta con configurar una ruta; la otra se detectará automáticamente.",
    settingsCliPathPlaceholder: "p. ej., C:\\Users\\YourName\\Desktop\\DocWenCLI.exe",
    settingsBrowse: "Examinar...",
    settingsPathStatus: "Estado de la ruta (GUI)",
    settingsCliPathStatus: "Estado de la ruta CLI",
    settingsPathValid: "✓ La ruta es válida",
    settingsPathInvalid: "✗ Error: El archivo no existe",
    settingsPathNotSet: "Ruta no configurada",
    settingsCliPathNotSet: "Ruta de CLI no configurada (detección automática si GUI está configurado)",
    settingsAutoDetectedSuffix: "(detectado automáticamente)",
    settingsPathNotExe: "⚠ Aviso: La extensión del archivo no es .exe",
    settingsPathNotFile: "✗ Error: La ruta no apunta a un archivo",
    settingsUsageTitle: "Uso",
    settingsUsageList: `
      <ul>
        <li>Haz clic en el icono de documento en la barra lateral izquierda para iniciar DocWen o enviar el archivo actual</li>
        <li>Haz clic derecho en un archivo de la lista y usa el submenú <b>DocWen</b>: convertir formatos, gestionar numeración o abrir en DocWen</li>
        <li>Usa la paleta de comandos (Ctrl/Cmd + P) y busca <b>DocWen</b> para todos los comandos disponibles</li>
        <li>Si hay un archivo abierto, su ruta se pasará automáticamente a DocWen</li>
      </ul>
    `,

    noticePathNotSet: "Primero configura la ruta del ejecutable en los ajustes del plugin.",
    noticePathNotExist: "El archivo ejecutable no existe. Revisa la configuración de la ruta.",
    noticeLaunchFailed: "Error al iniciar: {error}",
    noticeLaunched: "DocWen iniciado",
    noticeLaunchedWithFile: "DocWen iniciado (con archivo: {filename})",
    noticeFileAdded: "Archivo añadido: {filename}",
    noticeWindowActivated: "Ventana de DocWen activada",
    noticeCommandFailed: "No se pudo enviar el comando. Revisa el programa DocWen.",
    noticePathUpdated: "Ruta actualizada",
    noticeCliNotFound: "No se encontró DocWenCLI.exe. Configúralo en los ajustes o colócalo junto a DocWen.exe.",
    noticeCliInvalidJson: "La salida de DocWenCLI no es un JSON válido. Actualiza la CLI o verifica --json/--quiet.",
    noticeExportSuccess: "Exportado: {filename}",
    noticeExportFailed: "Error de exportación: {error}",
    noticeExportFailedCopied: "Error de exportación (detalles copiados): {error}",
    noticeDoctorSuccess: "Comprobación doctor aprobada",
    noticeDoctorFailed: "Comprobación doctor fallida: {error}",
    noticeDoctorFailedCopied: "Comprobación doctor fallida (detalles copiados): {error}",
    pickerTemplatePlaceholder: "Seleccionar plantilla…",
    pickerOptimizationPlaceholder: "Seleccionar optimización…",
    pickerNoOptimization: "Sin optimización",
    noticeNoTemplatesAvailable: "No hay plantillas disponibles. Configure plantillas en DocWen primero.",
    settingsExportMdTitle: "Opciones de exportación a Markdown",
    settingsExtractImages: "Extraer imágenes",
    settingsExtractImagesDesc: "Extraer e incrustar imágenes del documento al convertir a Markdown.",
    settingsEnableOcr: "Reconocimiento de texto (OCR)",
    settingsEnableOcrDesc: "Realizar OCR en las imágenes e insertar el texto reconocido en la salida Markdown.",
    settingsExportDocTitle: "Opciones: Exportar a documento",
    settingsCleanNumbering: "Limpiar numeración",
    settingsCleanNumberingDesc: "Si se limpia la numeración de títulos de la fuente durante la conversión",
    settingsAddNumbering: "Añadir numeración",
    settingsAddNumberingDesc: "Si se añade una nueva numeración de títulos durante la conversión",
    settingsNumberingDefault: "Seguir configuración de DocWen",
    settingsNumberingRemove: "Limpiar numeración",
    settingsNumberingKeep: "Mantener tal cual",
    settingsNumberingNone: "No añadir",
    settingsNumberingSchemeError: "No se pudieron cargar los esquemas. Compruebe la ruta del CLI.",
    commandAddNumbering: "Agregar numeración a títulos Markdown",
    commandRemoveNumbering: "Eliminar numeración de títulos Markdown",
    pickerNumberingSchemePlaceholder: "Seleccionar esquema de numeración…",
    noticeNumberingSuccess: "Numeración completada: {filename}",
    noticeNumberingFailed: "Numeración fallida: {error}",
    noticeNumberingFailedCopied: "Numeración fallida (detalles copiados): {error}",
  },

  "vi": {
    ribbonTooltip: "Khởi chạy DocWen",
    commandLaunch: "Khởi chạy DocWen",
    commandLaunchWithFile: "Khởi chạy DocWen với tệp hiện tại",
    commandExportDocx: "Xuất Word (Docx) chạy nền",
    commandExportMd: "Xuất Markdown (MD) chạy nền",
    commandExportXlsx: "Xuất Excel (XLSX) chạy nền",
    commandDoctor: "Kiểm tra doctor của DocWen",

    contextMenuSubmenuTitle: "DocWen",
    contextMenuConvertToMd: "Chuyển đổi sang Markdown (MD)",
    contextMenuConvertToDocx: "Chuyển đổi sang Word (Docx)",
    contextMenuConvertToXlsx: "Chuyển đổi sang Excel (XLSX)",
    contextMenuAddNumbering: "Thêm đánh số tiêu đề",
    contextMenuRemoveNumbering: "Xóa đánh số tiêu đề",
    contextMenuOpenInDocWen: "Mở trong DocWen",

    settingsTitle: "Cài đặt DocWen Assistant",
    settingsGuiPath: "Đường dẫn GUI DocWen",
    settingsGuiPathDesc: "Đường dẫn đầy đủ đến DocWen.exe. Chỉ cần đặt một đường dẫn; cái còn lại sẽ được phát hiện tự động.",
    settingsGuiPathPlaceholder: "ví dụ: C:\\Users\\YourName\\Desktop\\DocWen.exe",
    settingsCliPath: "Đường dẫn CLI DocWen (tùy chọn)",
    settingsCliPathDesc: "Đường dẫn đầy đủ đến DocWenCLI.exe. Chỉ cần đặt một đường dẫn; cái còn lại sẽ được phát hiện tự động.",
    settingsCliPathPlaceholder: "ví dụ: C:\\Users\\YourName\\Desktop\\DocWenCLI.exe",
    settingsBrowse: "Chọn...",
    settingsPathStatus: "Trạng thái đường dẫn GUI",
    settingsCliPathStatus: "Trạng thái đường dẫn CLI",
    settingsPathValid: "✓ Đường dẫn hợp lệ",
    settingsPathInvalid: "✗ Lỗi: Tệp không tồn tại",
    settingsPathNotSet: "Chưa đặt đường dẫn",
    settingsCliPathNotSet: "Chưa đặt đường dẫn CLI (tự phát hiện nếu đã đặt GUI)",
    settingsAutoDetectedSuffix: "(tự phát hiện)",
    settingsPathNotExe: "⚠ Cảnh báo: Phần mở rộng tệp không phải .exe",
    settingsPathNotFile: "✗ Lỗi: Đường dẫn không trỏ tới tệp",
    settingsUsageTitle: "Cách dùng",
    settingsUsageList: `
      <ul>
        <li>Nhấn biểu tượng tài liệu ở thanh bên trái để khởi chạy DocWen hoặc gửi tệp hiện tại</li>
        <li>Nhấp chuột phải vào tệp trong danh sách và dùng menu con <b>DocWen</b>: chuyển đổi định dạng, đánh số hoặc mở trong DocWen</li>
        <li>Dùng bảng lệnh (Ctrl/Cmd + P) và tìm <b>DocWen</b> để xem tất cả lệnh có sẵn</li>
        <li>Nếu đang mở một tệp, đường dẫn của nó sẽ được gửi tự động tới DocWen</li>
      </ul>
    `,

    noticePathNotSet: "Vui lòng đặt đường dẫn tệp thực thi trong cài đặt plugin trước.",
    noticePathNotExist: "Tệp thực thi không tồn tại. Vui lòng kiểm tra cài đặt đường dẫn.",
    noticeLaunchFailed: "Khởi chạy thất bại: {error}",
    noticeLaunched: "Đã khởi chạy DocWen",
    noticeLaunchedWithFile: "Đã khởi chạy DocWen (kèm tệp: {filename})",
    noticeFileAdded: "Đã thêm tệp: {filename}",
    noticeWindowActivated: "Đã kích hoạt cửa sổ DocWen",
    noticeCommandFailed: "Gửi lệnh thất bại. Vui lòng kiểm tra chương trình DocWen.",
    noticePathUpdated: "Đã cập nhật đường dẫn",
    noticeCliNotFound: "Không tìm thấy DocWenCLI.exe. Hãy đặt trong cài đặt hoặc để cạnh DocWen.exe.",
    noticeCliInvalidJson: "Đầu ra DocWenCLI không phải JSON hợp lệ. Hãy cập nhật CLI hoặc kiểm tra hỗ trợ --json/--quiet.",
    noticeExportSuccess: "Đã xuất: {filename}",
    noticeExportFailed: "Xuất thất bại: {error}",
    noticeExportFailedCopied: "Xuất thất bại (đã sao chép chi tiết): {error}",
    noticeDoctorSuccess: "doctor kiểm tra đạt",
    noticeDoctorFailed: "doctor kiểm tra thất bại: {error}",
    noticeDoctorFailedCopied: "doctor kiểm tra thất bại (đã sao chép chi tiết): {error}",
    pickerTemplatePlaceholder: "Chọn mẫu…",
    pickerOptimizationPlaceholder: "Chọn tối ưu…",
    pickerNoOptimization: "Không tối ưu",
    noticeNoTemplatesAvailable: "Không có mẫu nào. Vui lòng cấu hình mẫu trong DocWen trước.",
    settingsExportMdTitle: "Tùy chọn xuất Markdown",
    settingsExtractImages: "Trích xuất hình ảnh",
    settingsExtractImagesDesc: "Trích xuất và nhúng hình ảnh từ tài liệu khi chuyển đổi sang Markdown.",
    settingsEnableOcr: "Nhận dạng văn bản (OCR)",
    settingsEnableOcrDesc: "Thực hiện OCR trên hình ảnh và chèn văn bản nhận dạng vào đầu ra Markdown.",
    settingsExportDocTitle: "Tùy chọn xuất ra tài liệu",
    settingsCleanNumbering: "Làm sạch đánh số",
    settingsCleanNumberingDesc: "Có làm sạch đánh số tiêu đề từ nguồn khi chuyển đổi hay không",
    settingsAddNumbering: "Thêm đánh số",
    settingsAddNumberingDesc: "Có thêm đánh số tiêu đề mới khi chuyển đổi hay không",
    settingsNumberingDefault: "Theo cấu hình DocWen",
    settingsNumberingRemove: "Làm sạch đánh số",
    settingsNumberingKeep: "Giữ nguyên",
    settingsNumberingNone: "Không thêm",
    settingsNumberingSchemeError: "Không thể tải sơ đồ đánh số. Hãy kiểm tra đường dẫn CLI.",
    commandAddNumbering: "Thêm đánh số vào tiêu đề Markdown",
    commandRemoveNumbering: "Xóa đánh số tiêu đề Markdown",
    pickerNumberingSchemePlaceholder: "Chọn kiểu đánh số…",
    noticeNumberingSuccess: "Đánh số hoàn tất: {filename}",
    noticeNumberingFailed: "Đánh số thất bại: {error}",
    noticeNumberingFailedCopied: "Đánh số thất bại (đã sao chép chi tiết): {error}",
  },
};

// Language aliases mapping
const languageAliases: Record<string, string> = {
  "zh": "zh-cn",
  "zh-hans": "zh-cn",
  "zh-hant": "zh-tw",
  "en-us": "en",
  "en-gb": "en",
  "de-de": "de",
  "fr-fr": "fr",
  "ru-ru": "ru",
  "pt-br": "pt",
  "ja-jp": "ja",
  "ko-kr": "ko",
  "es-es": "es",
  "es-mx": "es",
  "vi-vn": "vi",
};

// Current locale cache
let currentLocale: string = "en";
let i18nValidated = false;

function validateI18nTables(): void {
  if (i18nValidated) return;
  i18nValidated = true;

  const baseKeys = Object.keys(translations["en"]) as Array<keyof Translations>;
  for (const [locale, table] of Object.entries(translations)) {
    for (const k of baseKeys) {
      if (!(k in (table as any))) {
        console.warn(`[i18n] Missing key "${String(k)}" in locale "${locale}"`);
      }
    }
  }

  for (const [alias, target] of Object.entries(languageAliases)) {
    if (!translations[target]) {
      console.warn(`[i18n] Alias "${alias}" points to missing locale "${target}"`);
    }
  }
}

/**
 * Initialize i18n with the given locale
 * @param locale - The locale code (e.g., "zh-cn", "en", "de")
 */
export function initI18n(locale: string): void {
  validateI18nTables();
  const normalizedLocale = locale.toLowerCase();
  
  // Check direct match
  if (translations[normalizedLocale]) {
    currentLocale = normalizedLocale;
    return;
  }
  
  // Check aliases
  if (languageAliases[normalizedLocale]) {
    currentLocale = languageAliases[normalizedLocale];
    return;
  }
  
  // Try base language (e.g., "zh-cn" -> "zh")
  const baseLocale = normalizedLocale.split("-")[0];
  if (translations[baseLocale]) {
    currentLocale = baseLocale;
    return;
  }
  
  if (languageAliases[baseLocale]) {
    currentLocale = languageAliases[baseLocale];
    return;
  }
  
  // Default to English
  currentLocale = "en";
}

/**
 * Get a translation string by key
 * @param key - The translation key
 * @param params - Optional parameters for string interpolation
 * @returns The translated string
 */
export function t(key: keyof Translations, params?: Record<string, string>): string {
  const translation = translations[currentLocale]?.[key] || translations["en"][key] || key;
  
  if (!params) {
    return translation;
  }
  
  // Replace placeholders like {filename} with actual values
  return translation.replace(/\{(\w+)\}/g, (match, paramKey) => {
    return params[paramKey] !== undefined ? params[paramKey] : match;
  });
}

/**
 * Get the current locale
 * @returns The current locale code
 */
export function getCurrentLocale(): string {
  return currentLocale;
}

/**
 * Get all supported locales
 * @returns Array of supported locale codes
 */
export function getSupportedLocales(): string[] {
  return Object.keys(translations);
}

export type { Translations };

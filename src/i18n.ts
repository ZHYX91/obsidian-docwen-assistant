/**
 * DocWen Obsidian Plugin - Internationalization Module
 * 
 * Supports 8 languages matching the main DocWen application:
 * - zh-cn: Simplified Chinese
 * - zh-tw: Traditional Chinese
 * - en: English
 * - de: German
 * - fr: French
 * - ru: Russian
 * - pt: Portuguese
 * - ja: Japanese
 */

// Translation type definition
interface Translations {
  // Ribbon & Commands
  ribbonTooltip: string;
  commandLaunch: string;
  commandLaunchWithFile: string;
  
  // Settings
  settingsTitle: string;
  settingsExePath: string;
  settingsExePathDesc: string;
  settingsExePathPlaceholder: string;
  settingsBrowse: string;
  settingsPathStatus: string;
  settingsPathValid: string;
  settingsPathInvalid: string;
  settingsPathNotSet: string;
  settingsPathNotExe: string;
  settingsPathNotFile: string;
  settingsUsageTitle: string;
  settingsUsageList: string;
  
  // Notices
  noticePathNotSet: string;
  noticePathNotExist: string;
  noticeLaunched: string;
  noticeLaunchedWithFile: string;
  noticeFileAdded: string;
  noticeWindowActivated: string;
  noticeCommandFailed: string;
  noticePathUpdated: string;
}

// All translations
const translations: Record<string, Translations> = {
  // Simplified Chinese
  "zh-cn": {
    ribbonTooltip: "启动 DocWen",
    commandLaunch: "启动 DocWen",
    commandLaunchWithFile: "使用当前文件启动 DocWen",
    
    settingsTitle: "DocWen 助手设置",
    settingsExePath: "可执行文件路径",
    settingsExePathDesc: "请填入 DocWen 程序 (例如 DocWen.exe) 的完整路径。",
    settingsExePathPlaceholder: "例如：C:\\Users\\YourName\\Desktop\\DocWen.exe",
    settingsBrowse: "浏览...",
    settingsPathStatus: "路径状态",
    settingsPathValid: "✓ 路径有效",
    settingsPathInvalid: "✗ 错误: 文件不存在",
    settingsPathNotSet: "未设置路径",
    settingsPathNotExe: "⚠ 警告: 文件扩展名不是 .exe",
    settingsPathNotFile: "✗ 错误: 路径指向的不是文件",
    settingsUsageTitle: "使用方法",
    settingsUsageList: `
      <ul>
        <li>点击左侧栏的文档图标启动 DocWen</li>
        <li>使用命令面板 (Ctrl/Cmd + P) 搜索"DocWen"</li>
        <li>如果当前有打开的文件，会自动传递文件路径给 DocWen</li>
      </ul>
    `,
    
    noticePathNotSet: "请先在插件设置中指定可执行文件路径。",
    noticePathNotExist: "可执行文件不存在，请检查路径设置。",
    noticeLaunched: "已启动 DocWen",
    noticeLaunchedWithFile: "已启动 DocWen（带文件: {filename}）",
    noticeFileAdded: "已添加文件: {filename}",
    noticeWindowActivated: "已激活 DocWen 窗口",
    noticeCommandFailed: "发送命令失败，请检查 DocWen 程序",
    noticePathUpdated: "路径已更新",
  },
  
  // Traditional Chinese
  "zh-tw": {
    ribbonTooltip: "啟動 DocWen",
    commandLaunch: "啟動 DocWen",
    commandLaunchWithFile: "使用當前檔案啟動 DocWen",
    
    settingsTitle: "DocWen 助手設定",
    settingsExePath: "可執行檔路徑",
    settingsExePathDesc: "請填入 DocWen 程式 (例如 DocWen.exe) 的完整路徑。",
    settingsExePathPlaceholder: "例如：C:\\Users\\YourName\\Desktop\\DocWen.exe",
    settingsBrowse: "瀏覽...",
    settingsPathStatus: "路徑狀態",
    settingsPathValid: "✓ 路徑有效",
    settingsPathInvalid: "✗ 錯誤: 檔案不存在",
    settingsPathNotSet: "未設定路徑",
    settingsPathNotExe: "⚠ 警告: 檔案副檔名不是 .exe",
    settingsPathNotFile: "✗ 錯誤: 路徑指向的不是檔案",
    settingsUsageTitle: "使用方法",
    settingsUsageList: `
      <ul>
        <li>點擊左側欄的文件圖示啟動 DocWen</li>
        <li>使用命令面板 (Ctrl/Cmd + P) 搜尋「DocWen」</li>
        <li>如果當前有開啟的檔案，會自動傳遞檔案路徑給 DocWen</li>
      </ul>
    `,
    
    noticePathNotSet: "請先在插件設定中指定可執行檔路徑。",
    noticePathNotExist: "可執行檔不存在，請檢查路徑設定。",
    noticeLaunched: "已啟動 DocWen",
    noticeLaunchedWithFile: "已啟動 DocWen（帶檔案: {filename}）",
    noticeFileAdded: "已添加檔案: {filename}",
    noticeWindowActivated: "已啟動 DocWen 視窗",
    noticeCommandFailed: "傳送命令失敗，請檢查 DocWen 程式",
    noticePathUpdated: "路徑已更新",
  },
  
  // English
  "en": {
    ribbonTooltip: "Launch DocWen",
    commandLaunch: "Launch DocWen",
    commandLaunchWithFile: "Launch DocWen with current file",
    
    settingsTitle: "DocWen Assistant Settings",
    settingsExePath: "Executable Path",
    settingsExePathDesc: "Enter the full path to the DocWen program (e.g., DocWen.exe).",
    settingsExePathPlaceholder: "e.g., C:\\Users\\YourName\\Desktop\\DocWen.exe",
    settingsBrowse: "Browse...",
    settingsPathStatus: "Path Status",
    settingsPathValid: "✓ Path is valid",
    settingsPathInvalid: "✗ Error: File does not exist",
    settingsPathNotSet: "Path not set",
    settingsPathNotExe: "⚠ Warning: File extension is not .exe",
    settingsPathNotFile: "✗ Error: Path does not point to a file",
    settingsUsageTitle: "Usage",
    settingsUsageList: `
      <ul>
        <li>Click the document icon in the left sidebar to launch DocWen</li>
        <li>Use the command palette (Ctrl/Cmd + P) and search for "DocWen"</li>
        <li>If a file is currently open, its path will be automatically passed to DocWen</li>
      </ul>
    `,
    
    noticePathNotSet: "Please set the executable path in the plugin settings first.",
    noticePathNotExist: "Executable file does not exist. Please check the path settings.",
    noticeLaunched: "DocWen launched",
    noticeLaunchedWithFile: "DocWen launched (with file: {filename})",
    noticeFileAdded: "File added: {filename}",
    noticeWindowActivated: "DocWen window activated",
    noticeCommandFailed: "Failed to send command. Please check the DocWen program.",
    noticePathUpdated: "Path updated",
  },
  
  // German
  "de": {
    ribbonTooltip: "DocWen starten",
    commandLaunch: "DocWen starten",
    commandLaunchWithFile: "DocWen mit aktueller Datei starten",
    
    settingsTitle: "DocWen-Assistent Einstellungen",
    settingsExePath: "Pfad zur ausführbaren Datei",
    settingsExePathDesc: "Geben Sie den vollständigen Pfad zum DocWen-Programm ein (z.B. DocWen.exe).",
    settingsExePathPlaceholder: "z.B. C:\\Users\\IhrName\\Desktop\\DocWen.exe",
    settingsBrowse: "Durchsuchen...",
    settingsPathStatus: "Pfadstatus",
    settingsPathValid: "✓ Pfad ist gültig",
    settingsPathInvalid: "✗ Fehler: Datei existiert nicht",
    settingsPathNotSet: "Pfad nicht festgelegt",
    settingsPathNotExe: "⚠ Warnung: Dateierweiterung ist nicht .exe",
    settingsPathNotFile: "✗ Fehler: Pfad zeigt nicht auf eine Datei",
    settingsUsageTitle: "Verwendung",
    settingsUsageList: `
      <ul>
        <li>Klicken Sie auf das Dokumentsymbol in der linken Seitenleiste, um DocWen zu starten</li>
        <li>Verwenden Sie die Befehlspalette (Strg/Cmd + P) und suchen Sie nach „DocWen"</li>
        <li>Wenn eine Datei geöffnet ist, wird ihr Pfad automatisch an DocWen übergeben</li>
      </ul>
    `,
    
    noticePathNotSet: "Bitte legen Sie zuerst den Pfad zur ausführbaren Datei in den Plugin-Einstellungen fest.",
    noticePathNotExist: "Ausführbare Datei existiert nicht. Bitte überprüfen Sie die Pfadeinstellungen.",
    noticeLaunched: "DocWen gestartet",
    noticeLaunchedWithFile: "DocWen gestartet (mit Datei: {filename})",
    noticeFileAdded: "Datei hinzugefügt: {filename}",
    noticeWindowActivated: "DocWen-Fenster aktiviert",
    noticeCommandFailed: "Befehl konnte nicht gesendet werden. Bitte überprüfen Sie das DocWen-Programm.",
    noticePathUpdated: "Pfad aktualisiert",
  },
  
  // French
  "fr": {
    ribbonTooltip: "Lancer DocWen",
    commandLaunch: "Lancer DocWen",
    commandLaunchWithFile: "Lancer DocWen avec le fichier actuel",
    
    settingsTitle: "Paramètres de l'assistant DocWen",
    settingsExePath: "Chemin de l'exécutable",
    settingsExePathDesc: "Entrez le chemin complet vers le programme DocWen (par ex. DocWen.exe).",
    settingsExePathPlaceholder: "par ex. C:\\Users\\VotreNom\\Desktop\\DocWen.exe",
    settingsBrowse: "Parcourir...",
    settingsPathStatus: "État du chemin",
    settingsPathValid: "✓ Chemin valide",
    settingsPathInvalid: "✗ Erreur : Le fichier n'existe pas",
    settingsPathNotSet: "Chemin non défini",
    settingsPathNotExe: "⚠ Avertissement : L'extension du fichier n'est pas .exe",
    settingsPathNotFile: "✗ Erreur : Le chemin ne pointe pas vers un fichier",
    settingsUsageTitle: "Utilisation",
    settingsUsageList: `
      <ul>
        <li>Cliquez sur l'icône de document dans la barre latérale gauche pour lancer DocWen</li>
        <li>Utilisez la palette de commandes (Ctrl/Cmd + P) et recherchez « DocWen »</li>
        <li>Si un fichier est ouvert, son chemin sera automatiquement transmis à DocWen</li>
      </ul>
    `,
    
    noticePathNotSet: "Veuillez d'abord définir le chemin de l'exécutable dans les paramètres du plugin.",
    noticePathNotExist: "Le fichier exécutable n'existe pas. Veuillez vérifier les paramètres du chemin.",
    noticeLaunched: "DocWen lancé",
    noticeLaunchedWithFile: "DocWen lancé (avec fichier : {filename})",
    noticeFileAdded: "Fichier ajouté : {filename}",
    noticeWindowActivated: "Fenêtre DocWen activée",
    noticeCommandFailed: "Échec de l'envoi de la commande. Veuillez vérifier le programme DocWen.",
    noticePathUpdated: "Chemin mis à jour",
  },
  
  // Russian
  "ru": {
    ribbonTooltip: "Запустить DocWen",
    commandLaunch: "Запустить DocWen",
    commandLaunchWithFile: "Запустить DocWen с текущим файлом",
    
    settingsTitle: "Настройки помощника DocWen",
    settingsExePath: "Путь к исполняемому файлу",
    settingsExePathDesc: "Введите полный путь к программе DocWen (например, DocWen.exe).",
    settingsExePathPlaceholder: "например, C:\\Users\\ВашеИмя\\Desktop\\DocWen.exe",
    settingsBrowse: "Обзор...",
    settingsPathStatus: "Статус пути",
    settingsPathValid: "✓ Путь действителен",
    settingsPathInvalid: "✗ Ошибка: Файл не существует",
    settingsPathNotSet: "Путь не задан",
    settingsPathNotExe: "⚠ Предупреждение: Расширение файла не .exe",
    settingsPathNotFile: "✗ Ошибка: Путь не указывает на файл",
    settingsUsageTitle: "Использование",
    settingsUsageList: `
      <ul>
        <li>Нажмите на значок документа на левой боковой панели, чтобы запустить DocWen</li>
        <li>Используйте палитру команд (Ctrl/Cmd + P) и найдите «DocWen»</li>
        <li>Если файл открыт, его путь будет автоматически передан в DocWen</li>
      </ul>
    `,
    
    noticePathNotSet: "Сначала укажите путь к исполняемому файлу в настройках плагина.",
    noticePathNotExist: "Исполняемый файл не существует. Проверьте настройки пути.",
    noticeLaunched: "DocWen запущен",
    noticeLaunchedWithFile: "DocWen запущен (с файлом: {filename})",
    noticeFileAdded: "Файл добавлен: {filename}",
    noticeWindowActivated: "Окно DocWen активировано",
    noticeCommandFailed: "Не удалось отправить команду. Проверьте программу DocWen.",
    noticePathUpdated: "Путь обновлён",
  },
  
  // Portuguese (Brazil)
  "pt": {
    ribbonTooltip: "Iniciar DocWen",
    commandLaunch: "Iniciar DocWen",
    commandLaunchWithFile: "Iniciar DocWen com arquivo atual",
    
    settingsTitle: "Configurações do Assistente DocWen",
    settingsExePath: "Caminho do Executável",
    settingsExePathDesc: "Digite o caminho completo para o programa DocWen (ex: DocWen.exe).",
    settingsExePathPlaceholder: "ex: C:\\Users\\SeuNome\\Desktop\\DocWen.exe",
    settingsBrowse: "Procurar...",
    settingsPathStatus: "Status do Caminho",
    settingsPathValid: "✓ Caminho válido",
    settingsPathInvalid: "✗ Erro: Arquivo não existe",
    settingsPathNotSet: "Caminho não definido",
    settingsPathNotExe: "⚠ Aviso: Extensão do arquivo não é .exe",
    settingsPathNotFile: "✗ Erro: Caminho não aponta para um arquivo",
    settingsUsageTitle: "Uso",
    settingsUsageList: `
      <ul>
        <li>Clique no ícone de documento na barra lateral esquerda para iniciar o DocWen</li>
        <li>Use a paleta de comandos (Ctrl/Cmd + P) e pesquise "DocWen"</li>
        <li>Se um arquivo estiver aberto, seu caminho será automaticamente passado para o DocWen</li>
      </ul>
    `,
    
    noticePathNotSet: "Por favor, defina o caminho do executável nas configurações do plugin primeiro.",
    noticePathNotExist: "O arquivo executável não existe. Verifique as configurações do caminho.",
    noticeLaunched: "DocWen iniciado",
    noticeLaunchedWithFile: "DocWen iniciado (com arquivo: {filename})",
    noticeFileAdded: "Arquivo adicionado: {filename}",
    noticeWindowActivated: "Janela do DocWen ativada",
    noticeCommandFailed: "Falha ao enviar comando. Verifique o programa DocWen.",
    noticePathUpdated: "Caminho atualizado",
  },
  
  // Japanese
  "ja": {
    ribbonTooltip: "DocWen を起動",
    commandLaunch: "DocWen を起動",
    commandLaunchWithFile: "現在のファイルで DocWen を起動",
    
    settingsTitle: "DocWen アシスタント設定",
    settingsExePath: "実行ファイルのパス",
    settingsExePathDesc: "DocWen プログラム（例：DocWen.exe）のフルパスを入力してください。",
    settingsExePathPlaceholder: "例：C:\\Users\\YourName\\Desktop\\DocWen.exe",
    settingsBrowse: "参照...",
    settingsPathStatus: "パスの状態",
    settingsPathValid: "✓ パスは有効です",
    settingsPathInvalid: "✗ エラー：ファイルが存在しません",
    settingsPathNotSet: "パスが設定されていません",
    settingsPathNotExe: "⚠ 警告：ファイル拡張子が .exe ではありません",
    settingsPathNotFile: "✗ エラー：パスがファイルを指していません",
    settingsUsageTitle: "使用方法",
    settingsUsageList: `
      <ul>
        <li>左サイドバーのドキュメントアイコンをクリックして DocWen を起動</li>
        <li>コマンドパレット (Ctrl/Cmd + P) で「DocWen」を検索</li>
        <li>ファイルが開いている場合、そのパスは自動的に DocWen に渡されます</li>
      </ul>
    `,
    
    noticePathNotSet: "プラグイン設定で実行ファイルのパスを先に設定してください。",
    noticePathNotExist: "実行ファイルが存在しません。パス設定を確認してください。",
    noticeLaunched: "DocWen を起動しました",
    noticeLaunchedWithFile: "DocWen を起動しました（ファイル：{filename}）",
    noticeFileAdded: "ファイルを追加しました：{filename}",
    noticeWindowActivated: "DocWen ウィンドウをアクティブにしました",
    noticeCommandFailed: "コマンドの送信に失敗しました。DocWen プログラムを確認してください。",
    noticePathUpdated: "パスを更新しました",
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
};

// Current locale cache
let currentLocale: string = "en";

/**
 * Initialize i18n with the given locale
 * @param locale - The locale code (e.g., "zh-cn", "en", "de")
 */
export function initI18n(locale: string): void {
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

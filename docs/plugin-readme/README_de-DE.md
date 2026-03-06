[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md) | [Español](README_es-ES.md) | [한국어](README_ko-KR.md) | [Tiếng Việt](README_vi-VN.md)

# DocWen Assistant

Obsidian-Plugin zum Starten des DocWen-Konverters.

## Installation

1. Kopieren Sie diesen Ordner in das Verzeichnis `.obsidian/plugins/` Ihres Obsidian-Vaults
2. Laden Sie die Plugins in den Obsidian-Einstellungen neu
3. Aktivieren Sie das Plugin „DocWen Assistant"
4. Konfigurieren Sie den Pfad zu `DocWen.exe` oder `DocWenCLI.exe` in den Plugin-Einstellungen (eins genügt)

## Verwendung

- Klicken Sie auf das Dokumentsymbol in der linken Seitenleiste, um DocWen zu starten
- Verwenden Sie die Befehlspalette (Strg/Cmd + P) und suchen Sie nach „DocWen"
- Wenn eine Datei geöffnet ist, wird ihr Pfad automatisch an DocWen übergeben

### Hintergrund-Export (erfordert DocWenCLI.exe)

- „Als Word (Docx) im Hintergrund exportieren“ — für `.md`/`.markdown`/`.txt` Dateien: Template auswählen
- „Als Excel (XLSX) im Hintergrund exportieren“ — für `.md`/`.markdown`/`.txt` Dateien: Template auswählen
- „Als Markdown (MD) im Hintergrund exportieren“ — Optimierungstyp auswählen, falls verfügbar (oder überspringen)

### Überschriftennummerierung (erfordert DocWenCLI.exe)

- „Nummerierung zu Markdown-Überschriften hinzufügen“ — Nummerierungsschema auswählen
- „Nummerierung aus Markdown-Überschriften entfernen“

Nur für `.md`-Dateien verfügbar.

### Diagnose (erfordert DocWenCLI.exe)

- „DocWen doctor prüfen“ — Umgebung und Abhängigkeiten prüfen

## Enthaltene Dateien

- `main.js` - Plugin-Kerncode
- `manifest.json` - Plugin-Manifest
- `styles.css` - Stildatei (falls vorhanden)
- `README*.md` - Dokumentation

Weitere Informationen finden Sie auf der Plugin-Einstellungsseite.

## Links

- Plugin-Repo: https://github.com/ZHYX91/docwen-obsidian
- DocWen-Repo: https://github.com/ZHYX91/docwen

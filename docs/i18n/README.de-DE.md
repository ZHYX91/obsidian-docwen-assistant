# DocWen Assistant

[English](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/README.md) · [简体中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-CN.md) · [繁體中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-TW.md) · [Deutsch](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.de-DE.md) · [Français](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.fr-FR.md) · [Русский](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ru-RU.md) · [Português](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.pt-BR.md) · [日本語](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ja-JP.md) · [Español](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.es-ES.md) · [한국어](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ko-KR.md) · [Tiếng Việt](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.vi-VN.md)

DocWen Assistant verbindet Obsidian über das öffentliche `DocWenCLI.exe`-Protokoll mit einer lokalen [DocWen](https://github.com/ZHYX91/docwen)-Installation. Erforderlich sind Windows, Obsidian 1.12.7 oder neuer und eine stabile DocWen-Version der Reihe 0.9.x.

> **DocWen ist erforderlich.** Installieren und entpacken Sie vor dem Aktivieren des Plugins ein kompatibles [DocWen-0.9.x-Windows-Komplettpaket](https://github.com/ZHYX91/docwen/releases).

## Screenshots

Diese Bilder zeigen das paketierte Plugin mit der DocWen CLI in Obsidian Desktop.

### Korrekturlese-Seitenleiste

Prüfen Sie Probleme nach Zeile oder Regel und springen Sie zum passenden Quellbereich, ohne die Notiz umzuschreiben.

![DocWen-Korrekturlese-Seitenleiste](../assets/docwen-assistant-proofread-en.png)

### Einstellungen mit oberen Registerkarten und CLI-Funktionen

Wählen Sie über fünf obere Registerkarten die genaue DocWen-Laufzeit, konfigurieren Sie Konvertierung und Korrekturlesen und prüfen Sie die Machine-Funktionen.

![DocWen-Assistant-Einstellungen](../assets/docwen-assistant-settings-en.png)

### Funktionsabhängiger Export

Wählen Sie einen verfügbaren Konvertierungsweg und einen ausdrücklichen Ausgabeort, ohne die Quellnotiz zu verändern.

![Funktionsabhängiger DocWen-Assistant-Export](../assets/docwen-assistant-export-en.png)

## Funktionen

Die Erweiterung öffnet Dateien in DocWen, exportiert Word/Excel/Markdown mit einem ausdrücklich gewählten Ziel, verwaltet Markdown-Überschriftennummern, prüft Markdown und führt doctor-Diagnosen aus.

## Voraussetzungen und Kompatibilität

- Windows und Obsidian 1.12.7 oder neuer; das Plugin ist nur für den Desktop verfügbar.
- Ein vollständig entpacktes Windows-Komplettpaket einer stabilen DocWen-Version der Reihe 0.9.x; das Plugin lädt DocWen nicht automatisch herunter.
- Das Plugin benötigt `docwen.machine.v1` und `docwen.artifact_bundle.v2`; eine inkompatible DocWen-Version wird abgelehnt, statt ein anderes Protokoll zu verwenden.

Sie können den vollständig entpackten DocWen-Ordner, `DocWen.exe` oder `DocWenCLI.exe` auswählen. Das Plugin löst die Auswahl auf die gleichgeordnete `DocWenCLI.exe` auf und speichert und verwendet nur diesen geprüften absoluten Pfad. Es führt die GUI nicht als CLI aus, sucht nicht rekursiv und lädt keine Software automatisch herunter.

## Installation

### DocWen und das Plugin installieren

Prüfen Sie zuerst bei [DocWen Releases](https://github.com/ZHYX91/docwen/releases) und [DocWen Assistant Releases](https://github.com/ZHYX91/obsidian-docwen-assistant/releases), dass passende numerische Releases veröffentlicht sind. Laden Sie dann `DocWen-windows-x64.zip` und das passende Plugin-Paket herunter. Kopieren Sie `main.js`, `manifest.json` und `styles.css` nach `<Vault>/.obsidian/plugins/docwen-assistant/`, aktivieren Sie das Plugin und wählen Sie den DocWen-Ordner, `DocWen.exe` oder `DocWenCLI.exe`.

### Installationssicherheit

Das Release-Paket enthält nur `main.js`, `manifest.json` und `styles.css`; es enthält, ersetzt oder löscht niemals `data.json`. Löschen Sie `data.json` nur zum bewussten Zurücksetzen aller Einstellungen.

## Verwendung

Über das Symbol, das **DocWen**-Untermenü oder die Befehlspalette können Sie DocWen starten, Word/Excel/Markdown exportieren, Überschriftennummern ändern, Markdown prüfen und doctor ausführen. Hintergrundexporte verlangen immer eine ausdrücklich gewählte Ausgabedatei.

## Einstellungen

Obsidian 1.12.7 oder neuer verwendet fünf horizontal scrollbare Registerkarten: Allgemein, In Markdown exportieren, In Word exportieren, Korrekturlesen und Verwendung. Die Registerkarten unterstützen Pfeiltasten einschließlich RTL, Pos1/Ende, 20-px-Oberflächentext und große Ziele für grobe Zeiger. Die Sprache folgt standardmäßig Obsidian und kann auf eine der 11 unterstützten Sprachen festgelegt werden.

## Einschränkungen

- Nur Windows-Desktop mit einer kompatiblen lokalen DocWen-Installation.
- Keine rekursive Suche außerhalb des ausgewählten DocWen-Ordners oder Programms.
- Ein Vorgang wird abgelehnt, wenn CLI-Antwort, Quell-Snapshot, Editorzustand oder Ziel nicht sicher geprüft werden können.

## Datenschutz und Sicherheit

Das Plugin übergibt nur einen isolierten Snapshot des aktuellen Editors oder der Vault-Datei an den lokalen CLI-Prozess. Es greift außerhalb des Vault nur auf Dateien zu, um die vom Benutzer ausgewählte `DocWenCLI.exe` auszuführen, isolierte temporäre Eingaben und geprüfte Artefakte zu verwalten und an einen ausdrücklich gewählten Ausgabeort zu schreiben; diese Zugriffe sind für lokale Konvertierung und Export erforderlich. Bei Konvertierungen wird die geprüfte bevorzugte Ausgabe am vom Benutzer bestätigten Ziel gespeichert; geprüfte zugehörige Ressourcen werden unter sicheren Namen daneben abgelegt. Es lädt keine Dokumente hoch und durchsucht nicht den gesamten Vault. Details: [CLI integration contract](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/cli-integration.md)

## Entwicklung

Verwenden Sie Node.js 24.19.0 und npm 11.17.0. Führen Sie `npm ci`, `npm run check` und `npm run release` aus. Quellcode liegt unter `src/`, Tests unter `tests/`; erzeugte Dateien in `dist/` und `release/` sind kein Quellcode.

Stabile Dokumente: [Produktanforderungen](../product-requirements.en.md) · [UX-Spezifikation](../ux-spec.en.md) · [Architektur](../architecture.en.md) · [Teststrategie](../testing-strategy.en.md) · [Release-Verfahren](../release.en.md)

Repository-Governance: [Änderungsprotokoll](../../CHANGELOG.md) · [Mitwirken](../../CONTRIBUTING.md) · [Sicherheit](../../SECURITY.md)

## Support

- Verwenden Sie [General](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/general) für Workflow-Ideen und allgemeines Feedback.
- Verwenden Sie [Q&A](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/q-a) für Fragen zur Nutzung und Konfiguration.
- Reproduzierbare Obsidian-Integrationsfehler und konkrete Funktionsvorschläge gehören in die strukturierten [DocWen Assistant Issue-Formulare](https://github.com/ZHYX91/obsidian-docwen-assistant/issues/new/choose).
- Konvertierung, OCR, Korrektur oder CLI-Verhalten außerhalb von Obsidian gehört zu den [DocWen Core Issues](https://github.com/ZHYX91/docwen/issues).
- Melden Sie Sicherheitslücken privat gemäß der [Sicherheitsrichtlinie](https://github.com/ZHYX91/obsidian-docwen-assistant/security/policy).

Entfernen Sie vor öffentlichen Beiträgen private Dokumentinhalte, Datei- und Vault-Pfade, CLI-Protokolle, Programmpfade und Zugangsdaten.

## Lizenz

MIT © ZhengYX

# DocWen Assistant

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md)

DocWen Assistant verbindet Obsidian mit einer lokalen [DocWen](https://github.com/ZHYX91/docwen)-Installation. Erforderlich sind Windows oder Linux, Obsidian 1.12.7 oder neuer und eine stabile DocWen-Version ab 0.17.0.

> **DocWen ist erforderlich.** Installieren Sie eine kompatible Version aus dem [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97) oder entpacken Sie die portable ZIP-Datei aus [DocWen Releases](https://github.com/ZHYX91/docwen/releases) vollständig.

Die Oberflächensprache ändert nur Texte und Layout von Assistant. Ausgabesprache, Vorlagen und OCR werden durch die Aufgabenoptionen und DocWen-Einstellungen gesteuert.

## Screenshots

Beispiele der Desktop-Oberfläche. Das Korrekturbeispiel verwendet eine Testnotiz.

### Korrekturlese-Seitenleiste

Prüfen Sie Probleme nach Zeile oder Regel und springen Sie zum passenden Quellbereich, ohne die Notiz umzuschreiben.

![DocWen-Korrekturlese-Seitenleiste](../assets/docwen-assistant-proofread-en.png)

### Einstellungen und DocWen-Verbindung

Prüfen Sie die DocWen-Verbindung und wählen Sie die Optionen für Export und Korrektur auf den vier Registerkarten.

![DocWen-Assistant-Einstellungen](../assets/docwen-assistant-settings-en.png)

### Dateien exportieren

Wählen Sie das Ausgabeformat, prüfen Sie die Optionen und legen Sie den Speicherort fest.

![Funktionsabhängiger DocWen-Assistant-Export](../assets/docwen-assistant-export-en.png)

## Funktionen

Die Erweiterung öffnet Dateien in DocWen, exportiert Word/Excel/Markdown mit einem ausdrücklich gewählten Ziel, verwaltet Markdown-Überschriftennummern, prüft Markdown und bietet die Funktion **DocWen-Verbindung prüfen** an.

## Voraussetzungen und Kompatibilität

- Windows oder Linux und Obsidian 1.12.7 oder neuer; das Plugin ist nur für den Desktop verfügbar.
- Unter Windows wird eine kompatible Store- oder vollständig entpackte portable DocWen-Version ab 0.17.0 verwendet; unter Linux ein manuell ausgewähltes, vollständig entpacktes Paket. Der Export unter Linux benötigt x64 und ein Dateisystem, das neue Ergebnisordner ohne Überschreiben vorhandener Daten speichern kann; das Plugin lädt DocWen nicht automatisch herunter.
- Das Plugin benötigt `docwen.machine.v2` und `docwen.artifact_bundle.v3`; eine inkompatible DocWen-Version wird abgelehnt, statt ein anderes Protokoll zu verwenden.
- Auch bei einer inkompatiblen Verbindung für Hintergrundkonvertierungen können Sie die DocWen-Desktop-App separat öffnen.

Wenn die Store-Installation diese Anforderungen nicht erfüllt, verwenden Sie ein kompatibles portables Paket und wählen es unter „Manuelle Installation“ aus.

Die automatische Erkennung ist nur unter Windows verfügbar, verwendet den registrierten Alias `docwen.exe` und bleibt bei Microsoft-Store-Updates stabil. Unter Linux ist die manuelle Installation erforderlich; sie akzeptiert den entpackten Ordner, `DocWen` oder `DocWenCLI`. Das Plugin durchsucht keine beliebigen Ordner nach Programmen und lädt keine Software automatisch herunter.

## Installation

### DocWen und das Plugin installieren

1. Installieren Sie unter Windows eine kompatible DocWen-Version ab 0.17.0 aus dem [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97) oder entpacken Sie das Windows-Paket aus [DocWen Releases](https://github.com/ZHYX91/docwen/releases). Unter Linux x64 entpacken Sie das Linux-Paket derselben Seite vollständig.
2. Installieren Sie DocWen Assistant über Community Plugins. Manuell laden Sie `docwen-assistant-x.y.z.zip` von den [Plugin-Releases](https://github.com/ZHYX91/obsidian-docwen-assistant/releases) und kopieren `main.js`, `manifest.json` und `styles.css` nach `<Vault>/.obsidian/plugins/docwen-assistant/`.
3. Laden Sie Community Plugins neu und aktivieren Sie DocWen Assistant.
4. Die Windows-Store-Version kann automatisch erkannt werden. Für portable Windows-Versionen und Linux wählen Sie unter **Einstellungen → DocWen Assistant → Allgemein** die manuelle Verbindung und anschließend den entpackten Ordner oder die Programmdatei.

### Einstellungen beim Update behalten

Ersetzen Sie bei manuellen Updates nur `main.js`, `manifest.json` und `styles.css`. Behalten Sie `data.json`, damit Ihre Einstellungen erhalten bleiben; löschen Sie die Datei nur zum Zurücksetzen. Der Ordnername bleibt `docwen-assistant`.

## Verwendung

**Welche Befehle verfügbar sind, hängt von der Datei ab.** Die Konvertierung erfordert eine passende Funktion der verbundenen DocWen-Installation. Der Export legt einen eigenen Ergebnisordner an; Korrekturlesen verändert die Notiz nicht. **Das Hinzufügen und Entfernen von Überschriftennummern ändert dagegen den Markdown-Text.** Vor dem Speichern werden Editorinhalt oder gespeicherte Datei auf Änderungen geprüft. Bei mehreren nicht eindeutig zuordenbaren Editoren derselben Datei wird abgebrochen.

Über das Symbol, das **DocWen**-Untermenü oder die Befehlspalette können Sie DocWen starten, Word/Excel/Markdown exportieren, Überschriftennummern ändern, Markdown prüfen und **DocWen-Verbindung prüfen** ausführen.

Wählen Sie eine Vorlage oder ein Konvertierungsprofil, falls angeboten, und danach den Ausgabeordner. Prüfen Sie Quelldatei, Format, Ziel und Optionen und klicken Sie auf **Exportieren**. Die Übersicht verwendet die für diesen Auftrag erfassten Einstellungen; beim Abbrechen startet keine Konvertierung. Ergebnisse und verknüpfte Bilder landen in einem neuen Ordner. Klicken Sie nach Abschluss in der Meldung auf **Ergebnisordner öffnen**. Vorhandene Ergebnisordner bleiben erhalten.

## Einstellungen

Aktivieren Sie vor dem Word-Export unter **DocWen → Einstellungen → Markdown-Syntax** die benötigten **Eingabe-Erweiterungen**. Bei einer Neuinstallation sind sie ausgeschaltet; die Obsidian-Eingabevoreinstellung aktiviert die zugehörige Gruppe.

| Inhalt oder Aufgabe | DocWen-Einstellung |
| --- | --- |
| Verbundene Structural-Tables-Zellen | Structural-Tables-Eingabe-Erweiterung |
| Number-Suite-Beschriftungen und Querverweise | Eingabe-Erweiterung für Beschriftungen und Verweise |
| H7–H9-Überschriften / typisierte Endnoten | Entsprechende Überschriften- / Endnoten-Eingabe-Erweiterungen |
| Word zurück in erweitertes Markdown | Entsprechende Ausgabe-Erweiterungen |

Word-Export liest die Number-Suite-Syntax auch ohne installiertes Number Suite. Die Nummern im Export folgen den DocWen-Optionen, nicht den reinen Anzeigenummern von Number Suite. Die separaten Befehle zum Hinzufügen oder Entfernen von Überschriftennummern ändern die Quellnotiz; der Export tut das nicht.

**Welche Inhalte die Projekte ändern**

| Projekt und Anleitung | Anzeige, Quelldateien und Ausgabe |
| --- | --- |
| [DocWen (Core)](https://github.com/ZHYX91/docwen/blob/main/docs/user-guides/README.de-DE.md) | Erzeugt konvertierte Dateien. Eingabeerweiterungen interpretieren die Quellsyntax; Exporteinstellungen bestimmen die Ausgabe und ihre Nummerierung. |
| [DocWen Assistant](../product-requirements.en.md) | Der Export erstellt einen eigenen Ergebnisordner; Korrekturlesen greift nur lesend zu. Ausdrückliche Aktionen für Überschriftennummern ändern den Markdown-Quelltext. |
| [Chrono Notes](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/docs/i18n/README.de-DE.md) | Kalender- und Aufgabenansichten lesen den Index. Änderungen an Erledigungsstatus oder Datum schreiben in die Markdown-Quelle; Erstellungsaktionen legen Notizen an. |
| [Property Order](https://github.com/ZHYX91/obsidian-property-order/blob/main/docs/i18n/README.de-DE.md) | Vorschlagseinstellungen ändern Menüs. Neuordnen oder Verschieben von Werten bearbeitet die betroffenen YAML-Listen und kann Nichttextwerte in Zeichenketten umwandeln. |
| [Link Integrity](https://github.com/ZHYX91/obsidian-link-integrity/blob/main/docs/i18n/README.de.md) | Regeln filtern Analyseergebnisse oder bestimmen, welche Graphverbindungen zählen. Links in Notizen werden nicht umgeschrieben. |
| [Folder Nodes](https://github.com/ZHYX91/obsidian-folder-nodes/blob/main/docs/i18n/README.de.md) | Ansichten zeigen die Knotenstruktur. Erstellen, Verschieben, Umbenennen, Zusammenführen und Löschen ändern Notizen, Ordner oder Struktureigenschaften. |
| [Number Suite](https://github.com/ZHYX91/obsidian-number-suite/blob/main/docs/i18n/README.de.md) | Virtuelle Nummern ändern die Anzeige. Notizbezogene Einstellungen speichern Eigenschaften; Schreiben, Entfernen und Neunummerieren ändern den Überschriftentext. |
| [Structural Tables](https://github.com/ZHYX91/obsidian-structural-tables/blob/main/docs/i18n/README.de.md) | Die Tabellenansicht und das Darstellungsbeispiel bearbeiten keine Notizen. Tabellenbearbeitung schreibt Markdown; die Umwandlung in eine Base erstellt Datensatzdateien. |

Die Einstellungen sind auf vier Registerkarten verteilt: Allgemein, In Markdown exportieren, In Word exportieren und Korrekturlesen. Hinweise stehen direkt bei den jeweiligen Optionen. Die Sprache folgt standardmäßig Obsidian und lässt sich in den allgemeinen Einstellungen ändern. Mit den Pfeiltasten sowie Pos1/Ende können Sie zwischen den Registerkarten wechseln.

## Einschränkungen

- Windows- oder Linux-Desktop mit einer kompatiblen lokalen DocWen-Installation; der Export unter Linux benötigt x64 und ein Dateisystem, das Ergebnisse ohne Überschreiben bestehender Daten speichern kann.
- Keine rekursive Suche außerhalb des ausgewählten DocWen-Ordners oder Programms.
- Wenn sich die Notiz während der Verarbeitung ändert oder das Ergebnis nicht sicher gespeichert werden kann, hält der Vorgang an und fordert Sie zur Prüfung auf.

Eine Konvertierung zu Word und zurück ersetzt keine Sicherung des ursprünglichen Markdown. Unterstützte sichtbare Inhalte lassen sich zurückwandeln; nicht unterstützte Syntax, eingebettete Notizen und manche Layoutdetails können verloren gehen. Bewahren Sie die Quellnotiz auf und prüfen Sie das zurückgewandelte Dokument.

## Datenschutz und Sicherheit

Ihre Dokumente bleiben auf Ihrem Computer. Das Plugin übergibt dem lokalen DocWen eine temporäre Kopie der ausgewählten Datei, einschließlich ungespeicherter Änderungen aus dem eindeutig zugehörigen Editor. Es nimmt nur ausdrücklich verknüpfte Bilder hinzu, durchsucht den Vault nicht nach fremden Dateien und lädt keine Dokumente hoch.

Exporte werden im gewählten Ordner gespeichert; Korrekturlesen verändert keine Notiz. Überschriftennummern werden nur geschrieben, solange die ursprüngliche Notiz am selben Pfad liegt und ihr Text unverändert ist. Nach Umbenennen oder Ersetzen während der Verarbeitung führen Sie den Befehl erneut für die aktuelle Notiz aus. Der Store-Installationspfad wird nicht in den Plugin-Einstellungen gespeichert. Technische Details stehen in der [Integrationsbeschreibung](../cli-integration.md).

## Entwicklung

Verwenden Sie Node.js 24.19.0 und npm 11.17.0. Führen Sie `npm ci`, `npm run check` und `npm run release` aus. Quellcode liegt unter `src/`, Tests unter `tests/`; erzeugte Dateien in `dist/` und `release/` sind kein Quellcode.

Stabile Dokumente: [Produktanforderungen](../product-requirements.en.md) · [UX-Spezifikation](../ux-spec.en.md) · [Architektur](../architecture.en.md) · [Teststrategie](../testing-strategy.en.md)

Repository-Governance: [Änderungsprotokoll](../../CHANGELOG.md) · [Mitwirken](../../CONTRIBUTING.md) · [Sicherheit](../../SECURITY.md)

## Support

In Obsidian finden Sie unter **Allgemein → Hilfe** die **Benutzeranleitung** und **Problem melden**.

- [Q&A](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/q-a): Fragen zur Nutzung und Konfiguration.
- [Ideas](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/ideas): Erste Ideen für Funktionen und Arbeitsabläufe.
- [Show and tell](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/show-and-tell): Tipps, Arbeitsabläufe und Referenzimplementierungen.
- Reproduzierbare Obsidian-Integrationsfehler und konkrete Funktionsvorschläge gehören in die strukturierten [DocWen Assistant Issue-Formulare](https://github.com/ZHYX91/obsidian-docwen-assistant/issues/new/choose).
- Konvertierung, OCR, Korrektur oder CLI-Verhalten außerhalb von Obsidian gehört zu den [DocWen Core Issues](https://github.com/ZHYX91/docwen/issues).
- Melden Sie Sicherheitslücken privat gemäß der [Sicherheitsrichtlinie](https://github.com/ZHYX91/obsidian-docwen-assistant/security/policy).

Entfernen Sie vor öffentlichen Beiträgen private Dokumentinhalte, Datei- und Vault-Pfade, CLI-Protokolle, Programmpfade und Zugangsdaten.

## Lizenz

MIT © ZhengYX

[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md) | [Español](README_es-ES.md) | [한국어](README_ko-KR.md) | [Tiếng Việt](README_vi-VN.md)

# DocWen Assistent - Obsidian Plugin

Ein Obsidian-Plugin für die [DocWen](https://github.com/ZHYX91/docwen) Desktop-Anwendung.

## ✨ Funktionen

### Kernfunktionen
- ✅ **Seitenleisten-Schnellstart**: Fügen Sie ein Symbol zur Obsidian-Seitenleiste für Ein-Klick-Start hinzu
- ✅ **Automatische Dateiübergabe**: Übergibt automatisch den aktuell geöffneten Dateipfad an DocWen
- ✅ **Befehlspaletten-Integration**: Schneller Zugriff über Strg/Cmd + P
- ✅ **Hintergrund-Export (CLI)**: Export nach Word/Excel/Markdown über DocWenCLI.exe ohne Öffnen der GUI (Picker erscheint bei Bedarf)
- ✅ **Überschriftennummerierung (CLI)**: Nummerierung für Markdown-Überschriften hinzufügen/entfernen über DocWenCLI.exe
- ✅ **Doctor-Check (CLI)**: Ein-Klick-Umgebungs-/Diagnoseprüfung
- ✅ **Pfadvalidierung**: Echtzeit-Validierung des ausführbaren Dateipfads
- ✅ **Datei-Browser**: Einfache Auswahl der ausführbaren Datei über Durchsuchen-Dialog
- ✅ **Erfolgsrückmeldung**: Freundliche Benachrichtigungen beim Start
- ✅ **Rechtsklick-Kontextmenü**: Rechtsklick auf eine Datei im Explorer → DocWen-Untermenü (Formate konvertieren, Nummerierung verwalten, in DocWen öffnen)
- ✅ **Einzelinstanz-Verwaltung**: Sendet Dateien automatisch an laufende Instanz
- ✅ **Mehrsprachige Unterstützung**: Unterstützt 11 Sprachen (zh-CN, zh-TW, en, de, fr, ru, pt-BR, ja, ko, es, vi)

---

## 📦 Schnellstart

### Voraussetzungen

1. **Node.js installieren**
   - Besuchen Sie die [Node.js Website](https://nodejs.org/)
   - Laden Sie die LTS-Version herunter und installieren Sie sie
   - Installation überprüfen: `node -v` und `npm -v`

2. **Abhängigkeiten installieren**
   ```bash
   npm install
   ```

### Entwicklungsmodus

Verwenden Sie den Watch-Modus während der Entwicklung für automatische Neukompilierung bei Codeänderungen:

```bash
npm run dev
```

### Plugin erstellen

#### Schnell-Build (ohne Typprüfung)
```bash
npm run build:quick
```

#### Vollständiger Build (mit Typprüfung und Minimierung)
```bash
npm run build
```

#### Release-Build (automatische Paketierung)
```bash
npm run release
# Oder direkt ausführen: node scripts/build.js
```

Dieser Befehl wird:
1. TypeScript-Code kompilieren
2. Release-Verzeichnis erstellen
3. Erforderliche Dateien kopieren
4. Gebrauchsanweisung generieren

---

## 🚀 In Obsidian installieren

### Methode 1: Release herunterladen (Empfohlen)

1. Gehen Sie zur [GitHub Releases](https://github.com/ZHYX91/docwen-obsidian/releases)-Seite
2. Laden Sie die neueste Version herunter und entpacken Sie sie
3. Kopieren Sie den Ordner `docwen-assistant` nach `<Ihr Vault>/.obsidian/plugins/`
4. In Obsidian: `Einstellungen` → `Community-Plugins` → `Plugins neu laden` → `DocWen Assistant` aktivieren

### Methode 2: Aus Quellcode erstellen

1. Abhängigkeiten installieren und erstellen:
   ```bash
   npm install
   npm run release
   ```
2. Den Ordner `release/docwen-assistant` nach `<Ihr Vault>/.obsidian/plugins/` kopieren
3. Plugin in Obsidian neu laden und aktivieren

---

## ⚙️ Konfiguration

1. Obsidian `Einstellungen` → `Community-Plugins` → `DocWen Assistant` öffnen

2. Pfad zur GUI- oder CLI-Datei konfigurieren (eins genügt):
   - Vollständiger Pfad zu `DocWen.exe` oder `DocWenCLI.exe`
   - Wenn nur eines gesetzt ist, wird das andere im selben Ordner automatisch erkannt

3. Pfadvalidierung:
   - ✓ Grün zeigt gültigen Pfad an
   - ✗ Rot zeigt ungültigen Pfad oder nicht gefundene Datei an

---

## 📖 Verwendung

### DocWen starten

Drei Möglichkeiten zum Starten:

1. **Seitenleisten-Symbol**
   - Klicken Sie auf das Dokument-Symbol in der linken Seitenleiste

2. **Befehlspalette**
   - Drücken Sie `Strg/Cmd + P`, um die Befehlspalette zu öffnen
   - Suchen Sie nach "DocWen starten"

3. **Mit aktueller Datei starten**
   - Suchen Sie "DocWen mit aktueller Datei starten" in der Befehlspalette
   - Nur verfügbar, wenn eine Datei geöffnet ist

### Hintergrund-Export (CLI, ohne GUI-Popup)

In der Befehlspalette suchen:
- „Als Word (Docx) im Hintergrund exportieren“ — für `.md`/`.markdown`/`.txt` Dateien: Template im Picker auswählen
- „Als Excel (XLSX) im Hintergrund exportieren“ — für `.md`/`.markdown`/`.txt` Dateien: Template im Picker auswählen
- „Als Markdown (MD) im Hintergrund exportieren“ — wenn Optimierungstypen für Dateityp und Sprache verfügbar sind: im Picker auswählen (oder überspringen)

Erfordert `DocWenCLI.exe`.

### Rechtsklick-Kontextmenü

Rechtsklick auf eine Datei im Datei-Explorer zeigt das **DocWen**-Untermenü. Verfügbare Aktionen hängen vom Dateityp ab:

- **In Markdown konvertieren** — für docx, xlsx, pdf, Bilder usw.
- **In Word (Docx) konvertieren** / **In Excel (XLSX) konvertieren** — für `.md`/`.markdown`/`.txt` Dateien
- **Überschriftennummerierung hinzufügen/entfernen** — nur für `.md` Dateien
- **In DocWen öffnen** — für alle Dateien verfügbar

### Überschriftennummerierung (CLI)

In der Befehlspalette suchen:
- „Nummerierung zu Markdown-Überschriften hinzufügen“ — Nummerierungsschema im Picker auswählen
- „Nummerierung aus Markdown-Überschriften entfernen“

Nur verfügbar, wenn eine `.md`-Datei geöffnet ist. Erfordert `DocWenCLI.exe`.

### Doctor-Check (CLI)

In der Befehlspalette suchen:
- „DocWen doctor prüfen“

Erfordert `DocWenCLI.exe`.

### Automatische Dateiübergabe

- Wenn eine Datei geöffnet ist, übergibt das Plugin automatisch den vollständigen Pfad an DocWen
- Wenn keine Datei geöffnet ist, wird nur das DocWen-Programm gestartet

### Einzelinstanz-Verwaltung

- **Erster Klick** → DocWen starten und aktuelle Datei übergeben
- **Erneuter Klick (mit Datei)** → Mit neuer Datei ersetzen (Einzeldatei-Modus)
- **Erneuter Klick (ohne Datei)** → DocWen-Fenster aktivieren

---

## 🛠️ Entwicklungsskripte

### Verfügbare Befehle

| Befehl | Beschreibung |
|--------|--------------|
| `npm run dev` | Entwicklungsmodus (Watch) |
| `npm run build` | Vollständiger Build (Typprüfung + Minimierung) |
| `npm run build:quick` | Schnell-Build (ohne Typprüfung) |
| `npm run lint` | ESLint-Prüfung |
| `npm run lint:fix` | ESLint automatisch beheben |
| `node version-bump.js [patch\|minor\|major]` | Versionsnummer aktualisieren |
| `npm run release` | Release-Paket erstellen |

### Versionsverwaltung

Versionsnummer aktualisieren:

```bash
# Patch-Version (1.0.0 → 1.0.1)
node version-bump.js patch

# Minor-Version (1.0.0 → 1.1.0)
node version-bump.js minor

# Major-Version (1.0.0 → 2.0.0)
node version-bump.js major
```

---

## 📁 Projektstruktur

```
docwen-obsidian/
├── src/                 # 📁 Quellcode-Verzeichnis
│   ├── main.ts          # Plugin-Hauptlogik
│   ├── settings.ts      # Einstellungsseite
│   ├── i18n.ts          # Internationalisierungsmodul
│   └── utils/           # Hilfs-Module
│       └── suggest-modal.ts # Picker-Modal
├── dist/                # 🔨 Build-Ausgabeverzeichnis
│   └── main.js          # Kompilierter Code
├── docs/                # 📄 Dokumentation
│   └── plugin-readme/    # Benutzer-README (mehrsprachig)
├── scripts/             # 📜 Build-Skripte
│   ├── build.bat        # Windows Ein-Klick-Build
│   ├── build.js         # Plattformübergreifendes Build-Skript
│   └── README.md        # Skript-Gebrauchsanweisung
├── release/             # 📦 Release-Artefakte
├── .vscode/             # 🛠️ Editor-Konfiguration
│   └── settings.json    # VS Code-Einstellungen
├── manifest.json        # Plugin-Manifest
├── package.json         # Projektkonfiguration
├── tsconfig.json        # TypeScript-Konfiguration
├── eslint.config.cjs    # ESLint-Konfiguration
├── .gitignore          # Git-Ignorierdatei
├── version-bump.js     # Versionsverwaltungsskript
├── README.md           # Englische Dokumentation
└── README_de-DE.md     # Dieses Dokument (Deutsch)
```

---

## 🐛 Fehlerbehebung

### Plugin lädt nicht

1. Überprüfen Sie, ob `main.js` und `manifest.json` korrekt kopiert wurden
2. Klicken Sie in Obsidian auf `Plugins neu laden`
3. Überprüfen Sie die Entwicklerkonsole (`Strg/Cmd + Umschalt + I`) auf Fehler

### DocWen kann nicht gestartet werden

1. Überprüfen Sie, ob der Pfad zur ausführbaren Datei korrekt ist
2. Bestätigen Sie, dass der Pfadstatus grün ✓ anzeigt
3. Bestätigen Sie, dass die ausführbare Datei die richtigen Berechtigungen hat

### Dateipfad wird nicht übergeben

1. Bestätigen Sie, dass eine Datei aktuell geöffnet ist
2. Überprüfen Sie, ob der Dateipfad Sonderzeichen enthält
3. Überprüfen Sie die Konsolenprotokolle auf übergebene Argumente

---

## 📜 Lizenz

Dieses Projekt ist unter der MIT-Lizenz lizenziert.

### Kontakt

- **GitHub**: https://github.com/ZHYX91/docwen-obsidian
- **DocWen Hauptprojekt**: https://github.com/ZHYX91/docwen
- **Autor kontaktieren**: zhengyx91@hotmail.com

---

**Autor**: ZhengYX

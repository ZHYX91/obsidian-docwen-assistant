[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md) | [Español](README_es-ES.md) | [한국어](README_ko-KR.md) | [Tiếng Việt](README_vi-VN.md)

# DocWen Assistent - Obsidian Plugin

Ein Obsidian-Plugin für die [DocWen](https://github.com/ZHYX91/docwen) Desktop-Anwendung.

## ✨ Funktionen

### Kernfunktionen
- ✅ **Seitenleisten-Schnellstart**: Fügen Sie ein Symbol zur Obsidian-Seitenleiste für Ein-Klick-Start hinzu
- ✅ **Automatische Dateiübergabe**: Übergibt automatisch den aktuell geöffneten Dateipfad an DocWen
- ✅ **Befehlspaletten-Integration**: Schneller Zugriff über Strg/Cmd + P
- ✅ **Pfadvalidierung**: Echtzeit-Validierung des ausführbaren Dateipfads
- ✅ **Datei-Browser**: Einfache Auswahl der ausführbaren Datei über Durchsuchen-Dialog
- ✅ **Erfolgsrückmeldung**: Freundliche Benachrichtigungen beim Start
- ✅ **Einzelinstanz-Verwaltung**: Sendet Dateien automatisch an laufende Instanz
- ✅ **Mehrsprachige Unterstützung**: Unterstützt 11 Sprachen (zh-CN, zh-TW, en, de, fr, ru, pt, ja, es-ES, ko-KR, vi-VN)

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

### Methode 1: Mit Release-Skript (Empfohlen)

1. Release-Build ausführen:
   ```bash
   npm run release
   ```

2. Den Ordner `release/docwen-assistant` kopieren nach:
   ```
   <Ihr Vault>/.obsidian/plugins/
   ```

3. In Obsidian:
   - `Einstellungen` → `Community-Plugins` öffnen
   - `Plugins neu laden` klicken
   - `DocWen Assistant` aktivieren

### Methode 2: Manuelle Installation

1. Plugin erstellen:
   ```bash
   npm run build
   ```

2. Plugin-Verzeichnis erstellen:
   ```
   <Ihr Vault>/.obsidian/plugins/docwen-assistant/
   ```

3. Diese Dateien in das Verzeichnis kopieren:
   - `main.js`
   - `manifest.json`

4. Plugin in Obsidian neu laden und aktivieren

---

## ⚙️ Konfiguration

1. Obsidian `Einstellungen` → `Community-Plugins` → `DocWen Assistant` öffnen

2. Pfad zur ausführbaren Datei konfigurieren:
   - **Option 1**: Pfad direkt eingeben
   - **Option 2**: `Durchsuchen...` Schaltfläche klicken, um Datei auszuwählen

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

### Automatische Dateiübergabe

- Wenn eine Markdown-Datei geöffnet ist, übergibt das Plugin automatisch den vollständigen Pfad an DocWen
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
│   ├── utils/           # Hilfsfunktionen (zukünftig)
│   ├── types/           # Typdefinitionen (zukünftig)
│   └── commands/        # Befehlsmodule (zukünftig)
├── dist/                # 🔨 Build-Ausgabeverzeichnis
│   └── main.js          # Kompilierter Code
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
├── .eslintrc.json       # ESLint-Konfiguration
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

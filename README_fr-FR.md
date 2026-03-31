[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md) | [Español](README_es-ES.md) | [한국어](README_ko-KR.md) | [Tiếng Việt](README_vi-VN.md)

# DocWen Assistant - Plugin Obsidian

Un plugin Obsidian pour l'application de bureau [DocWen](https://github.com/ZHYX91/docwen).

## ✨ Fonctionnalités

### Fonctionnalités principales
- ✅ **Lancement rapide depuis la barre latérale**: Ajoutez une icône à la barre latérale d'Obsidian pour un lancement en un clic
- ✅ **Transmission automatique de fichiers**: Transmet automatiquement le chemin du fichier actuellement ouvert à DocWen
- ✅ **Intégration à la palette de commandes**: Accès rapide via Ctrl/Cmd + P
- ✅ **Export en arrière-plan (CLI)**: Exporter vers Word/Excel/Markdown via DocWenCLI.exe sans ouvrir l'interface GUI (un sélecteur peut apparaître si nécessaire)
- ✅ **Numérotation des titres (CLI)**: Ajouter/supprimer la numérotation des titres Markdown via DocWenCLI.exe
- ✅ **Vérification doctor (CLI)**: Vérification de l'environnement/diagnostic en un clic
- ✅ **Validation du chemin**: Validation en temps réel du chemin de l'exécutable
- ✅ **Explorateur de fichiers**: Sélectionnez facilement le fichier exécutable via la boîte de dialogue de navigation
- ✅ **Retour de succès**: Notifications conviviales au lancement
- ✅ **Menu contextuel (clic droit)**: Clic droit sur un fichier dans l'explorateur → sous-menu DocWen (convertir, numéroter, ouvrir dans DocWen)
- ✅ **Gestion d'instance unique**: Envoie automatiquement le fichier à l'instance en cours d'exécution
- ✅ **Support multilingue**: Prend en charge 11 langues (zh-CN, zh-TW, en, de, fr, ru, pt-BR, ja, ko, es, vi)

---

## 📦 Démarrage rapide

### Prérequis

1. **Installer Node.js**
   - Visitez le [site officiel Node.js](https://nodejs.org/)
   - Téléchargez et installez la version LTS
   - Vérifiez l'installation: `node -v` et `npm -v`

2. **Installer les dépendances**
   ```bash
   npm install
   ```

### Mode développement

Utilisez le mode watch pendant le développement pour une recompilation automatique lors des modifications de code:

```bash
npm run dev
```

### Construire le plugin

#### Construction rapide (sans vérification de type)
```bash
npm run build:quick
```

#### Construction complète (avec vérification de type et minification)
```bash
npm run build
```

#### Construction de release (empaquetage automatique)
```bash
npm run release
# Ou exécutez directement: node scripts/build.js
```

Cette commande va:
1. Compiler le code TypeScript
2. Créer le répertoire de release
3. Copier les fichiers requis
4. Générer les instructions d'utilisation

---

## 🚀 Installer dans Obsidian

### Méthode 1 : Télécharger la release (Recommandé)

1. Rendez-vous sur la page [GitHub Releases](https://github.com/ZHYX91/docwen-obsidian/releases)
2. Téléchargez et extrayez la dernière version
3. Copiez le dossier `docwen-assistant` dans `<Votre Vault>/.obsidian/plugins/`
4. Dans Obsidian : `Paramètres` → `Plugins communautaires` → `Recharger les plugins` → Activer `DocWen Assistant`

### Méthode 2 : Compiler depuis les sources

1. Installer les dépendances et compiler :
   ```bash
   npm install
   npm run release
   ```
2. Copier le dossier `release/docwen-assistant` dans `<Votre Vault>/.obsidian/plugins/`
3. Recharger et activer le plugin dans Obsidian

---

## ⚙️ Configuration

1. Ouvrez Obsidian `Paramètres` → `Plugins communautaires` → `DocWen Assistant`

2. Configurez le chemin vers l'exécutable GUI ou CLI (un seul suffit) :
   - Chemin complet vers `DocWen.exe` ou `DocWenCLI.exe`
   - Si un seul est défini, l'autre sera détecté automatiquement dans le même dossier

3. Validation du chemin:
   - ✓ Vert indique un chemin valide
   - ✗ Rouge indique un chemin invalide ou fichier non trouvé

---

## 📖 Utilisation

### Lancer DocWen

Trois façons de lancer:

1. **Icône de la barre latérale**
   - Cliquez sur l'icône du document dans la barre latérale gauche

2. **Palette de commandes**
   - Appuyez sur `Ctrl/Cmd + P` pour ouvrir la palette de commandes
   - Recherchez "Lancer DocWen"

3. **Lancer avec le fichier actuel**
   - Recherchez "Lancer DocWen avec le fichier actuel" dans la palette de commandes
   - Disponible uniquement lorsqu'un fichier est ouvert

### Export en arrière-plan (CLI, sans ouverture de GUI)

Recherchez dans la palette de commandes :
- « Exporter en Word (Docx) en arrière-plan » — pour les fichiers `.md`/`.markdown`/`.txt`, choisissez un modèle dans le sélecteur
- « Exporter en Excel (XLSX) en arrière-plan » — pour les fichiers `.md`/`.markdown`/`.txt`, choisissez un modèle dans le sélecteur
- « Exporter en Markdown (MD) en arrière-plan » — si des types d'optimisation sont disponibles pour le type de fichier et la langue, choisissez-en un (ou ignorez)

Nécessite `DocWenCLI.exe`.

### Menu contextuel (clic droit)

Faites un clic droit sur un fichier dans l'explorateur pour voir le sous-menu **DocWen**. Les actions disponibles dépendent du type de fichier :

- **Convertir en Markdown** — pour les fichiers docx, xlsx, pdf, images, etc.
- **Convertir en Word (Docx)** / **Convertir en Excel (XLSX)** — pour les fichiers `.md`/`.markdown`/`.txt`
- **Ajouter/Supprimer la numérotation des titres** — uniquement pour les fichiers `.md`
- **Ouvrir dans DocWen** — disponible pour tous les fichiers

### Numérotation des titres (CLI)

Recherchez dans la palette de commandes :
- « Ajouter la numérotation aux titres Markdown » — sélectionnez un schéma de numérotation
- « Supprimer la numérotation des titres Markdown »

Disponible uniquement lorsqu'un fichier `.md` est ouvert. Nécessite `DocWenCLI.exe`.

### Vérification doctor (CLI)

Recherchez dans la palette de commandes :
- « Vérification doctor DocWen »

Nécessite `DocWenCLI.exe`.

### Transmission automatique de fichiers

- Si un fichier est ouvert, le plugin transmet automatiquement son chemin complet à DocWen
- Si aucun fichier n'est ouvert, lance uniquement le programme DocWen

### Gestion d'instance unique

- **Premier clic** → Lance DocWen et transmet le fichier actuel
- **Clic suivant (avec fichier)** → Remplace par le nouveau fichier (Mode fichier unique)
- **Clic suivant (sans fichier)** → Active la fenêtre DocWen

---

## 🛠️ Scripts de développement

### Commandes disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Mode développement (watch) |
| `npm run build` | Construction complète (vérification de type + minification) |
| `npm run build:quick` | Construction rapide (sans vérification de type) |
| `npm run lint` | Vérification ESLint |
| `npm run lint:fix` | Correction automatique ESLint |
| `node version-bump.js [patch\|minor\|major]` | Mettre à jour le numéro de version |
| `npm run release` | Construire le package de release |

### Gestion des versions

Mettre à jour le numéro de version:

```bash
# Version patch (1.0.0 → 1.0.1)
node version-bump.js patch

# Version mineure (1.0.0 → 1.1.0)
node version-bump.js minor

# Version majeure (1.0.0 → 2.0.0)
node version-bump.js major
```

---

## 📁 Structure du projet

```
docwen-obsidian/
├── src/                 # 📁 Répertoire du code source
│   ├── main.ts          # Logique principale du plugin
│   ├── settings.ts      # Page des paramètres
│   ├── i18n.ts          # Module d'internationalisation
│   └── utils/           # Modules utilitaires
│       └── suggest-modal.ts # Sélecteur (modal)
├── dist/                # 🔨 Répertoire de sortie de construction
│   └── main.js          # Code compilé
├── docs/                # 📄 Documentation
│   └── plugin-readme/    # README utilisateur (multi-langues)
├── scripts/             # 📜 Scripts de construction
│   ├── build.bat        # Construction en un clic Windows
│   ├── build.js         # Script de construction multiplateforme
│   └── README.md        # Guide d'utilisation des scripts
├── release/             # 📦 Artefacts de release
├── .vscode/             # 🛠️ Configuration de l'éditeur
│   └── settings.json    # Paramètres VS Code
├── manifest.json        # Manifeste du plugin
├── package.json         # Configuration du projet
├── tsconfig.json        # Configuration TypeScript
├── eslint.config.cjs    # Configuration ESLint
├── .gitignore          # Fichier Git ignore
├── version-bump.js     # Script de gestion des versions
├── README.md           # Documentation anglaise
└── README_fr-FR.md     # Ce document (Français)
```

---

## 🐛 Dépannage

### Le plugin ne charge pas

1. Vérifiez que `main.js` et `manifest.json` sont correctement copiés
2. Cliquez sur `Recharger les plugins` dans Obsidian
3. Vérifiez la console développeur (`Ctrl/Cmd + Shift + I`) pour les erreurs

### Impossible de lancer DocWen

1. Vérifiez que le chemin de l'exécutable est correct
2. Confirmez que le statut du chemin affiche vert ✓
3. Confirmez que l'exécutable a les bonnes permissions

### Chemin du fichier non transmis

1. Confirmez qu'un fichier est actuellement ouvert
2. Vérifiez si le chemin du fichier contient des caractères spéciaux
3. Vérifiez les logs de la console pour les arguments transmis

---

## 📜 Licence

Ce projet est sous licence MIT.

### Contact

- **GitHub**: https://github.com/ZHYX91/docwen-obsidian
- **Projet principal DocWen**: https://github.com/ZHYX91/docwen
- **Contacter l'auteur**: zhengyx91@hotmail.com

---

**Auteur**: ZhengYX

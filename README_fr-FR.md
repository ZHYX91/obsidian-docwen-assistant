[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md)

# DocWen Assistant - Plugin Obsidian

Un plugin Obsidian pour l'application de bureau [DocWen](https://github.com/ZHYX91/docwen).

## ✨ Fonctionnalités

### Fonctionnalités principales
- ✅ **Lancement rapide depuis la barre latérale**: Ajoutez une icône à la barre latérale d'Obsidian pour un lancement en un clic
- ✅ **Transmission automatique de fichiers**: Transmet automatiquement le chemin du fichier actuellement ouvert à DocWen
- ✅ **Intégration à la palette de commandes**: Accès rapide via Ctrl/Cmd + P
- ✅ **Validation du chemin**: Validation en temps réel du chemin de l'exécutable
- ✅ **Explorateur de fichiers**: Sélectionnez facilement le fichier exécutable via la boîte de dialogue de navigation
- ✅ **Retour de succès**: Notifications conviviales au lancement
- ✅ **Gestion d'instance unique**: Envoie automatiquement le fichier à l'instance en cours d'exécution
- ✅ **Support multilingue**: Prend en charge 8 langues (zh-CN, zh-TW, en, de, fr, ru, pt, ja)

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

### Méthode 1: Utiliser le script de release (Recommandé)

1. Exécutez la construction de release:
   ```bash
   npm run release
   ```

2. Copiez le dossier `release/docwen-assistant` vers:
   ```
   <Votre Vault>/.obsidian/plugins/
   ```

3. Dans Obsidian:
   - Ouvrez `Paramètres` → `Plugins communautaires`
   - Cliquez sur `Recharger les plugins`
   - Activez `DocWen Assistant`

### Méthode 2: Installation manuelle

1. Construisez le plugin:
   ```bash
   npm run build
   ```

2. Créez le répertoire du plugin:
   ```
   <Votre Vault>/.obsidian/plugins/docwen-assistant/
   ```

3. Copiez ces fichiers dans le répertoire:
   - `main.js`
   - `manifest.json`

4. Rechargez et activez le plugin dans Obsidian

---

## ⚙️ Configuration

1. Ouvrez Obsidian `Paramètres` → `Plugins communautaires` → `DocWen Assistant`

2. Configurez le chemin de l'exécutable:
   - **Option 1**: Entrez le chemin directement
   - **Option 2**: Cliquez sur le bouton `Parcourir...` pour sélectionner le fichier

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

### Transmission automatique de fichiers

- Si un fichier Markdown est ouvert, le plugin transmet automatiquement son chemin complet à DocWen
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
│   ├── utils/           # Fonctions utilitaires (futur)
│   ├── types/           # Définitions de types (futur)
│   └── commands/        # Modules de commandes (futur)
├── dist/                # 🔨 Répertoire de sortie de construction
│   └── main.js          # Code compilé
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
├── .eslintrc.json       # Configuration ESLint
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

Ce projet est sous licence ISC.

### Contact

- **GitHub**: https://github.com/ZHYX91/docwen-obsidian
- **Projet principal DocWen**: https://github.com/ZHYX91/docwen
- **Contacter l'auteur**: zhengyx91@hotmail.com

---

**Auteur**: ZhengYX

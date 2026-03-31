[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md) | [Español](README_es-ES.md) | [한국어](README_ko-KR.md) | [Tiếng Việt](README_vi-VN.md)

# DocWen Assistant

Plugin Obsidian pour lancer le convertisseur DocWen.

## Installation

1. Copiez ce dossier dans le répertoire `.obsidian/plugins/` de votre coffre Obsidian
2. Rechargez les plugins dans les paramètres d'Obsidian
3. Activez le plugin « DocWen Assistant »
4. Configurez le chemin vers `DocWen.exe` ou `DocWenCLI.exe` dans les paramètres du plugin (un seul suffit)

## Utilisation

- Cliquez sur l'icône de document dans la barre latérale gauche pour lancer DocWen
- Utilisez la palette de commandes (Ctrl/Cmd + P) et recherchez « DocWen »
- Si un fichier est ouvert, son chemin sera automatiquement transmis à DocWen

### Export en arrière-plan (nécessite DocWenCLI.exe)

- « Exporter en Word (Docx) en arrière-plan » — pour les fichiers `.md`/`.markdown`/`.txt`, choisissez un modèle
- « Exporter en Excel (XLSX) en arrière-plan » — pour les fichiers `.md`/`.markdown`/`.txt`, choisissez un modèle
- « Exporter en Markdown (MD) en arrière-plan » — choisissez un type d'optimisation si disponible (ou ignorez)

### Numérotation des titres (nécessite DocWenCLI.exe)

- « Ajouter la numérotation aux titres Markdown » — choisissez un schéma de numérotation
- « Supprimer la numérotation des titres Markdown »

Disponible uniquement pour les fichiers `.md`.

### Menu contextuel (clic droit)

Faites un clic droit sur un fichier dans l'explorateur pour voir le sous-menu **DocWen** :

- **Convertir en Markdown** — pour les fichiers docx, xlsx, pdf, images, etc.
- **Convertir en Word (Docx)** / **Convertir en Excel (XLSX)** — pour les fichiers `.md`/`.markdown`/`.txt`
- **Ajouter/Supprimer la numérotation des titres** — uniquement pour les fichiers `.md`
- **Ouvrir dans DocWen** — disponible pour tous les fichiers

### Diagnostics (nécessite DocWenCLI.exe)

- « Vérification doctor DocWen » — vérifier l'environnement et les dépendances

## Fichiers inclus

- `main.js` - Code principal du plugin
- `manifest.json` - Manifeste du plugin
- `styles.css` - Fichier de styles (si présent)
- `README*.md` - Documentation

Pour plus d'informations, consultez la page des paramètres du plugin.

## Liens

- Dépôt du plugin : https://github.com/ZHYX91/docwen-obsidian
- Dépôt DocWen : https://github.com/ZHYX91/docwen

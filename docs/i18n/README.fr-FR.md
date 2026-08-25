# DocWen Assistant

[English](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/README.md) · [简体中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-CN.md) · [繁體中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-TW.md) · [Deutsch](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.de-DE.md) · [Français](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.fr-FR.md) · [Русский](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ru-RU.md) · [Português](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.pt-BR.md) · [日本語](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ja-JP.md) · [Español](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.es-ES.md) · [한국어](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ko-KR.md) · [Tiếng Việt](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.vi-VN.md)

DocWen Assistant relie Obsidian à une installation locale de [DocWen](https://github.com/ZHYX91/docwen) via le protocole public `DocWenCLI.exe`. Il nécessite Windows, Obsidian 1.12.7 ou ultérieur et une version stable de DocWen 0.9.x.

> **DocWen est requis.** Cet état des sources cible DocWen 0.9.0 et DocWen Assistant 2.0.0 ; une version source ne prouve pas qu'une GitHub Release existe. N'installez qu'après publication des deux versions numériques et de leurs fichiers définis dans [DocWen Releases](https://github.com/ZHYX91/docwen/releases) et la page des versions de l'Assistant.

## Fonctionnalités

Le plugin ouvre les fichiers dans DocWen, exporte vers Word/Excel/Markdown avec une destination explicite, gère la numérotation des titres Markdown, relit le Markdown et lance le diagnostic doctor.

## Configuration requise et compatibilité

- Windows et Obsidian 1.12.7 ou ultérieur ; le plugin fonctionne uniquement sur ordinateur.
- Un paquet Windows complet d'une version stable de DocWen 0.9.x, entièrement extrait ; le plugin ne télécharge pas DocWen automatiquement.
- DocWen Assistant 2.0 exige `docwen.machine.v1` et `docwen.artifact_bundle.v2`, sans repli vers des commandes argv ou d'anciennes enveloppes JSON.

Vous pouvez sélectionner le dossier DocWen entièrement extrait, `DocWen.exe` ou `DocWenCLI.exe`. Le plugin résout ce choix vers le fichier `DocWenCLI.exe` du même dossier et n'enregistre et n'appelle que ce chemin absolu validé. Il n'exécute pas l'interface comme CLI, ne recherche pas récursivement et ne télécharge aucun logiciel automatiquement.

## Installation

Vérifiez d'abord dans [DocWen Releases](https://github.com/ZHYX91/docwen/releases) et [DocWen Assistant Releases](https://github.com/ZHYX91/obsidian-docwen-assistant/releases) que des versions numériques correspondantes sont publiées. Téléchargez ensuite `DocWen-windows-x64.zip` et le paquet correspondant. Copiez `main.js`, `manifest.json` et `styles.css` dans `<Vault>/.obsidian/plugins/docwen-assistant/`, activez le plugin et choisissez le dossier DocWen, `DocWen.exe` ou `DocWenCLI.exe`.

Le paquet de publication contient uniquement `main.js`, `manifest.json` et `styles.css` ; il ne contient, ne remplace et ne supprime jamais `data.json`. Ne supprimez `data.json` que pour réinitialiser volontairement toutes les préférences.

## Utilisation

L'icône, le sous-menu **DocWen** et la palette de commandes permettent de lancer DocWen, d'exporter Word/Excel/Markdown, de modifier la numérotation des titres, de relire le Markdown et d'exécuter doctor. L'export en arrière-plan exige toujours un fichier de sortie explicitement choisi.

## Paramètres

Obsidian 1.12.7 ou ultérieur utilise cinq onglets supérieurs à défilement horizontal : Général, Exporter en Markdown, Exporter vers Word, Relecture et Utilisation. Les onglets prennent en charge les flèches, y compris RTL, Début/Fin, le texte d'interface à 20 px et de grandes cibles tactiles. La langue suit Obsidian par défaut et peut être remplacée par l'une des 11 langues prises en charge.

## Limitations

- Uniquement sur ordinateur Windows avec une installation locale compatible de DocWen.
- Aucune recherche récursive en dehors du dossier ou du programme DocWen sélectionné.
- Une opération est refusée si la réponse CLI, l'instantané source, l'état de l'éditeur ou la cible ne peuvent pas être vérifiés en toute sécurité.

## Confidentialité et sécurité

Le plugin transmet uniquement un instantané isolé de l'éditeur courant ou du fichier du Vault au processus CLI local. Il ne téléverse aucun document et ne parcourt pas tout le Vault. Détails : [CLI integration contract](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/cli-integration.md)

## Développement

Utilisez Node.js 24.19.0 et npm 11.17.0. Exécutez `npm ci`, `npm run check` et `npm run release`. Le code source se trouve sous `src/`, les tests sous `tests/` ; les fichiers générés dans `dist/` et `release/` ne sont pas du code source.

Contrats stables : [Exigences produit](../product-requirements.en.md) · [Spécification UX](../ux-spec.en.md) · [Architecture](../architecture.en.md) · [Stratégie de test](../testing-strategy.en.md) · [Contrat de publication](../release.en.md)

Gouvernance du dépôt : [Journal des modifications](../../CHANGELOG.md) · [Contribuer](../../CONTRIBUTING.md) · [Sécurité](../../SECURITY.md)

## Assistance

- Utilisez [General](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/general) pour les idées de flux de travail et les retours généraux.
- Utilisez [Q&A](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/q-a) pour les questions d'utilisation et de configuration.
- Signalez les défauts reproductibles d'intégration Obsidian et les propositions concrètes via les [formulaires d'issue DocWen Assistant](https://github.com/ZHYX91/obsidian-docwen-assistant/issues/new/choose).
- Pour la conversion, l'OCR, la relecture ou le comportement CLI hors d'Obsidian, utilisez les [issues DocWen Core](https://github.com/ZHYX91/docwen/issues).
- Signalez les vulnérabilités en privé conformément à la [politique de sécurité](https://github.com/ZHYX91/obsidian-docwen-assistant/security/policy).

Avant toute publication, retirez le contenu privé des documents, les chemins de fichiers et de Vault, les journaux CLI, les emplacements d'exécutables et les identifiants.

## Licence

MIT © ZhengYX

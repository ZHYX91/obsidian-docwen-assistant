# DocWen Assistant

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md)

DocWen Assistant relie Obsidian à une installation locale de [DocWen](https://github.com/ZHYX91/docwen). Il nécessite Windows ou Linux, Obsidian 1.12.7 ou ultérieur et une version stable de DocWen 0.17.0 ou ultérieure.

> **DocWen est requis.** Installez une version compatible depuis [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97), ou extrayez entièrement le ZIP portable proposé dans [DocWen Releases](https://github.com/ZHYX91/docwen/releases).

La langue de l’interface change uniquement les textes et la disposition d’Assistant. La langue de conversion, les modèles et l’OCR dépendent des options de la tâche et des réglages de DocWen.

## Captures d’écran

Exemples de l’interface sur ordinateur. L’exemple de relecture utilise une note fictive.

### Barre latérale de relecture

Examinez les problèmes par ligne ou par règle et revenez à la plage source correspondante sans réécrire la note.

![Barre latérale de relecture DocWen](../assets/docwen-assistant-proofread-en.png)

### Paramètres et connexion à DocWen

Vérifiez la connexion à DocWen et choisissez les options de conversion et de relecture dans les quatre onglets.

![Paramètres de DocWen Assistant](../assets/docwen-assistant-settings-en.png)

### Exporter des fichiers

Choisissez le format de sortie, vérifiez les options et indiquez où enregistrer le résultat.

![Export DocWen Assistant selon les capacités](../assets/docwen-assistant-export-en.png)

## Fonctionnalités

Le plugin ouvre les fichiers dans DocWen, exporte vers Word/Excel/Markdown avec une destination explicite, gère la numérotation des titres Markdown, relit le Markdown et propose **Vérifier la connexion à DocWen**.

## Configuration requise et compatibilité

- Windows ou Linux et Obsidian 1.12.7 ou ultérieur ; le plugin fonctionne uniquement sur ordinateur.
- Sous Windows, utilisez une version DocWen 0.17.0 ou ultérieure compatible du Store ou un paquet portable entièrement extrait ; sous Linux, utilisez un paquet entièrement extrait sélectionné manuellement. L’export sous Linux nécessite x64 et un système de fichiers capable de créer un dossier de résultat sans écraser les données existantes ; le plugin ne télécharge pas DocWen automatiquement.
- Le plugin exige `docwen.machine.v2` et `docwen.artifact_bundle.v3` ; une version incompatible de DocWen est refusée au lieu d'utiliser un autre protocole.
- Même si la connexion pour la conversion en arrière-plan est incompatible, vous pouvez essayer d’ouvrir l’application DocWen séparément.

Si la version du Store ne répond pas à ces exigences, utilisez un paquet portable compatible et sélectionnez-le avec l’installation manuelle.

La détection automatique est réservée à Windows, utilise l’alias enregistré `docwen.exe` et reste valide après les mises à jour Microsoft Store. Sous Linux, l’installation manuelle est obligatoire et accepte le dossier extrait, `DocWen` ou `DocWenCLI`. Le plugin ne recherche pas de programmes dans des dossiers arbitraires et ne télécharge aucun logiciel automatiquement.

## Installation

### Installer DocWen et le plugin

1. Sous Windows, installez une version compatible de DocWen 0.17.0 ou ultérieure depuis [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97), ou extrayez le paquet Windows de [DocWen Releases](https://github.com/ZHYX91/docwen/releases). Sous Linux x64, extrayez entièrement le paquet Linux de la même page.
2. Installez DocWen Assistant depuis Community Plugins. Pour l’installation manuelle, téléchargez `docwen-assistant-x.y.z.zip` depuis les [versions du plugin](https://github.com/ZHYX91/obsidian-docwen-assistant/releases) et copiez `main.js`, `manifest.json` et `styles.css` dans `<Vault>/.obsidian/plugins/docwen-assistant/`.
3. Rechargez Community Plugins et activez DocWen Assistant.
4. La version Windows du Store peut être détectée automatiquement. Pour Windows portable ou Linux, ouvrez **Paramètres → DocWen Assistant → Général**, choisissez la connexion manuelle, puis le dossier extrait ou l’exécutable.

### Conserver les réglages lors des mises à jour

Lors d’une mise à jour manuelle, remplacez seulement `main.js`, `manifest.json` et `styles.css`. Conservez `data.json` pour garder vos réglages ; supprimez-le uniquement pour les réinitialiser. Gardez le nom de dossier `docwen-assistant`.

## Utilisation

**Les commandes proposées dépendent du fichier ouvert.** Une conversion nécessite une capacité compatible du DocWen connecté. L’export crée un dossier de résultat séparé, tandis que la relecture ne modifie pas la note. **L’ajout ou le retrait de numéros de titres modifie le Markdown.** Le texte de l’éditeur, même non enregistré, ou le fichier enregistré est vérifié avant l’écriture. Si plusieurs éditeurs du même fichier ne peuvent être distingués, l’opération s’arrête.

L'icône, le sous-menu **DocWen** et la palette de commandes permettent de lancer DocWen, d'exporter Word/Excel/Markdown, de modifier la numérotation des titres, de relire le Markdown et de choisir **Vérifier la connexion à DocWen**.

Choisissez un modèle ou un préréglage de conversion si proposé, puis un dossier de sortie. Vérifiez la source, le format, la destination et les options, puis cliquez sur **Exporter**. La fenêtre reprend les réglages capturés pour cette tâche ; l’annulation ne lance aucune conversion. Chaque conversion crée un nouveau dossier contenant le résultat et les images liées. Après l’export, cliquez sur **Ouvrir le dossier du résultat** dans la notification. Les dossiers existants ne sont pas remplacés.

## Paramètres

Avant l’export Word, activez les **extensions d’entrée** nécessaires dans **DocWen → Paramètres → Syntaxe Markdown**. Elles sont désactivées à l’installation ; le préréglage d’entrée Obsidian active le groupe correspondant.

| Contenu ou tâche | Réglage dans DocWen |
| --- | --- |
| Cellules fusionnées de Structural Tables | Extension d’entrée Structural Tables |
| Légendes et renvois Number Suite | Extension d’entrée des légendes et renvois |
| Titres H7–H9 / notes de fin typées | Extensions d’entrée correspondantes |
| Word vers Markdown étendu | Extensions de sortie correspondantes |

L’export Word lit la syntaxe Number Suite même si ce plugin n’est pas installé. Les numéros exportés suivent les options DocWen, pas les numéros affichés uniquement par Number Suite. Les commandes séparées d’ajout ou de retrait des numéros de titres modifient la note source ; l’export ne la modifie pas.

**Ce que chaque projet modifie**

| Projet et guide | Affichage, source et sortie |
| --- | --- |
| [DocWen (Core)](https://github.com/ZHYX91/docwen/blob/main/docs/user-guides/README.fr-FR.md) | Crée les fichiers convertis. Les extensions d’entrée interprètent la syntaxe source ; les réglages d’export déterminent la sortie et sa numérotation. |
| [DocWen Assistant](../product-requirements.en.md) | L’export crée un dossier de résultats distinct ; la relecture est en lecture seule. Les actions explicites de numérotation des titres modifient le Markdown source. |
| [Chrono Notes](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/docs/i18n/README.fr-FR.md) | Les vues du calendrier et des tâches lisent l’index. Modifier l’état ou la date d’une tâche écrit dans son Markdown source ; les actions de création ajoutent des notes. |
| [Property Order](https://github.com/ZHYX91/obsidian-property-order/blob/main/docs/i18n/README.fr-FR.md) | Les réglages de suggestions changent les menus. Réordonner ou déplacer des valeurs modifie les listes YAML concernées et peut convertir des valeurs non textuelles en chaînes. |
| [Link Integrity](https://github.com/ZHYX91/obsidian-link-integrity/blob/main/docs/i18n/README.fr.md) | Les règles filtrent les résultats d’analyse ou déterminent les connexions du graphe prises en compte. Elles ne réécrivent pas les liens des notes. |
| [Folder Nodes](https://github.com/ZHYX91/obsidian-folder-nodes/blob/main/docs/i18n/README.fr.md) | Les vues montrent la structure des nœuds. Créer, déplacer, renommer, fusionner et supprimer modifie les notes, les dossiers ou les propriétés structurelles. |
| [Number Suite](https://github.com/ZHYX91/obsidian-number-suite/blob/main/docs/i18n/README.fr.md) | Les numéros virtuels changent l’affichage. Les réglages par note enregistrent des propriétés ; écrire, supprimer ou renuméroter les numéros modifie le texte des titres. |
| [Structural Tables](https://github.com/ZHYX91/obsidian-structural-tables/blob/main/docs/i18n/README.fr.md) | La lecture des tableaux et l’exemple d’apparence ne modifient pas les notes. Éditer un tableau écrit du Markdown ; la conversion en Base crée des fichiers d’enregistrement. |

Les paramètres sont répartis entre quatre onglets : Général, Exporter en Markdown, Exporter vers Word et Relecture. Chaque onglet contient les explications utiles. La langue suit Obsidian par défaut et peut être choisie dans les paramètres généraux. Utilisez les flèches ou les touches Début/Fin pour changer d’onglet.

## Limitations

- Sur ordinateur Windows ou Linux avec une installation locale compatible de DocWen ; l’export sous Linux nécessite x64 et un système de fichiers permettant de sauvegarder les résultats sans écraser les données existantes.
- Aucune recherche récursive en dehors du dossier ou du programme DocWen sélectionné.
- Si la note change pendant le traitement ou si le résultat ne peut pas être enregistré en toute sécurité, l’opération s’arrête et vous demande de vérifier.

Un aller-retour par Word ne remplace pas une sauvegarde du Markdown original. Le contenu visible pris en charge peut être reconverti, mais certaines syntaxes, les notes intégrées et des détails de mise en page peuvent être perdus. Conservez la note source et vérifiez le document reconverti.

## Confidentialité et sécurité

Vos documents restent sur votre ordinateur. Le plugin transmet au DocWen local une copie temporaire du fichier choisi, avec les modifications non enregistrées si un seul éditeur correspond à cette note. Il inclut les images explicitement référencées, sans chercher de fichiers sans rapport dans le Vault ni envoyer vos documents en ligne.

L’export écrit dans le dossier choisi. La relecture ne modifie pas la note. La numérotation n’est appliquée que si la note d’origine reste au même emplacement et son texte est inchangé. Si la note est renommée ou remplacée pendant le traitement, relancez l’action sur la note actuelle. Le chemin d’installation du Store n’est pas enregistré dans les réglages du plugin. Voir la [spécification d’intégration](../cli-integration.md) pour les détails techniques.

## Développement

Utilisez Node.js 24.19.0 et npm 11.17.0. Exécutez `npm ci`, `npm run check` et `npm run release`. Le code source se trouve sous `src/`, les tests sous `tests/` ; les fichiers générés dans `dist/` et `release/` ne sont pas du code source.

Documents stables : [Exigences produit](../product-requirements.en.md) · [Spécification UX](../ux-spec.en.md) · [Architecture](../architecture.en.md) · [Stratégie de test](../testing-strategy.en.md)

Gouvernance du dépôt : [Journal des modifications](../../CHANGELOG.md) · [Contribuer](../../CONTRIBUTING.md) · [Sécurité](../../SECURITY.md)

## Assistance

Dans Obsidian, ouvrez **Général → Aide**, puis **Guide utilisateur** ou **Signaler un problème**.

- [Q&A](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/q-a): Questions d’utilisation et de configuration.
- [Ideas](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/ideas): Premières idées de fonctionnalités et de flux de travail.
- [Show and tell](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/show-and-tell): Astuces, flux de travail et implémentations de référence.
- Signalez les défauts reproductibles d'intégration Obsidian et les propositions concrètes via les [formulaires d'issue DocWen Assistant](https://github.com/ZHYX91/obsidian-docwen-assistant/issues/new/choose).
- Pour la conversion, l'OCR, la relecture ou le comportement CLI hors d'Obsidian, utilisez les [issues DocWen Core](https://github.com/ZHYX91/docwen/issues).
- Signalez les vulnérabilités en privé conformément à la [politique de sécurité](https://github.com/ZHYX91/obsidian-docwen-assistant/security/policy).

Avant toute publication, retirez le contenu privé des documents, les chemins de fichiers et de Vault, les journaux CLI, les emplacements d'exécutables et les identifiants.

## Licence

MIT © ZhengYX

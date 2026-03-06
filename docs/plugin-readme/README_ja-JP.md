[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md) | [Español](README_es-ES.md) | [한국어](README_ko-KR.md) | [Tiếng Việt](README_vi-VN.md)

# DocWen Assistant

DocWen コンバーターを起動するための Obsidian プラグイン。

## インストール方法

1. このフォルダを Obsidian ボールトの `.obsidian/plugins/` ディレクトリにコピー
2. Obsidian の設定でプラグインを再読み込み
3. 「DocWen Assistant」プラグインを有効化
4. プラグイン設定で `DocWen.exe` または `DocWenCLI.exe` のパスを設定（どちらか一方でOK）

## 使用方法

- 左サイドバーのドキュメントアイコンをクリックして DocWen を起動
- コマンドパレット (Ctrl/Cmd + P) で「DocWen」を検索
- ファイルが開いている場合、そのパスは自動的に DocWen に渡されます

### バックグラウンド書き出し（DocWenCLI.exe が必要）

- 「バックグラウンドで Word（Docx）へ書き出し」 — `.md`/`.markdown`/`.txt` の場合はテンプレートを選択
- 「バックグラウンドで Excel（XLSX）へ書き出し」 — `.md`/`.markdown`/`.txt` の場合はテンプレートを選択
- 「バックグラウンドで Markdown（MD）へ書き出し」 — 最適化タイプが利用可能な場合は選択（スキップも可能）

### 見出し番号（DocWenCLI.exe が必要）

- 「Markdown 見出しに番号を付ける」 — 番号付け方式を選択
- 「Markdown 見出しの番号を削除」

`.md` ファイルのみ利用可能です。

### 診断（DocWenCLI.exe が必要）

- 「DocWen doctor チェック」 — 環境と依存関係をチェック

## 含まれるファイル

- `main.js` - プラグインのコアコード
- `manifest.json` - プラグインマニフェスト
- `styles.css` - スタイルファイル（存在する場合）
- `README*.md` - ドキュメント

詳細についてはプラグイン設定ページをご覧ください。

## リンク

- プラグインリポジトリ：https://github.com/ZHYX91/docwen-obsidian
- DocWen リポジトリ：https://github.com/ZHYX91/docwen

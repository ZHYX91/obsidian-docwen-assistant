# DocWen Assistant

[English](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/README.md) · [简体中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-CN.md) · [繁體中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-TW.md) · [Deutsch](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.de-DE.md) · [Français](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.fr-FR.md) · [Русский](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ru-RU.md) · [Português](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.pt-BR.md) · [日本語](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ja-JP.md) · [Español](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.es-ES.md) · [한국어](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ko-KR.md) · [Tiếng Việt](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.vi-VN.md)

DocWen Assistant は公開 `DocWenCLI.exe` プロトコルを通じて、Obsidian とローカルの [DocWen](https://github.com/ZHYX91/docwen) を接続します。Windows、Obsidian 1.12.7 以降、安定版 DocWen 0.9.x が必要です。

> **DocWen 本体が必要です。** このソースは DocWen 0.9.0 と DocWen Assistant 2.0.0 を対象としますが、ソースのバージョンは GitHub Release の公開を証明しません。両方の数字のみの Release と所定のファイルが [DocWen Releases](https://github.com/ZHYX91/docwen/releases) と Assistant のリリースページで公開された後にだけインストールしてください。

## 機能

DocWen でのファイル表示、出力先を明示した Word／Excel／Markdown 変換、Markdown 見出し番号の追加・削除、校正、doctor 診断を利用できます。

## 要件と互換性

- Windows と Obsidian 1.12.7 以降。プラグインはデスクトップ専用です。
- 完全に展開した安定版 DocWen 0.9.x の Windows 完全版。プラグインは DocWen を自動ダウンロードしません。
- DocWen Assistant 2.0 には `docwen.machine.v1` と `docwen.artifact_bundle.v2` が必要で、argv コマンドや旧 JSON エンベロープへのフォールバックはありません。

完全に展開した DocWen フォルダー、`DocWen.exe`、または `DocWenCLI.exe` を選択できます。プラグインは同じフォルダーの `DocWenCLI.exe` に解決し、検証済みの絶対 CLI パスだけを保存して使用します。GUI を CLI として実行せず、再帰検索やソフトウェアの自動ダウンロードも行いません。

## インストール

[DocWen Releases](https://github.com/ZHYX91/docwen/releases) と [DocWen Assistant Releases](https://github.com/ZHYX91/obsidian-docwen-assistant/releases) で対応する数字のみの Release が公開済みであることを確認し、`DocWen-windows-x64.zip` と対応するプラグイン一式をダウンロードします。`main.js`、`manifest.json`、`styles.css` を `<Vault>/.obsidian/plugins/docwen-assistant/` にコピーし、プラグインを有効にして DocWen フォルダー、`DocWen.exe`、または `DocWenCLI.exe` を選択してください。

リリースパッケージに含まれるのは `main.js`、`manifest.json`、`styles.css` だけであり、`data.json` を含めたり、置き換えたり、削除したりすることはありません。すべての設定を意図的にリセットする場合だけ `data.json` を削除してください。

## 使用方法

リボンアイコン、**DocWen** サブメニュー、コマンドパレットから、DocWen の起動、Word／Excel／Markdown の出力、見出し番号の変更、Markdown 校正、doctor を実行できます。バックグラウンド出力では必ず出力ファイルを明示的に選択します。

## 設定

Obsidian 1.12.7 以降では、横スクロール可能な 5 つの上部タブ（一般、Markdown へ、Word へ、校正、使用方法）を使用します。タブは RTL を含む矢印キー、Home/End、20 px の UI 文字、粗いポインター向けの大きな操作領域に対応します。言語は既定で Obsidian に従い、対応する 11 言語から明示的に選択できます。

## 制限

- 対応するローカル DocWen がある Windows デスクトップ専用です。
- 選択した DocWen フォルダーまたは実行ファイル以外を再帰検索しません。
- CLI 応答、元スナップショット、エディター状態、出力先を安全に検証できない操作は拒否されます。

## プライバシーとセキュリティ

プラグインは現在のエディターまたは Vault ファイルの隔離スナップショットだけをローカル CLI に渡します。文書のアップロードや Vault 全体の列挙は行いません。詳細：[CLI integration contract](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/cli-integration.md)

## 開発

Node.js 24.19.0 と npm 11.17.0 を使用します。`npm ci`、`npm run check`、`npm run release` を実行します。ソースは `src/`、テストは `tests/` にあり、`dist/` と `release/` の生成物はソースではありません。

安定版契約：[製品要件](../product-requirements.en.md) · [UX 仕様](../ux-spec.en.md) · [アーキテクチャ](../architecture.en.md) · [テスト戦略](../testing-strategy.en.md) · [リリース契約](../release.en.md)

リポジトリ運営：[変更履歴](../../CHANGELOG.md) · [コントリビューションガイド](../../CONTRIBUTING.md) · [セキュリティ](../../SECURITY.md)

## サポート

- ワークフローのアイデアや一般的なフィードバックには [General](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/general) を使用してください。
- 使用方法や設定に関する質問には [Q&A](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/q-a) を使用してください。
- 再現可能な Obsidian 連携の不具合や具体的な機能提案は、[DocWen Assistant の Issue フォーム](https://github.com/ZHYX91/obsidian-docwen-assistant/issues/new/choose)から報告してください。
- Obsidian 外の変換、OCR、校正、CLI の動作は [DocWen Core Issues](https://github.com/ZHYX91/docwen/issues) で報告してください。
- 脆弱性は[セキュリティポリシー](https://github.com/ZHYX91/obsidian-docwen-assistant/security/policy)に従って非公開で報告してください。

公開前に、文書の機密内容、ファイルと Vault のパス、CLI ログ、実行ファイルの場所、認証情報を削除してください。

## ライセンス

MIT © ZhengYX

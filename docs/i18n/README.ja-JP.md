# DocWen Assistant

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md)

DocWen Assistant は Obsidian とローカルの [DocWen](https://github.com/ZHYX91/docwen) を接続します。Windows または Linux、Obsidian 1.12.7 以降、安定版 DocWen 0.17.0 以降 が必要です。

> **DocWen 本体が必要です。** [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97) から互換バージョンをインストールするか、[DocWen Releases](https://github.com/ZHYX91/docwen/releases) のポータブル ZIP を完全に展開してください。

表示言語で変わるのは Assistant 自身の文言とレイアウトだけです。変換言語、テンプレート、OCR はタスクのオプションと DocWen の設定で管理します。

## スクリーンショット

デスクトップ画面の例です。校正にはサンプルノートを使用しています。

### 校正サイドバー

行またはルールごとに問題を確認し、ノートを書き換えずに対応するソース範囲へ戻れます。

![DocWen 校正サイドバー](../assets/docwen-assistant-proofread-en.png)

### 設定と DocWen への接続

4 つの設定タブで DocWen への接続を確認し、変換と校正の項目を選びます。

![DocWen Assistant の上部タブ設定](../assets/docwen-assistant-settings-en.png)

### ファイルのエクスポート

出力形式と設定を確認して、保存先を選びます。

![DocWen Assistant の機能別エクスポート](../assets/docwen-assistant-export-en.png)

## 機能

DocWen でのファイル表示、出力先を明示した Word／Excel／Markdown 変換、Markdown 見出し番号の追加・削除、校正、**DocWen 接続を確認**コマンドを利用できます。

## 要件と互換性

- Windows または Linux と Obsidian 1.12.7 以降。プラグインはデスクトップ専用です。
- Windows では Store 版または完全に展開したポータブル版の DocWen 0.17.0 以降、Linux では手動選択した完全展開済みパッケージを使用します。Linux でのエクスポートには x64 と、既存のデータを上書きせずに結果を保存できるファイルシステムが必要です。プラグインは DocWen を自動ダウンロードしません。
- プラグインには `docwen.machine.v2` と `docwen.artifact_bundle.v3` が必要です。互換性のない DocWen は、別のプロトコルへ切り替えずに拒否されます。
- バックグラウンド変換の接続に互換性がない場合でも、DocWen デスクトップアプリは別に開くことができます。

Store のインストールがこれらの要件を満たさない場合は、互換性のあるポータブル版を使用し、手動インストールで選択してください。

自動検出は Windows 専用で、登録済みの `docwen.exe` エイリアスを使用します。Linux では手動インストールが必須で、展開したフォルダー、`DocWen`、または `DocWenCLI` を選択します。ディスク内の他のプログラムを検索せず、ソフトウェアを自動ダウンロードしません。

## インストール

### DocWen とプラグインをインストール

1. Windows では [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97) から互換性のある DocWen 0.17.0 以降をインストールするか、[DocWen Releases](https://github.com/ZHYX91/docwen/releases) の Windows パッケージを完全に展開します。Linux x64 では同じページの Linux パッケージを展開します。
2. Community Plugins から DocWen Assistant をインストールします。手動の場合は[プラグインのリリース](https://github.com/ZHYX91/obsidian-docwen-assistant/releases)から `docwen-assistant-x.y.z.zip` を取得し、`main.js`、`manifest.json`、`styles.css` を `<Vault>/.obsidian/plugins/docwen-assistant/` にコピーします。
3. Community Plugins を再読み込みし、DocWen Assistant を有効にします。
4. Windows の Store 版は自動検出できます。Windows ポータブル版と Linux では **設定 → DocWen Assistant → 一般**で手動接続を選び、展開したフォルダーまたは実行ファイルを指定します。

### 更新時に設定を残す

手動更新では `main.js`、`manifest.json`、`styles.css` のみ置き換えます。設定を残すには `data.json` を保持し、リセットしたい場合だけ削除してください。フォルダー名は `docwen-assistant` のままにします。

## 使用方法

**操作は現在のファイルに応じて表示されます。** 変換コマンドはファイルの内容と接続先 DocWen の対応機能によって利用可否が決まります。書き出しは選択したフォルダー内に別の結果フォルダーを作り、校正はノートを書き換えません。**見出し番号の追加・削除は Markdown 自体を変更します。** 実行前に編集中の内容や保存済みファイルを照合し、同じノートの編集元を一意に判定できなければ停止します。

リボンアイコン、**DocWen** サブメニュー、コマンドパレットから、DocWen の起動、Word／Excel／Markdown の出力、見出し番号の変更、Markdown 校正、**DocWen 接続を確認**コマンドを実行できます。

テンプレートや変換プリセットが表示されたら選択し、出力先フォルダーを指定します。元ファイル、形式、保存先、今回の設定を確認して**エクスポート**を押します。確認画面はそのタスクで取得した設定を使い、キャンセルすると変換は始まりません。結果と関連画像は新しいフォルダーに保存されます。完了通知の**結果フォルダーを開く**から確認できます。既存の結果フォルダーは上書きしません。

## 設定

Word に出力する前に、**DocWen → 設定 → Markdown 構文**で必要な**入力拡張**を有効にしてください。新規インストールでは無効です。Obsidian 用の入力プリセットも利用できます。

| ノートの内容・操作 | DocWen の設定 |
| --- | --- |
| Structural Tables の結合セル | Structural Tables の入力拡張 |
| Number Suite のキャプション・相互参照 | キャプションと参照の入力拡張 |
| H7–H9 見出し・型付き文末脚注 | 対応する見出し・脚注の入力拡張 |
| Word から拡張 Markdown に戻す | 対応する出力拡張 |

Number Suite が未インストールでも、Word 出力は Markdown 内の対応構文を読み取れます。出力の番号は DocWen の設定に従い、Number Suite の表示だけの番号はコピーしません。見出し番号の追加・削除コマンドは元のノートを変更しますが、エクスポートは変更しません。

設定は「一般」「Markdown へ」「Word へ」「校正」の 4 つのタブに分かれています。各タブに関連する説明が表示されます。表示言語は既定で Obsidian に従い、「一般」から変更できます。矢印キーや Home/End キーでもタブを切り替えられます。

## 制限

- 対応するローカル DocWen がある Windows または Linux デスクトップ向けです。Linux でのエクスポートには x64 と、既存のデータを上書きせずに結果を保存できるファイルシステムが必要です。
- 選択した DocWen フォルダーまたは実行ファイル以外を再帰検索しません。
- 処理中にノートが変更された場合や、結果を安全に保存できない場合は、操作を停止して確認を求めます。

Word への変換と再変換は、元の Markdown の完全なバックアップにはなりません。対応する表示内容は変換できますが、未対応の構文、埋め込みノートの展開、一部のレイアウトは保持されないことがあります。元のノートを残し、再変換後の内容を確認してください。

## プライバシーとセキュリティ

文書は自分のコンピューターで処理されます。プラグインは選択したファイルの一時コピーをローカルの DocWen に渡します。対応するエディターが一つなら未保存の編集内容も使います。ノートが明示的に参照する画像だけを含め、Vault 全体から無関係なファイルを探したり、文書をアップロードしたりしません。

エクスポート先は自分で選びます。校正はノートを変更しません。見出し番号は元のノートの場所と本文が変わっていない場合だけ書き戻します。処理中に名前を変えたりファイルを置き換えたりした場合は、現在のノートでもう一度実行してください。Store のインストール先はプラグイン設定に保存しません。開発者向けの詳細は[連携仕様](../cli-integration.md)を参照してください。

## 開発

Node.js 24.19.0 と npm 11.17.0 を使用します。`npm ci`、`npm run check`、`npm run release` を実行します。ソースは `src/`、テストは `tests/` にあり、`dist/` と `release/` の生成物はソースではありません。

安定版文書：[製品要件](../product-requirements.en.md) · [UX 仕様](../ux-spec.en.md) · [アーキテクチャ](../architecture.en.md) · [テスト戦略](../testing-strategy.en.md)

リポジトリ運営：[変更履歴](../../CHANGELOG.md) · [コントリビューションガイド](../../CONTRIBUTING.md) · [セキュリティ](../../SECURITY.md)

## サポート

Obsidian 内では、**一般 → ヘルプ**から**ユーザーガイド**または**問題を報告**を開けます。

- [Q&A](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/q-a)：使用方法や設定に関する質問。
- [Ideas](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/ideas)：機能やワークフローについての初期段階のアイデア。
- [Show and tell](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/show-and-tell)：ヒント、ワークフロー、参考実装。
- 再現可能な Obsidian 連携の不具合や具体的な機能提案は、[DocWen Assistant の Issue フォーム](https://github.com/ZHYX91/obsidian-docwen-assistant/issues/new/choose)から報告してください。
- Obsidian 外の変換、OCR、校正、CLI の動作は [DocWen Core Issues](https://github.com/ZHYX91/docwen/issues) で報告してください。
- 脆弱性は[セキュリティポリシー](https://github.com/ZHYX91/obsidian-docwen-assistant/security/policy)に従って非公開で報告してください。

公開前に、文書の機密内容、ファイルと Vault のパス、CLI ログ、実行ファイルの場所、認証情報を削除してください。

## ライセンス

MIT © ZhengYX

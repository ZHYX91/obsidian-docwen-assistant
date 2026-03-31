[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md) | [Español](README_es-ES.md) | [한국어](README_ko-KR.md) | [Tiếng Việt](README_vi-VN.md)

# DocWen アシスタント - Obsidian プラグイン

[DocWen](https://github.com/ZHYX91/docwen) デスクトップアプリケーション用の Obsidian プラグインです。

## ✨ 機能

### コア機能
- ✅ **サイドバークイック起動**: Obsidian サイドバーにアイコンを追加してワンクリック起動
- ✅ **自動ファイル転送**: 現在開いているファイルのパスを自動的に DocWen に転送
- ✅ **コマンドパレット統合**: Ctrl/Cmd + P でクイックアクセス
- ✅ **バックグラウンド書き出し（CLI）**: DocWenCLI.exe で Word/Excel/Markdown に書き出し（必要に応じて選択画面が表示されます）
- ✅ **見出し番号（CLI）**: DocWenCLI.exe で Markdown 見出しの番号を付与/削除
- ✅ **doctor チェック（CLI）**: 環境/診断チェックをワンクリック実行
- ✅ **パス検証**: 実行ファイルパスのリアルタイム検証
- ✅ **ファイルブラウザ**: 参照ダイアログで実行ファイルを簡単に選択
- ✅ **成功フィードバック**: 起動時のフレンドリーな通知
- ✅ **右クリックメニュー**: エクスプローラーでファイルを右クリック → DocWen サブメニュー（形式変換、番号管理、DocWen で開く）
- ✅ **シングルインスタンス管理**: 実行中のインスタンスにファイルを自動送信
- ✅ **多言語サポート**: 11言語をサポート (zh-CN, zh-TW, en, de, fr, ru, pt-BR, ja, ko, es, vi)

---

## 📦 クイックスタート

### 前提条件

1. **Node.js のインストール**
   - [Node.js 公式サイト](https://nodejs.org/)にアクセス
   - LTS バージョンをダウンロードしてインストール
   - インストールの確認: `node -v` と `npm -v`

2. **依存関係のインストール**
   ```bash
   npm install
   ```

### 開発モード

開発中は watch モードを使用して、コード変更時に自動的に再コンパイル:

```bash
npm run dev
```

### プラグインのビルド

#### クイックビルド（型チェックなし）
```bash
npm run build:quick
```

#### フルビルド（型チェックと圧縮付き）
```bash
npm run build
```

#### リリースビルド（自動パッケージング）
```bash
npm run release
# または直接実行: node scripts/build.js
```

このコマンドは:
1. TypeScript コードをコンパイル
2. release ディレクトリを作成
3. 必要なファイルをコピー
4. 使用説明を生成

---

## 🚀 Obsidian にインストール

### 方法1：リリースをダウンロード（推奨）

1. [GitHub Releases](https://github.com/ZHYX91/docwen-obsidian/releases) ページにアクセス
2. 最新バージョンをダウンロードして解凍
3. `docwen-assistant` フォルダを `<あなたの Vault>/.obsidian/plugins/` にコピー
4. Obsidian で：`設定` → `コミュニティプラグイン` → `プラグインを再読み込み` → `DocWen Assistant` を有効化

### 方法2：ソースコードからビルド

1. 依存関係をインストールしてビルド：
   ```bash
   npm install
   npm run release
   ```
2. `release/docwen-assistant` フォルダを `<あなたの Vault>/.obsidian/plugins/` にコピー
3. Obsidian でプラグインを再読み込みして有効化

---

## ⚙️ 設定

1. Obsidian `設定` → `コミュニティプラグイン` → `DocWen Assistant` を開く

2. GUI または CLI の実行ファイルパスを設定（どちらか一方でOK）:
   - `DocWen.exe` または `DocWenCLI.exe` のフルパス
   - 片方だけ設定した場合、同じフォルダからもう一方を自動検出します

3. パス検証:
   - ✓ 緑は有効なパスを示す
   - ✗ 赤は無効なパスまたはファイルが見つからないことを示す

---

## 📖 使用方法

### DocWen を起動

3つの起動方法:

1. **サイドバーアイコン**
   - 左サイドバーのドキュメントアイコンをクリック

2. **コマンドパレット**
   - `Ctrl/Cmd + P` でコマンドパレットを開く
   - 「DocWen を起動」を検索

3. **現在のファイルで起動**
   - コマンドパレットで「現在のファイルで DocWen を起動」を検索
   - ファイルが開いている時のみ利用可能

### バックグラウンド書き出し（GUI を開かない）

コマンドパレットで検索:
- 「バックグラウンドで Word（Docx）へ書き出し」 — `.md`/`.markdown`/`.txt` の場合はテンプレート選択画面が表示されます
- 「バックグラウンドで Excel（XLSX）へ書き出し」 — `.md`/`.markdown`/`.txt` の場合はテンプレート選択画面が表示されます
- 「バックグラウンドで Markdown（MD）へ書き出し」 — 最適化タイプが利用可能な場合は選択画面が表示されます（スキップも可能）

`DocWenCLI.exe` が必要です。

### 右クリックメニュー

ファイルエクスプローラーでファイルを右クリックすると、**DocWen** サブメニューが表示されます。利用可能なアクションはファイルの種類によって異なります：

- **Markdown に変換** — docx、xlsx、pdf、画像ファイルなど
- **Word（Docx）に変換** / **Excel（XLSX）に変換** — `.md`/`.markdown`/`.txt` ファイル用
- **見出し番号の追加/削除** — `.md` ファイルのみ
- **DocWen で開く** — すべてのファイルで利用可能

### 見出し番号（CLI）

コマンドパレットで検索:
- 「Markdown 見出しに番号を付ける」 — 番号付け方式を選択
- 「Markdown 見出しの番号を削除」

`.md` ファイルを開いている時のみ利用可能です。`DocWenCLI.exe` が必要です。

### doctor チェック

コマンドパレットで検索:
- 「DocWen doctor チェック」

`DocWenCLI.exe` が必要です。

### 自動ファイル転送

- ファイルが開いている場合、プラグインは自動的にフルパスを DocWen に転送
- ファイルが開いていない場合、DocWen プログラムのみを起動

### シングルインスタンス管理

- **最初のクリック** → DocWen を起動して現在のファイルを転送
- **再クリック（ファイルあり）** → 新しいファイルで置換（シングルファイルモード）
- **再クリック（ファイルなし）** → DocWen ウィンドウをアクティブ化

---

## 🛠️ 開発スクリプト

### 利用可能なコマンド

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発モード（watch） |
| `npm run build` | フルビルド（型チェック + 圧縮） |
| `npm run build:quick` | クイックビルド（型チェックなし） |
| `npm run lint` | ESLint チェック |
| `npm run lint:fix` | ESLint 自動修正 |
| `node version-bump.js [patch\|minor\|major]` | バージョン番号を更新 |
| `npm run release` | リリースパッケージをビルド |

### バージョン管理

バージョン番号を更新:

```bash
# パッチバージョン (1.0.0 → 1.0.1)
node version-bump.js patch

# マイナーバージョン (1.0.0 → 1.1.0)
node version-bump.js minor

# メジャーバージョン (1.0.0 → 2.0.0)
node version-bump.js major
```

---

## 📁 プロジェクト構造

```
docwen-obsidian/
├── src/                 # 📁 ソースコードディレクトリ
│   ├── main.ts          # プラグインメインロジック
│   ├── settings.ts      # 設定ページ
│   ├── i18n.ts          # 国際化モジュール
│   └── utils/           # ユーティリティ
│       └── suggest-modal.ts # 選択モーダル
├── dist/                # 🔨 ビルド出力ディレクトリ
│   └── main.js          # コンパイル済みコード
├── docs/                # 📄 ドキュメント
│   └── plugin-readme/    # ユーザー向け README（多言語）
├── scripts/             # 📜 ビルドスクリプト
│   ├── build.bat        # Windows ワンクリックビルド
│   ├── build.js         # クロスプラットフォームビルドスクリプト
│   └── README.md        # スクリプト使用ガイド
├── release/             # 📦 リリース成果物
├── .vscode/             # 🛠️ エディタ設定
│   └── settings.json    # VS Code 設定
├── manifest.json        # プラグインマニフェスト
├── package.json         # プロジェクト設定
├── tsconfig.json        # TypeScript 設定
├── eslint.config.cjs    # ESLint 設定
├── .gitignore          # Git 無視ファイル
├── version-bump.js     # バージョン管理スクリプト
├── README.md           # 英語ドキュメント
└── README_ja-JP.md     # このドキュメント（日本語）
```

---

## 🐛 トラブルシューティング

### プラグインが読み込まれない

1. `main.js` と `manifest.json` が正しくコピーされているか確認
2. Obsidian で `プラグインを再読み込み` をクリック
3. デベロッパーコンソール (`Ctrl/Cmd + Shift + I`) でエラーを確認

### DocWen を起動できない

1. 実行ファイルパスが正しいか確認
2. パスステータスが緑 ✓ を表示していることを確認
3. 実行ファイルに適切な権限があることを確認

### ファイルパスが転送されない

1. ファイルが現在開いていることを確認
2. ファイルパスに特殊文字が含まれていないか確認
3. コンソールログで転送された引数を確認

---

## 📜 ライセンス

このプロジェクトは MIT ライセンスの下でライセンスされています。

### 連絡先

- **GitHub**: https://github.com/ZHYX91/docwen-obsidian
- **DocWen メインプロジェクト**: https://github.com/ZHYX91/docwen
- **作者に連絡**: zhengyx91@hotmail.com

---

**作者**: ZhengYX

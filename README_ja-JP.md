[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md)

# DocWen アシスタント - Obsidian プラグイン

[DocWen](https://github.com/ZHYX91/docwen) デスクトップアプリケーション用の Obsidian プラグインです。

## ✨ 機能

### コア機能
- ✅ **サイドバークイック起動**: Obsidian サイドバーにアイコンを追加してワンクリック起動
- ✅ **自動ファイル転送**: 現在開いているファイルのパスを自動的に DocWen に転送
- ✅ **コマンドパレット統合**: Ctrl/Cmd + P でクイックアクセス
- ✅ **パス検証**: 実行ファイルパスのリアルタイム検証
- ✅ **ファイルブラウザ**: 参照ダイアログで実行ファイルを簡単に選択
- ✅ **成功フィードバック**: 起動時のフレンドリーな通知
- ✅ **シングルインスタンス管理**: 実行中のインスタンスにファイルを自動送信
- ✅ **多言語サポート**: 8言語をサポート (zh-CN, zh-TW, en, de, fr, ru, pt, ja)

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

## 🚀 Obsidian へのインストール

### 方法1: リリーススクリプトを使用（推奨）

1. リリースビルドを実行:
   ```bash
   npm run release
   ```

2. `release/docwen-assistant` フォルダを以下にコピー:
   ```
   <あなたの Vault>/.obsidian/plugins/
   ```

3. Obsidian で:
   - `設定` → `コミュニティプラグイン` を開く
   - `プラグインを再読み込み` をクリック
   - `DocWen Assistant` を有効化

### 方法2: 手動インストール

1. プラグインをビルド:
   ```bash
   npm run build
   ```

2. プラグインディレクトリを作成:
   ```
   <あなたの Vault>/.obsidian/plugins/docwen-assistant/
   ```

3. 以下のファイルをディレクトリにコピー:
   - `main.js`
   - `manifest.json`

4. Obsidian でプラグインを再読み込みして有効化

---

## ⚙️ 設定

1. Obsidian `設定` → `コミュニティプラグイン` → `DocWen Assistant` を開く

2. 実行ファイルパスを設定:
   - **オプション 1**: パスを直接入力
   - **オプション 2**: `参照...` ボタンをクリックしてファイルを選択

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

### 自動ファイル転送

- Markdown ファイルが開いている場合、プラグインは自動的にフルパスを DocWen に転送
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
│   ├── utils/           # ユーティリティ関数（将来）
│   ├── types/           # 型定義（将来）
│   └── commands/        # コマンドモジュール（将来）
├── dist/                # 🔨 ビルド出力ディレクトリ
│   └── main.js          # コンパイル済みコード
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
├── .eslintrc.json       # ESLint 設定
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

このプロジェクトは ISC ライセンスの下でライセンスされています。

### 連絡先

- **GitHub**: https://github.com/ZHYX91/docwen-obsidian
- **DocWen メインプロジェクト**: https://github.com/ZHYX91/docwen
- **作者に連絡**: zhengyx91@hotmail.com

---

**作者**: ZhengYX

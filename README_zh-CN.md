[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md) | [Español](README_es-ES.md) | [한국어](README_ko-KR.md) | [Tiếng Việt](README_vi-VN.md)

# DocWen 助手 - Obsidian 插件

为 [DocWen](https://github.com/ZHYX91/docwen) 桌面应用开发的配套 Obsidian 插件。

## ✨ 功能特性

### 核心功能
- ✅ **侧边栏快捷启动**: 在 Obsidian 左侧栏添加图标，一键启动 DocWen
- ✅ **自动文件传递**: 自动将当前打开的文件路径传递给 DocWen
- ✅ **命令面板集成**: 通过 Ctrl/Cmd + P 快速访问插件功能
- ✅ **后台静默转换（CLI）**: 调用 DocWenCLI.exe 后台导出为 Word/Excel/Markdown（需要时会弹出选择器）
- ✅ **标题序号（CLI）**: 通过 DocWenCLI.exe 为 Markdown 标题添加/清理序号
- ✅ **doctor 自检（CLI）**: 一键检查 DocWen 环境与依赖
- ✅ **路径验证**: 实时验证可执行文件路径的有效性
- ✅ **文件选择器**: 通过浏览对话框轻松选择可执行文件
- ✅ **成功反馈**: 启动时显示友好的通知消息
- ✅ **单实例管理**: 自动向运行中的实例发送文件
- ✅ **多语言支持**: 支持 11 种语言（简中、繁中、英、德、法、俄、葡、日、韩、西、越）

---

## 📦 快速开始

### 环境准备

1. **安装 Node.js**
   - 访问 [Node.js 官网](https://nodejs.org/)
   - 下载并安装 LTS 版本
   - 验证安装: `node -v` 和 `npm -v`

2. **安装依赖**
   ```bash
   npm install
   ```

### 开发模式

开发时使用 watch 模式，代码修改后自动重新编译：

```bash
npm run dev
```

### 构建插件

#### 快速构建（不含类型检查）
```bash
npm run build:quick
```

#### 完整构建（含类型检查和代码压缩）
```bash
npm run build
```

#### 发布构建（自动打包）
```bash
npm run release
# 或直接运行: node scripts/build.js
```

此命令会：
1. 编译 TypeScript 代码
2. 创建 release 目录
3. 复制必需文件
4. 生成使用说明

---

## 🚀 安装到 Obsidian

### 方法一：使用发布脚本（推荐）

1. 运行发布构建:
   ```bash
   npm run release
   ```

2. 将 `release/docwen-assistant` 文件夹复制到:
   ```
   <你的 Vault>/.obsidian/plugins/
   ```

3. 在 Obsidian 中:
   - 打开 `设置` → `第三方插件`
   - 点击 `重新加载插件`
   - 启用 `DocWen Assistant`

### 方法二：手动安装

1. 构建插件:
   ```bash
   npm run build
   ```

2. 创建插件目录:
   ```
   <你的 Vault>/.obsidian/plugins/docwen-assistant/
   ```

3. 复制以下文件到该目录:
   - `main.js`
   - `manifest.json`

4. 在 Obsidian 中重新加载并启用插件

---

## ⚙️ 配置

1. 打开 Obsidian `设置` → `第三方插件` → `DocWen Assistant`

2. 配置可执行文件路径（GUI）或命令行工具路径（CLI）（二选一即可）:
   - `DocWen.exe` 的完整路径，或 `DocWenCLI.exe` 的完整路径
   - 若只填写其中一个，插件会尝试从同目录自动识别另一个（例如：在 `DocWen.exe` 同目录寻找 `DocWenCLI.exe`，反之亦然）

3. 路径验证:
   - ✓ 绿色表示路径有效
   - ✗ 红色表示路径无效或文件不存在

---

## 📖 使用方法

### 启动 DocWen

有三种方式启动:

1. **侧边栏图标**
   - 点击左侧栏的文档图标

2. **命令面板**
   - 按 `Ctrl/Cmd + P` 打开命令面板
   - 搜索 "启动 DocWen"

3. **当前文件启动**
   - 在命令面板搜索 "使用当前文件启动 DocWen"
   - 仅在有打开文件时可用

### 后台导出（不弹出 GUI）

在命令面板中搜索：
- “后台导出为 Word（Docx）” — 对 `.md`/`.markdown`/`.txt` 文件会弹出模板选择器
- “后台导出为 Excel（XLSX）” — 对 `.md`/`.markdown`/`.txt` 文件会弹出模板选择器
- “后台导出为 Markdown（MD）” — 如果当前文件类型和语言下存在可用优化类型，会弹出选择器供选择（也可跳过不选）

需要 `DocWenCLI.exe`。

### 标题序号（CLI）

在命令面板中搜索：
- “为 Markdown 标题添加序号” — 从选择器中选择序号方案
- “清理 Markdown 标题序号”

仅在打开 `.md` 文件时可用。需要 `DocWenCLI.exe`。

### doctor 自检

在命令面板中搜索：
- “DocWen doctor 自检”

需要 `DocWenCLI.exe`。

### 自动文件传递

- 如果有打开的文件，插件会自动将完整路径传递给 DocWen
- 如果没有打开文件，仅启动 DocWen 程序

### 单实例管理

- **首次点击** → 启动 DocWen 并传递当前文件
- **再次点击（有文件）** → 替换为新文件（单文件模式）
- **再次点击（无文件）** → 激活 DocWen 窗口

---

## 🛠️ 开发脚本

### 可用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式（watch） |
| `npm run build` | 完整构建（类型检查 + 压缩） |
| `npm run build:quick` | 快速构建（无类型检查） |
| `node version-bump.js [patch\|minor\|major]` | 更新版本号 |
| `npm run release` | 构建发布包 |

### 版本管理

更新版本号:

```bash
# 补丁版本 (1.0.0 → 1.0.1)
node version-bump.js patch

# 次要版本 (1.0.0 → 1.1.0)
node version-bump.js minor

# 主要版本 (1.0.0 → 2.0.0)
node version-bump.js major
```

---

## 📁 项目结构

```
docwen-obsidian/
├── src/                 # 📁 源代码目录
│   ├── main.ts          # 插件主逻辑
│   ├── settings.ts      # 设置页面
│   ├── i18n.ts          # 国际化模块
│   └── utils/           # 工具模块
│       └── suggest-modal.ts # 选择器弹窗
├── dist/                # 🔨 构建输出目录
│   └── main.js          # 编译后的代码
├── docs/                # 文档
│   └── plugin-readme/    # 用户文档（多语言）
├── scripts/             # 📜 构建脚本
│   ├── build.bat        # Windows 一键构建
│   ├── build.js         # 跨平台构建脚本
│   └── README.md        # 脚本使用说明
├── release/             # 📦 发布产物
├── .vscode/             # 🛠️ 编辑器配置
│   └── settings.json    # VS Code 设置
├── manifest.json        # 插件清单
├── package.json         # 项目配置
├── tsconfig.json        # TypeScript 配置
├── eslint.config.cjs    # ESLint 配置
├── .gitignore          # Git 忽略文件
├── version-bump.js     # 版本管理脚本
├── README.md           # 英文文档
└── README_zh-CN.md     # 本文档（中文）
```

---

## 🐛 故障排查

### 插件无法加载

1. 检查是否正确复制了 `main.js` 和 `manifest.json`
2. 在 Obsidian 中点击 `重新加载插件`
3. 查看开发者控制台 (`Ctrl/Cmd + Shift + I`) 中的错误信息

### 无法启动 DocWen

1. 检查可执行文件路径是否正确
2. 确认路径状态显示为绿色 ✓
3. 确认可执行文件有执行权限

### 文件路径未传递

1. 确认当前有打开的文件
2. 检查文件路径是否包含特殊字符
3. 查看控制台日志确认传递的参数

---

## 📜 许可证

本项目使用 MIT 许可证。

### 联系方式

- **GitHub**: https://github.com/ZHYX91/docwen-obsidian
- **DocWen 主项目**: https://github.com/ZHYX91/docwen
- **联系作者**: zhengyx91@hotmail.com

---

**作者**: ZhengYX

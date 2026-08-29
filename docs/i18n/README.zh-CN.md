# DocWen Assistant

[English](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/README.md) · [简体中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-CN.md) · [繁體中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-TW.md) · [Deutsch](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.de-DE.md) · [Français](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.fr-FR.md) · [Русский](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ru-RU.md) · [Português](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.pt-BR.md) · [日本語](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ja-JP.md) · [Español](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.es-ES.md) · [한국어](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ko-KR.md) · [Tiếng Việt](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.vi-VN.md)

DocWen Assistant 将 Obsidian 连接到本机 [DocWen](https://github.com/ZHYX91/docwen)，提供转换、校对、标题编号和文件打开能力。需要 Windows、Obsidian 1.12.7 或更高版本，以及 DocWen 0.9.x 稳定版。

> **必须安装 DocWen 本体。** 推荐从 [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97) 安装兼容的 DocWen 0.9.x，也可以从 [DocWen Releases](https://github.com/ZHYX91/docwen/releases) 下载并完整解压 ZIP 便携版。

## 截图

以下截图展示了打包后的插件与本机 DocWen 在桌面版 Obsidian 中运行的界面。

### 校对侧边栏

按行或规则检查问题，并跳转到对应源码范围，不改写笔记。

![DocWen 校对侧边栏](../assets/docwen-assistant-proofread-en.png)

### 顶部页签设置与 DocWen 连接

通过五个顶部页签自动连接 Microsoft Store 安装版、按需配置便携版，并调整转换与校对。

![DocWen Assistant 顶部页签设置](../assets/docwen-assistant-settings-en.png)

### 按能力选择导出

选择当前可用的转换路径和明确的输出位置，同时保持源笔记不变。

![DocWen Assistant 按能力选择导出](../assets/docwen-assistant-export-en.png)

## 功能

- 在 DocWen 中打开当前文件或激活 DocWen 窗口；
- 导出 Word、Excel、Markdown，并明确选择输出文件；
- 添加或删除 Markdown 标题序号；
- 在 Obsidian 侧边栏校对 Markdown；
- 检查本机 DocWen 连接，并使用文件右键菜单命令。

## 使用要求与兼容性

- 需要 Windows 和 Obsidian 1.12.7 或更高版本，插件仅支持桌面端；
- 需要 Microsoft Store 安装版或完整解压的 ZIP 便携版 DocWen 0.9.x，插件不会自动下载 DocWen；
- 插件要求 `docwen.machine.v1` 和 `docwen.artifact_bundle.v2`；DocWen 版本不兼容时会停止并提示，不会降级使用其他协议。

插件默认通过系统注册的 `docwen.exe` 执行别名自动连接，因此 Microsoft Store 更新不会导致保存的程序路径失效。ZIP 便携版用户可以切换到“手动安装”，再选择解压后的 DocWen 文件夹、`DocWen.exe` 或 `DocWenCLI.exe`。插件不会扫描 `WindowsApps`、递归搜索程序、写命令文件、自动下载软件或降级到旧协议。

## 安装

### 安装 DocWen 与插件

1. 从 [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97) 安装兼容的 DocWen 0.9.x；也可以从 [DocWen Releases](https://github.com/ZHYX91/docwen/releases) 下载 `DocWen-windows-x64.zip` 并完整解压；
2. 从 Obsidian 第三方插件市场安装 DocWen Assistant。手动安装时，从 [DocWen Assistant Releases](https://github.com/ZHYX91/obsidian-docwen-assistant/releases) 下载 `docwen-assistant-x.y.z.zip`，将其中的 `main.js`、`manifest.json` 和 `styles.css` 复制到 `<Vault>/.obsidian/plugins/docwen-assistant/`；
3. 重新加载第三方插件并启用 DocWen Assistant；
4. 自动检测模式无需选择任何文件。使用 ZIP 便携版时，打开 **设置 → DocWen Assistant → 常规**，选择“手动安装”，再选择解压后的 DocWen 文件夹。

### 安装安全边界

发布包只包含 `main.js`、`manifest.json` 和 `styles.css`，不会包含、覆盖或删除 `data.json`。请保留 `data.json`，只替换三个运行时文件。固定的 `manifest.id` 是 `docwen-assistant`，由此固定已安装插件身份和设置文件位置。只有明确希望清空全部插件偏好时才删除 `data.json`。

## 使用

可以通过侧边栏图标、文件列表的 **DocWen** 子菜单或命令面板执行以下操作：

- 启动 DocWen，或使用当前文件启动；
- 后台导出 Word、Excel 或 Markdown，并明确选择输出文件；
- 添加或删除 Markdown 标题序号；
- 在 Obsidian 侧边栏校对当前 Markdown；
- 检查 DocWen 连接。

后台导出始终要求选择输出文件；只有原生保存对话框确认目标后，才会覆盖已有输出。

## 设置

- Obsidian 1.12.7 或更高版本使用五个可横向滚动的顶部页签：常规、转为 Markdown、转为 Word、校对和使用方法；
- 五个顶部页签使用同一套设置定义和数据模型；
- 插件语言默认“跟随 Obsidian”，也可明确选择 11 种语言之一；界面、通知和资源查询始终使用同一解析结果；
- “连接方式”默认“自动检测”，直接支持 Microsoft Store 安装版；切换到“手动安装”后才显示便携版文件夹选择器。状态行会核验产品身份、版本、协议和程序健康状态，不向普通用户暴露包路径；
- 页签支持方向键（含 RTL）、Home/End、清晰的键盘焦点、20 px 界面字号和粗指针点击区；仅在显示相应页签时查询运行时编号方案。

## 限制

- 仅支持 Windows 桌面端，并要求本机存在兼容的 DocWen；
- 自动模式只使用固定的 `docwen.exe` 注册别名；手动模式只接受用户选择的 DocWen 文件夹、`DocWen.exe` 或 `DocWenCLI.exe`，两种模式都不会搜索任意目录；
- 后台导出必须明确选择输出文件，校对不会直接重写源笔记；
- 无法安全核验 CLI 响应、源快照、编辑器状态或目标时，操作会被拒绝。

## 隐私与安全

插件会把当前编辑器（包括未保存正文）或 Vault 文件复制成隔离快照再交给本机 DocWen。它仅为启动系统注册的 DocWen 执行别名或用户手动选择的便携版程序、管理隔离的临时输入和已验证产物，以及写入用户明确选择的输出路径而访问 Vault 外部文件；不会打开或保存版本化的 Microsoft Store 包路径。转换会把经过验证的首选输出提交到用户确认的目标，并以安全名称把经过验证的关联资源提交到同一目录。校对只读；编号先生成隔离输出，确认文件、视图和原快照未变化后，才通过 Obsidian Editor 或 Vault API 一次提交。插件不会上传文档或为 DocWen 枚举整个 Vault。完整协议见[Machine 集成契约](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/cli-integration.md)。

CLI 边界使用 JSON-RPC 2.0 和规范的 `Content-Length` framing。所有输入均固定大小与 SHA-256，所有 Artifact Bundle 在原子提交前都要校验图、路径、大小和哈希；调用具有超时、任务取消、输出上限和子进程清理。

## 开发

使用 Node.js 24.19.0 和 npm 11.17.0。

```bash
npm ci
npm run check
npm run release
```

运行时代码位于 `src/`，DocWen 边界位于 `src/docwen/`，测试位于 `tests/`；生成的 `dist/` 和 `release/` 文件不是源代码。

稳定文档：[产品需求](../product-requirements.zh-CN.md) · [交互规范](../ux-spec.zh-CN.md) · [架构](../architecture.zh-CN.md) · [测试策略](../testing-strategy.zh-CN.md) · [发布流程](../release.zh-CN.md)

仓库治理：[变更日志](../../CHANGELOG.md) · [贡献指南](../../CONTRIBUTING.md) · [安全策略](../../SECURITY.md)

## 支持

- 工作流想法和一般反馈请发布到 [General](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/general)；
- 使用和配置问题请发布到 [Q&A](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/q-a)；
- 可复现的 Obsidian 集成缺陷和明确的功能建议请使用结构化的 [DocWen Assistant Issue 表单](https://github.com/ZHYX91/obsidian-docwen-assistant/issues/new/choose)；
- Obsidian 之外的转换、OCR、校对或 CLI 行为请提交到 [DocWen Core Issues](https://github.com/ZHYX91/docwen/issues)；
- 安全漏洞请按照仓库的[安全策略](https://github.com/ZHYX91/obsidian-docwen-assistant/security/policy)私密报告。

公开发布前请移除私密文档内容、文件和 Vault 路径、CLI 日志、可执行文件位置及凭据。

## 许可证

MIT © ZhengYX

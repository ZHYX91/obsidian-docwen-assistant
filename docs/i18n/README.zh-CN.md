# DocWen Assistant

[English](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/README.md) · [简体中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-CN.md) · [繁體中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-TW.md) · [Deutsch](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.de-DE.md) · [Français](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.fr-FR.md) · [Русский](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ru-RU.md) · [Português](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.pt-BR.md) · [日本語](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ja-JP.md) · [Español](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.es-ES.md) · [한국어](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ko-KR.md) · [Tiếng Việt](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.vi-VN.md) · [العربية](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ar.md)

在 Obsidian 里就能用 DocWen 转换文件、校对 Markdown、给标题编号，不用每次切到另一个程序。实际处理由你电脑上安装的 [DocWen](https://github.com/ZHYX91/docwen) 完成；插件负责把 Obsidian 和它连接起来。

> **必须安装 DocWen 本体。** 推荐从 [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97) 安装兼容的 DocWen 0.17.0 或更高版本，也可以从 [DocWen Releases](https://github.com/ZHYX91/docwen/releases) 下载并完整解压 ZIP 便携版。

## 截图

以下是日常最常用的三个界面。

### 校对侧边栏

查看校对发现的问题，并跳回笔记中的对应位置。校对不会修改原文。

![DocWen 校对侧边栏](../assets/docwen-assistant-proofread-en.png)

### 顶部页签设置与 DocWen 连接

在四个设置页签里检查 DocWen 连接、选择导出方式和校对规则。

![DocWen Assistant 顶部页签设置](../assets/docwen-assistant-settings-en.png)

### 按能力选择导出

选择文件要导出的格式和保存位置。原始笔记不会被转换结果覆盖。

![DocWen Assistant 按能力选择导出](../assets/docwen-assistant-export-en.png)

## 功能

- 在 DocWen 中打开当前文件或激活 DocWen 窗口；
- 导出 Word、Excel、Markdown，并明确选择输出目录；
- 添加或删除 Markdown 标题序号；
- 在 Obsidian 侧边栏校对 Markdown；
- 检查本机 DocWen 连接，并使用文件右键菜单命令。

## 使用要求与兼容性

- 需要 Windows 或 Linux 上的 Obsidian 桌面版 1.12.7 或更高版本；移动版不支持；
- 需要另行安装兼容的 DocWen 0.17.0 或更高版本。Windows 可以使用 Microsoft Store 或便携版；Linux 要手动选择安装位置，结果目录导出要求 x64 和支持安全写入的文件系统。插件不会代你下载安装 DocWen；
- 导出、校对和编号需要 DocWen 支持 Machine Protocol v2 和 Artifact Bundle v3。如果版本不兼容，插件会提示你更新，不会尝试不安全的旧接口。
- 即使后台转换接口不兼容，仍可尝试单独打开 DocWen 桌面程序。

Windows 商店安装版不满足以上要求时，请使用兼容的便携包并在“手动安装”中选择；Linux 始终使用“手动安装”。

自动检测只用于 Windows 的 Microsoft Store 安装版。手动模式可以选择解压后的 DocWen 文件夹，或直接选择程序文件：Windows 支持 `DocWen.exe`、`DocWenCLI.exe`，Linux 支持 `DocWen`、`DocWenCLI`。插件不会在硬盘上到处搜索程序，也不会自动下载软件。

## 安装

### 安装 DocWen 与插件

1. Windows 可从 [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97) 安装兼容的 DocWen 0.17.0 或更高版本，也可从 [DocWen Releases](https://github.com/ZHYX91/docwen/releases) 下载并完整解压 Windows 便携包；Linux x64 请从同一 Releases 页面下载并完整解压兼容的 Linux 包；
2. 从 Obsidian 第三方插件市场安装 DocWen Assistant。手动安装时，从 [DocWen Assistant Releases](https://github.com/ZHYX91/obsidian-docwen-assistant/releases) 下载 `docwen-assistant-x.y.z.zip`，将其中的 `main.js`、`manifest.json` 和 `styles.css` 复制到 `<Vault>/.obsidian/plugins/docwen-assistant/`；
3. 重新加载第三方插件并启用 DocWen Assistant；
4. Windows 自动检测无需选择文件；Windows 便携版和所有 Linux 用户都应打开 **设置 → DocWen Assistant → 常规**，选择“手动安装”，再选择解压后的 DocWen 文件夹或可执行文件。

### 安装安全边界

升级时只替换 `main.js`、`manifest.json` 和 `styles.css`。**不要删除 `data.json`**，它保存了插件设置。只有确实想重置所有偏好时才删除它。插件文件夹的名称应保持为 `docwen-assistant`。

## 使用

可以通过侧边栏图标、文件列表的 **DocWen** 子菜单或命令面板执行以下操作：

- 启动 DocWen，或使用当前文件启动；
- 后台导出 Word、Excel 或 Markdown，并明确选择输出目录；
- 添加或删除 Markdown 标题序号；
- 在 Obsidian 侧边栏校对当前 Markdown；
- 检查 DocWen 连接。

导出时先选择保存目录。每次转换都会生成独立的结果文件夹，图片等关联文件也保存在其中，不会直接覆盖已有结果。

导出 Word 会另存为 DOCX，不会改写原笔记。Word 转回 Markdown 时不要求保留原始 Markdown，但格式、空格或标记的写法可能有变化；建议检查转换结果。


## 设置

如果笔记用了 Structural Tables 的合并表格、Number Suite 的题注或交叉引用、七至九级标题或带类型的尾注，导出 Word 前请到 **DocWen → 设置 → Markdown 语法** 开启对应的**输入扩展**，或使用输入方向的**使用 Obsidian 扩展**预设。新安装 DocWen 时这些可选扩展默认关闭；如果还要将 Word 转回扩展 Markdown，需要开启相应的**输出扩展**。Word 中的编号按 DocWen 导出选项生成，不直接复制 Number Suite 的纯显示编号；请检查输出的表格与引用。

- 设置分为四页：常规、转为 Markdown、转为 Word、校对。页签可横向滚动，相关说明就在每页中；
- 界面语言默认“跟随 Obsidian”，也可以手动选择 12 种语言，包括阿拉伯语。阿拉伯语设置界面使用从右到左布局；
- Windows 的 Microsoft Store 版可以自动检测；Linux 和 Windows 便携版需要手动选择安装位置。连接状态会告诉你 DocWen 是否可用以及是否需要更新；
- 你可以用方向键及 Home/End 切换设置页签；触摸屏也提供足够大的点击区域。

## 限制

- 只支持 Windows 与 Linux 桌面版 Obsidian，并需要本机安装兼容的 DocWen。Linux 结果目录导出要求 x64；无法安全保存结果的文件系统会直接报错，不会冒险覆盖原有文件；
- Windows 自动模式使用系统注册的 `docwen.exe`；手动模式由你选择具体文件夹或程序，插件不会搜索其他目录；
- 后台导出必须明确选择输出目录，校对不会直接重写源笔记；
- 如果文件在处理过程中发生变化，或者插件无法确认结果是否安全，操作会停止并提示你检查。

## 隐私与安全

**文件留在你的电脑上。** 插件把当前笔记（包括尚未保存的编辑内容）或已保存的文件交给本机 DocWen 处理，不会上传到在线转换服务，也不会遍历整个 Vault 寻找无关文件。只有笔记明确引用的图片等资源才会按需要一并处理。校对不会修改笔记；编号修改前会检查笔记是否仍是开始处理时的版本。输出仅写入你选择的目录。更详细的实现边界见[集成技术文档](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/cli-integration.md)。

转换和打开程序使用不同的本机接口。插件会检查输入、结果和错误状态；如果无法确认写入是否成功，不会自动重复写入，避免生成重复文件或误覆盖。

## 开发

使用 Node.js 24.19.0 和 npm 11.17.0。

```bash
npm ci
npm run check
npm run release
```

运行时代码位于 `src/`，DocWen 边界位于 `src/docwen/`，测试位于 `tests/`；生成的 `dist/` 和 `release/` 文件不是源代码。

稳定文档：[产品需求](../product-requirements.zh-CN.md) · [交互规范](../ux-spec.zh-CN.md) · [架构](../architecture.zh-CN.md) · [测试策略](../testing-strategy.zh-CN.md)

仓库治理：[变更日志](../../CHANGELOG.md) · [贡献指南](../../CONTRIBUTING.md) · [安全策略](../../SECURITY.md)

## 支持

- [Q&A](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/q-a)：使用和配置问题。
- [Ideas](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/ideas)：尚待讨论的功能与工作流想法。
- [Show and tell](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/show-and-tell)：技巧、工作流和参考实现。
- 可复现的 Obsidian 集成缺陷和明确的功能建议请使用结构化的 [DocWen Assistant Issue 表单](https://github.com/ZHYX91/obsidian-docwen-assistant/issues/new/choose)；
- Obsidian 之外的转换、OCR、校对或 CLI 行为请提交到 [DocWen Core Issues](https://github.com/ZHYX91/docwen/issues)；
- 安全漏洞请按照仓库的[安全策略](https://github.com/ZHYX91/obsidian-docwen-assistant/security/policy)私密报告。

公开发布前请移除私密文档内容、文件和 Vault 路径、CLI 日志、可执行文件位置及凭据。

## 许可证

MIT © ZhengYX

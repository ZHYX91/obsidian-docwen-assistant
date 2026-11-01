# DocWen Assistant

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md)

在 Obsidian 里就能用 DocWen 转换文件、校对 Markdown、给标题编号，不用每次切到另一个程序。实际处理由你电脑上安装的 [DocWen](https://github.com/ZHYX91/docwen) 完成；插件负责把 Obsidian 和它连接起来。

> **必须安装 DocWen 本体。** 推荐从 [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97) 安装兼容的 DocWen 0.17.0 或更高版本，也可以从 [DocWen Releases](https://github.com/ZHYX91/docwen/releases) 下载并完整解压 ZIP 便携版。

界面语言改变 Assistant 自身的文案和布局，已打开的校对报告也会立即更新。转换语言、模板与 OCR 由任务选项和 DocWen 设置控制。

## 截图

桌面界面示例。校对示例使用合成笔记。

### 校对侧边栏

查看校对发现的问题，并跳回笔记中的对应位置。校对不会修改原文。

![DocWen 校对侧边栏](../assets/docwen-assistant-proofread-en.png)

### 设置与 DocWen 连接

在四个设置页签中检查 DocWen 连接，选择转换和校对选项。

![DocWen Assistant 顶部页签设置](../assets/docwen-assistant-settings-en.png)

### 导出文件

选择输出格式，核对本次配置，再将结果保存到指定位置。

![DocWen Assistant 导出文件](../assets/docwen-assistant-export-en.png)

## 功能

- 在 DocWen 中打开当前文件或激活 DocWen 窗口；
- 导出 Word、Excel、Markdown，并明确选择输出目录；
- 添加或删除 Markdown 标题序号；
- 在 Obsidian 侧边栏校对 Markdown；
- 检查本机 DocWen 连接，并使用文件右键菜单命令。

## 使用要求与兼容性

- 需要 Windows 或 Linux 上的 Obsidian 桌面版 1.12.7 或更高版本；移动版不支持；
- 需要另行安装兼容的 DocWen 0.17.0 或更高版本。Windows 可以使用 Microsoft Store 或便携版；Linux 要手动选择安装位置，结果目录导出要求 x64 和支持安全写入的文件系统。插件不会代你下载安装 DocWen；
- 导出、校对和编号需要 DocWen 支持 Machine Protocol v2 和 Artifact Bundle v3。如果版本不兼容，插件会提示你更新，请按提示更新后重试。
- 即使后台转换接口不兼容，仍可尝试单独打开 DocWen 桌面程序。

Windows 商店安装版不满足以上要求时，请使用兼容的便携包，在插件设置中手动选择解压目录。Linux 也需要手动选择安装位置。

自动检测只用于 Windows 的 Microsoft Store 安装版。手动模式可以选择解压后的 DocWen 文件夹，或直接选择程序文件：Windows 支持 `DocWen.exe`、`DocWenCLI.exe`，Linux 支持 `DocWen`、`DocWenCLI`。插件不会在硬盘上到处搜索程序，也不会自动下载软件。

## 安装

### 安装 DocWen 与插件

1. Windows 可从 [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97) 安装兼容的 DocWen 0.17.0 或更高版本，也可从 [DocWen Releases](https://github.com/ZHYX91/docwen/releases) 下载并完整解压 Windows 便携包。Linux x64 请从同一页面下载并解压 Linux 包。
2. 从 Obsidian 第三方插件市场安装 DocWen Assistant。手动安装时，从[插件发布页](https://github.com/ZHYX91/obsidian-docwen-assistant/releases)下载 `docwen-assistant-x.y.z.zip`，将 `main.js`、`manifest.json`、`styles.css` 复制到 `<Vault>/.obsidian/plugins/docwen-assistant/`。
3. 重新加载第三方插件并启用 DocWen Assistant。
4. Windows 商店版可自动检测。Windows 便携版和 Linux 用户请打开 **设置 → DocWen Assistant → 常规**，将连接方式设为**手动选择安装位置**，再选择解压后的文件夹或可执行文件。

### 升级时保留设置

手动升级时只替换 `main.js`、`manifest.json` 和 `styles.css`。保留 `data.json` 才能保留设置；只有想重置设置时才删除它。插件文件夹名称保持为 `docwen-assistant`。

## 使用

**先看当前文件支持什么操作。** 导出命令会根据文件内容和本机 DocWen 提供的能力决定是否出现；导出在选定目录保存独立输出，校对不会修改笔记。**添加／删除标题编号会修改 Markdown 原文**，提交前核对当前编辑器或已保存文件的内容；同一路径存在无法唯一确定的多个编辑器时会停止，不会猜测使用哪一个。

可以通过侧边栏图标、文件列表的 **DocWen** 子菜单或命令面板执行以下操作：

- “启动 DocWen”打开或激活程序；“使用当前文件启动 DocWen”还会打开当前文件；
- 后台导出 Word、Excel 或 Markdown，并明确选择输出目录；
- 添加或删除 Markdown 标题序号；
- 在 Obsidian 侧边栏校对当前 Markdown；
- 检查 DocWen 连接。

若出现模板或转换预设选择，先完成选择，再指定输出目录。核对源文件、格式、保存位置和本次选项后，点击**导出**。确认框使用本次任务已取得的设置，取消不会开始转换。DocWen 返回单个 DOCX 或 XLSX 时，直接保存在所选目录；Markdown 和组合输出仍使用独立结果文件夹，保留图片与附件。完成后，可在通知中点击**打开结果文件夹**。已有输出文件和结果文件夹都不会被覆盖；“打开结果文件夹”会打开输出所在目录。

## 设置

导出 Word 前，请在 **DocWen → 设置 → Markdown 语法**开启需要的**输入扩展**。新安装时这些扩展默认关闭，也可使用输入方向的**使用 Obsidian 扩展**预设。

| 笔记内容或操作 | DocWen 中的对应设置 |
| --- | --- |
| Structural Tables 合并单元格 | Structural Tables 输入扩展 |
| Number Suite 题注与交叉引用 | 题注与交叉引用输入扩展 |
| H7–H9 标题／带类型的尾注 | 相应的标题／尾注输入扩展 |
| Word 转回扩展 Markdown | 相应的输出扩展 |

即使没有安装 Number Suite，Word 导出也能读取 Markdown 中的相应语法。导出文档的编号按 DocWen 选项生成，不直接复制 Number Suite 的纯显示编号。独立的“添加／删除标题编号”命令会修改源笔记，导出不会。

**各项目会改动什么**

| 项目与用法 | 显示、源文修改与输出 |
| --- | --- |
| [DocWen (Core)](https://github.com/ZHYX91/docwen/blob/main/docs/user-guides/README.zh-CN.md) | 生成转换后的文件。输入扩展解释源文语法，导出设置控制输出及其编号。 |
| [DocWen Assistant](../product-requirements.zh-CN.md) | 导出保存独立输出，校对只读；明确执行标题编号操作时会修改源 Markdown。 |
| [Chrono Notes](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/docs/i18n/README.zh-CN.md) | 日历和任务视图读取索引。勾选任务或调整日期会更新源 Markdown，创建操作会新增笔记。 |
| [Property Order](https://github.com/ZHYX91/obsidian-property-order/blob/main/docs/i18n/README.zh-CN.md) | 候选设置改变菜单。重排或移动值会修改相关 YAML 列表，也可能把非文本值转成字符串。 |
| [Link Integrity](https://github.com/ZHYX91/obsidian-link-integrity/blob/main/docs/i18n/README.zh-CN.md) | 规则筛选分析结果，或改变参与分析的图连接；不会重写笔记中的链接。 |
| [Folder Nodes](https://github.com/ZHYX91/obsidian-folder-nodes/blob/main/docs/i18n/README.zh-CN.md) | 视图显示节点结构。创建、移动、重命名、合并和删除操作会改动笔记、文件夹或结构属性。 |
| [Number Suite](https://github.com/ZHYX91/obsidian-number-suite/blob/main/docs/i18n/README.zh-CN.md) | 虚拟编号改变显示。单篇笔记的设置会保存属性；写入、移除或重新编号会修改标题文本。 |
| [Structural Tables](https://github.com/ZHYX91/obsidian-structural-tables/blob/main/docs/i18n/README.zh-CN.md) | 查看表格和外观示例不修改笔记。编辑表格会写入 Markdown，转换为 Base 会创建记录文件。 |

- 设置分为四页：常规、转为 Markdown、转为 Word、校对。页签可横向滚动，相关说明就在每页中；
- 界面语言默认“跟随 Obsidian”，也可以在“常规”页手动选择；
- Windows 的 Microsoft Store 版可以自动检测；Linux 和 Windows 便携版需要手动选择安装位置。连接状态会告诉你 DocWen 是否可用以及是否需要更新；
- 你可以用方向键及 Home/End 切换设置页签；触摸屏也提供足够大的点击区域。

## 限制

- 只支持 Windows 与 Linux 桌面版 Obsidian，并需要本机安装兼容的 DocWen。Linux 结果目录导出要求 x64；无法安全保存结果的文件系统会直接报错，不会冒险覆盖原有文件；
- Windows 自动模式使用系统注册的 `docwen.exe`；手动模式由你选择具体文件夹或程序，插件不会搜索其他目录；
- 后台导出必须明确选择输出目录，校对不会直接重写源笔记；
- 如果文件在处理过程中发生变化，或者插件无法确认结果是否安全，操作会停止并提示你检查。

Word 往返转换有保真范围：能转换回受支持的可见内容，但不能把它当作 Markdown 原文的精确备份。未支持的语法、嵌入笔记展开和部分版式可能无法保留；请保留源笔记，并检查转回的文档。

## 隐私与安全

文件留在你的电脑上。插件将所选文件的临时副本交给本机 DocWen；如果该笔记有唯一对应的编辑器，也会包含未保存的正文。只按需处理笔记明确引用的图片，不会遍历 Vault 搜索无关文件，也不会上传文档。

导出写入你选择的目录，校对不修改笔记。标题编号只有在原笔记仍位于原路径且正文未变时才写回；处理中若重命名或替换了笔记，请在当前笔记上重新执行。插件设置不保存商店包的安装路径。开发者可参阅[集成说明](../cli-integration.md)。

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

在 Obsidian 内需要帮助时，打开 **常规 → 帮助**，选择 **使用指南** 或 **报告问题**。

- [Q&A](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/q-a)：使用和配置问题。
- [Ideas](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/ideas)：尚待讨论的功能与工作流想法。
- [Show and tell](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/show-and-tell)：技巧、工作流和参考实现。
- 可复现的 Obsidian 集成缺陷和明确的功能建议请使用结构化的 [DocWen Assistant Issue 表单](https://github.com/ZHYX91/obsidian-docwen-assistant/issues/new/choose)；
- Obsidian 之外的转换、OCR、校对或 CLI 行为请提交到 [DocWen Core Issues](https://github.com/ZHYX91/docwen/issues)；
- 安全漏洞请按照仓库的[安全策略](https://github.com/ZHYX91/obsidian-docwen-assistant/security/policy)私密报告。

公开发布前请移除私密文档内容、文件和 Vault 路径、CLI 日志、可执行文件位置及凭据。

## 许可证

MIT © ZhengYX

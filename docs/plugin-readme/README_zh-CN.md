[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md) | [Español](README_es-ES.md) | [한국어](README_ko-KR.md) | [Tiếng Việt](README_vi-VN.md)

# DocWen Assistant

用于启动 DocWen 转换器的 Obsidian 插件。

## 安装方法

1. 将此文件夹复制到 Obsidian 库的 `.obsidian/plugins/` 目录下
2. 在 Obsidian 设置中重新加载插件
3. 启用「DocWen Assistant」插件
4. 在插件设置中配置 `DocWen.exe` 或 `DocWenCLI.exe` 路径（二选一即可）

## 使用方法

- 点击左侧栏的文档图标启动 DocWen
- 使用命令面板 (Ctrl/Cmd + P) 搜索「DocWen」
- 如果当前有打开的文件，会自动传递文件路径给 DocWen

### 后台导出（需要 DocWenCLI.exe）

- “后台导出为 Word（Docx）” — 对 `.md`/`.markdown`/`.txt` 文件，选择一个模板
- “后台导出为 Excel（XLSX）” — 对 `.md`/`.markdown`/`.txt` 文件，选择一个模板
- “后台导出为 Markdown（MD）” — 若有可用优化类型则选择一个（也可跳过不选）

### 标题序号（需要 DocWenCLI.exe）

- “为 Markdown 标题添加序号” — 选择一个序号方案
- “清理 Markdown 标题序号”

仅对 `.md` 文件可用。

### 诊断（需要 DocWenCLI.exe）

- “DocWen doctor 自检” — 检查环境与依赖

## 包含文件

- `main.js` - 插件核心代码
- `manifest.json` - 插件清单
- `styles.css` - 样式文件（如有）
- `README*.md` - 说明文档

更多信息请查看插件设置页面。

## 链接

- 插件仓库：https://github.com/ZHYX91/docwen-obsidian
- DocWen 仓库：https://github.com/ZHYX91/docwen

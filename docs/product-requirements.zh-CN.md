---
source_language: zh-CN
translation_status: source
---

# DocWen Assistant — 产品需求

[English synced translation](product-requirements.en.md)

## 产品定位

DocWen Assistant 是 Windows 桌面端 Obsidian 插件，将当前笔记或用户明确选择的 Vault 文件连接到本机 DocWen。它面向希望在 Obsidian 中启动 DocWen、转换文档、管理单文件标题编号和查看校对建议的用户。

## 兼容性前提

插件要求 Windows、Obsidian 1.12.7 或更高版本，以及 Microsoft Store 安装版或完整解压的 ZIP 便携版稳定 DocWen 0.9.x。插件只接受 `docwen.machine.v1` 和 `docwen.artifact_bundle.v2`；其他 Bundle schema 与不兼容的进程信封均失败关闭。

## 核心能力

- 启动或激活 DocWen，并可打开当前文件；
- 根据文件检查和 Machine capability 提供 Word、Excel、Markdown 导出；
- 为一个 Markdown 文件添加或删除标题编号；
- 在只读侧栏展示 Markdown 校对结果；
- 检查 DocWen 连接，并在安装、协议、健康状态或能力不可用时给出失败状态。

## 数据与写入边界

插件只为用户选择的文件创建隔离快照：优先读取按路径唯一匹配的已打开 Markdown 编辑器内容（包括后台分栏中的未保存正文），文件关闭时才读取 Vault；同一路径打开多个编辑器则失败关闭。插件不为 DocWen 枚举整个 Vault，也不上传文档。Markdown 转 DOCX 时，只解析该笔记 metadata cache 中明确出现的图片嵌入，把 Obsidian 已确定的文件内容封装为中性资源；缺失、过大或不支持的图片失败关闭。导出目标必须由用户明确选择；校对不改写源笔记；独立编号操作只在源快照和目标身份仍一致时，通过 Obsidian Editor 或 Vault API 一次提交。CLI 不直接写 Vault 路径。

## 失败语义

无法验证已注册的 DocWen 别名或手动位置、Machine 响应、输入快照、Artifact Bundle、编辑器状态或目标身份时，操作必须失败关闭。能力查询失败不能伪装成“支持能力为空”，已有输出不能在未经确认时静默覆盖。

## 非目标

插件不自动下载 DocWen，不检查带版本的 Microsoft Store 包路径，不递归寻找可执行文件，不支持移动端，不提供其他进程协议，不把当前 Vault 当成批量扫描目录，也不定义跨文件组合编号。MD→DOCX 不提供源标题编号控制；需要修改源 Markdown 标题编号时使用独立编号动作。同一 Markdown 内没有开始、停止或重置编号的特殊语法；嵌入文件保留其自身真实编号；插件不增加编号或 OCR 专用 YAML 字段。

## 验收边界

源码测试、固定 DocWen 包测试、真实最低 Obsidian 1.12.7 与当前 1.13.x 宿主验收、Windows 人工检查和公开发布是不同证据层。任一较低层通过都不能替代其后的候选或宿主证据。

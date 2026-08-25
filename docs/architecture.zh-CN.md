---
source_language: zh-CN
translation_status: source
---

# DocWen Assistant 架构

[English synced translation](architecture.en.md)

## 分层

`src/main.ts` 只负责插件组合与生命周期。`src/actions/` 编排用户操作，`src/docwen/` 拥有路径、Machine 协议与 Artifact Bundle 边界，`src/host/` 封装 Obsidian、Electron 与文件系统，`src/runtime/` 管理并发与释放。顶部页签设置界面使用一个共享页面模型，且不依赖兄弟仓库。本地化使用一个共享模型。

## DocWen 进程边界

用户选择 DocWen 文件夹、`DocWen.exe` 或 `DocWenCLI.exe` 后，路径解析只接受同目录的精确 `DocWenCLI.exe`。每次操作以 `shell: false` 启动 `serve --stdio`，使用规范 `Content-Length` framing 和 JSON-RPC 2.0，并验证 Machine v1、服务身份和稳定 0.9.x 产品版本。

## 请求数据流

动作先从按路径唯一匹配的已打开 Markdown 编辑器（包括后台分栏）取得隔离快照；不存在该编辑器时才读取 Vault 文件，同一路径同时打开多个编辑器则失败关闭。随后生成具备类型、媒体类型、规范逻辑路径、大小与 SHA-256 的输入 handle。检查和 capability 决定是否支持动作；plan 与 execute 使用同一能力和输入事实，不能从扩展名或 route id 推断支持。

Markdown 转 DOCX 时，原始快照只用于检查、校对和冲突验证。Assistant 通过 Obsidian metadata cache 解析该笔记明确写出的图片嵌入，支持 PNG、JPEG、GIF、BMP 与 WebP；短 Wiki 链接、跨目录链接和带空格文件名都遵循 Obsidian 自己的解析结果。Assistant 不枚举 Vault，也不扫描同名文件。它把每个出现位置、原始 token、媒体类型、字节、大小和 SHA-256 封装进 `resolved_document`。同时，它认证 DocWen 的完整 1 至 9 级标题清单，并在中性的 `numbering_export_plan` 中把这些标题显式标为未启用编号；这不会猜测或增加编号。DocWen 不读取 Vault，也不二次寻找图片。

## 产物与提交

DocWen 只写请求拥有的 staging 目录。Assistant 只接受并校验 Artifact Bundle v2，其他 Bundle schema 一律失败关闭；校验覆盖 Bundle 身份、布局、逻辑路径、图、角色、关系、物理路径、普通文件、大小和哈希。首选产物映射到用户确认的目标，相关资源使用安全名称；提交使用独占创建、无覆盖链接、备份与回滚，不让 CLI 直接接触 Vault 目标。

## Vault 写入

校对只读取报告。编号在隔离文件中生成，并由 `VaultWriteTransaction` 比对原快照及按路径唯一匹配的 Markdown leaf、view 与编辑器状态；只有全部仍一致时才经 Editor 或 Vault API 一次提交。出现第二个匹配 view、打开/关闭状态切换、插件卸载、视图关闭或冲突都会取消或拒绝写入。

## 生命周期与资源

任务具有超时、协议帧与队列上限、stderr 上限和显式取消。任务接收后取消会发送 `task/cancel`，必要时终止插件拥有的进程树。运行时 disposer、操作协调器和设置保存队列在卸载时必须停止观察者、释放视图并等待或终止拥有的工作。

## 信任边界

Obsidian 文档、用户路径、Machine 消息、staging 文件和 GitHub 发布资产都属于需验证输入。产品不信任扩展名、相对路径、软链接、现有目标、未经绑定的诊断或仅在 UI 中显示的版本文本。

## 从属协议合同

[Machine integration contract](cli-integration.md) 冻结具体方法、capability、限制与 Bundle 消费规则。本架构文档说明组件所有权；若两者变更，必须在同一变更中保持一致。

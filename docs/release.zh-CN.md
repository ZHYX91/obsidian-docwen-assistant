---
source_language: zh-CN
translation_status: source
---

# DocWen Assistant — 发布流程

[English synced translation](release.en.md)

本文定义 DocWen Assistant 的可重复发布流程。源码检查、Candidate Bundle、真实 Obsidian
验收、GitHub 发布和正式 Vault 部署是独立边界。

## 边界

获授权的稳定版本 tag push 触发发布。也可在同一 tag 上手动派发，选择只验证或发布，两种入口共用工作流。宿主验收可选；发布不会部署到 Vault。

## 版本与源码

`manifest.json`、`package.json`、`package-lock.json` 和 `versions.json` 必须绑定同一规范
`x.y.z` 版本、Obsidian `1.12.7` 最低版本与精确 commit/tree。干净工作树必须通过
确定性、离线的 `npm run release:check`。只读 DocWen 0.10.x package compatibility preflight
保留为独立外部状态门禁，并在临近发布时重新执行。

## Candidate Bundle v3

vendored release-core `3.0.1` 和薄 adapter 创建唯一 Candidate Bundle v3。Bundle 包含
`main.js`、`manifest.json`、`styles.css`、`docwen-assistant-x.y.z.zip`、`SHA256SUMS` 与
`candidate-bundle.json`，并绑定源码、工具链、core/config/workflow、产品 payload、场景合同与
fixture 哈希。ZIP 不包含文档或 `data.json`。

## 可选产品验收

DocWen Assistant 是 desktop-only；可使用同一 Bundle 开展桌面验收，覆盖四个 imperative settings
tab、能力发现、校对、转换、校验、编号、取消、未保存缓冲区与并发目标冲突。外部 DocWen
package 验收与插件宿主验收分别记录，不能互相替代。

## 独立工作流

tag push 与手动派发共用构建、发布和发布后验证任务。只读构建任务生成并验证 Bundle；发布任务下载同一固定资产，不重复构建，在写入前验证事件、tag、提交和 Bundle 摘要。手动 verify 模式不执行发布。

## 发布与核验

源码和传输验证通过 `--verify-tag` 核对精确发布标签。

Actions 为四个公开资产生成 SLSA 构建证明。发布器核对其源码、tag 和工作流，创建草稿，下载并检查全部草稿资产，然后正式发布 immutable Release。独立任务再检查已发布资产。公开附件仅为三个松散文件和版本 ZIP；Bundle 元数据保留在 CI artifact 中。GitHub 发布结果与 Community Directory 审核结果分别记录。

## 失败、回退与部署

既有同 tag Release 只有在元数据、四个资产字节与 provenance 完全一致时才是零写 no-op；
任何差异都失败，修复必须使用新版本。正式 Vault 部署需要对精确 Vault 单独授权，保留
`data.json`，并且不得把 package、宿主或 Community Plugins 状态混成一个结论。

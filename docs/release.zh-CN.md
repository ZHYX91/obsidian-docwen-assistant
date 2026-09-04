---
source_language: zh-CN
translation_status: source
---

# DocWen Assistant — 发布流程

[English synced translation](release.en.md)

本文定义 DocWen Assistant 的可重复发布流程。源码检查、Candidate Bundle、真实 Obsidian
验收、GitHub 发布和正式 Vault 部署是独立边界。

## 边界

普通 tag push 不触发发布。commit、push、tag、workflow dispatch、GitHub Release 和正式 Vault
部署必须分别授权；本地门禁不会产生远端写入。

## 版本与源码

`manifest.json`、`package.json`、`package-lock.json` 和 `versions.json` 必须绑定同一规范
`x.y.z` 版本、Obsidian `1.12.7` 最低版本与精确 commit/tree。干净工作树必须通过
确定性、离线的 `npm run release:check`。只读 DocWen 0.9.x package compatibility preflight
保留为独立外部状态门禁，并在临近发布时重新执行。

## Candidate Bundle v3

vendored release-core `2.0.0` 和薄 adapter 创建唯一 Candidate Bundle v3。Bundle 包含
`main.js`、`manifest.json`、`styles.css`、`docwen-assistant-x.y.z.zip`、`SHA256SUMS` 与
`candidate-bundle.json`，并绑定源码、工具链、core/config/workflow、产品 payload、场景合同与
fixture 哈希。ZIP 不包含文档或 `data.json`。

## 产品验收

DocWen Assistant 是 desktop-only；同一 Bundle 必须完成桌面验收，覆盖四个 imperative settings
tab、能力发现、校对、转换、校验、编号、取消、未保存缓冲区与并发目标冲突。外部 DocWen
package 验收与插件宿主验收分别记录，不能互相替代。

## 独立工作流

生成并签入的 standalone workflow 只接受显式 `workflow_dispatch`。只读 verify job 在精确
commit 上执行一次独立安装与一次完整 `release:check`，重建并 source-verify Bundle；publish
job 下载固定 artifact 后只做 transport verification，不恢复 `dist`。

## 发布与核验

acceptance closure 不授权发布；单独 authorization 必须绑定同一 Bundle 与 closure。首次写入
前 workflow 深度校验两份记录、执行 `--verify-tag` 等价门禁和只读 preflight。公共 Release
恰好包含三个 loose assets 与版本 ZIP；`SHA256SUMS` 和 `candidate-bundle.json` 仅在私有
Bundle 中。发布后回读托管字节与 provenance。

## 失败、回退与部署

既有同 tag Release 只有在元数据、四个资产字节与 provenance 完全一致时才是零写 no-op；
任何差异都失败，修复必须使用新版本。正式 Vault 部署需要对精确 Vault 单独授权，保留
`data.json`，并且不得把 package、宿主或 Community Plugins 状态混成一个结论。

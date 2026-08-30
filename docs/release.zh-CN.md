---
source_language: zh-CN
translation_status: source
---

# DocWen Assistant — 发布流程

[English synced translation](release.en.md)

## 版本身份

`manifest.json`、`package.json`、`package-lock.json` 和 `versions.json` 必须对同一规范 `x.y.z` 版本与最低 Obsidian 版本达成一致。tag 不带 `v` 前缀，指向精确的已验收提交，并可从默认分支到达。tag 只是身份绑定之一，既不触发也不授权发布。

## 工具链与源门

Node 版本由 `.node-version` 单一声明，npm 版本由 `package.json#packageManager` 单一声明。`npm ci` 后，`npm run check` 执行完整离线源码门与规范验证，但不要求本地 tag 存在；`npm run release:check` 再为真实候选增加 absent-or-exact tag 策略。发布文档不复制 npm pin，避免第二权威。

## 候选构建

锁定并 vendored 的 release core 生成确定性、无路径且无时间戳的候选，并绑定精确 commit、tree、插件身份、版本、core 版本与运行时哈希。handoff 包含四个公共资产（`main.js`、`manifest.json`、`styles.css` 和版本化 ZIP）、排序后的 `SHA256SUMS` 与 `candidate.json`；隔离重建必须得到同一候选摘要。校验清单与候选 metadata 不作为公共 Release 资产。安装 ZIP 只含前三个运行时文件，文档与 `data.json` 不进入发布包。

## 安装边界

安装时只替换 `main.js`、`manifest.json` 与 `styles.css`。发布包绝不包含、覆盖或删除 `data.json`。`manifest.id` 固定为 `docwen-assistant`，由此固定已安装插件身份与设置文件位置。

## 只读预检

手动 workflow dispatch 默认使用 `verify`。只读 job 验证精确 tagged commit、完整仓库门、规范候选摘要与不可变的公开 DocWen 0.9.x 包兼容性 hook，不创建 Release；随后上传一个固定候选 artifact，并记录其 artifact ID 与服务端摘要。

## 发布边界

只有 mode 明确为 `publish` 的 dispatch 才能进入具备写权限的 job。该 job 不持久化 checkout 凭据，下载固定 artifact ID，解码可移植 acceptance closure 与 authorization，验证两者的精确 SHA-256 与交叉绑定，并运行只读 core publication boundary。任何远端写入前，`publication-preflight` 先读取 GitHub 状态：Release 不存在才允许暂存、签发 provenance 和创建；既有 Release 只有字节与 provenance 全部精确通过时才作为零写入安全重跑；任何冲突都在这些写入前失败。`publish-github` 在以 `--verify-tag` 创建精确不可变 Release 前重复边界和既有状态检查；不得从 tag 或验收通过推断人工授权。

## 发布后验证

独立的只读 job 使用同一固定候选回读最终 GitHub Release，要求稳定、非 draft、非 prerelease、不可变状态和精确资产集合。远端下载字节必须与候选一致，每个资产的 attestation 必须绑定同一仓库、workflow、ref、commit 与 GitHub-hosted runner 策略。

## 外部门槛

Immutable Releases、禁止更新或删除数字版本 tag 的 ruleset、受保护的 `release` environment，以及所需 GitHub 权限，都是仓库源码之外的发布前提。Community Plugins 审核和真实用户升级仍是独立外部证据；只有不可变托管状态与精确资产完成核验后，才能报告发布完成。

## 故障与恢复

候选、closure、authorization、tag、DocWen 依赖、artifact 身份或托管状态任一不一致时必须停止，不得 clobber、edit 或重新上传同 tag 资产。发布失败不会授权删除用户 `data.json` 或修改 Vault。

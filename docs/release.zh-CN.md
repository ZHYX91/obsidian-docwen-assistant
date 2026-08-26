---
source_language: zh-CN
translation_status: source
---

# DocWen Assistant — 发布流程

[English synced translation](release.en.md)

## 版本身份

`manifest.json`、`package.json`、`package-lock.json` 和 `versions.json` 必须对同一规范 `x.y.z` 版本与最低 Obsidian 版本达成一致。tag 不带 `v` 前缀，并必须指向默认分支上的精确发布提交；源码版本或 tag 本身不证明 GitHub Release 存在。

## 工具链与源门

Node 版本由 `.node-version` 单一声明，npm 版本由 `package.json#packageManager` 单一声明。`npm ci` 后运行 `npm run release:check`；该入口必须先运行完整 `check`，再执行只读发布版本验证。发布文档不复制 npm pin，避免第二权威。

## 候选构建

两个独立 clean Ubuntu runner 从同一提交生成候选，并逐字节比较。发布 handoff 包含一份绑定候选与来源的 metadata、四个公共资产（`main.js`、`manifest.json`、`styles.css` 和版本化 ZIP）以及仅用于内部交接校验的 `SHA256SUMS`；公共 Release 不上传校验清单。安装 ZIP 只含前三个运行时文件，文档与 `data.json` 不进入发布包。

## 安装边界

安装时只替换 `main.js`、`manifest.json` 与 `styles.css`。发布包绝不包含、覆盖或删除 `data.json`。`manifest.id` 固定为 `docwen-assistant`，由此固定已安装插件身份与设置文件位置。

## 只读预检

手动 workflow dispatch 只执行版本、源祖先、双构建、候选、DocWen 依赖和发布状态验证，不创建 tag 或 Release。验证 job 只持有 read 权限并运行仓库 `release:check`，然后把一个固定候选与其摘要交给发布边界。

## 发布边界

只有 numeric tag push 才能进入 publish job。该 job 不 checkout 源码，只读取本次验证 job 的固定 handoff；它重新验证 tag、候选摘要、handoff 中由只读验证阶段固定的 DocWen 0.9.x 身份，以及 Release 不存在状态，再为资产生成 provenance 并以 `--verify-tag` 创建 Release。

## 发布后验证

工作流必须有限重试地读取最终 GitHub Release，要求稳定、非 draft、非 prerelease、不可变状态和精确资产集合。远端下载字节必须与候选一致，每个资产的 attestation 必须绑定同一仓库、workflow、ref 和 commit。

## 外部门槛

Immutable Releases 与所需 GitHub 权限是仓库源码之外的发布前提。仓库 ruleset 和 tag 保护只是可选的纵深防御，不是发布门槛。Community Plugins 审核和真实用户升级仍是独立外部证据；只有不可变托管状态与精确资产完成核验后，才能报告发布完成。

## 故障与恢复

同一 tag 已存在不同资产、候选不一致、DocWen 依赖不可信或远端状态漂移时必须停止，不得 clobber、edit 或重新上传同 tag 资产。发布失败不会授权删除用户 `data.json` 或修改 Vault。

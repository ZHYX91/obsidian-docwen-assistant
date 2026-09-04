---
source_language: zh-CN
translation_status: source
---

# DocWen Assistant — 测试策略

[English synced translation](testing-strategy.en.md)

## 原则

测试按可声明的证据层分开。源码单元测试、模拟进程集成、固定 DocWen 包、真实 Obsidian 宿主、人工 Office 检查和公开发布状态不能互相替代；跳过项与外部门槛必须保留为未证明。

## 源码自动测试

Vitest 覆盖固定 LOCALAPPDATA 执行别名、PATH 相对启动目标拒绝、手动路径启动目标、连接取消与去重、旧能力结果抑制、预加载去重与重试、连接状态迁移与展示、framing、Machine 进程、取消、Bundle v2 校验与其他 schema 拒绝、能力投影、动作、Vault 快照与事务、设置、本地化、运行时释放和发布治理。设置用例证明规范化纯净且幂等、无版本数据只迁移一次、默认值各自拥有独立副本，以及遇到更高版本 schema 时启动和后续均零写入、未知字段保持完整、四页签界面明确只读。资源测试必须覆盖跨目录短 Wiki 链接、带空格文件名、重复出现去重、UTF-16 到 Unicode 码点坐标转换、缺失/不支持/超限资源，以及 `neutral_document + numbering_export_plan` 精确双输入。负例应证明错误发生在任务规划或写入之前，并验证失败后的资源清理。

## 仓库质量门

`npm run check` 在锁定工具链下运行运行时检查、lint、格式、README 与稳定文档合同、覆盖率、类型检查、构建、制品检查和高风险依赖审计。格式与双语脚本必须实际读取仓库内容，不能是无操作占位符。

## 固定 DocWen 包

`npm run acceptance:docwen-package` 只接受绑定版本、Candidate Bundle v3 身份和哈希的完整 DocWen Windows 包。它验证 Machine 健康、能力、v4 精确双输入、DocWen 1 至 9 级标题、两种当前脚注写法与当前尾注写法、Obsidian 已解析的嵌入资源、Unicode/空格路径、实际 DOCX 图片字节、`docwen.document_node.v1` 清单与 DocWen Bundle v2 写入边界；没有精确候选身份时应跳过或失败关闭，不能转称为源码通过。

## Obsidian 宿主

真实宿主验收分别覆盖最低 Obsidian 1.12.7 与当前 1.13.x 的顶部页签界面，并各自使用全新隔离 Vault/profile。应检查默认与第三方主题、16/20 px 界面字号、中英文标签、窄布局、键盘与 RTL 导航、保存失败恢复、入口、侧栏取消、文件菜单、进程零残留和 `data.json` 保留。自动 DOM 测试不能替代这些观察结果。

## 人工兼容矩阵

Windows 人工检查需要覆盖 Microsoft Store 安装、别名禁用与启用、Store 升级、卸载恢复、便携版回退、DocWen GUI 激活、原生保存对话框、Word/Excel/Markdown 输出、编号冲突和可见校对。若依赖 Office 或真实文档呈现，应单独记录应用版本、样本、候选哈希与人工结论。

## 安全夹具

测试只使用合成文件、临时目录和专用 Vault。禁止把普通或生产 Vault 当成测试目标；不得删除、覆盖或重建真实 `data.json`。日志与失败夹具必须脱敏路径、正文、可执行文件位置和凭据。

## 发布证据

精确 Candidate Bundle v3 摘要、一次隔离确定性 CI 重建、候选 ZIP、`SHA256SUMS`、可移植 acceptance closure、显式 authorization、tag 绑定、attestation、不可变 GitHub Release 与远端字节回读是彼此分离的发布证据；tag 本身绝不是执行或发布信号。source verification 绑定源码与 `dist`，下载后的 transport verification 只绑定 Bundle 字节。adapter、工作流源码与失败路径测试只证明合同存在，不证明该提交已在 GitHub 上成功执行或已进入 Community Plugins。

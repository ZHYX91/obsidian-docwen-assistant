---
source_language: zh-CN
translation_status: source
---

# DocWen Assistant — 测试策略

[English synced translation](testing-strategy.en.md)

## 原则

测试按可声明的证据层分开。源码单元测试、模拟进程集成、固定 DocWen 包、真实 Obsidian 宿主、人工 Office 检查和公开发布状态不能互相替代；跳过项与外部门槛必须保留为未证明。

## 源码自动测试

Vitest 覆盖固定 LOCALAPPDATA 执行别名、PATH 相对启动目标拒绝、手动路径启动目标、独立 `gui open` 控制进程及其 CLI protocol 3 成功信封、连接取消与去重、两侧 Machine 协议/最低产品版本诊断、旧能力结果抑制、预加载去重与重试、连接状态迁移与展示、framing、Machine 进程、取消、Bundle v3 校验与其他 schema 拒绝、能力投影、动作、Vault 快照与事务、设置、本地化、运行时释放和发布治理。直接 Markdown 校对必须固定为 `validate.markdown` 与 `docwen.proofread_report.v2`，并明确证明它不经过 Markdown→DOCX 后处理链。设置用例证明规范化纯净且幂等、无版本数据只迁移一次、默认值各自拥有独立副本，以及遇到更高版本 schema 时启动和后续均零写入、未知字段保持完整、四页签界面明确只读。资源测试必须覆盖跨目录短 Wiki 链接、带空格文件名、重复出现去重、UTF-16 到 Unicode 码点坐标转换、缺失/不支持/超限资源，以及 `neutral_document + numbering_export_plan` 精确双输入。负例应证明错误发生在任务规划或写入之前，并验证失败后的资源清理。 Machine 生命周期回归还必须使用真实受控 POSIX 子进程，在 query、task/execute 与已接收任务的 task/cancel 写入前关闭读取端，证明不会产生未处理的 EPIPE、等待者会在有界时间内结束、不会生成额外 staging 输出，并清理拥有的进程组及后代。 Windows 专用 CI 另外使用真实受控进程与原生关闭 stdin 夹具，覆盖直接 root 正常退出但独立 stdio 后代继续存活的旧反例，以及 timeout、已接收任务取消、插件卸载、真实 EPIPE、抵抗正常结束的后代、无关 sentinel 保活和 owner 创建/内嵌 PE 身份失败时在目标启动前失败关闭；这些进程级证据仍不替代 Obsidian 宿主验收。结果目录发布测试在最后一次碰撞检查与实际发布原语之间设置确定性屏障，让外部写者分别创建空目录和含用户字节的非空目录；两种情况都必须拒绝、保留目标目录身份与用户字节，并只清理自己的暂存目录。Linux x64 Node-API helper 的公开来源、C 源 SHA-256、内嵌二进制 SHA-256 与 Node-API 下限也由源码测试固定。

校对生命周期和视图状态测试使用每例独立的 happy-dom 文档，只通过小型适配器模拟 Obsidian 的 DOM 扩展方法。测试触发 DOM 点击并验证真实属性、节点连接、当前焦点和滚动状态，不再依赖创建元素时记录的参数。集成用例一起运行真实插件的 saveSettings、ProofreadView 和 OperationCoordinator，覆盖初始空状态、同一任务取消、语言切换、外部焦点与视图关闭后重开。大报告用例以 10,000 个问题验证首次 DOM 有界，分批访问所有问题，并检查键盘焦点、滚动、排序、RTL 本地化、新报告重置及旧控件失效。原有来源摘要和视图归属用例继续保留。DOM 夹具不代表浏览器布局或真实宿主验收。

格式检测动作回归使用完整的最小 DOCX 夹具、真实 Vault 快照与 capability 输入形状检查，覆盖错扩展名的取消和继续、双向 source kind 变化、检测/路线信息陈旧、规范副本复检不匹配、取消，以及发布前的来源身份和内容冲突。这些单元用例模拟 Machine 检测和转换。固定包门另运行真实导出动作、快照、client 和精确 Core 进程，将完整 DOCX 复制为 `.txt`：继续后必须产出含预期段落和表格的 Markdown，取消不得创建规范副本或输出，确认或复核时来源内容改变、复核时文件身份替换均须阻止发布；原夹具及应保持不变的来源字节另行核验。固定包层仍模拟 UI 对话框，不能替代真实宿主验收。

源码回归另覆盖最后一次读取后的关闭文件 stat/modify 事件、两个资源扫描器与声明输入 builder 的 raw HTML 字面内容所有权及真实外部资源身份（含容器边界、目的地址／标题中的反引号、行内注释、引用式图片与图片标签中的代码）、正式 health `status/reason`、精确记录 MSVC 选择，以及合法 67 帧进度流的逐字节、逐帧、随机和合并 stdout 分块。Linux x64/arm64 原生 CI 独立重建内嵌 owner 两次，并覆盖 setsid/double-fork 后代、root 退出/崩溃、两层 supervisor 各自崩溃，以及 outer owner 死亡时尚未 exec 的停止子进程。真实进程状态、心跳停止和无关 sentinel 存活共同证明清理；仅 PID 存在不足以证明。源码负控证明未知架构在 image 写入或 spawn 前拒绝；native adapter 覆盖正常完成、中止、释放、真实 EPIPE 与 owner 未确认后禁止重试，已退役的 JavaScript procfs／进程组路径没有生产入口。受控原生测试不建立真实 Obsidian、Gateway 或 Mermaid 渲染验收结论。

## 仓库质量门

`npm run check` 在锁定工具链下运行运行时检查、lint、格式、README 与稳定文档合同、覆盖率、类型检查、构建、制品检查和高风险依赖审计。格式与双语脚本必须实际读取仓库内容，不能是无操作占位符。 制品检查还会核对 Linux helper 锁定的来源、源码/二进制摘要，并要求构建后的 `dist/main.js` 保留完全相同的内嵌 payload；这只能证明 payload 已进入 bundle，不能证明它已在 Electron/Obsidian 中成功加载。

## 固定 DocWen 包

`npm run acceptance:docwen-package` 只接受绑定版本、Candidate Bundle v3 身份和哈希的完整 DocWen 0.17.0 或更高 Windows 包。它验证 Machine 健康、能力、v4 精确双输入、DocWen 1 至 9 级标题、两种当前脚注写法与当前尾注写法、Obsidian 已解析的嵌入资源、Unicode/空格路径、实际 DOCX 图片字节、完整 `docwen.document_node.v1` 目录发布、无需节点 JSON 的发布与关联图片不计入业务输出数量、同一父目录连续导出与 DocWen Bundle v3 写入边界；没有精确候选身份时应跳过或失败关闭，不能转称为源码通过。

## Obsidian 宿主

真实宿主验收分别覆盖最低 Obsidian 1.12.7 与当前 1.13.x 的顶部页签界面，并各自使用全新隔离 Vault/profile。应检查默认与第三方主题、16/20 px 界面字号、中英文标签、窄布局、键盘与 RTL 导航、保存失败恢复、入口、侧栏取消、文件菜单、进程零残留和 `data.json` 保留。自动 DOM 测试不能替代这些观察结果。

## 人工兼容矩阵

Windows 人工检查需要覆盖 Microsoft Store 安装、别名禁用与启用、Store 升级、卸载恢复、便携版回退、DocWen GUI 激活、原生目录选择对话框、Word/Excel/Markdown 输出、编号冲突和可见校对。Linux x64 人工检查另行覆盖手动包选择、Machine/GUI 控制和真实结果目录导出；Ubuntu 源码 CI 对 Node-API helper 与 no-replace 竞态的通过不能替代真实 Obsidian Linux 宿主验收。若依赖 Office 或真实文档呈现，应单独记录应用版本、样本、候选哈希与人工结论。

## 安全夹具

测试只使用合成文件、临时目录和专用 Vault。禁止把普通或生产 Vault 当成测试目标；不得删除、覆盖或重建真实 `data.json`。日志与失败夹具必须脱敏路径、正文、可执行文件位置和凭据。

## 发布证据

精确 Candidate Bundle v3 摘要、一次隔离确定性 CI 重建、候选 ZIP、`SHA256SUMS`、可选产品证据、事件绑定的 authorization、tag 绑定、attestation、不可变 GitHub Release 与远端字节回读是彼此分离的发布证据；获授权的稳定版本 tag push 触发经过验证的发布工作流。source verification 绑定源码与 `dist`，下载后的 transport verification 只绑定 Bundle 字节。adapter、工作流源码与失败路径测试只证明合同存在，不证明该提交已在 GitHub 上成功执行或已进入 Community Plugins。

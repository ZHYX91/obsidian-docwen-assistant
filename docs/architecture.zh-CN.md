---
source_language: zh-CN
translation_status: source
---

# DocWen Assistant — 架构

[English synced translation](architecture.en.md)

## 分层

`src/main.ts` 只负责插件组合与生命周期。`src/actions/` 编排用户操作，`src/docwen/` 拥有路径、Machine 协议与 Artifact Bundle 边界，`src/host/` 封装 Obsidian、Electron 与文件系统，`src/runtime/` 管理并发与释放。顶部页签设置界面使用一个共享页面模型，且不依赖兄弟仓库。设置持久化使用 schema v1：无版本数据只规范化一次并形成拥有所有权的快照；显式 schema 无效或高于当前版本时只读打开，绝不回写。本地化使用一个共享模型。

## DocWen 进程边界

子进程在受限环境中继承平台资料目录变量，以及明确的 `DOCWEN_DATA_DIR`、`DOCWEN_CONFIG_DIR`、`DOCWEN_LOG_DIR` 和真值 `DOCWEN_LOG_TO_TEMP`。DATA 选择整份资料，CONFIG 与 LOG 分别覆盖各自组件。相对路径在启动子进程前按父进程工作目录解析；无关变量与凭据不传递。

Windows 自动模式从安全的临时工作目录直接启动固定的 `%LOCALAPPDATA%\\Microsoft\\WindowsApps\\docwen.exe` 执行别名；它不会通过 `PATH` 解析裸命令，也不发现或保存带版本的 Microsoft Store 包路径。手动模式在 Windows 把用户选择的 DocWen 文件夹、`DocWen.exe` 或 `DocWenCLI.exe` 解析为同目录的精确 CLI，在 Linux 把文件夹、`DocWen` 或 `DocWenCLI` 解析为精确 CLI；Linux 不使用自动别名发现。转换、校对、编号、能力发现和连接检查等内容操作以 `shell: false` 启动 `serve --stdio`，使用规范 `Content-Length` framing 和 JSON-RPC 2.0，并验证 DocWen 0.17.0 以上、Machine Protocol 2.0、Artifact Bundle v3 与服务身份；产物版本绑定同一会话，候选验收可另外固定精确产品版本。应用状态和“启动/打开 DocWen”走独立的本机 `gui status --json` 与 `gui open --json` 控制命令并校验 CLI protocol 3 成功信封，不先协商 Machine，因此后台协议不兼容不会阻止打开桌面应用。

## 请求数据流

优化选择通过 `optimization_id`、输入形状、输出媒体类型与可用性，把资源 ID 绑定到可执行的
`transform` 能力。`conversion-selection.ts` 按已准备的输入 handle 核验选定能力；动作把已发现能力
传入执行，不重复发现查询。优化不可用或存在歧义时不能退回普通转换。参数集合由选定能力定义，
完整预转换链则由 Core 在接受任务时再次核验。

动作先从按路径唯一匹配的已打开 Markdown 编辑器（包括后台分栏）取得隔离快照；不存在该编辑器时才读取 Vault 文件，同一路径同时打开多个编辑器则失败关闭。随后生成具备类型、媒体类型、规范逻辑路径、大小与 SHA-256 的输入 handle。检查和 capability 决定是否支持动作；plan 与 execute 使用同一能力和输入事实，不能从扩展名或 route id 推断支持。

Markdown 转 DOCX 时，Assistant 通过 source-native `convert.markdown_source.to_docx` Machine capability 发送精确的隔离 Markdown 快照。笔记中明确写出的图片嵌入由 Obsidian metadata cache 解析，并作为具有规范逻辑路径、媒体类型和已认证字节的 `linked_resource` 类型化输入复制到隔离工作区。普通本地 WikiLink 同样使用 Obsidian cache 的精确 UTF-16 源范围和解析结果；当前正文中的活动 WikiLink 若没有对应 cache 记录会失败关闭。已解析导航不会复制目标笔记，也不会暴露 Vault 绝对路径，而是绑定为 `obsidian://open` URI。短 Wiki 名称、跨目录链接和带空格文件名均遵循 Obsidian 自己的解析结果；Assistant 不枚举 Vault，也不要求 DocWen 按文件名搜索目标。capability 声明的 `markdown_resource_bindings` 选项将完整源 SHA-256、原始图片标记及可选普通 WikiLink 导航标记分别绑定到已声明资源逻辑路径或导航 URI；未声明此选项的旧 capability 无法接收这些映射。Wiki 图片与 Markdown 图片仍分别遵循各自的处理策略。Markdown 笔记嵌入展开仍不属于普通导航合同。

本次导出的编号由转换请求拥有，而不是由任何已安装的编辑插件拥有。Assistant 会随请求发送清理/保持选择、可选的编号方案 ID、标题序号渲染模式；Markdown 扩展开关使用 DocWen 的有效配置。DocWen 的 source-native consumer 直接从作者 Markdown 解释 Number Suite 题注/引用方言，并应用本次选择的 DocWen 编号策略。因此安装、停用或配置 Number Suite 都不能改变其他输入完全相同的 Assistant Word 导出结果。

provider-neutral 的 `resolved_document` + `numbering_export_plan` capability 仍作为独立的 exact-two 接口，供已经拥有完整已解析语义/编号计划的消费者使用。普通 Assistant Word 导出不使用 Number Suite `interop.v2` 的 `enabled`/`derivedNumber` 状态，也不走该 resolved-provider 路线。Number Suite 的 interop API 仍可供独立校验或其他消费者使用，但不是 Assistant 的转换 authority。在作者 Markdown、声明资源和显式 DocWen 转换参数相同的前提下，直接 DocWen 与 Assistant→DocWen 的可观察目标、编号、引用和往返声明必须一致。

## 产物与提交

DocWen 只写请求拥有的 staging 目录。Assistant 校验 Bundle v3 身份、图、逻辑路径、角色、关系、普通文件身份、大小与 SHA-256。转换要求 `docwen.document_node.v1`：在所选目录内准备完整逻辑目录，并以单次原子 no-replace 目录重命名发布；已有结果目录以及最终检查后由外部写者创建的空或非空目录都拒绝覆盖。Windows 使用系统目录重命名的 no-replace 行为；Linux x64 使用随 `main.js` 内嵌、运行时校验 SHA-256 与 Node-API 8 下限的最小 `renameat2(RENAME_NOREPLACE)` 边界，不增加新的插件运行时资产，也没有仓库间运行时依赖。Linux 不支持的架构、运行时、内核或文件系统在发布前失败关闭。普通转换无需节点 JSON，字节数、哈希与关系来自已校验的 Bundle。界面只列业务输出，绑定的布局清单和图片资源不计入输出数量。

source-native Markdown 转 DOCX 包含一个首选 DOCX 和一个 primary entry，大小与 SHA-256 保留在已验证的 Bundle 中；普通转换无需节点 JSON，不包含原文伴随文件。反向转换读取独立 DOCX。合法的无编号引用保留已解析目标，以空 cached_number 表达没有编号，显示 Alias 或当前标题。

`output-files` 负责文件发布和回滚，`output-directory` 负责完整结果目录，`operation-outcome` 限定每次操作只能尝试一次实际提交。宿主回调不能不提交就报告成功、重复提交，或让已经完成的发布进入回滚。备份、锁、任务 staging 和输入快照清理失败随结果返回结构化警告；清理对象身份变化时保留对象。提交前清理失败不能覆盖原始错误。

## Vault 写入

导出在转换前记录所选父目录身份。发布前再次核对父目录、源快照和准备好的文件字节，拒绝已存在的结果目录或该目录内打开的编辑器，并在原子 no-replace 重命名前检查取消状态。最终碰撞检查只用于尽早给出清晰错误；安全性不依赖检查与重命名之间没有外部写者。父目录中的其他文件或编辑器不阻止导出。

校对只读取报告。编号在隔离文件中生成，并由 `VaultWriteTransaction` 比对原快照及按路径唯一匹配的 Markdown leaf、view 与编辑器状态；只有全部仍一致时才经 Editor 或 Vault API 一次提交。出现第二个匹配 view、打开/关闭状态切换、插件卸载、视图关闭或冲突都会取消或拒绝写入。

编辑器缓冲区或 Vault API 确认预期内容后，保存调度失败或后续身份变化返回警告。宿主已接收内容但未确认写入时，结果明确为未确认，不自动重试；编辑器缓冲区确认不代表内容已经持久化到磁盘。

## 生命周期与资源

一次内容操作的文件识别、必要的能力发现、计划与执行共用一个已初始化 Machine 进程。准备阶段查询保留 30 秒响应期限，整个操作仍受十分钟预算约束。校验结束后关闭进程，不跨操作缓存进程；输入和发布完整性检查保留。

任务具有超时、协议帧与队列上限、stderr 上限和显式取消。Machine stdin Writable 的异步错误（包括对端关闭读取端后延迟出现的 `EPIPE`）进入同一会话失败队列，拒绝等待者并触发幂等、有界的进程树清理；`stdin.end()` 已发生后到达的取消不会再次写入已结束流。任务接收后取消会发送 `task/cancel`，必要时终止插件拥有的进程树。改变 DocWen 目标会取消活动工作，并按同一代际重置连接检查、能力投影、文件缓存和待完成预加载；失效请求不能恢复旧状态。运行时 disposer、操作协调器和设置保存队列在卸载时必须停止观察者、释放视图并等待或终止拥有的工作。

Windows Machine 生命周期由随 `main.js` 内嵌并在运行时验证 SHA-256 与 PE 身份的 x64 控制器拥有。控制器以 `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` 创建 Job，并通过 `PROC_THREAD_ATTRIBUTE_JOB_LIST` 在 `CreateProcessW` 创建挂起的 DocWen 进程时原子加入；直接 DocWen 进程先正常退出时，独立 stdio 的后代仍归同一 owner，并在控制器退出前收口。异常清理只终止当前持有的控制器进程，由 Job 句柄关闭提供终止 authority；不按历史 PID、进程名或普通用户进程扫描清理，也不回退到裸 `spawn`/`taskkill`。owner 物化或身份校验失败会在启动 DocWen 前失败关闭。Linux 继续使用既有 procfs 身份与进程组证据链。

导出和编号任务持续拥有选择窗口直至写入结束，选中条目不会启动脱离当前生命周期的任务。取消、新任务替换和卸载会关闭插件选择窗口及格式确认框，已排队的旧选择也失效。系统目录对话框可能保持打开直至用户关闭，但取消后返回的路径不会继续执行。文件菜单能力发现也由同一协调器管理，卸载后的菜单回调不能再调用操作。

宿主正常退出时，通过 Obsidian 公开的 `Workspace.quit` 任务收集器等待取消后的操作收尾。每项动作的 `finally` 完成前持续记录其收尾状态，包括已被替换或先前卸载时取消的任务。等待最多十秒，避免未返回的原生对话框或文件系统操作无限阻塞退出；超时写入日志。强制终止、未触发退出事件或断电不保证临时文件清理。

## 信任边界

Obsidian 文档、用户路径、Machine 消息、staging 文件和 GitHub 发布资产都属于需验证输入。产品不信任扩展名、相对路径、软链接、现有目标、未经绑定的诊断或仅在 UI 中显示的版本文本。候选构建与发布位于产品 runtime 之外：仓库 thin adapter 以精确版本和 SHA-256 锁定自包含 vendored core，验收与人工授权仍属于外部证据。公开仓库绝不导入父 workspace 或 sibling 路径。

## 从属协议合同

[Machine integration contract](cli-integration.md) 冻结具体方法、capability、限制与 Bundle 消费规则。本架构文档说明组件所有权；若两者变更，必须在同一变更中保持一致。

设置分别显示应用控制与后台集成状态。详情标明已加载清单和编译运行时的版本、初始化阶段、发送及接收协议与有界服务身份。取消 GUI 控制时等待自有 CLI 进程关闭，宽限期后只终止该进程，无法确认关闭则报告清理失败；不终止桌面应用。

# Obsidian 插件构建脚本

这是公文转换器 Obsidian 插件的一键构建脚本。

## 📦 脚本说明

### build.bat

**功能：**
- ✅ 自动检测并安装依赖包（仅首次或缺失时）
- ✅ 编译 TypeScript 代码为 JavaScript
- ✅ 创建发布文件夹 `release/docwen-assistant/`
- ✅ 复制必需文件（main.js, manifest.json）
- ✅ 复制用户文档（`docs/plugin-readme/README*.md`，多语言）
- ✅ 显示详细的构建进度和结果
- ✅ 可选：构建完成后打开输出文件夹

**特点：**
- 🚀 完整构建模式（类型检查 + 代码压缩）
- 🔍 智能依赖检测（仅需要时才安装）
- 📋 友好的中文提示信息
- ⚡ Windows 用户一键构建

## 🚀 使用方法

### 方式一：VSCode 中运行（推荐）

1. 在 VSCode 文件浏览器中找到 `build.bat`
2. 右键点击文件
3. 选择"在集成终端中运行"或"在终端中打开"
4. 等待构建完成

### 方式二：双击运行

1. 在文件管理器中找到 `build.bat`
2. 双击运行
3. 等待构建完成

## 📂 输出内容

构建完成后，会在以下位置生成插件文件：

```
obsidian-plugin/
└── release/
    └── docwen-assistant/
        ├── main.js          # 编译后的插件代码
        ├── manifest.json    # 插件清单
        └── README*.md       # 使用说明（多语言）
```

## 📥 安装到 Obsidian

构建完成后，按以下步骤安装插件：

1. **找到 Obsidian 插件目录**
   - 打开 Obsidian
   - 进入 `设置` → `第三方插件`
   - 点击"已安装插件"旁边的文件夹图标
   - 这会打开 `<你的 Vault>/.obsidian/plugins/` 目录

2. **复制插件文件夹**
   - 将 `release/docwen-assistant` 整个文件夹
   - 复制到上一步打开的 `plugins` 目录中

3. **启用插件**
   - 回到 Obsidian 设置页面
   - 点击"重新加载插件"按钮
   - 在插件列表中找到"公文转换器助手"
   - 点击开关启用它

4. **配置插件**
   - 进入插件设置页面
   - 配置可执行文件路径
   - 点击"浏览..."按钮或手动输入路径

## 🔧 构建过程详解

脚本执行的步骤：

```
[1/6] 检查依赖包
  └─ 检测 node_modules 是否存在
  └─ 如缺失则运行 npm install

[2/6] 清理旧的构建文件
  └─ 删除 dist/ 与 release/（如果存在）

[3/6] 编译 TypeScript
  └─ 运行 npm run build
  └─ 使用 esbuild 完整编译（类型检查 + 代码压缩）

[4/6] 准备发布目录
  └─ 清理并创建 release 文件夹

[5/6] 复制插件文件
  └─ 复制 main.js
  └─ 复制 manifest.json
  └─ 复制 styles.css（如果存在）

[6/6] 复制用户文档
  └─ 复制 docs/plugin-readme/README*.md 到输出目录
```

## ⚠️ 常见问题

### 问题：提示"npm 不是内部或外部命令"

**原因：** Node.js 未安装或未添加到系统 PATH

**解决方法：**
1. 访问 [Node.js 官网](https://nodejs.org/) 下载并安装 LTS 版本
2. 确保安装时勾选"Add to PATH"选项
3. 重启命令行或 VSCode

### 问题：依赖安装失败

**可能原因：**
- 网络连接问题
- npm 镜像源速度慢

**解决方法：**
```bash
# 切换到国内镜像源
npm config set registry https://registry.npmmirror.com

# 然后重新运行脚本
```

### 问题：编译失败

**检查步骤：**
1. 确保 TypeScript 代码没有语法错误
2. 确保 `package.json` 中的依赖已正确安装
3. 查看错误信息，确定具体问题

**手动编译测试：**
```bash
cd obsidian-plugin
npm run build:quick
```

### 问题：构建完成但找不到输出文件

**检查：**
1. 确认脚本运行时没有错误提示
2. 检查 `obsidian-plugin/release/` 目录
3. 如果还是找不到，尝试手动查看输出路径

## 💡 开发提示

### 快速开发流程

1. **首次设置**
   ```bash
   cd obsidian-plugin
   npm install
   ```

2. **日常开发**
   - 修改代码（main.ts, settings.ts）
   - 双击 `build.bat` 构建
   - 复制到 Obsidian 测试

3. **开发模式（可选）**
   ```bash
   npm run dev
   ```
   代码修改后自动重新编译

### 两种构建脚本对比

**build.bat（Windows）：**
- 完整构建（类型检查 + 代码压缩）
- 智能依赖检测
- 中文界面
- 双击即可运行

**build.js（跨平台）：**
- 完整构建（类型检查 + 代码压缩）
- 跨平台兼容（Windows/Mac/Linux）
- 需要命令行运行：`npm run release`

**两者功能相同，选择更方便的使用即可。**

## 📝 相关文件

- `../main.ts` - 插件主逻辑
- `../settings.ts` - 设置页面
- `../manifest.json` - 插件清单
- `../package.json` - 项目配置
- `./build.js` - Node.js 跨平台构建脚本（完整构建）
- `./build.bat` - Windows 批处理脚本（完整构建，更方便）

## 🆘 需要帮助？

如果遇到问题：
1. 检查上面的"常见问题"部分
2. 查看完整的错误信息
3. 确认 Node.js 和 npm 已正确安装
4. 确保在正确的目录下运行脚本

---

**提示：** 
- Windows 用户推荐使用 `build.bat`（双击运行）
- macOS/Linux 用户请使用 `npm run release` 或 `node scripts/build.js`
- 两个脚本功能完全相同，都是完整构建（类型检查 + 代码压缩）

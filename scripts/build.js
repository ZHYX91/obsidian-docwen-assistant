// 构建并打包插件用于发布
// 用法:
// - npm run release
// - 或: node scripts/build.js

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 切换到插件根目录
const pluginDir = path.join(__dirname, '..');
process.chdir(pluginDir);

console.log('🚀 开始构建插件...\n');
console.log(`工作目录: ${process.cwd()}\n`);

// 1. 清理旧的构建文件
console.log('📦 清理旧的构建文件...');
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true });
  console.log('  ✓ 已删除 dist 目录');
}
if (fs.existsSync('release')) {
  fs.rmSync('release', { recursive: true });
  console.log('  ✓ 已删除 release 目录');
}

// 2. 运行构建
console.log('\n🔨 编译 TypeScript...');
console.log('  使用完整构建模式（类型检查 + 代码压缩）');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('  ✓ 编译成功');
} catch (error) {
  console.error('  ✗ 编译失败');
  process.exit(1);
}

// 3. 检查必需文件
console.log('\n🔍 检查必需文件...');
const distMainJs = path.join('dist', 'main.js');
const manifestJson = 'manifest.json';

if (!fs.existsSync(distMainJs)) {
  console.error(`  ✗ 缺少文件: ${distMainJs}`);
  process.exit(1);
}
if (!fs.existsSync(manifestJson)) {
  console.error(`  ✗ 缺少文件: ${manifestJson}`);
  process.exit(1);
}
console.log('  ✓ 所有必需文件都存在');

// 4. 创建发布目录
console.log('\n📁 创建发布目录...');
const releaseDir = 'release';
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir);
}

// 读取版本号
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const pluginReleaseDir = path.join(releaseDir, manifest.id);

if (fs.existsSync(pluginReleaseDir)) {
  fs.rmSync(pluginReleaseDir, { recursive: true });
}
fs.mkdirSync(pluginReleaseDir, { recursive: true });

console.log(`  ✓ 创建目录: ${pluginReleaseDir}`);

// 5. 复制文件到发布目录
console.log('\n📋 复制文件...');

// 从 dist 目录复制 main.js
fs.copyFileSync(path.join('dist', 'main.js'), path.join(pluginReleaseDir, 'main.js'));
console.log(`  ✓ 已复制 main.js`);

// 从根目录复制 manifest.json
fs.copyFileSync('manifest.json', path.join(pluginReleaseDir, 'manifest.json'));
console.log(`  ✓ 已复制 manifest.json`);

// 如果存在 styles.css，也复制它
if (fs.existsSync('styles.css')) {
  fs.copyFileSync('styles.css', path.join(pluginReleaseDir, 'styles.css'));
  console.log(`  ✓ 已复制 styles.css`);
}

// 6. 复制用户版 README 文件（多语言）
console.log('\n📋 复制用户文档...');
const pluginReadmeDir = path.join(__dirname, '..', 'docs', 'plugin-readme');
if (fs.existsSync(pluginReadmeDir)) {
  const readmeFiles = fs.readdirSync(pluginReadmeDir).filter(f => f.startsWith('README') && f.endsWith('.md'));
  readmeFiles.forEach(file => {
    fs.copyFileSync(path.join(pluginReadmeDir, file), path.join(pluginReleaseDir, file));
    console.log(`  ✓ 已复制 ${file}`);
  });
} else {
  console.log('  ⚠ 未找到 docs/plugin-readme 目录，跳过 README 复制');
}

// 7. 显示总结
console.log('\n✨ 构建完成！\n');
console.log('发布文件位于:');
console.log(`  ${path.resolve(pluginReleaseDir)}\n`);
console.log('包含文件:');
fs.readdirSync(pluginReleaseDir).forEach(file => {
  const stats = fs.statSync(path.join(pluginReleaseDir, file));
  const size = (stats.size / 1024).toFixed(2);
  console.log(`  - ${file} (${size} KB)`);
});
console.log('\n下一步:');
console.log('  1. 将整个文件夹复制到 Obsidian vault 的 .obsidian/plugins/ 目录');
console.log('  2. 在 Obsidian 中重新加载插件');
console.log('  3. 启用并配置插件\n');

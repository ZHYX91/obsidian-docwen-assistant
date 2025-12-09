// 版本号自动更新脚本
// 用法: node version-bump.js [major|minor|patch]

const fs = require('fs');
const path = require('path');

// 读取当前版本号
const manifestPath = path.join(__dirname, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const currentVersion = manifest.version;
const versionParts = currentVersion.split('.').map(Number);

// 获取版本更新类型 (默认为 patch)
const updateType = process.argv[2] || 'patch';

// 更新版本号
if (updateType === 'major') {
  versionParts[0]++;
  versionParts[1] = 0;
  versionParts[2] = 0;
} else if (updateType === 'minor') {
  versionParts[1]++;
  versionParts[2] = 0;
} else {
  versionParts[2]++;
}

const newVersion = versionParts.join('.');

// 更新 manifest.json
manifest.version = newVersion;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

// 更新或创建 versions.json
const versionsPath = path.join(__dirname, 'versions.json');
let versions = {};

if (fs.existsSync(versionsPath)) {
  versions = JSON.parse(fs.readFileSync(versionsPath, 'utf8'));
}

versions[newVersion] = manifest.minAppVersion;
fs.writeFileSync(versionsPath, JSON.stringify(versions, null, 2));

console.log(`版本已从 ${currentVersion} 更新到 ${newVersion}`);

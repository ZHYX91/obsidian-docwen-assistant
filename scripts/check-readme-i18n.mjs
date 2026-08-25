import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = {
  repository: "ZHYX91/obsidian-docwen-assistant",
  repositoryLinks: [
    "docs/i18n/README.zh-CN.md",
    "docs/product-requirements.en.md",
    "docs/ux-spec.en.md",
    "docs/architecture.en.md",
    "docs/testing-strategy.en.md",
    "docs/release.en.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
  ],
  screenshots: [
    "docs/assets/docwen-assistant-proofread-en.png",
    "docs/assets/docwen-assistant-settings-en.png",
    "docs/assets/docwen-assistant-export-en.png",
  ],
  languages: [
    {
      label: "English",
      path: "README.md",
      sections: ["Screenshots", "Features", "Requirements and compatibility", "Installation", "Usage", "Settings", "Limitations", "Privacy and security", "Development", "Support", "License"],
    },
    {
      label: "简体中文",
      path: "docs/i18n/README.zh-CN.md",
      sections: ["功能", "使用要求与兼容性", "安装", "使用", "设置", "限制", "隐私与安全", "开发", "支持", "许可证"],
    },
    {
      label: "繁體中文",
      path: "docs/i18n/README.zh-TW.md",
      sections: ["功能", "使用要求與相容性", "安裝", "使用", "設定", "限制", "隱私與安全性", "開發", "支援", "授權"],
    },
    {
      label: "Deutsch",
      path: "docs/i18n/README.de-DE.md",
      sections: ["Funktionen", "Voraussetzungen und Kompatibilität", "Installation", "Verwendung", "Einstellungen", "Einschränkungen", "Datenschutz und Sicherheit", "Entwicklung", "Support", "Lizenz"],
    },
    {
      label: "Français",
      path: "docs/i18n/README.fr-FR.md",
      sections: ["Fonctionnalités", "Configuration requise et compatibilité", "Installation", "Utilisation", "Paramètres", "Limitations", "Confidentialité et sécurité", "Développement", "Assistance", "Licence"],
    },
    {
      label: "Русский",
      path: "docs/i18n/README.ru-RU.md",
      sections: ["Возможности", "Требования и совместимость", "Установка", "Использование", "Настройки", "Ограничения", "Конфиденциальность и безопасность", "Разработка", "Поддержка", "Лицензия"],
    },
    {
      label: "Português",
      path: "docs/i18n/README.pt-BR.md",
      sections: ["Recursos", "Requisitos e compatibilidade", "Instalação", "Uso", "Configurações", "Limitações", "Privacidade e segurança", "Desenvolvimento", "Suporte", "Licença"],
    },
    {
      label: "日本語",
      path: "docs/i18n/README.ja-JP.md",
      sections: ["機能", "要件と互換性", "インストール", "使用方法", "設定", "制限", "プライバシーとセキュリティ", "開発", "サポート", "ライセンス"],
    },
    {
      label: "Español",
      path: "docs/i18n/README.es-ES.md",
      sections: ["Funciones", "Requisitos y compatibilidad", "Instalación", "Uso", "Configuración", "Limitaciones", "Privacidad y seguridad", "Desarrollo", "Soporte", "Licencia"],
    },
    {
      label: "한국어",
      path: "docs/i18n/README.ko-KR.md",
      sections: ["기능", "요구 사항 및 호환성", "설치", "사용", "설정", "제한 사항", "개인정보 보호 및 보안", "개발", "지원", "라이선스"],
    },
    {
      label: "Tiếng Việt",
      path: "docs/i18n/README.vi-VN.md",
      sections: ["Tính năng", "Yêu cầu và khả năng tương thích", "Cài đặt", "Cách sử dụng", "Cài đặt plugin", "Giới hạn", "Quyền riêng tư và bảo mật", "Phát triển", "Hỗ trợ", "Giấy phép"],
    },
  ],
  packagedReadmeDir: null,
  requiredTokens: [
    "https://github.com/ZHYX91/docwen/releases",
    "https://github.com/ZHYX91/obsidian-docwen-assistant/releases",
    "`DocWen.exe`",
    "`DocWenCLI.exe`",
    "`main.js`",
    "`manifest.json`",
    "`styles.css`",
    "`data.json`",
  ],
  requiredLeadTokens: [
    "> **",
    "https://github.com/ZHYX91/docwen/releases",
  ],
};

const ignoredDirectories = new Set([
  ".git",
  "coverage",
  "dist",
  "node_modules",
  "release",
]);
const errors = [];
const normalizePath = (filePath) => filePath.split(path.sep).join("/");
const resolveProjectPath = (filePath) => path.resolve(projectRoot, filePath);

function readProjectJson(filePath) {
  return JSON.parse(readFileSync(resolveProjectPath(filePath), "utf8"));
}

function listReadmeFiles(directory) {
  try {
    return readdirSync(resolveProjectPath(directory), { withFileTypes: true })
      .filter((entry) => entry.isFile() && /^README.*\.md$/u.test(entry.name))
      .map((entry) => entry.name)
      .sort();
  } catch {
    errors.push(`Missing README directory: ${directory}`);
    return [];
  }
}

function compareFileSets(label, actualFiles, expectedFiles) {
  const actual = new Set(actualFiles);
  const expected = new Set(expectedFiles);

  for (const file of [...expected].sort()) {
    if (!actual.has(file)) {
      errors.push(`${label} is missing ${file}`);
    }
  }
  for (const file of [...actual].sort()) {
    if (!expected.has(file)) {
      errors.push(`${label} contains unexpected README file ${file}`);
    }
  }
}

function validateLocalLinks(filePath, source) {
  const repositoryTargets = new Set();
  for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
    const rawTarget = match[1].trim();
    if (/^(?:[a-z][a-z0-9+.-]*:|#)/iu.test(rawTarget)) {
      const repositoryPrefix = `https://github.com/${config.repository}/blob/main/`;
      if (rawTarget.startsWith(repositoryPrefix)) {
        const repositoryPath = rawTarget.slice(repositoryPrefix.length).split("#", 1)[0];
        repositoryTargets.add(repositoryPath);
        if (!existsSync(resolveProjectPath(repositoryPath))) {
          errors.push(`${filePath} contains a missing repository link: ${rawTarget}`);
        }
      }
      continue;
    }

    let target = rawTarget.replace(/^<|>$/gu, "").split("#", 1)[0].split("?", 1)[0];
    try {
      target = decodeURIComponent(target);
    } catch {
      errors.push(`${filePath} contains an invalid encoded link: ${rawTarget}`);
      continue;
    }
    if (!target) {
      continue;
    }

    const resolvedTarget = path.resolve(path.dirname(resolveProjectPath(filePath)), target);
    const relativeTarget = path.relative(projectRoot, resolvedTarget);
    if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
      errors.push(`${filePath} contains a local link outside the repository: ${rawTarget}`);
    } else if (!existsSync(resolvedTarget)) {
      errors.push(`${filePath} contains a missing local link: ${rawTarget}`);
    } else {
      repositoryTargets.add(normalizePath(relativeTarget));
    }
  }
  return repositoryTargets;
}

function validateReadme(language, title, navigation) {
  const { path: filePath, sections } = language;
  let source;
  try {
    source = readFileSync(resolveProjectPath(filePath), "utf8").replace(/^\uFEFF/u, "");
  } catch {
    errors.push(`Missing README file: ${filePath}`);
    return;
  }

  const lines = source.split(/\r\n|\n|\r/u);
  if (lines[0] !== `# ${title}`) {
    errors.push(`${filePath} must start with the canonical title: # ${title}`);
  }
  if (lines[1] !== "" || lines[2] !== navigation || lines[3] !== "") {
    errors.push(`${filePath} must place the shared language navigation after its title`);
  }
  const actualSections = [...source.matchAll(/^## (.+)$/gmu)].map((match) => match[1].trim());
  if (JSON.stringify(actualSections) !== JSON.stringify(sections)) {
    errors.push(
      `${filePath} must use the configured H2 section order; expected ${sections.join(" -> ")}, got ${actualSections.join(" -> ")}`,
    );
  }
  for (const token of config.requiredTokens) {
    if (!source.includes(token)) {
      errors.push(`${filePath} is missing required README contract token: ${token}`);
    }
  }
  const lead = source.split(/^## /mu, 1)[0];
  for (const token of config.requiredLeadTokens) {
    if (!lead.includes(token)) {
      errors.push(`${filePath} must emphasize the DocWen prerequisite before the first section: ${token}`);
    }
  }
  const developmentSection = sections.at(-3);
  const developmentStart = lines.findIndex((line) => line === `## ${developmentSection}`);
  const developmentEnd = lines.findIndex(
    (line, index) => index > developmentStart && line.startsWith("## "),
  );
  const development = lines
    .slice(developmentStart, developmentEnd < 0 ? lines.length : developmentEnd)
    .join("\n");
  for (const token of ["24.19.0", "11.17.0", "npm ci"]) {
    if (!development.includes(token)) {
      errors.push(`${filePath} Development is missing required toolchain token: ${token}`);
    }
  }
  if (/\bnpm\s+install\b/u.test(development)) {
    errors.push(`${filePath} Development must use npm ci instead of npm install`);
  }
  const repositoryTargets = validateLocalLinks(filePath, source);
  if (filePath === "README.md") {
    validateScreenshots(source);
  }
  const expectedRepositoryLinks = filePath === "docs/i18n/README.zh-CN.md"
    ? config.repositoryLinks.map((target) => target.endsWith(".en.md")
      ? target.replace(/\.en\.md$/u, ".zh-CN.md")
      : target)
    : config.repositoryLinks;
  for (const target of expectedRepositoryLinks) {
    if (!repositoryTargets.has(target)) {
      errors.push(`${filePath} must link repository contract: ${target}`);
    }
  }
}

function validateScreenshots(source) {
  const rawPrefix = `https://raw.githubusercontent.com/${config.repository}/main/`;
  for (const screenshot of config.screenshots) {
    const expectedTarget = `${rawPrefix}${screenshot}`;
    if (!source.includes(`](${expectedTarget})`)) {
      errors.push(`README.md is missing required screenshot link: ${expectedTarget}`);
    }

    const absolutePath = resolveProjectPath(screenshot);
    if (!existsSync(absolutePath)) {
      errors.push(`README.md screenshot is missing: ${screenshot}`);
      continue;
    }
    const png = readFileSync(absolutePath);
    const isPng = png.length >= 24 && png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (!isPng) {
      errors.push(`README.md screenshot is not a valid PNG: ${screenshot}`);
      continue;
    }
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    if (width < 1200 || height < 700) {
      errors.push(`README.md screenshot is too small: ${screenshot} (${width}x${height})`);
    }
  }
}

function findLocalizedReadmes(directory, result = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        findLocalizedReadmes(path.join(directory, entry.name), result);
      }
      continue;
    }
    if (entry.isFile() && /^README[._-][A-Za-z0-9].*\.md$/u.test(entry.name)) {
      result.push(normalizePath(path.relative(projectRoot, path.join(directory, entry.name))));
    }
  }
  return result;
}

const manifest = readProjectJson("manifest.json");
const expectedNavigation = config.languages
  .map(
    ({ label, path: readmePath }) =>
      `[${label}](https://github.com/${config.repository}/blob/main/${readmePath})`,
  )
  .join(" · ");
const publicReadmes = config.languages.map(({ path: readmePath }) => readmePath);
const translatedReadmes = publicReadmes.slice(1);

if (publicReadmes[0] !== "README.md") {
  errors.push("The English public README must be README.md at the repository root");
}
for (const translatedReadme of translatedReadmes) {
  if (!/^docs\/i18n\/README\.[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*\.md$/u.test(translatedReadme)) {
    errors.push(`Invalid translated README path: ${translatedReadme}`);
  }
}

compareFileSets(
  "docs/i18n",
  listReadmeFiles("docs/i18n"),
  translatedReadmes.map((filePath) => path.basename(filePath)),
);
for (const language of config.languages) {
  validateReadme(language, manifest.name, expectedNavigation);
}

const allowedLocalizedReadmes = new Set(translatedReadmes);
let packagedReadmeCount = 0;
if (config.packagedReadmeDir) {
  const packagedReadmes = publicReadmes.map((filePath) => path.basename(filePath));
  compareFileSets(
    config.packagedReadmeDir,
    listReadmeFiles(config.packagedReadmeDir),
    packagedReadmes,
  );
  for (const fileName of packagedReadmes) {
    const packagedPath = normalizePath(path.join(config.packagedReadmeDir, fileName));
    allowedLocalizedReadmes.add(packagedPath);
    validateReadme(
      { path: packagedPath, sections: config.languages[0].sections },
      manifest.name,
      expectedNavigation,
    );
  }
  packagedReadmeCount = packagedReadmes.length;
}

for (const readmePath of findLocalizedReadmes(projectRoot).sort()) {
  if (!allowedLocalizedReadmes.has(readmePath)) {
    errors.push(`Localized README is outside the configured layout: ${readmePath}`);
  }
}

if (errors.length > 0) {
  console.error("README i18n contract failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  const packagedSummary =
    packagedReadmeCount > 0 ? ` and ${packagedReadmeCount} packaged README files` : "";
  console.log(
    `README i18n contract passed: ${publicReadmes.length} public README files${packagedSummary}.`,
  );
}

import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DOCUMENTS = Object.freeze([
  "product-requirements",
  "ux-spec",
  "architecture",
  "testing-strategy",
  "release",
]);
const REQUIRED_TOKENS = Object.freeze({
  "product-requirements": { shared: [
    "DocWen Assistant",
    "docwen.machine.v1",
    "docwen.artifact_bundle.v2",
    "Windows",
    "Obsidian 1.12.7",
    "DocWen 0.9.x",
  ] },
  "ux-spec": {
    shared: [
    "DocWen Assistant",
    "Obsidian",
    ],
    source: ["顶部页签"],
    translation: ["top tabs"],
  },
  architecture: { shared: [
    "DocWen Assistant",
    "serve --stdio",
    "Content-Length",
    "JSON-RPC 2.0",
    "Machine v1",
    "0.9.x",
    "task/cancel",
  ] },
  "testing-strategy": { shared: [
    "DocWen Assistant",
    "npm run check",
    "npm run acceptance:docwen-package",
    "Obsidian 1.12.7",
    "data.json",
  ] },
  release: { shared: [
    "DocWen Assistant",
    "npm run release:check",
    "main.js",
    "manifest.json",
    "styles.css",
    "SHA256SUMS",
    "--verify-tag",
    "data.json",
    "docwen-assistant",
    "DocWen 0.9.x",
  ] },
});
const RETIRED_DOCUMENTS = Object.freeze([
  "docs/product.en.md",
  "docs/product.zh-CN.md",
  "docs/ux.en.md",
  "docs/ux.zh-CN.md",
]);

function parseDocument(source, relativePath, expectedFrontmatter) {
  const normalized = source.replaceAll("\r\n", "\n");
  const frontmatter = /^---\n([\s\S]*?)\n---\n\n([\s\S]+)$/u.exec(normalized);
  if (frontmatter === null) {
    throw new Error(`${relativePath} must start with canonical YAML frontmatter`);
  }
  const actualFrontmatter = frontmatter[1]?.split("\n") ?? [];
  if (JSON.stringify(actualFrontmatter) !== JSON.stringify(expectedFrontmatter)) {
    throw new Error(
      `${relativePath} frontmatter must be exactly:\n${expectedFrontmatter.join("\n")}`,
    );
  }
  const body = frontmatter[2] ?? "";
  const headings = [...body.matchAll(/^(#{1,6})\s+.+$/gmu)].map((match) =>
    (match[1] ?? "").length
  );
  if (!body.startsWith("# ") || !body.includes("\n## ") || headings[0] !== 1) {
    throw new Error(`${relativePath} must contain one H1 followed by at least one H2`);
  }
  if (headings.filter((level) => level === 1).length !== 1) {
    throw new Error(`${relativePath} must contain exactly one H1`);
  }
  if (!body.includes("DocWen Assistant")) {
    throw new Error(`${relativePath} must identify DocWen Assistant`);
  }
  const listShape = [...body.matchAll(/^(\s*)(?:[-*+]|\d+[.)])\s+/gmu)].map(
    (match) => `${(match[1] ?? "").length}:${/^\s*\d/u.test(match[0] ?? "") ? "ordered" : "bullet"}`,
  );
  const fenceShape = [...body.matchAll(/^\s*(`{3,}|~{3,})[^\n]*$/gmu)].map(
    (match) => `${(match[1] ?? "")[0]}:${(match[1] ?? "").length}`,
  );
  const tableShape = body
    .split("\n")
    .filter((line) => /^\s*\|.*\|\s*$/u.test(line))
    .map((line) => line.split("|").length - 2);
  return { body, headings, structure: { listShape, fenceShape, tableShape } };
}

async function validateRelativeLinks(projectRoot, relativePath, peerPath, body) {
  const relativeTargets = [];
  for (const match of body.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^)]*)?\)/gu)) {
    const rawTarget = (match[1] ?? "").replace(/^<|>$/gu, "");
    if (rawTarget.startsWith("#") || /^[a-z][a-z0-9+.-]*:/iu.test(rawTarget)) continue;
    let decoded;
    try {
      decoded = decodeURIComponent(rawTarget.split("#", 1)[0].split("?", 1)[0]);
    } catch {
      throw new Error(`${relativePath} contains an invalid encoded link: ${rawTarget}`);
    }
    if (!decoded) continue;
    const absoluteTarget = path.resolve(projectRoot, path.dirname(relativePath), decoded);
    const repositoryTarget = path.relative(projectRoot, absoluteTarget);
    if (repositoryTarget.startsWith("..") || path.isAbsolute(repositoryTarget)) {
      throw new Error(`${relativePath} contains a link outside the repository: ${rawTarget}`);
    }
    if (!existsSync(absoluteTarget)) {
      throw new Error(`${relativePath} contains a missing relative link: ${rawTarget}`);
    }
    const normalizedTarget = repositoryTarget.replaceAll("\\", "/");
    relativeTargets.push(normalizedTarget === peerPath ? "$peer" : normalizedTarget);
  }
  return relativeTargets;
}

export async function checkDocsI18n(projectRoot = process.cwd()) {
  for (const relativePath of RETIRED_DOCUMENTS) {
    if (existsSync(path.join(projectRoot, relativePath))) {
      throw new Error(`${relativePath} is a retired authority; use the canonical document name`);
    }
  }

  const expectedLocalizedFiles = new Set(
    DOCUMENTS.flatMap((document) => [
      `${document}.en.md`,
      `${document}.zh-CN.md`,
    ]),
  );
  const unexpectedLocalizedFiles = (await readdir(path.join(projectRoot, "docs"), {
    withFileTypes: true,
  }))
    .filter((entry) => entry.isFile() && /\.(?:en|zh-CN)\.md$/u.test(entry.name))
    .map((entry) => entry.name)
    .filter((name) => !expectedLocalizedFiles.has(name));
  if (unexpectedLocalizedFiles.length > 0) {
    throw new Error(
      `docs contains unregistered stable-language authorities: ${unexpectedLocalizedFiles.join(", ")}`,
    );
  }

  for (const document of DOCUMENTS) {
    const sourcePath = `docs/${document}.zh-CN.md`;
    const translationPath = `docs/${document}.en.md`;
    const [source, translation] = await Promise.all([
      readFile(path.join(projectRoot, sourcePath), "utf8"),
      readFile(path.join(projectRoot, translationPath), "utf8"),
    ]);
    const sourceDocument = parseDocument(source, sourcePath, [
      "source_language: zh-CN",
      "translation_status: source",
    ]);
    const translationDocument = parseDocument(translation, translationPath, [
      "source_language: zh-CN",
      `translation_of: ${document}.zh-CN.md`,
      "translation_status: synced",
    ]);
    if (JSON.stringify(sourceDocument.headings) !== JSON.stringify(translationDocument.headings)) {
      throw new Error(`${sourcePath} and ${translationPath} must have matching heading structures`);
    }
    if (JSON.stringify(sourceDocument.structure) !== JSON.stringify(translationDocument.structure)) {
      throw new Error(`${sourcePath} and ${translationPath} must have matching block structures`);
    }
    const requiredTokens = REQUIRED_TOKENS[document];
    for (const token of requiredTokens.shared) {
      if (!sourceDocument.body.includes(token) || !translationDocument.body.includes(token)) {
        throw new Error(`${sourcePath} and ${translationPath} must both contain critical token '${token}'`);
      }
    }
    for (const token of requiredTokens.source ?? []) {
      if (!sourceDocument.body.includes(token)) {
        throw new Error(`${sourcePath} must contain source-language critical token '${token}'`);
      }
    }
    for (const token of requiredTokens.translation ?? []) {
      if (!translationDocument.body.includes(token)) {
        throw new Error(`${translationPath} must contain translation-language critical token '${token}'`);
      }
    }
    const [sourceLinks, translationLinks] = await Promise.all([
      validateRelativeLinks(projectRoot, sourcePath, translationPath, sourceDocument.body),
      validateRelativeLinks(projectRoot, translationPath, sourcePath, translationDocument.body),
    ]);
    if (JSON.stringify(sourceLinks) !== JSON.stringify(translationLinks)) {
      throw new Error(`${sourcePath} and ${translationPath} must have matching relative-link sequences`);
    }
  }
  return DOCUMENTS.length * 2;
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;
if (import.meta.url === entryPoint) {
  const count = await checkDocsI18n();
  process.stdout.write(`Stable documentation contract passed for ${count} files.\n`);
}

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { TextDecoder } from "node:util";

const INCLUDED_EXTENSIONS = new Set([
  ".css",
  ".cjs",
  ".json",
  ".md",
  ".mjs",
  ".py",
  ".ts",
  ".yaml",
  ".yml",
]);
const INCLUDED_NAMES = new Set([".gitattributes", ".gitignore", ".node-version", "LICENSE"]);
const IGNORED_DIRECTORIES = new Set([".git", "coverage", "dist", "node_modules", "release"]);
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

export async function checkFormatting(projectRoot = process.cwd()) {
  const root = path.resolve(projectRoot);
  const files = await collectTextFiles(root);
  const failures = [];
  for (const filePath of files) {
    const relativePath = path.relative(root, filePath).replaceAll("\\", "/");
    let source;
    try {
      const bytes = await readFile(filePath);
      if (bytes.subarray(0, UTF8_BOM.length).equals(UTF8_BOM)) {
        failures.push(`${relativePath}: UTF-8 BOM is forbidden`);
        continue;
      }
      source = UTF8_DECODER.decode(bytes);
    } catch {
      failures.push(`${relativePath}: not valid UTF-8`);
      continue;
    }
    if (source.includes("\0")) failures.push(`${relativePath}: NUL bytes are forbidden`);
    if (source.includes("\r")) failures.push(`${relativePath}: LF line endings are required`);
    if (!source.endsWith("\n")) failures.push(`${relativePath}: final newline is required`);
    if (source.endsWith("\n\n")) failures.push(`${relativePath}: exactly one final newline is required`);
    if (/[ \t]+$/mu.test(source)) failures.push(`${relativePath}: trailing whitespace is forbidden`);
    if (path.extname(filePath) === ".json") {
      try {
        const parsed = JSON.parse(source);
        if (`${JSON.stringify(parsed, null, 2)}\n` !== source) {
          failures.push(`${relativePath}: JSON must use canonical 2-space formatting`);
        }
      } catch {
        failures.push(`${relativePath}: invalid JSON`);
      }
    }
  }
  if (failures.length > 0) {
    throw new Error(`Format check failed:\n- ${failures.join("\n- ")}`);
  }
  return files.length;
}

async function collectTextFiles(root) {
  const result = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Format input must not be a symbolic link: ${entryPath}`);
      }
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) await visit(entryPath);
      } else if (
        entry.isFile() &&
        (INCLUDED_NAMES.has(entry.name) || INCLUDED_EXTENSIONS.has(path.extname(entry.name)))
      ) {
        result.push(entryPath);
      }
    }
  }
  await visit(root);
  return result.sort((left, right) => left.localeCompare(right, "en"));
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;
if (import.meta.url === entryPoint) {
  const count = await checkFormatting();
  process.stdout.write(`Format check passed for ${count} text files.\n`);
}

import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { checkDocsI18n } from "../scripts/check-docs-i18n.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryDirectories: string[] = [];
let fixtureRoot = "";

beforeEach(async () => {
  fixtureRoot = await mkdtemp(path.join(tmpdir(), "assistant-docs-"));
  temporaryDirectories.push(fixtureRoot);
  await cp(path.join(projectRoot, "docs"), path.join(fixtureRoot, "docs"), { recursive: true });
});

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("stable documentation contract", () => {
  it("accepts the five canonical synchronized document pairs", async () => {
    await expect(checkDocsI18n(fixtureRoot)).resolves.toBe(10);
  });

  it("rejects wrong or additional translation metadata", async () => {
    await replaceInDocument(
      "docs/product-requirements.en.md",
      "translation_of: product-requirements.zh-CN.md",
      "translation_of: product.zh-CN.md\nstatus: stable",
    );
    await expect(checkDocsI18n(fixtureRoot)).rejects.toThrow(/frontmatter must be exactly/u);
  });

  it("rejects a missing or unregistered stable-language authority", async () => {
    await rm(path.join(fixtureRoot, "docs/ux-spec.en.md"));
    await expect(checkDocsI18n(fixtureRoot)).rejects.toThrow();

    await cp(
      path.join(projectRoot, "docs/architecture.en.md"),
      path.join(fixtureRoot, "docs/architecture-copy.en.md"),
    );
    await expect(checkDocsI18n(fixtureRoot)).rejects.toThrow(/unregistered/u);
  });

  it("rejects heading drift and broken or escaping relative links", async () => {
    await replaceInDocument("docs/ux-spec.en.md", "## Entry points", "### Entry points");
    await expect(checkDocsI18n(fixtureRoot)).rejects.toThrow(/matching heading structures/u);
    await replaceInDocument("docs/ux-spec.en.md", "### Entry points", "## Entry points");

    await replaceInDocument(
      "docs/architecture.en.md",
      "(cli-integration.md)",
      "(missing-contract.md)",
    );
    await expect(checkDocsI18n(fixtureRoot)).rejects.toThrow(/missing relative link/u);

    await replaceInDocument(
      "docs/architecture.en.md",
      "(missing-contract.md)",
      "(../../outside.md)",
    );
    await expect(checkDocsI18n(fixtureRoot)).rejects.toThrow(/outside the repository/u);
  });

  it("rejects a wrong existing relative link and removed critical token", async () => {
    await replaceInDocument(
      "docs/architecture.en.md",
      "(cli-integration.md)",
      "(product-requirements.en.md)",
    );
    await expect(checkDocsI18n(fixtureRoot)).rejects.toThrow(/relative-link sequences/u);
    await replaceInDocument(
      "docs/architecture.en.md",
      "(product-requirements.en.md)",
      "(cli-integration.md)",
    );

    await replaceInDocument(
      "docs/product-requirements.en.md",
      "docwen.machine.v1",
      "machine protocol",
    );
    await expect(checkDocsI18n(fixtureRoot)).rejects.toThrow(/critical token/u);
  });

  it("checks translated semantic tokens in their own language", async () => {
    await replaceInDocument("docs/ux-spec.en.md", "top tabs", "settings pages");
    await replaceInDocument("docs/ux-spec.en.md", "top tabs", "settings pages");
    await expect(checkDocsI18n(fixtureRoot)).rejects.toThrow(/translation-language critical token/u);

    await replaceInDocument("docs/ux-spec.en.md", "settings pages", "top tabs");
    await replaceInDocument("docs/ux-spec.en.md", "settings pages", "top tabs");
    await replaceInDocument("docs/ux-spec.zh-CN.md", "顶部页签", "设置页面");
    await replaceInDocument("docs/ux-spec.zh-CN.md", "顶部页签", "设置页面");
    await expect(checkDocsI18n(fixtureRoot)).rejects.toThrow(/source-language critical token/u);
  });

  it("rejects list, fence, or table structure drift", async () => {
    await replaceInDocument(
      "docs/product-requirements.en.md",
      "- Launch or activate",
      "1. Launch or activate",
    );
    await expect(checkDocsI18n(fixtureRoot)).rejects.toThrow(/block structures/u);
  });
});

async function replaceInDocument(filePath: string, search: string, replacement: string) {
  const absolutePath = path.join(fixtureRoot, filePath);
  const source = await readFile(absolutePath, "utf8");
  expect(source).toContain(search);
  await writeFile(absolutePath, source.replace(search, replacement));
}

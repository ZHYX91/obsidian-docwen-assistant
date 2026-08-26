import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryDirectories: string[] = [];
let fixtureRoot = "";

beforeEach(async () => {
  fixtureRoot = await mkdtemp(path.join(tmpdir(), "assistant-readme-"));
  temporaryDirectories.push(fixtureRoot);
  await Promise.all([
    cp(path.join(projectRoot, "README.md"), path.join(fixtureRoot, "README.md")),
    cp(path.join(projectRoot, "manifest.json"), path.join(fixtureRoot, "manifest.json")),
    cp(path.join(projectRoot, "CHANGELOG.md"), path.join(fixtureRoot, "CHANGELOG.md")),
    cp(path.join(projectRoot, "CONTRIBUTING.md"), path.join(fixtureRoot, "CONTRIBUTING.md")),
    cp(path.join(projectRoot, "SECURITY.md"), path.join(fixtureRoot, "SECURITY.md")),
    cp(path.join(projectRoot, "docs"), path.join(fixtureRoot, "docs"), { recursive: true }),
    cp(path.join(projectRoot, "scripts"), path.join(fixtureRoot, "scripts"), { recursive: true }),
  ]);
});

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("README standardization contract", () => {
  it("accepts all eleven synchronized READMEs", () => {
    expect(runReadmeCheck()).toMatchObject({ status: 0 });
  });

  it("rejects npm install or an unpinned Development toolchain", async () => {
    await replaceInReadme("docs/i18n/README.de-DE.md", "npm ci", "npm install");
    expect(runReadmeCheck().stderr).toContain("must use npm ci instead of npm install");

    await replaceInReadme("README.md", "Node.js 24.19.0", "Node.js 24.18");
    expect(runReadmeCheck().stderr).toContain("24.19.0");
  });

  it("requires real links to every canonical contract and governance file", async () => {
    await replaceInReadme(
      "README.md",
      "](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/release.en.md)",
      "](#release-contract)",
    );
    expect(runReadmeCheck().stderr).toContain("must link repository contract: docs/release.en.md");

    await rm(path.join(fixtureRoot, "SECURITY.md"));
    expect(runReadmeCheck().stderr).toContain("missing repository link");
  });

  it("requires all three current governed English interface screenshots", async () => {
    await rm(path.join(fixtureRoot, "docs/assets/docwen-assistant-proofread-en.png"));
    expect(runReadmeCheck().stderr).toContain(
      "README.md screenshot is missing: docs/assets/docwen-assistant-proofread-en.png",
    );

    await replaceInReadme(
      "README.md",
      "docs/assets/docwen-assistant-export-en.png",
      "docs/assets/missing-export.png",
    );
    expect(runReadmeCheck().stderr).toContain("is missing required screenshot link");

    await rm(path.join(fixtureRoot, "docs/assets/docwen-assistant-settings-en.png"));
    expect(runReadmeCheck().stderr).toContain(
      "README.md screenshot is missing: docs/assets/docwen-assistant-settings-en.png",
    );
  });
});

function runReadmeCheck() {
  return spawnSync(process.execPath, [path.join(fixtureRoot, "scripts/check-readme-i18n.mjs")], {
    cwd: fixtureRoot,
    encoding: "utf8",
  });
}

async function replaceInReadme(filePath: string, search: string, replacement: string) {
  const absolutePath = path.join(fixtureRoot, filePath);
  const source = await readFile(absolutePath, "utf8");
  expect(source).toContain(search);
  await writeFile(absolutePath, source.replace(search, replacement));
}

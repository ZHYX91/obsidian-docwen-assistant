import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { DocWenClient } from "../src/docwen/client";
import { DocWenMachineClient } from "../src/docwen/machine-client";
import { resolveDocWenLaunchTarget } from "../src/docwen/path";

const receiptPath = process.env.DOCWEN_SOURCE_DIAGNOSTIC_RECEIPT;
describe.skipIf(!receiptPath)("explicit native ARM64 Core source compatibility diagnostic", () => {
  it("uses the composed source CLI through actual ownership, handshake, proofreading and numbering", async () => {
    assert.ok(receiptPath);
    assert.equal(process.platform, "linux");
    assert.equal(process.arch, "arm64");
    const binding = JSON.parse(await readFile(receiptPath, "utf8")) as {
      kind: string; arch: string; entry: string; entrySha256: string;
      core: { commit: string; tree: string; composedEntry: string };
    };
    assert.equal(binding.kind, "docwen-arm64-source-diagnostic");
    assert.equal(binding.arch, "aarch64");
    assert.match(binding.core.commit, /^[a-f0-9]{40}$/u);
    assert.match(binding.core.tree, /^[a-f0-9]{40}$/u);
    assert.equal(binding.core.composedEntry, "docwen_bundle.cli_entry");
    assert.equal(createHash("sha256").update(await readFile(binding.entry)).digest("hex"), binding.entrySha256);
    const target = resolveDocWenLaunchTarget("manual", binding.entry);
    const machine = new DocWenMachineClient(() => target, () => "en_US");
    const client = new DocWenClient(machine);
    const root = dirname(receiptPath);
    const source = join(root, "输入.md");
    const numbered = join(root, "numbered.md");
    const restored = join(root, "restored.md");
    const original = "# 标题\n\n## 小节\n\n未闭合引号：“测试\n";
    await mkdir(root, { recursive: true });
    await writeFile(source, original, "utf8");
    try {
      const health = await client.doctor();
      await writeFile(join(root, "health.json"), JSON.stringify(health, null, 2) + "\n");
      expect(health.allOk).toBe(true);
      expect(health.checks.length).toBeGreaterThan(0);
      const capabilities = await client.runtimeCapabilities();
      expect(capabilities.capabilities.map((item) => item.capability_id)).toEqual(expect.arrayContaining([
        "validate.markdown", "transform.markdown.heading_numbering",
      ]));
      const report = await client.validate(source, ["punct"]);
      expect(report.issues.length).toBeGreaterThan(0);
      await client.numberMarkdown(source, numbered, "add", "hierarchical_standard");
      const numberedBytes = await readFile(numbered);
      expect(numberedBytes.toString("utf8")).toMatch(/^# \d[^\n]*标题$/mu);
      expect(numberedBytes.toString("utf8")).toMatch(/^## \d[^\n]*小节$/mu);
      await client.numberMarkdown(numbered, restored, "remove");
      expect(await readFile(restored, "utf8")).toBe(original);
      expect(await readFile(source, "utf8")).toBe(original);
      await writeFile(join(root, "consumer-result.json"), JSON.stringify({
        schemaVersion: 1, status: "passed-source-diagnostic", binding, health,
        proofreadIssueCount: report.issues.length,
        sourceSha256: createHash("sha256").update(original).digest("hex"),
        numberedSha256: createHash("sha256").update(numberedBytes).digest("hex"),
        sourceUnchanged: true, numberingRoundTripExact: true,
        scope: "Explicit manual DocWenCLI-compatible entry for fixed Core source, not natural discovery, a precompiled release, final producer-pair or Obsidian acceptance.",
      }, null, 2) + "\n");
    } finally {
      client.dispose();
    }
  }, 120000);
});

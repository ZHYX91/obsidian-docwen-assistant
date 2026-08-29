import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertRoundTripSidecarTargetAvailable,
  publishRoundTripSidecar,
} from "../src/host/round-trip-sidecar";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("round-trip sidecar", () => {
  it("publishes exact source inputs beside the DOCX and replaces only an owned sidecar", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "docwen-sidecar-test-"));
    roots.push(root);
    const docx = path.join(root, "result.docx");
    const neutral = path.join(root, "neutral.json");
    const plan = path.join(root, "plan.json");
    const source = path.join(root, "source.md");
    await Promise.all([
      writeFile(docx, "docx-one"),
      writeFile(neutral, "neutral-one"),
      writeFile(plan, "plan-one"),
      writeFile(source, "\uFEFF# Title\r\n"),
    ]);

    const sidecar = await publishRoundTripSidecar(docx, {
      neutralDocumentPath: neutral,
      numberingExportPlanPath: plan,
      authoredSourcePath: source,
    });
    expect(await readFile(path.join(sidecar, "authored-source.md"), "utf8"))
      .toBe("\uFEFF# Title\r\n");

    await writeFile(source, "# Changed\n");
    await publishRoundTripSidecar(docx, {
      neutralDocumentPath: neutral,
      numberingExportPlanPath: plan,
      authoredSourcePath: source,
    });
    expect(await readFile(path.join(sidecar, "authored-source.md"), "utf8"))
      .toBe("# Changed\n");
  });

  it("refuses to overwrite an unowned adjacent directory", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "docwen-sidecar-test-"));
    roots.push(root);
    const docx = path.join(root, "result.docx");
    const input = path.join(root, "input");
    await writeFile(docx, "docx");
    await writeFile(input, "input");
    const foreign = `${docx}.docwen`;
    const { mkdir } = await import("node:fs/promises");
    await mkdir(foreign);
    await writeFile(path.join(foreign, "keep.txt"), "keep");

    await expect(assertRoundTripSidecarTargetAvailable(docx))
      .rejects.toThrow("unexpected inventory");

    await expect(publishRoundTripSidecar(docx, {
      neutralDocumentPath: input,
      numberingExportPlanPath: input,
      authoredSourcePath: input,
    })).rejects.toThrow("unexpected inventory");
    expect(await readFile(path.join(foreign, "keep.txt"), "utf8")).toBe("keep");
  });

  it("accepts an absent or previously owned publication target", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "docwen-sidecar-test-"));
    roots.push(root);
    const docx = path.join(root, "result.docx");
    const input = path.join(root, "input");
    await writeFile(docx, "docx");
    await writeFile(input, "input");

    await expect(assertRoundTripSidecarTargetAvailable(docx)).resolves.toBeUndefined();
    await publishRoundTripSidecar(docx, {
      neutralDocumentPath: input,
      numberingExportPlanPath: input,
      authoredSourcePath: input,
    });
    await expect(assertRoundTripSidecarTargetAvailable(docx)).resolves.toBeUndefined();
  });
});

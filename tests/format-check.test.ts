import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error The format checker is an executable JavaScript module.
import { checkFormatting } from "../scripts/check-format.mjs";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("format contract", () => {
  it("accepts UTF-8 text and canonical two-space JSON", async () => {
    const root = await createWorkspace();
    await writeFile(path.join(root, "source.ts"), "export const value = true;\n");
    await writeFile(path.join(root, "package.json"), "{\n  \"name\": \"fixture\"\n}\n");
    await expect(checkFormatting(root)).resolves.toBe(2);
  });

  it("rejects trailing whitespace, bare CR, missing newlines, and compact JSON", async () => {
    const root = await createWorkspace();
    await mkdir(path.join(root, "src"));
    await writeFile(path.join(root, "src", "bad.ts"), "const bad = true; \r");
    await writeFile(path.join(root, "package.json"), "{\"name\":\"fixture\"}");
    await expect(checkFormatting(root)).rejects.toThrow(
      /line endings|trailing whitespace|canonical 2-space formatting/u,
    );
  });

  it("rejects CRLF, UTF-8 BOM, NUL bytes, and extra final newlines", async () => {
    const root = await createWorkspace();
    await writeFile(path.join(root, "crlf.ts"), "export const crlf = true;\r\n");
    await writeFile(
      path.join(root, "bom.md"),
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("# BOM\n")]),
    );
    await writeFile(path.join(root, "nul.md"), "# NUL\0\n");
    await writeFile(path.join(root, "extra.md"), "# Extra\n\n");
    await expect(checkFormatting(root)).rejects.toThrow(
      /LF line endings|UTF-8 BOM|NUL bytes|exactly one final newline/u,
    );
  });

  it("includes CommonJS configuration files in the LF contract", async () => {
    const root = await createWorkspace();
    await writeFile(path.join(root, "eslint.config.cjs"), "module.exports = {};\r\n");
    await expect(checkFormatting(root)).rejects.toThrow(/LF line endings/u);
  });
});

async function createWorkspace(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "assistant-format-"));
  temporaryDirectories.push(root);
  return root;
}

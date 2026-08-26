import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LocalCliError } from "../src/docwen/errors";
import { resolveDocWenCliPath } from "../src/docwen/path";

const workspaces: string[] = [];

afterEach(() => {
  for (const workspace of workspaces.splice(0)) rmSync(workspace, { recursive: true, force: true });
});

describe("DocWen location resolution", () => {
  it("normalizes a direct DocWenCLI.exe selection", () => {
    const root = workspace();
    const cli = touch(root, "DocWenCLI.exe");

    expect(resolveDocWenCliPath(`  \"${cli}\"  `)).toBe(path.normalize(cli));
  });

  it("resolves DocWen.exe to the exact sibling CLI", () => {
    const root = workspace();
    const gui = touch(root, "DocWen.exe");
    const cli = touch(root, "DocWenCLI.exe");

    expect(resolveDocWenCliPath(gui)).toBe(cli);
  });

  it("resolves the extracted package folder to its root CLI", () => {
    const root = workspace();
    const cli = touch(root, "DocWenCLI.exe");

    expect(resolveDocWenCliPath(root)).toBe(cli);
  });

  it("rejects unrelated executables without guessing", () => {
    const root = workspace();
    const other = touch(root, "Other.exe");

    expectFailure(other, "cli_wrong_filename");
  });

  it("rejects a GUI or folder when the sibling CLI is missing", () => {
    const root = workspace();
    const gui = touch(root, "DocWen.exe");

    expectFailure(gui, "cli_not_found");
    expectFailure(root, "cli_not_found");
  });

  it("does not accept a missing GUI merely because a sibling CLI exists", () => {
    const root = workspace();
    touch(root, "DocWenCLI.exe");

    expectFailure(path.join(root, "DocWen.exe"), "cli_not_found");
  });

  it("does not recursively search child folders", () => {
    const root = workspace();
    const nested = path.join(root, "nested");
    mkdirSync(nested);
    touch(nested, "DocWenCLI.exe");

    expectFailure(root, "cli_not_found");
  });
});

function workspace(): string {
  const result = mkdtempSync(path.join(tmpdir(), "docwen-location-"));
  workspaces.push(result);
  return result;
}

function touch(root: string, filename: string): string {
  const target = path.join(root, filename);
  writeFileSync(target, "fixture");
  return target;
}

function expectFailure(value: string, code: LocalCliError["code"]): void {
  try {
    resolveDocWenCliPath(value);
    throw new Error("Expected resolveDocWenCliPath to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(LocalCliError);
    expect((error as LocalCliError).code).toBe(code);
  }
}

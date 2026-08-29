import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LocalCliError } from "../src/docwen/errors";
import {
  DOCWEN_EXECUTION_ALIAS,
  resolveDocWenExecutionAlias,
  resolveDocWenCliPath,
  resolveDocWenLaunchTarget,
} from "../src/docwen/path";

const workspaces: string[] = [];

afterEach(() => {
  for (const workspace of workspaces.splice(0)) rmSync(workspace, { recursive: true, force: true });
});

describe("DocWen location resolution", () => {
  it("uses the fixed LOCALAPPDATA execution alias without inspecting the package directory", () => {
    const localAppData = "C:\\Users\\Tester\\AppData\\Local";
    const expected = path.win32.join(localAppData, "Microsoft", "WindowsApps", DOCWEN_EXECUTION_ALIAS);
    expect(resolveDocWenLaunchTarget(
      "automatic",
      "C:\\ignored\\DocWenCLI.exe",
      localAppData,
      (candidate) => candidate === expected,
      "win32",
    )).toMatchObject({
      executable: expected,
      mode: "automatic",
      cwd: expect.any(String),
    });
  });

  it("never resolves automatic mode through a same-named PATH program", () => {
    const localAppData = "C:\\Users\\Tester\\AppData\\Local";
    const expected = path.win32.join(localAppData, "Microsoft", "WindowsApps", DOCWEN_EXECUTION_ALIAS);
    const previousPath = process.env.PATH;
    process.env.PATH = "C:\\ToolsWithFakeDocWen";
    const target = (() => {
      try {
        return resolveDocWenLaunchTarget("automatic", "", localAppData, () => true, "win32");
      } finally {
        if (previousPath === undefined) delete process.env.PATH;
        else process.env.PATH = previousPath;
      }
    })();

    expect(target.executable).toBe(expected);
    expect(target.executable).not.toBe("C:\\Tools\\docwen.exe");
  });

  it("fails closed when LOCALAPPDATA or the fixed alias is unavailable", () => {
    const previousLocalAppData = process.env.LOCALAPPDATA;
    try {
      delete process.env.LOCALAPPDATA;
      expect(() => resolveDocWenExecutionAlias(undefined, () => true, "win32")).toThrowError(
        expect.objectContaining({ code: "cli_alias_not_found" }),
      );
    } finally {
      if (previousLocalAppData === undefined) delete process.env.LOCALAPPDATA;
      else process.env.LOCALAPPDATA = previousLocalAppData;
    }
    expect(() => resolveDocWenExecutionAlias("relative", () => true, "win32")).toThrowError(
      expect.objectContaining({ code: "cli_alias_not_found" }),
    );
    expect(() => resolveDocWenExecutionAlias(
      "C:\\Users\\Tester\\AppData\\Local",
      () => false,
      "win32",
    )).toThrowError(expect.objectContaining({ code: "cli_alias_not_found" }));
  });

  it("rejects automatic discovery outside Windows", () => {
    expect(() => resolveDocWenLaunchTarget(
      "automatic",
      "",
      undefined,
      () => true,
      "linux",
    )).toThrowError(expect.objectContaining({ code: "cli_platform_unsupported" }));
  });

  it("normalizes a direct DocWenCLI.exe selection", () => {
    const root = workspace();
    const cli = touch(root, "DocWenCLI.exe");

    expect(resolveDocWenCliPath(`  \"${cli}\"  `, "win32")).toBe(path.normalize(cli));
  });

  it("resolves DocWen.exe to the exact sibling CLI", () => {
    const root = workspace();
    const gui = touch(root, "DocWen.exe");
    const cli = touch(root, "DocWenCLI.exe");

    expect(resolveDocWenCliPath(gui, "win32")).toBe(cli);
  });

  it("resolves the extracted package folder to its root CLI", () => {
    const root = workspace();
    const cli = touch(root, "DocWenCLI.exe");

    expect(resolveDocWenCliPath(root, "win32")).toBe(cli);
  });

  it("keeps the validated absolute path in manual mode", () => {
    const root = workspace();
    const cli = touch(root, "DocWenCLI.exe");

    expect(resolveDocWenLaunchTarget("manual", cli, undefined, undefined, "win32")).toEqual({
      executable: cli,
      cwd: root,
      mode: "manual",
    });
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

  it("resolves the exact Ubuntu package CLI, GUI sibling, and folder", () => {
    const root = workspace();
    const gui = touch(root, "DocWen");
    const cli = touch(root, "DocWenCLI", true);

    expect(resolveDocWenCliPath(cli, "linux")).toBe(cli);
    expect(resolveDocWenCliPath(gui, "linux")).toBe(cli);
    expect(resolveDocWenCliPath(root, "linux")).toBe(cli);
    expect(resolveDocWenLaunchTarget("manual", gui, undefined, undefined, "linux")).toEqual({
      executable: cli,
      cwd: root,
      mode: "manual",
    });
  });

  it("keeps Linux executable names case-sensitive and rejects Windows package names", () => {
    const root = workspace();
    const wrongCase = touch(root, "docwencli");
    const windowsCli = touch(root, "DocWenCLI.exe");

    expectFailure(wrongCase, "cli_wrong_filename", "linux");
    expectFailure(windowsCli, "cli_wrong_filename", "linux");
  });

  it("requires execute permission for the Ubuntu CLI", () => {
    const root = workspace();
    const cli = touch(root, "DocWenCLI");

    expect(() => resolveDocWenCliPath(cli, "linux", () => false)).toThrowError(
      expect.objectContaining({ code: "cli_not_executable" }),
    );
  });

  it("rejects unsupported desktop platforms", () => {
    const root = workspace();
    const cli = touch(root, "DocWenCLI");

    expectFailure(cli, "cli_platform_unsupported", "darwin");
  });
});

function workspace(): string {
  const result = mkdtempSync(path.join(tmpdir(), "docwen-location-"));
  workspaces.push(result);
  return result;
}

function touch(root: string, filename: string, executable = false): string {
  const target = path.join(root, filename);
  writeFileSync(target, "fixture");
  if (executable) chmodSync(target, 0o755);
  return target;
}

function expectFailure(
  value: string,
  code: LocalCliError["code"],
  platform: NodeJS.Platform = "win32",
): void {
  try {
    resolveDocWenCliPath(value, platform);
    throw new Error("Expected resolveDocWenCliPath to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(LocalCliError);
    expect((error as LocalCliError).code).toBe(code);
  }
}

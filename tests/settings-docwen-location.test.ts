import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initI18n } from "../src/i18n";

const showOpenDialog = vi.fn();
const showNotice = vi.fn();

vi.mock("obsidian", () => ({ Setting: class Setting {} }));
vi.mock("../src/host/electron-dialogs", () => ({
  getElectronOpenDialog: () => ({ showOpenDialog }),
}));
vi.mock("../src/host/notices", () => ({ showNotice }));

const workspaces: string[] = [];

afterEach(() => {
  for (const workspace of workspaces.splice(0)) rmSync(workspace, { recursive: true, force: true });
});

describe("DocWen settings location picker", () => {
  beforeEach(() => {
    initI18n("en");
    showOpenDialog.mockReset();
    showNotice.mockReset();
  });

  it("turns automatic connection outcomes into user-facing status messages", async () => {
    const { getDocWenConnectionDisplay } = await import("../src/settings-docwen-location");

    expect(getDocWenConnectionDisplay("automatic", "", { state: "unchecked" })).toMatchObject({
      state: "empty",
      message: expect.stringContaining("Microsoft Store"),
    });
    expect(getDocWenConnectionDisplay("automatic", "", {
      state: "connected",
      mode: "automatic",
      productVersion: "0.9.1",
    })).toMatchObject({ state: "valid", message: expect.stringContaining("0.9.1") });
    expect(getDocWenConnectionDisplay("automatic", "", {
      state: "error",
      mode: "automatic",
      code: "cli_alias_not_found",
    })).toMatchObject({ state: "error", message: expect.stringContaining("not found") });
  });

  it("accepts the visible GUI and returns only its sibling CLI", async () => {
    const root = workspace();
    const gui = touch(root, "DocWen.exe");
    const cli = touch(root, "DocWenCLI.exe");
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [gui] });
    const { pickDocWenCliPath } = await import("../src/settings-docwen-location");

    await expect(pickDocWenCliPath("program", "win32")).resolves.toBe(cli);
    expect(showOpenDialog).toHaveBeenCalledWith(expect.objectContaining({ properties: ["openFile"] }));
  });

  it("accepts the extracted folder without recursively searching", async () => {
    const root = workspace();
    const cli = touch(root, "DocWenCLI.exe");
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [root] });
    const { pickDocWenCliPath } = await import("../src/settings-docwen-location");

    await expect(pickDocWenCliPath("directory", "win32")).resolves.toBe(cli);
    expect(showOpenDialog).toHaveBeenCalledWith({
      title: expect.any(String),
      properties: ["openDirectory"],
    });
  });

  it("keeps the previous setting when an unrelated executable is selected", async () => {
    const root = workspace();
    const other = touch(root, "Other.exe");
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [other] });
    const { pickDocWenCliPath } = await import("../src/settings-docwen-location");

    await expect(pickDocWenCliPath("program", "win32")).resolves.toBeNull();
    expect(showNotice).toHaveBeenCalledOnce();
  });

  it("accepts the Ubuntu executable without applying a Windows extension filter", async () => {
    const root = workspace();
    const cli = touch(root, "DocWenCLI", true);
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [cli] });
    const { pickDocWenCliPath } = await import("../src/settings-docwen-location");

    await expect(pickDocWenCliPath("program", "linux")).resolves.toBe(cli);
    expect(showOpenDialog).toHaveBeenCalledWith({
      title: expect.any(String),
      properties: ["openFile"],
    });
  });
});

function workspace(): string {
  const result = mkdtempSync(path.join(tmpdir(), "docwen-picker-"));
  workspaces.push(result);
  return result;
}

function touch(root: string, filename: string, executable = false): string {
  const target = path.join(root, filename);
  writeFileSync(target, "fixture");
  if (executable) chmodSync(target, 0o755);
  return target;
}

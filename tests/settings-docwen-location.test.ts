import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    showOpenDialog.mockReset();
    showNotice.mockReset();
  });

  it("accepts the visible GUI and returns only its sibling CLI", async () => {
    const root = workspace();
    const gui = touch(root, "DocWen.exe");
    const cli = touch(root, "DocWenCLI.exe");
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [gui] });
    const { pickDocWenCliPath } = await import("../src/settings-docwen-location");

    await expect(pickDocWenCliPath("program")).resolves.toBe(cli);
    expect(showOpenDialog).toHaveBeenCalledWith(expect.objectContaining({ properties: ["openFile"] }));
  });

  it("accepts the extracted folder without recursively searching", async () => {
    const root = workspace();
    const cli = touch(root, "DocWenCLI.exe");
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [root] });
    const { pickDocWenCliPath } = await import("../src/settings-docwen-location");

    await expect(pickDocWenCliPath("directory")).resolves.toBe(cli);
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

    await expect(pickDocWenCliPath("program")).resolves.toBeNull();
    expect(showNotice).toHaveBeenCalledOnce();
  });
});

function workspace(): string {
  const result = mkdtempSync(path.join(tmpdir(), "docwen-picker-"));
  workspaces.push(result);
  return result;
}

function touch(root: string, filename: string): string {
  const target = path.join(root, filename);
  writeFileSync(target, "fixture");
  return target;
}

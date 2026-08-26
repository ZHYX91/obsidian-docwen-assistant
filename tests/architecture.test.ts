import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("architecture boundaries", () => {
  it("keeps lifecycle orchestration out of new monoliths", () => {
    const main = source("src/main.ts");
    const settings = source("src/settings.ts");
    expect(main.split(/\r?\n/).length).toBeLessThanOrEqual(500);
    expect(settings.split(/\r?\n/).length).toBeLessThanOrEqual(350);
    expect(main).not.toContain("ARG.");
    expect(main).not.toContain("extraArgs");
    expect(main).not.toContain('require("electron")');
    expect(main).not.toContain("new Notice(");
    expect(main).not.toContain('workspace.on("file-menu"');
    expect(main).not.toContain("numberMarkdown(");
    expect(main).not.toContain("docwen.validate(");
    expect(main).toContain("this.runtimeDisposer.dispose()");
    expect(main.indexOf("detachLeavesOfType(PROOFREAD_VIEW_TYPE)"))
      .toBeLessThan(main.indexOf("this.registerView("));
  });

  it("separates i18n runtime, key types, and data-only catalogs", () => {
    const runtime = source("src/i18n.ts");
    const types = source("src/i18n/types.ts");
    const catalogs = source("src/i18n/catalogs.ts");
    expect(runtime.split(/\r?\n/).length).toBeLessThanOrEqual(150);
    expect(runtime).toContain('from "./i18n/catalogs"');
    expect(types).toContain("export interface Translations");
    expect(catalogs).toContain("export const translations");
    expect(catalogs).not.toContain("function ");
  });

  it("uses one shared settings tree for the current top-tab surface", () => {
    const settings = source("src/settings.ts");
    const definitions = source("src/settings-definitions.ts");
    expect(settings).toContain("override display(): void");
    expect(settings).toContain("new SettingsTabs(");
    expect(definitions).toContain("export function getSettingsPages(");
    expect(definitions).not.toContain("toDeclarativeSettingDefinitions");
    expect(settings).not.toContain("this.update()");
    expect(settings).not.toContain("ENABLE_DECLARATIVE_SETTINGS");
    expect(settings).not.toContain("renderDefinitionItems");
  });

  it("keeps Machine framing and Electron fallbacks inside their adapters", () => {
    const client = source("src/docwen/client.ts");
    const machine = source("src/docwen/machine-client.ts");
    const main = source("src/main.ts");
    const settings = source("src/settings.ts");
    const dialogs = source("src/host/electron-dialogs.ts");
    expect(client).toMatch(/async convert\(\s*request: ConvertRequest,\s*signal\?: AbortSignal,?\s*\)/u);
    expect(client).toContain('"convert.markdown.to_docx"');
    expect(machine).toContain('method: "task/cancel"');
    expect(machine).toContain('path.join(windowsRoot, "System32", "taskkill.exe")');
    expect(machine).toContain('process.kill(-pid, force ? "SIGKILL" : "SIGTERM")');
    expect(machine).toContain('detached: process.platform !== "win32"');
    expect(machine).toContain("ARTIFACT_BUNDLE_LIMITS");
    expect(machine).toContain('"docwen.artifact_bundle.v2"');
    expect(machine).not.toContain('shell: true');
    expect(client).toContain("await link(item.temporary, item.target)");
    expect(client).not.toContain("await rename(item.temporary, item.target)");
    expect(client).not.toContain("const bytes = await readFile(filePath)");
    expect(main).not.toContain("--output");
    expect(settings).not.toContain('require("electron")');
    expect(settings).not.toContain("new Notice(");
    expect(dialogs).toContain('require("electron")');
    expect(source("src/host/notices.ts")).toContain("new Notice(");
    expect(source("src/host/file-system.ts")).toContain('from "node:fs"');
  });

  it("accepts friendly DocWen locations but retains one exact CLI runtime boundary", () => {
    const location = source("src/settings-docwen-location.ts");
    const links = source("src/docwen/links.ts");
    const pathResolver = source("src/docwen/path.ts");
    expect(location).toContain('["openFile"]');
    expect(location).toContain('["openDirectory"]');
    expect(links).toContain("https://github.com/ZHYX91/docwen/releases");
    expect(links).not.toContain("/releases/latest");
    expect(pathResolver).toContain('path.join(selectedPath, "DocWenCLI.exe")');
    expect(pathResolver).toContain('filename === "docwen.exe"');
    expect(pathResolver).not.toContain("readdir");
    const settings = source("src/settings.ts");
    expect(settings.indexOf("await this.plugin.saveSettings()"))
      .toBeLessThan(settings.indexOf("await this.plugin.runDoctorCheck()"));
  });

});

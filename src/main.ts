/**
 * DocWen Assistant - Obsidian Plugin
 * 
 * Launch DocWen converter from Obsidian and pass the current file path.
 * Supports single instance management via file-based IPC.
 */

import { Plugin, Notice, FileSystemAdapter, TFile, TFolder, TAbstractFile, Menu } from "obsidian";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as crypto from "crypto";
import { PluginSettings, SettingTab, DEFAULT_SETTINGS } from "./settings";
import { initI18n, t } from "./i18n";
import { ItemPickerModal, PickerItem } from "./utils/suggest-modal";

// CLI data types
interface TemplateItem {
  id: string;
  name: string;
  target: string;
  description?: string;
}

interface OptimizationItem {
  id: string;
  name: string;
  description?: string;
}

interface NumberingSchemeItem {
  id: string;
  name: string;
  description?: string;
}

/**
 * DocWen Assistant Plugin
 * Main plugin class for launching and communicating with DocWen converter
 */
export default class DocWenPlugin extends Plugin {
  settings!: PluginSettings;
  private readonly IPC_DIR_NAME = "docwen";

  private getDocwenLangCode(): string | null {
    const lang = String(document.documentElement.lang || "").trim().toLowerCase();
    if (!lang) return null;

    if (lang === "zh" || lang === "zh-cn" || lang === "zh-hans") return "zh_CN";
    if (lang === "zh-tw" || lang === "zh-hant") return "zh_TW";
    if (lang === "en" || lang.startsWith("en-")) return "en_US";
    if (lang === "de" || lang.startsWith("de-")) return "de_DE";
    if (lang === "fr" || lang.startsWith("fr-")) return "fr_FR";
    if (lang === "ru" || lang.startsWith("ru-")) return "ru_RU";
    if (lang === "pt" || lang.startsWith("pt-")) return "pt_BR";
    if (lang === "ja" || lang.startsWith("ja-")) return "ja_JP";
    if (lang === "ko" || lang.startsWith("ko-")) return "ko_KR";
    if (lang === "es" || lang.startsWith("es-")) return "es_ES";
    if (lang === "vi" || lang.startsWith("vi-")) return "vi_VN";
    return null;
  }

  private resolveGuiExecutablePath(): string | null {
    const guiPathRaw = (this.settings.executablePath || "").trim().replace(/^['"]|['"]$/g, "");
    if (guiPathRaw) {
      const p = path.normalize(guiPathRaw);
      if (fs.existsSync(p)) {
        // Filename correction: if user accidentally put CLI path in GUI field
        const basename = path.basename(p).toLowerCase();
        if (basename === "docwencli.exe") {
          // Wrong field — look for DocWen.exe next to it
          const corrected = path.join(path.dirname(p), "DocWen.exe");
          if (fs.existsSync(corrected)) return corrected;
        }
        return p;
      }
    }

    const cliPathRaw = (this.settings.cliExecutablePath || "").trim().replace(/^['"]|['"]$/g, "");
    if (!cliPathRaw) return null;
    const cliPath = path.normalize(cliPathRaw);
    if (!fs.existsSync(cliPath)) return null;

    const candidate = path.join(path.dirname(cliPath), "DocWen.exe");
    if (fs.existsSync(candidate)) return candidate;
    return null;
  }

  private resolveCliExecutablePath(): string | null {
    const cliPathRaw = (this.settings.cliExecutablePath || "").trim().replace(/^['"]|['"]$/g, "");
    if (cliPathRaw) {
      const p = path.normalize(cliPathRaw);
      if (fs.existsSync(p)) {
        // Filename correction: if user accidentally put GUI path in CLI field
        const basename = path.basename(p).toLowerCase();
        if (basename === "docwen.exe") {
          // Wrong field — look for DocWenCLI.exe next to it
          const corrected = path.join(path.dirname(p), "DocWenCLI.exe");
          if (fs.existsSync(corrected)) return corrected;
        }
        return p;
      }
    }

    const guiPathRaw = (this.settings.executablePath || "").trim().replace(/^['"]|['"]$/g, "");
    if (!guiPathRaw) return null;
    const guiPath = path.normalize(guiPathRaw);
    if (!fs.existsSync(guiPath)) return null;

    const candidate = path.join(path.dirname(guiPath), "DocWenCLI.exe");
    if (fs.existsSync(candidate)) return candidate;
    return null;
  }

  private async runCliJson(args: string[]): Promise<any> {
    const cliPath = this.resolveCliExecutablePath();
    if (!cliPath) {
      throw new Error("cli_not_found");
    }

    const effectiveArgs = [...args];
    if (!effectiveArgs.includes("--lang") && !effectiveArgs.some((a) => a.startsWith("--lang="))) {
      const code = this.getDocwenLangCode();
      if (code) effectiveArgs.push("--lang", code);
    }
    if (!effectiveArgs.includes("--json")) effectiveArgs.push("--json");
    if (!effectiveArgs.includes("--quiet")) effectiveArgs.push("--quiet");

    return await new Promise((resolve, reject) => {
      const child = spawn(cliPath, effectiveArgs, { windowsHide: true });
      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (d: Buffer) => (stdout += d.toString()));
      child.stderr?.on("data", (d: Buffer) => (stderr += d.toString()));

      child.on("error", (e: Error) => reject(e));
      child.on("close", (code: number | null) => {
        const out = stdout.trim();
        if (!out) {
          reject(new Error(stderr || `empty_stdout (code=${code})`));
          return;
        }
        try {
          resolve(JSON.parse(out));
        } catch {
          reject(new Error(`invalid_json: ${out.slice(0, 500)}`));
        }
      });
    });
  }

  private async copyText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}

    try {
      const { clipboard } = require("electron");
      clipboard.writeText(text);
      return true;
    } catch {}

    return false;
  }

  /**
   * Format CLI failure message — supports v2 envelope (error in result.error)
   * with fallback to v1 (error fields at top level)
   */
  private async formatCliFailure(result: any): Promise<{ message: string; copied: boolean }> {
    // v2 envelope: error info in result.error object
    const errorObj = result?.error ?? {};
    const code = String(errorObj?.error_code || result?.error_code || result?.errorCode || result?.code || "error");
    const message = String(errorObj?.message || result?.message || result?.error || "");
    const details = errorObj?.details ?? result?.details ?? result?.error_details ?? result?.errorDetails ?? null;

    const err = `${code}${message ? `: ${message}` : ""}`;
    if (!details) return { message: err, copied: false };

    const detailsText =
      typeof details === "string" ? details : JSON.stringify(details, null, 2);
    const payload = JSON.stringify(
      { error_code: code, message: message || undefined, details },
      null,
      2
    );
    const copied = await this.copyText(payload || detailsText);
    return { message: err, copied };
  }

  // ==================== CLI Data Query Methods ====================

  /**
   * Fetch available templates from CLI
   * CLI command: templates list [--target docx|xlsx] --json --quiet
   */
  private async fetchTemplates(target?: string): Promise<TemplateItem[] | null> {
    try {
      const args: string[] = ["templates", "list"];
      if (target) args.push("--target", target);
      const result = await this.runCliJson(args);
      if (result?.success && result?.data?.templates) {
        return result.data.templates;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Fetch available optimization types from CLI
   * CLI command: list optimizations [--scope xxx] --json --quiet
   */
  private async fetchOptimizations(scope?: string): Promise<OptimizationItem[] | null> {
    try {
      const args: string[] = ["list", "optimizations"];
      if (scope) args.push("--scope", scope);
      const result = await this.runCliJson(args);
      if (result?.success && result?.data?.optimizations) {
        return result.data.optimizations;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Infer optimization scope from file extension
   */
  private getOptimizationScope(filePath: string): string | null {
    const ext = path.extname(filePath).toLowerCase();
    if ([".docx", ".doc", ".odt", ".rtf"].includes(ext)) return "document_to_md";
    if ([".pdf", ".ofd", ".xps", ".caj"].includes(ext)) return "layout_to_md";
    if ([".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".gif"].includes(ext)) return "image_to_md";
    if ([".xlsx", ".xls", ".ods", ".csv"].includes(ext)) return "spreadsheet_to_md";
    return null;
  }

  /**
   * Fetch available numbering schemes from CLI
   * CLI command: numbering-schemes list --json --quiet
   */
  public async fetchNumberingSchemes(): Promise<NumberingSchemeItem[] | null> {
    try {
      const args: string[] = ["numbering-schemes", "list"];
      const result = await this.runCliJson(args);
      if (result?.success && result?.data?.schemes) {
        return result.data.schemes;
      }
      return null;
    } catch {
      return null;
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Resolve a vault-relative path from a TFile to an absolute file path
   */
  private resolveAbsolutePath(file: TFile): string | null {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) return null;
    return path.join(adapter.getBasePath(), file.path);
  }

  /**
   * Resolve TAbstractFile to a TFile, supporting Folder Note convention
   * If the abstractFile is a TFolder, look for a same-named .md file inside it
   */
  private resolveTargetFile(abstractFile: TAbstractFile): TFile | null {
    if (abstractFile instanceof TFile) {
      return abstractFile;
    }
    if (abstractFile instanceof TFolder) {
      // Folder Note convention: FolderName/FolderName.md
      const candidate = abstractFile.children?.find(
        (child) =>
          child instanceof TFile &&
          child.basename === abstractFile.name &&
          child.extension === "md"
      );
      if (candidate instanceof TFile) {
        return candidate;
      }
    }
    return null;
  }

  // ==================== Helper: Build MD export args ====================

  /**
   * Build CLI arguments for Markdown export based on plugin settings
   * Appends --extract-img / --no-extract-img and --ocr as needed
   */
  private buildMdExportArgs(): string[] {
    const args: string[] = ["--to", "md"];
    if (this.settings.extractImages) {
      args.push("--extract-img");
    } else {
      args.push("--no-extract-img");
    }
    if (this.settings.enableOcr) {
      args.push("--ocr");
    }
    return args;
  }

  private buildNumberingArgs(cleanMode: string, addMode: string): string[] {
    const args: string[] = [];
    if (cleanMode !== "default") {
      args.push("--clean-numbering", cleanMode);
    }
    if (addMode !== "default") {
      args.push("--add-numbering", addMode);
    }
    return args;
  }

  // ==================== Export Methods ====================

  /**
   * Run CLI export for a given file path
   * @param filePath - Absolute file path
   * @param subcommand - CLI subcommand (e.g., "convert")
   * @param extraArgs - Additional arguments (e.g., ["--to", "docx", "--template", "XXX"])
   */
  private async runExportForFile(filePath: string, subcommand: string, extraArgs: string[]): Promise<void> {
    try {
      const result = await this.runCliJson([subcommand, filePath, ...extraArgs]);
      const ok = result?.success === true;
      if (ok) {
        const data = result?.data ?? {};
        const out = String(data?.output_file || data?.outputFile || "");
        new Notice(
          t("noticeExportSuccess", {
            filename: out ? path.basename(out) : path.basename(filePath),
          })
        );
      } else {
        const f = await this.formatCliFailure(result);
        new Notice(t(f.copied ? "noticeExportFailedCopied" : "noticeExportFailed", { error: f.message }));
      }
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "cli_not_found") {
        new Notice(t("noticeCliNotFound"));
      } else if (msg.startsWith("invalid_json")) {
        new Notice(t("noticeCliInvalidJson"));
      } else {
        new Notice(t("noticeExportFailed", { error: msg }));
      }
    }
  }

  /**
   * Run export for the active file (delegates to runExportForFile)
   */
  private async runExportForActiveFile(subcommand: string, extraArgs: string[]): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) return;
    const filePath = this.resolveAbsolutePath(activeFile);
    if (!filePath) return;
    await this.runExportForFile(filePath, subcommand, extraArgs);
  }

  /**
   * Export current file to Docx with template picker
   * MD → docx requires a template (user must select one)
   */
  private async exportCurrentFileToDocx(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) return;

    // Check if the source is markdown — templates are required for md→docx
    const ext = path.extname(activeFile.path).toLowerCase();
    const isMarkdown = [".md", ".markdown", ".txt"].includes(ext);

    if (isMarkdown) {
      // Fetch templates and show picker
      const templates = await this.fetchTemplates("docx");

      if (templates && templates.length > 0) {
        const items: PickerItem[] = templates.map((tpl) => ({
          id: tpl.id,
          label: tpl.name,
          description: tpl.description,
        }));

        new ItemPickerModal(
          this.app,
          items,
          t("pickerTemplatePlaceholder"),
          async (chosen) => {
            await this.runExportForActiveFile("convert", [
              "--to",
              "docx",
              "--template",
              chosen.id,
              ...this.buildNumberingArgs(this.settings.mdToDocCleanNumbering, this.settings.mdToDocAddNumbering),
            ]);
          }
        ).open();
      } else {
        // No templates available — cannot export md→docx without template
        new Notice(t("noticeNoTemplatesAvailable"));
      }
    } else {
      // Non-markdown source → direct convert (no template needed)
      await this.runExportForActiveFile("convert", ["--to", "docx"]);
    }
  }

  /**
   * Export current file to Xlsx with template picker
   * MD → xlsx requires a template (user must select one)
   */
  private async exportCurrentFileToXlsx(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) return;

    const ext = path.extname(activeFile.path).toLowerCase();
    const isMarkdown = [".md", ".markdown", ".txt"].includes(ext);

    if (isMarkdown) {
      const templates = await this.fetchTemplates("xlsx");

      if (templates && templates.length > 0) {
        const items: PickerItem[] = templates.map((tpl) => ({
          id: tpl.id,
          label: tpl.name,
          description: tpl.description,
        }));

        new ItemPickerModal(
          this.app,
          items,
          t("pickerTemplatePlaceholder"),
          async (chosen) => {
            await this.runExportForActiveFile("convert", [
              "--to",
              "xlsx",
              "--template",
              chosen.id,
              ...this.buildNumberingArgs(this.settings.mdToDocCleanNumbering, this.settings.mdToDocAddNumbering),
            ]);
          }
        ).open();
      } else {
        new Notice(t("noticeNoTemplatesAvailable"));
      }
    } else {
      await this.runExportForActiveFile("convert", ["--to", "xlsx"]);
    }
  }

  /**
   * Export current file to Markdown with optimization type picker
   */
  private async exportCurrentFileToMarkdown(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) return;

    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) return;
    const basePath = adapter.getBasePath();
    const filePath = path.join(basePath, activeFile.path);

    // Determine scope from file type
    const scope = this.getOptimizationScope(filePath);

    // Fetch optimization types
    const optimizations = scope ? await this.fetchOptimizations(scope) : null;

    if (optimizations && optimizations.length > 0) {
      // Build picker items: first item is "no optimization"
      const items: PickerItem[] = [
        { id: "__none__", label: t("pickerNoOptimization") },
        ...optimizations.map((opt) => ({
          id: opt.id,
          label: opt.name,
          description: opt.description,
        })),
      ];

      new ItemPickerModal(
        this.app,
        items,
        t("pickerOptimizationPlaceholder"),
        async (chosen) => {
          const extraArgs: string[] = this.buildMdExportArgs();
          if (chosen.id !== "__none__") {
            extraArgs.push("--optimize-for", chosen.id);
          }
          const ext = path.extname(filePath).toLowerCase();
          if ([".docx", ".doc", ".odt", ".rtf"].includes(ext)) {
            extraArgs.push(
              ...this.buildNumberingArgs(this.settings.docToMdCleanNumbering, this.settings.docToMdAddNumbering)
            );
          }
          await this.runExportForActiveFile("convert", extraArgs);
        }
      ).open();
    } else {
      // No optimization types available → direct export
      const extraArgs: string[] = this.buildMdExportArgs();
      const ext = path.extname(filePath).toLowerCase();
      if ([".docx", ".doc", ".odt", ".rtf"].includes(ext)) {
        extraArgs.push(...this.buildNumberingArgs(this.settings.docToMdCleanNumbering, this.settings.docToMdAddNumbering));
      }
      await this.runExportForActiveFile("convert", extraArgs);
    }
  }

  /**
   * Add numbering to current Markdown file (with scheme picker)
   */
  private async addNumberingToCurrentFile(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) return;

    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) return;
    const basePath = adapter.getBasePath();
    const filePath = path.join(basePath, activeFile.path);

    // Fetch numbering schemes
    const schemes = await this.fetchNumberingSchemes();

    if (schemes && schemes.length > 0) {
      const items: PickerItem[] = schemes.map((s) => ({
        id: s.id,
        label: s.name,
        description: s.description,
      }));

      new ItemPickerModal(
        this.app,
        items,
        t("pickerNumberingSchemePlaceholder"),
        async (chosen) => {
          await this.runNumberingCommand(filePath, "add", chosen.id);
        }
      ).open();
    } else {
      // Fallback: use default scheme
      await this.runNumberingCommand(filePath, "add", "gongwen_standard");
    }
  }

  /**
   * Remove numbering from current Markdown file
   */
  private async removeNumberingFromCurrentFile(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) return;

    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) return;
    const basePath = adapter.getBasePath();
    const filePath = path.join(basePath, activeFile.path);

    await this.runNumberingCommand(filePath, "remove", null);
  }

  /**
   * Execute md-numbering CLI command
   */
  private async runNumberingCommand(filePath: string, operation: "add" | "remove", scheme: string | null): Promise<void> {
    try {
      const args: string[] = ["md-numbering", filePath];
      if (operation === "add") {
        args.push("--clean-numbering", "keep", "--add-numbering", scheme || "gongwen_standard");
      } else if (operation === "remove") {
        args.push("--clean-numbering", "remove", "--add-numbering", "none");
      } else {
        throw new Error("invalid_operation");
      }
      const result = await this.runCliJson(args);
      const ok = result?.success === true;
      if (ok) {
        new Notice(t("noticeNumberingSuccess", { filename: path.basename(filePath) }));
      } else {
        const f = await this.formatCliFailure(result);
        new Notice(t(f.copied ? "noticeNumberingFailedCopied" : "noticeNumberingFailed", { error: f.message }));
      }
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "cli_not_found") {
        new Notice(t("noticeCliNotFound"));
      } else if (msg.startsWith("invalid_json")) {
        new Notice(t("noticeCliInvalidJson"));
      } else {
        new Notice(t("noticeNumberingFailed", { error: msg }));
      }
    }
  }

  // ==================== Context Menu Export Methods ====================

  /**
   * Export a file to Docx (used by context menu)
   * @param filePath - Absolute file path
   */
  private async exportFileToDocx(filePath: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    const isMarkdown = [".md", ".markdown", ".txt"].includes(ext);

    if (isMarkdown) {
      const templates = await this.fetchTemplates("docx");
      if (templates && templates.length > 0) {
        const items: PickerItem[] = templates.map((tpl) => ({
          id: tpl.id,
          label: tpl.name,
          description: tpl.description,
        }));
        new ItemPickerModal(
          this.app,
          items,
          t("pickerTemplatePlaceholder"),
          async (chosen) => {
            await this.runExportForFile(filePath, "convert", [
              "--to",
              "docx",
              "--template",
              chosen.id,
              ...this.buildNumberingArgs(this.settings.mdToDocCleanNumbering, this.settings.mdToDocAddNumbering),
            ]);
          }
        ).open();
      } else {
        new Notice(t("noticeNoTemplatesAvailable"));
      }
    } else {
      await this.runExportForFile(filePath, "convert", ["--to", "docx"]);
    }
  }

  /**
   * Export a file to Xlsx (used by context menu)
   * @param filePath - Absolute file path
   */
  private async exportFileToXlsx(filePath: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    const isMarkdown = [".md", ".markdown", ".txt"].includes(ext);

    if (isMarkdown) {
      const templates = await this.fetchTemplates("xlsx");
      if (templates && templates.length > 0) {
        const items: PickerItem[] = templates.map((tpl) => ({
          id: tpl.id,
          label: tpl.name,
          description: tpl.description,
        }));
        new ItemPickerModal(
          this.app,
          items,
          t("pickerTemplatePlaceholder"),
          async (chosen) => {
            await this.runExportForFile(filePath, "convert", [
              "--to",
              "xlsx",
              "--template",
              chosen.id,
              ...this.buildNumberingArgs(this.settings.mdToDocCleanNumbering, this.settings.mdToDocAddNumbering),
            ]);
          }
        ).open();
      } else {
        new Notice(t("noticeNoTemplatesAvailable"));
      }
    } else {
      await this.runExportForFile(filePath, "convert", ["--to", "xlsx"]);
    }
  }

  /**
   * Export a file to Markdown (used by context menu)
   * @param filePath - Absolute file path
   */
  private async exportFileToMarkdown(filePath: string): Promise<void> {
    const scope = this.getOptimizationScope(filePath);
    const optimizations = scope ? await this.fetchOptimizations(scope) : null;

    if (optimizations && optimizations.length > 0) {
      const items: PickerItem[] = [
        { id: "__none__", label: t("pickerNoOptimization") },
        ...optimizations.map((opt) => ({
          id: opt.id,
          label: opt.name,
          description: opt.description,
        })),
      ];
      new ItemPickerModal(
        this.app,
        items,
        t("pickerOptimizationPlaceholder"),
        async (chosen) => {
          const extraArgs: string[] = this.buildMdExportArgs();
          if (chosen.id !== "__none__") {
            extraArgs.push("--optimize-for", chosen.id);
          }
          const ext = path.extname(filePath).toLowerCase();
          if ([".docx", ".doc", ".odt", ".rtf"].includes(ext)) {
            extraArgs.push(
              ...this.buildNumberingArgs(this.settings.docToMdCleanNumbering, this.settings.docToMdAddNumbering)
            );
          }
          await this.runExportForFile(filePath, "convert", extraArgs);
        }
      ).open();
    } else {
      const extraArgs: string[] = this.buildMdExportArgs();
      const ext = path.extname(filePath).toLowerCase();
      if ([".docx", ".doc", ".odt", ".rtf"].includes(ext)) {
        extraArgs.push(...this.buildNumberingArgs(this.settings.docToMdCleanNumbering, this.settings.docToMdAddNumbering));
      }
      await this.runExportForFile(filePath, "convert", extraArgs);
    }
  }

  /**
   * Add numbering to a file (used by context menu)
   * @param filePath - Absolute file path
   */
  private async addNumberingToFile(filePath: string): Promise<void> {
    const schemes = await this.fetchNumberingSchemes();
    if (schemes && schemes.length > 0) {
      const items: PickerItem[] = schemes.map((s) => ({
        id: s.id,
        label: s.name,
        description: s.description,
      }));
      new ItemPickerModal(
        this.app,
        items,
        t("pickerNumberingSchemePlaceholder"),
        async (chosen) => {
          await this.runNumberingCommand(filePath, "add", chosen.id);
        }
      ).open();
    } else {
      await this.runNumberingCommand(filePath, "add", "gongwen_standard");
    }
  }

  // ==================== File Menu Registration ====================

  /**
   * Register file-menu (right-click) context menu items
   * All DocWen actions are grouped into a single submenu to keep the context menu clean.
   */
  private registerFileMenu(): void {
    // Extensions that can be converted to Markdown
    const canConvertToMd = new Set([
      ".docx", ".doc", ".odt", ".rtf",
      ".xlsx", ".xls", ".ods", ".csv",
      ".pdf", ".ofd", ".xps", ".caj",
      ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".gif",
    ]);

    // Extensions that can be converted to Docx/Xlsx (markdown-like)
    const canConvertToDocxXlsx = new Set([".md", ".markdown", ".txt"]);

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu: Menu, abstractFile: TAbstractFile) => {
        // Resolve the target file (supports Folder Note)
        const targetFile = this.resolveTargetFile(abstractFile);
        if (!targetFile) return;

        const filePath = this.resolveAbsolutePath(targetFile);
        if (!filePath) return;

        const ext = path.extname(targetFile.path).toLowerCase();
        const isMd = ext === ".md";
        const hasConvertToMd = canConvertToMd.has(ext);
        const hasConvertToDocxXlsx = canConvertToDocxXlsx.has(ext);

        // Only add submenu if there is at least one applicable action
        // (Open in DocWen is always available, so submenu is always shown)
        menu.addItem((item) => {
          item
            .setTitle(t("contextMenuSubmenuTitle"))
            .setIcon("file-text");

          const submenu = (item as any).setSubmenu() as Menu;

          // --- Convert to Markdown ---
          if (hasConvertToMd) {
            submenu.addItem((sub) => {
              sub
                .setTitle(t("contextMenuConvertToMd"))
                .setIcon("file-text")
                .onClick(() => {
                  void this.exportFileToMarkdown(filePath);
                });
            });
          }

          // --- Convert to Word (Docx) ---
          if (hasConvertToDocxXlsx) {
            submenu.addItem((sub) => {
              sub
                .setTitle(t("contextMenuConvertToDocx"))
                .setIcon("file-output")
                .onClick(() => {
                  void this.exportFileToDocx(filePath);
                });
            });
          }

          // --- Convert to Excel (XLSX) ---
          if (hasConvertToDocxXlsx) {
            submenu.addItem((sub) => {
              sub
                .setTitle(t("contextMenuConvertToXlsx"))
                .setIcon("table")
                .onClick(() => {
                  void this.exportFileToXlsx(filePath);
                });
            });
          }

          // --- Separator before numbering actions (md only) ---
          if (isMd && (hasConvertToMd || hasConvertToDocxXlsx)) {
            submenu.addSeparator();
          }

          // --- Add numbering (md only) ---
          if (isMd) {
            submenu.addItem((sub) => {
              sub
                .setTitle(t("contextMenuAddNumbering"))
                .setIcon("list-ordered")
                .onClick(() => {
                  void this.addNumberingToFile(filePath);
                });
            });
          }

          // --- Remove numbering (md only) ---
          if (isMd) {
            submenu.addItem((sub) => {
              sub
                .setTitle(t("contextMenuRemoveNumbering"))
                .setIcon("list-x")
                .onClick(() => {
                  void this.runNumberingCommand(filePath, "remove", null);
                });
            });
          }

          // --- Separator before "Open in DocWen" ---
          submenu.addSeparator();

          // --- Open in DocWen (all files) ---
          submenu.addItem((sub) => {
            sub
              .setTitle(t("contextMenuOpenInDocWen"))
              .setIcon("external-link")
              .onClick(() => {
                this.launchExecutable(filePath);
              });
          });
        });
      })
    );
  }

  /**
   * Run doctor check using new subcommand format
   */
  private async runDoctorCheck(): Promise<void> {
    try {
      // New format: doctor subcommand
      const result = await this.runCliJson(["doctor"]);
      // v2 envelope: success at top level
      const ok = result?.success === true;
      if (ok) {
        new Notice(t("noticeDoctorSuccess"));
      } else {
        const f = await this.formatCliFailure(result);
        new Notice(t(f.copied ? "noticeDoctorFailedCopied" : "noticeDoctorFailed", { error: f.message }));
      }
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "cli_not_found") {
        new Notice(t("noticeCliNotFound"));
      } else if (msg.startsWith("invalid_json")) {
        new Notice(t("noticeCliInvalidJson"));
      } else {
        new Notice(t("noticeDoctorFailed", { error: msg }));
      }
    }
  }

  /**
   * Plugin load lifecycle hook
   */
  async onload() {
    // Initialize i18n with Obsidian's locale
    const locale = document.documentElement.lang || "en";
    initI18n(locale);
    
    // Load settings
    await this.loadSettings();

    // Add Ribbon Icon (left sidebar icon)
    const ribbonIconEl = this.addRibbonIcon(
      "file-text",
      t("ribbonTooltip"),
      (_evt: MouseEvent) => {
        this.launchOrSendFile();
      }
    );

    // Add CSS class for custom styling
    ribbonIconEl.addClass("docwen-ribbon-class");

    // Add settings tab
    this.addSettingTab(new SettingTab(this.app, this));

    // Add command palette commands
    this.addCommand({
      id: "launch-docwen",
      name: t("commandLaunch"),
      callback: () => {
        this.launchOrSendFile();
      },
    });

    this.addCommand({
      id: "launch-docwen-with-file",
      name: t("commandLaunchWithFile"),
      checkCallback: (checking: boolean) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
          if (!checking) {
            this.launchOrSendFile();
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "export-docx-background",
      name: t("commandExportDocx"),
      checkCallback: (checking: boolean) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
          if (!checking) {
            void this.exportCurrentFileToDocx();
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "export-xlsx-background",
      name: t("commandExportXlsx"),
      checkCallback: (checking: boolean) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
          if (!checking) {
            void this.exportCurrentFileToXlsx();
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "export-md-background",
      name: t("commandExportMd"),
      checkCallback: (checking: boolean) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
          if (!checking) {
            void this.exportCurrentFileToMarkdown();
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "add-numbering",
      name: t("commandAddNumbering"),
      checkCallback: (checking: boolean) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && activeFile.path.toLowerCase().endsWith(".md")) {
          if (!checking) {
            void this.addNumberingToCurrentFile();
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "remove-numbering",
      name: t("commandRemoveNumbering"),
      checkCallback: (checking: boolean) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && activeFile.path.toLowerCase().endsWith(".md")) {
          if (!checking) {
            void this.removeNumberingFromCurrentFile();
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "doctor-check",
      name: t("commandDoctor"),
      callback: () => {
        void this.runDoctorCheck();
      },
    });

    // Register file-menu (right-click) context menu
    this.registerFileMenu();
  }

  /**
   * Plugin unload lifecycle hook
   */
  onunload() {}

  /**
   * Load plugin settings from storage
   */
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  /**
   * Save plugin settings to storage
   */
  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * Get the IPC directory path in system temp folder
   * @returns Full path to the IPC directory
   */
  getIPCDir(): string {
    return path.join(os.tmpdir(), this.IPC_DIR_NAME);
  }

  /**
   * Check if DocWen converter is running with process detection
   * @returns true if converter is running, false otherwise
   */
  isConverterRunning(): boolean {
    const statusFile = path.join(this.getIPCDir(), "status.json");
    const ttlMs = 24 * 60 * 60 * 1000;
    
    // 1. Check if status file exists
    if (!fs.existsSync(statusFile)) {
      return false;
    }
    
    try {
      try {
        const st = fs.statSync(statusFile);
        const age = Date.now() - st.mtimeMs;
        if (age > ttlMs) {
          fs.unlinkSync(statusFile);
          return false;
        }
      } catch {}

      // 2. Read status file
      const content = fs.readFileSync(statusFile, 'utf-8');
      const status = JSON.parse(content);
      const pid = status.pid;
      const startedAt = status.started_at ?? status.startedAt ?? null;
      
      if (!pid || typeof pid !== 'number') {
        // Invalid status file format, clean it up
        console.warn("Invalid status file format, cleaning up");
        try {
          fs.unlinkSync(statusFile);
        } catch (e) {
          console.error("Failed to clean up status file:", e);
        }
        return false;
      }

      if (typeof startedAt === "number" && startedAt > 0) {
        const age = Date.now() - startedAt;
        if (age > ttlMs) {
          try {
            fs.unlinkSync(statusFile);
          } catch {}
          return false;
        }
      }
      
      // 3. Check if process actually exists
      try {
        // process.kill(pid, 0) doesn't kill the process, only checks if it exists
        // If process exists, no exception is thrown
        // If process doesn't exist, ESRCH error is thrown
        process.kill(pid, 0);
        const commandsDir = path.join(this.getIPCDir(), "commands");
        if (!fs.existsSync(commandsDir)) return false;
        console.log(`DocWen process detected (PID: ${pid})`);
        return true;
      } catch (e: any) {
        // Process doesn't exist, clean up residual status file
        if (e.code === 'ESRCH') {
          console.log(`Process ${pid} does not exist, cleaning up`);
        } else if (e.code === 'EPERM') {
          // Permission denied, but process exists
          console.log(`Process ${pid} exists but no permission to check`);
          return true;
        } else {
          console.warn(`Error checking process ${pid}:`, e.code);
        }
        
        // Clean up residual files
        try {
          fs.unlinkSync(statusFile);
          console.log("Cleaned up residual status file");
        } catch (cleanupError) {
          console.error("Failed to clean up status file:", cleanupError);
        }
        return false;
      }
    } catch (e) {
      // Failed to read or parse status file
      console.error("Failed to read status file:", e);
      try {
        fs.unlinkSync(statusFile);
      } catch {}
      return false;
    }
  }

  /**
   * Send command to running DocWen instance via IPC
   * @param command - The command object to send
   * @returns true if command was sent successfully, false otherwise
   */
  sendCommand(command: any): boolean {
    try {
      const commandsDir = path.join(this.getIPCDir(), "commands");
      
      if (!fs.existsSync(commandsDir)) {
        console.error("Commands directory does not exist, DocWen may not be running");
        return false;
      }
      
      const timestamp = Date.now();
      const rand = typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : crypto.randomBytes(8).toString("hex");
      const cmdFile = path.join(commandsDir, `cmd_${timestamp}_${rand}.json`);
      
      fs.writeFileSync(cmdFile, JSON.stringify(command, null, 2), 'utf-8');
      
      console.log(`Command sent: ${command.action}`);
      return true;
    } catch (error) {
      console.error("Failed to send command:", error);
      return false;
    }
  }

  /**
   * Main logic: launch DocWen or send file to running instance
   */
  async launchOrSendFile() {
    const isRunning = this.isConverterRunning();
    
    // Get current file
    const activeFile = this.app.workspace.getActiveFile();
    let filePath: string | null = null;

    if (activeFile && activeFile.path) {
      const adapter = this.app.vault.adapter;
      if (adapter instanceof FileSystemAdapter) {
        const basePath = adapter.getBasePath();
        filePath = path.join(basePath, activeFile.path);
      }
    }

    if (isRunning) {
      // DocWen is running: send command
      console.log("DocWen is running, sending command");
      
      const command = filePath 
        ? { action: 'add_file', file_path: filePath, mode: 'single' }
        : { action: 'activate' };
      
      const success = this.sendCommand(command);
      
      if (success) {
        const message = filePath 
          ? t("noticeFileAdded", { filename: path.basename(filePath) })
          : t("noticeWindowActivated");
        new Notice(message);
      } else {
        this.launchExecutable(filePath);
      }
    } else {
      // DocWen is not running: launch it
      console.log("DocWen is not running, launching");
      this.launchExecutable(filePath);
    }
  }

  /**
   * Launch the DocWen executable
   * @param filePath - Optional file path to pass as argument
   */
  launchExecutable(filePath: string | null = null) {
    const resolved = this.resolveGuiExecutablePath();
    if (!resolved) {
      // Distinguish "not set" vs "set but not found"
      const hasAnyPath = (this.settings.executablePath || "").trim() || (this.settings.cliExecutablePath || "").trim();
      new Notice(t(hasAnyPath ? "noticePathNotExist" : "noticePathNotSet"));
      return;
    }

    const args: string[] = [];
    if (filePath) {
      args.push(filePath);
    }

    try {
      const child = spawn(resolved, args, {
        detached: true,
        stdio: "ignore",
      });

      const message = args.length > 0
        ? t("noticeLaunchedWithFile", { filename: path.basename(args[0]) })
        : t("noticeLaunched");

      let finished = false;
      const successTimer = setTimeout(() => {
        if (finished) return;
        finished = true;
        new Notice(message);
      }, 500);

      child.on("error", (error: any) => {
        if (!finished) {
          finished = true;
          clearTimeout(successTimer);
          new Notice(t("noticeLaunchFailed", { error: String(error?.message || error) }));
        }
        console.error("Launch error:", error);
      });

      setTimeout(() => {
        child.unref();
      }, 800);
    } catch (error: any) {
      new Notice(t("noticeLaunchFailed", { error: String(error?.message || error) }));
      console.error("Launch error:", error);
    }
  }
}

/**
 * DocWen Assistant - Obsidian Plugin
 * 
 * Launch DocWen converter from Obsidian and pass the current file path.
 * Supports single instance management via file-based IPC.
 */

import { Plugin, Notice, FileSystemAdapter } from "obsidian";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { PluginSettings, SettingTab, DEFAULT_SETTINGS } from "./settings";
import { initI18n, t } from "./i18n";

/**
 * DocWen Assistant Plugin
 * Main plugin class for launching and communicating with DocWen converter
 */
export default class DocWenPlugin extends Plugin {
  settings: PluginSettings;
  private readonly IPC_DIR_NAME = "docwen";

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
      (evt: MouseEvent) => {
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
    
    // 1. Check if status file exists
    if (!fs.existsSync(statusFile)) {
      return false;
    }
    
    try {
      // 2. Read status file
      const content = fs.readFileSync(statusFile, 'utf-8');
      const status = JSON.parse(content);
      const pid = status.pid;
      
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
      
      // 3. Check if process actually exists
      try {
        // process.kill(pid, 0) doesn't kill the process, only checks if it exists
        // If process exists, no exception is thrown
        // If process doesn't exist, ESRCH error is thrown
        process.kill(pid, 0);
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
      } catch (cleanupError) {
        // Ignore cleanup error
      }
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
      const cmdFile = path.join(commandsDir, `cmd_${timestamp}.json`);
      
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
        new Notice(t("noticeCommandFailed"));
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
    let { executablePath } = this.settings;

    if (!executablePath) {
      new Notice(t("noticePathNotSet"));
      return;
    }

    // 1. Remove quotes from path and trim whitespace
    executablePath = executablePath.trim().replace(/^['"]|['"]$/g, "");

    // 2. Normalize path for cross-platform compatibility
    const normalizedPath = path.normalize(executablePath);

    // 3. Verify file exists
    if (!fs.existsSync(normalizedPath)) {
      new Notice(t("noticePathNotExist"));
      return;
    }

    const args: string[] = [];
    if (filePath) {
      args.push(filePath);
    }

    try {
      // Use spawn in detached mode to avoid blocking
      const child = spawn(normalizedPath, args, {
        detached: true,
        stdio: "ignore",
      });

      // Detach child process for independent execution
      child.unref();

      // Show success notification
      const message = args.length > 0
        ? t("noticeLaunchedWithFile", { filename: path.basename(args[0]) })
        : t("noticeLaunched");
      new Notice(message);

      console.log(`Successfully launched: ${normalizedPath}`);
      if (args.length > 0) {
        console.log(`Arguments: ${args.join(", ")}`);
      }
    } catch (error) {
      new Notice(`Launch failed: ${error.message}`);
      console.error("Launch error:", error);
    }
  }
}

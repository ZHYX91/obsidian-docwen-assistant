import * as fs from "node:fs";

export function pathExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function isFile(filePath: string): boolean {
  return pathExists(filePath) && fs.statSync(filePath).isFile();
}

export function isDirectory(filePath: string): boolean {
  return pathExists(filePath) && fs.statSync(filePath).isDirectory();
}

import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const command = process.argv[2] ?? "prepare";
if (!new Set(["clean", "prepare"]).has(command)) {
  throw new Error(`Unknown prepare-build command: ${command}`);
}
await rm(resolve(root, "dist"), { recursive: true, force: true });
if (command === "clean") await rm(resolve(root, "release"), { recursive: true, force: true });
await mkdir(resolve(root, "dist"), { recursive: true });

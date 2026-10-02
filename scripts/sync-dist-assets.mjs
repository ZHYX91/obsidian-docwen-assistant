import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { PRODUCTION_ASSETS } from "./product-assets.mjs";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
await mkdir(dist, { recursive: true });
for (const asset of PRODUCTION_ASSETS.filter((name) => name !== "main.js")) {
  await copyFile(resolve(root, asset), resolve(dist, asset));
}

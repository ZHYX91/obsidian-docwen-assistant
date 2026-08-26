import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const workflowPath = resolve(".github/workflows/release.yml");
const boundaryPath = resolve("scripts/publication-boundary.py");
const boundary = await readFile(boundaryPath);
const encoded = boundary.toString("base64");
const digest = createHash("sha256").update(boundary).digest("hex");
let workflow = await readFile(workflowPath, "utf8");

workflow = replaceExactlyOnce(
  workflow,
  /^(\s*PUBLICATION_BOUNDARY_B64:\s+)[A-Za-z0-9+/=]+$/mu,
  `$1${encoded}`,
  "PUBLICATION_BOUNDARY_B64",
);
workflow = replaceExactlyOnce(
  workflow,
  /^(\s*PUBLICATION_BOUNDARY_SHA256:\s+)[0-9a-f]{64}$/mu,
  `$1${digest}`,
  "PUBLICATION_BOUNDARY_SHA256",
);

await writeFile(workflowPath, workflow, "utf8");
console.log(`Synchronized publication boundary: sha256:${digest}`);

function replaceExactlyOnce(source, pattern, replacement, label) {
  const matches = source.match(new RegExp(pattern.source, pattern.flags.replace("m", "gm")));
  if (matches?.length !== 1) {
    throw new Error(`Expected exactly one ${label} field in ${workflowPath}`);
  }
  return source.replace(pattern, replacement);
}

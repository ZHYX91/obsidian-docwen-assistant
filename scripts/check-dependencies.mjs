import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function checkDependencies({ npmExecutable = process.env.npm_execpath } = {}) {
  if (!npmExecutable || path.basename(npmExecutable).toLowerCase() === "npm.cmd") {
    throw new Error("Dependency audit requires npm_execpath to name npm-cli.js");
  }
  const result = spawnSync(
    process.execPath,
    [npmExecutable, "audit", "--audit-level=high"],
    { encoding: "utf8", stdio: "pipe" },
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Dependency audit failed with exit code ${String(result.status)}`);
  }
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;
if (import.meta.url === entryPoint) checkDependencies();

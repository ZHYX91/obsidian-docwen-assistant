import { mkdir, mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vi } from "vitest";

/** Exercise the OS temporary-directory lookup through a real alias. */
export async function withAliasedTemp(run: (target: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(await realpath(tmpdir()), "docwen-alias-"));
  const alias = join(root, "alias");
  const target = join(root, "target");
  try {
    await mkdir(target);
    await symlink(target, alias, process.platform === "win32" ? "junction" : "dir");
    vi.stubEnv(process.platform === "win32" ? "TEMP" : "TMPDIR", alias);
    await run(target);
  } finally {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  }
}

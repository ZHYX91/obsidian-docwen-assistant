import { spawnSync } from "node:child_process";
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const workspaces: string[] = [];

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })));
});

describe("version synchronization", () => {
  it("updates package, lockfile, manifest and versions in one invocation", async () => {
    const root = await mkdtemp(join(tmpdir(), "docwen-assistant-version-test-"));
    workspaces.push(root);
    await mkdir(join(root, "scripts"));
    await copyFile("scripts/set-version.mjs", join(root, "scripts", "set-version.mjs"));
    await writeJson(join(root, "package.json"), { version: "2.0.0" });
    await writeJson(join(root, "package-lock.json"), {
      version: "2.0.0",
      packages: { "": { version: "2.0.0" } },
    });
    await writeJson(join(root, "manifest.json"), {
      version: "2.0.0",
      minAppVersion: "1.12.7",
    });
    await writeJson(join(root, "versions.json"), { "2.0.0": "1.12.7" });

    const result = spawnSync(process.execPath, [join(root, "scripts", "set-version.mjs"), "2.1.0"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect((await readJson(join(root, "package.json"))).version).toBe("2.1.0");
    const lock = await readJson(join(root, "package-lock.json"));
    expect(lock.version).toBe("2.1.0");
    expect((lock.packages as Record<string, { version: string }>)[""].version).toBe("2.1.0");
    expect((await readJson(join(root, "manifest.json"))).version).toBe("2.1.0");
    const versions = await readJson(join(root, "versions.json"));
    expect(versions["2.1.0"]).toBe("1.12.7");

    const invalid = spawnSync(process.execPath, [join(root, "scripts", "set-version.mjs"), "02.2.0"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(invalid.status).not.toBe(0);
    expect((await readJson(join(root, "package.json"))).version).toBe("2.1.0");
  });
});

async function writeJson(file: string, value: unknown): Promise<void> {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJson(file: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
}

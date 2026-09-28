import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertDirectoryPublicationSupported,
  publishDirectoryNoReplace,
} from "../src/docwen/publish-path";
import {
  LINUX_X64_RENAME_ADDON_BASE64,
  LINUX_X64_RENAME_ADDON_SHA256,
} from "../src/docwen/publish-path-linux-x64";

const roots: string[] = [];

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe("atomic directory publication boundary", () => {
  it("pins the embedded Node-API helper to its recorded public source and binary digests", async () => {
    const build = JSON.parse(await readFile(new URL("../native/BUILD.json", import.meta.url), "utf8")) as {
      sourceSha256: string;
      binarySha256: string;
      nodeApi: number;
      provenance: { commit: string };
    };
    const source = await readFile(new URL("../native/rename-directory.c", import.meta.url));
    const bytes = Buffer.from(LINUX_X64_RENAME_ADDON_BASE64, "base64");

    expect(createHash("sha256").update(source).digest("hex")).toBe(build.sourceSha256);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(build.binarySha256);
    expect(build.binarySha256).toBe(LINUX_X64_RENAME_ADDON_SHA256);
    expect(build.nodeApi).toBe(8);
    expect(build.provenance.commit).toBe("935f0a816da96c8f42a72ddba662d5556fa3ddd1");
  });

  it("rejects unsupported Linux architectures and Node-API levels without weakening Windows", () => {
    expect(() => assertDirectoryPublicationSupported("win32", "arm64", undefined)).not.toThrow();
    expect(() => assertDirectoryPublicationSupported("linux", "arm64", "8")).toThrowError(
      expect.objectContaining({ code: "cli_platform_unsupported" }),
    );
    expect(() => assertDirectoryPublicationSupported("linux", "x64", "7")).toThrowError(
      expect.objectContaining({ code: "cli_platform_unsupported" }),
    );
    expect(() => assertDirectoryPublicationSupported("darwin", "x64", "9")).toThrowError(
      expect.objectContaining({ code: "cli_platform_unsupported" }),
    );
  });

  it.skipIf(process.platform !== "linux" || process.arch !== "x64")(
    "loads the embedded helper and refuses to replace an existing empty directory",
    async () => {
      const root = await mkdtemp(path.join(tmpdir(), "docwen-publish-native-"));
      roots.push(root);
      const first = path.join(root, "first");
      const published = path.join(root, "published");
      await mkdir(first);
      await publishDirectoryNoReplace(first, published);
      expect(await readdir(published)).toEqual([]);

      const second = path.join(root, "second");
      await mkdir(second);
      const identity = await import("node:fs/promises").then(({ lstat }) => lstat(published, { bigint: true }));
      await expect(publishDirectoryNoReplace(second, published)).rejects.toMatchObject({ code: "cli_commit_failed" });
      const current = await import("node:fs/promises").then(({ lstat }) => lstat(published, { bigint: true }));
      expect({ dev: current.dev, ino: current.ino }).toEqual({ dev: identity.dev, ino: identity.ino });
      expect(await readdir(second)).toEqual([]);
    },
  );
});

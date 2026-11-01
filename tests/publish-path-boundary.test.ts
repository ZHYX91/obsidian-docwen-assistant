import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  rename: vi.fn(() => 0),
  cleanup: vi.fn(async () => undefined),
}));
vi.mock("node:fs/promises", async (importOriginal) => ({
  ...await importOriginal<typeof import("node:fs/promises")>(),
  mkdtemp: async () => "/tmp/owned-publication-helper",
  writeFile: async () => undefined,
  rm: () => native.cleanup(),
}));
vi.mock("node:module", async (importOriginal) => ({
  ...await importOriginal<typeof import("node:module")>(),
  createRequire: () => () => ({ renameDirectory: native.rename }),
}));

const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform")!;
const originalArch = Object.getOwnPropertyDescriptor(process, "arch")!;
beforeEach(() => {
  vi.resetModules();
  native.rename.mockClear();
  native.cleanup.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(process, "platform", { value: "linux" });
  Object.defineProperty(process, "arch", { value: "x64" });
});
afterEach(() => {
  Object.defineProperty(process, "platform", originalPlatform);
  Object.defineProperty(process, "arch", originalArch);
});

describe("Linux final publication guard", () => {
  it("rejects invalidation during cold native-helper loading before rename", async () => {
    const { publishDirectoryNoReplace } = await import("../src/docwen/publish-path");
    let current = true;
    native.cleanup.mockImplementation(async () => { current = false; });
    const error = new Error("source changed while loading native helper");
    await expect(publishDirectoryNoReplace("/source", "/destination", () => {
      if (!current) throw error;
    })).rejects.toBe(error);
    expect(native.rename).not.toHaveBeenCalled();
  });

  it("checks source invalidation after the warm helper's await", async () => {
    const { publishDirectoryNoReplace } = await import("../src/docwen/publish-path");
    await publishDirectoryNoReplace("/warm-source", "/warm-destination");
    native.rename.mockClear();
    let current = true;
    const error = new Error("final guard invalidated");
    const publishing = publishDirectoryNoReplace("/source", "/destination", () => {
      if (!current) throw error;
    });
    current = false;
    await expect(publishing).rejects.toBe(error);
    expect(native.rename).not.toHaveBeenCalled();
  });

  it("checks cancellation after the warm helper's await", async () => {
    const { publishDirectoryNoReplace } = await import("../src/docwen/publish-path");
    await publishDirectoryNoReplace("/warm-source", "/warm-destination");
    native.rename.mockClear();
    const controller = new AbortController();
    const publishing = publishDirectoryNoReplace("/source", "/destination", () => controller.signal.throwIfAborted());
    const reason = new Error("cancel publication");
    controller.abort(reason);
    await expect(publishing).rejects.toBe(reason);
    expect(native.rename).not.toHaveBeenCalled();
  });

  it("runs the guard immediately before the synchronous native rename", async () => {
    const { publishDirectoryNoReplace } = await import("../src/docwen/publish-path");
    const order: string[] = [];
    native.rename.mockImplementation(() => { order.push("rename"); return 0; });
    await publishDirectoryNoReplace("/source", "/destination", () => { order.push("guard"); });
    expect(order).toEqual(["guard", "rename"]);
  });
});

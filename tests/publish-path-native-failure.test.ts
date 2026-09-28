import { beforeEach, describe, expect, it, vi } from "vitest";

const nativeState = vi.hoisted(() => ({
  cleanupCode: null as string | null,
  loadCode: null as string | null,
  loadCalls: 0,
  mkdtempCalls: 0,
  rmCalls: 0,
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    mkdtemp: vi.fn(async () => {
      nativeState.mkdtempCalls += 1;
      return `/tmp/docwen-assistant-native-test-${nativeState.mkdtempCalls}`;
    }),
    writeFile: vi.fn(async () => undefined),
    rm: vi.fn(async () => {
      nativeState.rmCalls += 1;
      if (nativeState.cleanupCode) {
        throw Object.assign(new Error("synthetic cleanup failure"), { code: nativeState.cleanupCode });
      }
    }),
  };
});

vi.mock("node:module", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:module")>();
  return {
    ...actual,
    createRequire: vi.fn(() => (_path: string) => {
      nativeState.loadCalls += 1;
      if (nativeState.loadCode) {
        throw Object.assign(new Error("synthetic native load failure"), { code: nativeState.loadCode });
      }
      return { renameDirectory: () => 0 };
    }),
  };
});

import { getFailureWarnings } from "../src/docwen/operation-outcome";
import { publishDirectoryNoReplace } from "../src/docwen/publish-path";

beforeEach(() => {
  nativeState.cleanupCode = null;
  nativeState.loadCode = null;
  nativeState.loadCalls = 0;
  nativeState.mkdtempCalls = 0;
  nativeState.rmCalls = 0;
});

describe.skipIf(
  process.platform !== "linux" || process.arch !== "x64",
)("Linux publication helper load failures", () => {
  it("preserves a native load failure when cleanup succeeds", async () => {
    nativeState.loadCode = "ERR_DLOPEN_FAILED";

    const error = await captureFailure();

    expect(error).toMatchObject({
      code: "cli_platform_unsupported",
      details: { systemCode: "ERR_DLOPEN_FAILED" },
    });
    expect(getFailureWarnings(error)).toEqual([]);
    expect(nativeState).toMatchObject({ mkdtempCalls: 1, loadCalls: 1, rmCalls: 1 });
  });

  it("reports cleanup as the primary failure when native loading succeeded", async () => {
    nativeState.cleanupCode = "EACCES";

    const error = await captureFailure();

    expect(error).toMatchObject({
      code: "cli_cleanup_failed",
      details: { systemCode: "EACCES" },
    });
    expect(getFailureWarnings(error)).toEqual([]);
    expect(nativeState).toMatchObject({ mkdtempCalls: 1, loadCalls: 1, rmCalls: 1 });
  });

  it("keeps the native load error primary and attaches a safe cleanup warning when both fail", async () => {
    nativeState.loadCode = "ERR_DLOPEN_FAILED";
    nativeState.cleanupCode = "EACCES";

    const error = await captureFailure();
    const warnings = getFailureWarnings(error);

    expect(error).toMatchObject({
      code: "cli_platform_unsupported",
      details: { systemCode: "ERR_DLOPEN_FAILED" },
    });
    expect(warnings).toEqual([{
      code: "output_cleanup_failed",
      phase: "cleanup",
      detailCode: "EACCES",
    }]);
    expect(JSON.stringify({ details: (error as { details?: unknown }).details, warnings })).not.toContain("/tmp/");
  });

  it("retries after a double failure and reports each cleanup residue instead of caching success", async () => {
    nativeState.loadCode = "ERR_DLOPEN_FAILED";
    nativeState.cleanupCode = "EACCES";

    const first = await captureFailure();
    const second = await captureFailure();

    for (const error of [first, second]) {
      expect(error).toMatchObject({
        code: "cli_platform_unsupported",
        details: { systemCode: "ERR_DLOPEN_FAILED" },
      });
      expect(getFailureWarnings(error)).toEqual([{
        code: "output_cleanup_failed",
        phase: "cleanup",
        detailCode: "EACCES",
      }]);
    }
    expect(nativeState).toMatchObject({ mkdtempCalls: 2, loadCalls: 2, rmCalls: 2 });
  });
});

async function captureFailure(): Promise<unknown> {
  try {
    await publishDirectoryNoReplace("/owned-source", "/unused-destination");
  } catch (error) {
    return error;
  }
  throw new Error("Expected Linux publication helper loading to fail");
}

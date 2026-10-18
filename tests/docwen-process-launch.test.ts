import { afterEach, describe, expect, it, vi } from "vitest";

import { docWenChildEnvironment } from "../src/docwen/process-launch";

afterEach(() => vi.unstubAllGlobals());

describe("Machine child user identity", () => {
  it("keeps Windows USERNAME for Python getpass without leaking unrelated environment", () => {
    vi.stubGlobal("process", { ...process, platform: "win32", env: {
      USERNAME: "Profile User 中文",
      USERPROFILE: "C:\\Users\\Profile User",
      NODE_OPTIONS: "--require injected.js",
      PYTHONPATH: "untrusted-modules",
      PRIVATE_TOKEN: "must-not-cross-boundary",
    } });
    const environment = docWenChildEnvironment();
    expect(environment.USERNAME).toBe("Profile User 中文");
    expect(environment.USERPROFILE).toBe("C:\\Users\\Profile User");
    expect(environment).not.toHaveProperty("NODE_OPTIONS");
    expect(environment).not.toHaveProperty("PYTHONPATH");
    expect(environment).not.toHaveProperty("PRIVATE_TOKEN");
  });

  it("does not forward Windows identity on Linux or invent a missing username", () => {
    const original = process;
    vi.stubGlobal("process", { ...original, platform: "linux", env: { HOME: "/home/tester", USERNAME: "foreign" } });
    expect(docWenChildEnvironment()).not.toHaveProperty("USERNAME");
    vi.stubGlobal("process", { ...original, platform: "win32", env: { USERPROFILE: "C:\\Users\\Tester" } });
    expect(docWenChildEnvironment()).not.toHaveProperty("USERNAME");
  });
});

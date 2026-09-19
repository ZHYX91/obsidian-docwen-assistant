import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  PUBLIC_DOCWEN_ASSET,
  PUBLIC_DOCWEN_REPOSITORY,
  selectPublicDocWenRelease,
} from "../scripts/check-docwen-compatibility.mjs";

describe("public DocWen compatibility preflight", () => {
  it("stays separate from the deterministic offline candidate gate", () => {
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts["release:check"])
      .toBe("npm run check && npm run release:validate-tag");
    expect(packageJson.scripts["release:docwen-compatibility"])
      .toBe("node scripts/check-docwen-compatibility.mjs");
  });

  it("selects the highest current immutable stable package", () => {
    const selected = selectPublicDocWenRelease([
      release("0.10.99"),
      release("0.11.0"),
      release("0.11.7"),
      release("0.12.1"),
      release("0.13.0", { prerelease: true }),
    ]);

    expect(selected.release.tag_name).toBe("0.12.1");
    expect(selected.version).toEqual(["0", "12", "1"]);
    expect(selected.asset.name).toBe("DocWen-windows-x64.zip");
    expect(PUBLIC_DOCWEN_REPOSITORY).toBe("ZHYX91/docwen");
    expect(PUBLIC_DOCWEN_ASSET).toBe("DocWen-windows-x64.zip");
  });

  it("rejects mutable, incomplete, untrusted, or wrongly named packages", () => {
    expect(() => selectPublicDocWenRelease([
      release("0.12.2", { immutable: false }),
    ])).toThrow("is not immutable");
    expect(() => selectPublicDocWenRelease([
      release("0.12.2", { assets: [asset("0.12.2", { state: "starter" })] }),
    ])).toThrow("is not fully uploaded");
    expect(() => selectPublicDocWenRelease([
      release("0.12.2", { assets: [asset("0.12.2", { digest: null })] }),
    ])).toThrow("has no trusted SHA-256 digest");
    expect(() => selectPublicDocWenRelease([
      release("0.12.2", { assets: [asset("0.12.2", { name: "DocWen.zip" })] }),
    ])).toThrow("must contain exactly one DocWen-windows-x64.zip");
    expect(() => selectPublicDocWenRelease([
      release("0.12.2", {
        assets: [asset("0.12.2", { browser_download_url: "https://example.test/package.zip" })],
      }),
    ])).toThrow("asset URL is outside the canonical GitHub repository");
  });

  it("rejects prefixed tags and releases below the supported packaged baseline", () => {
    expect(() => selectPublicDocWenRelease([release("v0.12.2")]))
      .toThrow("No public stable DocWen Release at or above 0.12.0 exists");
    expect(() => selectPublicDocWenRelease([release("0.10.99")]))
      .toThrow("No public stable DocWen Release at or above 0.12.0 exists");
  });
});

function asset(tag: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "DocWen-windows-x64.zip",
    state: "uploaded",
    size: 42,
    digest: `sha256:${"a".repeat(64)}`,
    browser_download_url:
      `https://github.com/ZHYX91/docwen/releases/download/${tag}/DocWen-windows-x64.zip`,
    ...overrides,
  };
}

function release(tag: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tag_name: tag,
    draft: false,
    prerelease: false,
    published_at: "2026-08-01T00:00:00Z",
    immutable: true,
    assets: [asset(tag)],
    html_url: `https://github.com/ZHYX91/docwen/releases/tag/${tag}`,
    ...overrides,
  };
}

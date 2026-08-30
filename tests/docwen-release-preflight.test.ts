import { describe, expect, it } from "vitest";

// @ts-expect-error The product preflight is a directly exercised JavaScript module.
import {
  PUBLIC_DOCWEN_ASSET,
  PUBLIC_DOCWEN_REPOSITORY,
  selectPublicDocWenRelease,
} from "../scripts/check-docwen-compatibility.mjs";

describe("public DocWen compatibility preflight", () => {
  it("selects the highest compatible immutable stable 0.9.x package", () => {
    const selected = selectPublicDocWenRelease([
      release("0.9.7"),
      release("0.9.12"),
      release("0.9.11"),
      release("0.10.0"),
      release("0.9.99", { prerelease: true }),
    ]);

    expect(selected.release.tag_name).toBe("0.9.12");
    expect(selected.version).toEqual(["0", "9", "12"]);
    expect(selected.asset.name).toBe("DocWen-windows-x64.zip");
    expect(PUBLIC_DOCWEN_REPOSITORY).toBe("ZHYX91/docwen");
    expect(PUBLIC_DOCWEN_ASSET).toBe("DocWen-windows-x64.zip");
  });

  it("rejects mutable, incomplete, untrusted, or wrongly named packages", () => {
    expect(() => selectPublicDocWenRelease([
      release("0.9.12", { immutable: false }),
    ])).toThrow("is not immutable");
    expect(() => selectPublicDocWenRelease([
      release("0.9.12", { assets: [asset({ state: "starter" })] }),
    ])).toThrow("is not fully uploaded");
    expect(() => selectPublicDocWenRelease([
      release("0.9.12", { assets: [asset({ digest: null })] }),
    ])).toThrow("has no trusted SHA-256 digest");
    expect(() => selectPublicDocWenRelease([
      release("0.9.12", { assets: [asset({ name: "DocWen.zip" })] }),
    ])).toThrow("must contain exactly one DocWen-windows-x64.zip");
    expect(() => selectPublicDocWenRelease([
      release("0.9.12", {
        assets: [asset({ browser_download_url: "https://example.test/package.zip" })],
      }),
    ])).toThrow("asset URL is outside the canonical GitHub repository");
  });

  it("does not accept prefixed tags or a newer incompatible product line", () => {
    expect(() => selectPublicDocWenRelease([release("v0.9.12")]))
      .toThrow("No public stable DocWen 0.9.x Release exists");
    expect(() => selectPublicDocWenRelease([release("0.10.0")]))
      .toThrow("No public stable DocWen 0.9.x Release exists");
  });
});

function asset(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "DocWen-windows-x64.zip",
    state: "uploaded",
    size: 42,
    digest: `sha256:${"a".repeat(64)}`,
    browser_download_url:
      "https://github.com/ZHYX91/docwen/releases/download/0.9.12/DocWen-windows-x64.zip",
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
    assets: [asset({
      browser_download_url:
        `https://github.com/ZHYX91/docwen/releases/download/${tag}/DocWen-windows-x64.zip`,
    })],
    html_url: `https://github.com/ZHYX91/docwen/releases/tag/${tag}`,
    ...overrides,
  };
}

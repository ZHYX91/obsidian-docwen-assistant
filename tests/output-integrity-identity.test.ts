import { describe, expect, it } from "vitest";
import { fileIdentity, sameFileIdentity } from "../src/docwen/output-integrity";

describe("filesystem identity precision", () => {
  const stats = { dev: 1n, ino: 9007199254740992n, mtimeNs: 1000000000000000000n, size: 24n };

  it("distinguishes adjacent 64-bit identifiers without rounding", () => {
    const original = fileIdentity(stats);
    const different = fileIdentity({ ...stats, ino: stats.ino + 1n });
    expect(sameFileIdentity(original, different)).toBe(false);
    expect(sameFileIdentity(original, fileIdentity(stats))).toBe(true);
    expect(original.size).toBe(24);
  });

  it("distinguishes sub-millisecond modifications", () => {
    expect(sameFileIdentity(fileIdentity(stats), fileIdentity({
      ...stats, mtimeNs: stats.mtimeNs + 1n,
    }))).toBe(false);
  });

  it("rejects file sizes that cannot enter the numeric protocol safely", () => {
    expect(() => fileIdentity({ ...stats, size: 9007199254740993n }))
      .toThrow("File size cannot be represented safely");
  });
});

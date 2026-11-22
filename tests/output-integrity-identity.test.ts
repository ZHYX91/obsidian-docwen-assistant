import { createReadStream } from "node:fs";
import { devNull } from "node:os";
import { describe, expect, it, vi } from "vitest";
import { fileIdentity, sameFileIdentity, sha256File } from "../src/docwen/output-integrity";

vi.mock("node:fs", async (importOriginal) => {
  const fs = await importOriginal<typeof import("node:fs")>();
  return { ...fs, createReadStream: vi.fn(fs.createReadStream) };
});

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

it("honors cancellation at EOF even when the file has no data chunks", async () => {
  const controller = new AbortController();
  const stream = createReadStream(devNull);
  stream.once("end", () => controller.abort());
  vi.mocked(createReadStream).mockReturnValueOnce(stream);
  await expect(sha256File(devNull, 0, controller.signal)).rejects.toMatchObject({ code: "cli_cancelled" });
});

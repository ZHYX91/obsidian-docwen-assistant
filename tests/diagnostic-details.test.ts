import { describe, expect, it } from "vitest";
import { diagnosticCode, diagnosticDetails } from "../src/actions/diagnostic-details";

describe("shareable diagnostic facts", () => {
  it("rejects malformed or private strings even under allowed field names", () => {
    expect(diagnosticDetails({
      actualProductVersion: "0.12.0 secret", expectedProductVersion: "C:\\Users\\private",
      outputState: "private", mode: "private", primaryCode: "error containing a note",
      timeoutMs: Infinity, maxBytes: Number.MAX_SAFE_INTEGER + 1, exitCode: "7",
    })).toEqual({});
    for (const value of [null, undefined, "private", 42]) expect(diagnosticDetails(value)).toEqual({});
    for (const value of [null, 4, "private content", "/private/path", "X".repeat(97)]) expect(diagnosticCode(value)).toBe("");
  });

  it("keeps only supported primitive facts without traversing arbitrary objects", () => {
    const value = Object.create({ outputState: "unconfirmed" });
    value.mode = "automatic";
    value.sizeBytes = 32;
    value.nested = { stdout: "private content" };
    expect(diagnosticDetails(value)).toEqual({ mode: "automatic", sizeBytes: 32 });
    expect(diagnosticCode("docwen.integrity_failed")).toBe("docwen.integrity_failed");
    expect(diagnosticDetails({ expectedProductVersion: "0.12.0-rc.1", mode: "manual" })).toEqual({
      expectedProductVersion: "0.12.0-rc.1", mode: "manual",
    });
  });
});

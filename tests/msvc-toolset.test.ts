import { describe, expect, it } from "vitest";
import { recordedMsvcComponents, recordedMsvcVersion, selectRecordedToolset } from "../scripts/msvc-toolset.mjs";

const recorded = {
  compiler: "Microsoft (R) C/C++ Optimizing Compiler Version 19.51.36260 for x64",
  librarian: "Microsoft (R) Library Manager Version 14.51.36260.0",
  linker: "Microsoft (R) Incremental Linker Version 14.51.36260.0",
};
const candidate = (version: string, identities = recorded, installation = "build-tools") => ({ version, identities, installation });

describe("recorded MSVC binary identity selection", () => {
  it("derives the release-family component from the servicing identity", () => {
    expect(recordedMsvcVersion(recorded)).toBe("14.51.36260");
    expect(recordedMsvcComponents(recorded)).toEqual([
      "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
      "Microsoft.VisualStudio.Component.VC.14.51.x86.x64",
    ]);
  });
  it("accepts exact binaries in a directory whose base patch differs from servicing", () => {
    expect(selectRecordedToolset([candidate("14.51.36231")], recorded)).toEqual({ installation: "build-tools", version: "14.51.36231" });
  });
  it("finds an exact candidate across installations without selecting the newest", () => {
    expect(selectRecordedToolset([
      candidate("14.99.99999", { ...recorded, compiler: "new compiler" }, "latest"),
      candidate("14.51.36231", recorded, "exact-family"),
    ], recorded)).toEqual({ installation: "exact-family", version: "14.51.36231" });
  });
  it.each(["compiler", "librarian", "linker"] as const)("rejects the expected folder when its %s identity differs", (key) => {
    expect(() => selectRecordedToolset([candidate("14.51.36260", { ...recorded, [key]: "wrong actual binary" })], recorded))
      .toThrow("No installed MSVC candidate matches all three recorded tool identities");
  });
  it("never mixes matching tools from different candidates", () => {
    expect(() => selectRecordedToolset([
      candidate("14.51.36231", { ...recorded, compiler: "wrong compiler" }, "one"),
      candidate("14.51.36260", { ...recorded, librarian: "wrong librarian" }, "two"),
    ], recorded)).toThrow("No installed MSVC candidate");
  });
  it("retains actual candidate identities when none match", () => {
    expect(() => selectRecordedToolset([candidate("14.51.36231", { ...recorded, compiler: "unavailable: missing cl.exe" })], recorded))
      .toThrow("unavailable: missing cl.exe");
    expect(() => selectRecordedToolset([], recorded)).toThrow("Discovered: []");
  });
  it.each([undefined, null, {}, { librarian: null }, { librarian: 14.51 },
    { librarian: "Microsoft (R) Library Manager" },
    { librarian: "Microsoft (R) Library Manager Version 14.51.36260" },
    { librarian: "Microsoft (R) Library Manager Version 14.51.36260.0 preview" },
  ])("rejects a malformed recorded identity: %j", (record) => {
    expect(() => recordedMsvcVersion(record)).toThrow("recorded MSVC librarian identity");
  });
});

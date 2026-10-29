import { describe, expect, it } from "vitest";

import { recordedMsvcVersion, selectRecordedToolset } from "../scripts/msvc-toolset.mjs";

const recordedVersion = "14.51.36260";
const recorded = {
  compiler: "Microsoft (R) C/C++ Optimizing Compiler Version 19.51.36260 for x64",
  librarian: "Microsoft (R) Library Manager Version 14.51.36260.0",
  linker: "Microsoft (R) Incremental Linker Version 14.51.36260.0",
};

describe("recorded MSVC toolset selection", () => {
  it("derives the exact installed toolset directory version from the recorded librarian", () => {
    expect(recordedMsvcVersion(recorded)).toBe(recordedVersion);
  });

  it("selects the recorded version when newer and older directories coexist", () => {
    expect(selectRecordedToolset([
      { path: "build-tools", versions: ["14.52.37000", "14.49.35000", recordedVersion, "14.99.99999"] },
    ], recordedVersion)).toEqual({ installation: "build-tools", version: recordedVersion });
  });

  it("searches all installations instead of choosing the latest installation", () => {
    expect(selectRecordedToolset([
      { path: "latest-enterprise", versions: ["14.52.37000"] },
      { path: "recorded-build-tools", versions: [recordedVersion, "14.49.35000"] },
      { path: "older-community", versions: ["14.48.34000"] },
    ], recordedVersion)).toEqual({ installation: "recorded-build-tools", version: recordedVersion });
  });

  it.each([
    { name: "no installations", installations: [] },
    { name: "an empty toolset directory", installations: [{ path: "build-tools", versions: [] }] },
    {
      name: "adjacent patches and a preview directory",
      installations: [{ path: "build-tools", versions: ["14.51.36259", "14.51.36261", "14.51.36260-preview"] }],
    },
  ])("rejects an unavailable exact version with $name", ({ installations }) => {
    expect(() => selectRecordedToolset(installations, recordedVersion)).toThrow(
      /recorded MSVC toolset 14\.51\.36260 is not installed/u,
    );
  });

  it.each([
    undefined,
    null,
    {},
    { librarian: null },
    { librarian: 14.51 },
    { librarian: "Microsoft (R) Library Manager" },
    { librarian: "Microsoft (R) Library Manager Version 14.51.36260" },
    { librarian: "Microsoft (R) Library Manager Version 14.51.36260.0 preview" },
  ])("rejects an absent or inexact recorded identity with a useful diagnostic: %j", (record) => {
    expect(() => recordedMsvcVersion(record)).toThrow(/recorded MSVC librarian identity/u);
  });
});

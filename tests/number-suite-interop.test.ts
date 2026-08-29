import { describe, expect, it } from "vitest";

import {
  loadNumberSuiteSnapshot,
  NumberSuiteInteropError,
} from "../src/host/number-suite-interop";

function appWithApi(api: unknown): never {
  return {
    plugins: {
      getPlugin: () => ({ getInteropApi: () => api }),
    },
  } as never;
}

describe("Number Suite interoperability v2", () => {
  it("accepts an H9 target with exactly nine counters", () => {
    const source = "######### Deep ^deep";
    const snapshot = {
      schema: "number-suite.interop.v2",
      offsetEncoding: "utf16",
      disabled: false,
      headingTargets: [{
        sourceStartUtf16: 0,
        sourceEndUtf16: source.length,
        line: 0,
        level: 9,
        targetId: "deep",
        authoredText: "Deep",
        enabled: true,
        derivedNumber: "1",
        counters: [1, 1, 1, 1, 1, 1, 1, 1, 1],
        display: [{ kind: "counter", level: 9, numberFormat: "arabic" }],
      }],
      captionTargets: [],
      references: [],
    };
    const result = loadNumberSuiteSnapshot(appWithApi({
      schema: "number-suite.interop.v2",
      exportSemanticSnapshot: () => snapshot,
    }), source, null);

    expect(result?.headingTargets[0]).toMatchObject({
      level: 9,
      targetId: "deep",
      counters: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    });
  });

  it("rejects the retired v1 contract instead of silently truncating levels", () => {
    expect(() => loadNumberSuiteSnapshot(appWithApi({
      schema: "number-suite.interop.v1",
      exportSemanticSnapshot: () => null,
    }), "# Heading", null)).toThrow(NumberSuiteInteropError);
  });

  it("requires every semantic collection to be empty in a disabled snapshot", () => {
    const source = "Figure: One";
    expect(() => loadNumberSuiteSnapshot(appWithApi({
      schema: "number-suite.interop.v2",
      exportSemanticSnapshot: () => ({
        schema: "number-suite.interop.v2",
        offsetEncoding: "utf16",
        disabled: true,
        headingTargets: [],
        captionTargets: [{
          sourceStartUtf16: 0,
          sourceEndUtf16: source.length,
          line: 0,
          kind: "Figure",
          targetId: null,
          authoredText: "One",
          enabled: false,
          derivedNumber: null,
        }],
        references: [],
      }),
    }), source, null)).toThrow(NumberSuiteInteropError);
  });

  it("accepts a resolved reference to a valid but unnumbered target", () => {
    const heading = "# Scope";
    const reference = "@[[#Scope]]";
    const source = `${heading}\n${reference}`;
    const result = loadNumberSuiteSnapshot(appWithApi({
      schema: "number-suite.interop.v2",
      exportSemanticSnapshot: () => ({
        schema: "number-suite.interop.v2",
        offsetEncoding: "utf16",
        disabled: false,
        headingTargets: [{
          sourceStartUtf16: 0,
          sourceEndUtf16: heading.length,
          line: 0,
          level: 1,
          targetId: null,
          authoredText: "Scope",
          enabled: false,
          derivedNumber: null,
          counters: [1, 0, 0, 0, 0, 0, 0, 0, 0],
          display: [],
        }],
        captionTargets: [],
        references: [{
          sourceStartUtf16: heading.length + 1,
          sourceEndUtf16: source.length,
          targetSourceStartUtf16: 0,
          targetSourceEndUtf16: heading.length,
          alias: null,
        }],
      }),
    }), source, null);

    expect(result?.references).toHaveLength(1);
    expect(result?.headingTargets[0]?.enabled).toBe(false);
  });

  it("rejects ambiguous target IDs before consuming references", () => {
    const first = "# One ^same";
    const second = "# Two ^same";
    const source = `${first}\n${second}`;
    const heading = (start: number, text: string) => ({
      sourceStartUtf16: start,
      sourceEndUtf16: start + text.length,
      line: start === 0 ? 0 : 1,
      level: 1,
      targetId: "same",
      authoredText: text.includes("One") ? "One" : "Two",
      enabled: false,
      derivedNumber: null,
      counters: [1, 0, 0, 0, 0, 0, 0, 0, 0],
      display: [],
    });
    expect(() => loadNumberSuiteSnapshot(appWithApi({
      schema: "number-suite.interop.v2",
      exportSemanticSnapshot: () => ({
        schema: "number-suite.interop.v2",
        offsetEncoding: "utf16",
        disabled: false,
        headingTargets: [heading(0, first), heading(first.length + 1, second)],
        captionTargets: [],
        references: [],
      }),
    }), source, null)).toThrow(NumberSuiteInteropError);
  });
});

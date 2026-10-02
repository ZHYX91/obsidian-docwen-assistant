import { describe, expect, it } from "vitest";
import { SourceTextIndex } from "../src/host/source-text-index";

describe("SourceTextIndex", () => {
  it.each(["", "中文\r\n第二行\n", "A😀中\r\n🧭尾", "\ud800x\udc00\n\ud800\udc00"])(
    "preserves code-point and physical-line positions at every UTF-16 boundary in %j",
    (source) => {
      const index = new SourceTextIndex(source);
      for (let offset = 0; offset <= source.length; offset += 1) {
        const prefix = source.slice(0, offset);
        expect(index.unicodeOffset(offset)).toBe(Array.from(prefix).length);
        expect(index.lineNumber(offset)).toBe(prefix.split("\n").length - 1);
      }
    },
  );
});

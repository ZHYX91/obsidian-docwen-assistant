import { expect, it } from "vitest";
import { propertiesEnd } from "../src/host/markdown-properties";
import cases from "./fixtures/leading-note-properties.json";

it.each(cases)("locates note properties in $id", ({ properties, body }) => {
  // Obsidian's mask ends at the closing marker. Its line ending stays visible.
  const markerEnd = properties.replace(/(?:\r\n|[\r\n])$/u, "").length;
  expect(propertiesEnd(properties + body)).toBe(markerEnd);
});

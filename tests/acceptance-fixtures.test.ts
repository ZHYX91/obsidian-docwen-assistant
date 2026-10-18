import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

interface FormatFixture {
  format: string;
  file: string;
  bytes: number;
  sha256: string;
}

const formatsRoot = new URL("../acceptance/fixtures/Formats/", import.meta.url);
const fixtures = JSON.parse(readFileSync(
  new URL("../acceptance/format-fixtures.json", import.meta.url), "utf8",
)) as FormatFixture[];

describe("acceptance format fixtures", () => {
  it("retains every declared format and exactly the 35 synthetic input files", () => {
    expect(fixtures.map(({ format }) => format)).toEqual([
      "docx", "doc", "odt", "rtf", "wps", "txt", "xlsx", "xls", "ods", "et",
      "csv", "tsv", "png", "jpg", "jpeg", "gif", "bmp", "tif", "tiff", "webp",
      "heic", "heif", "pdf", "ofd", "xps", "md", "markdown", "html", "htm",
      "mhtml", "mht", "epub", "enex", "pptx", "ppt",
    ]);
    const files = fixtures.map(({ file }) => file);
    expect(new Set(files).size).toBe(35);
    expect(readdirSync(formatsRoot).filter((file) => file !== "README.md").sort())
      .toEqual([...files].sort());
  });

  it.each(fixtures)("binds $file to its committed input bytes", (fixture) => {
    expect(fixture.file).toMatch(/^\d{2}-[a-z]+\.[a-z]+$/u);
    const bytes = readFileSync(new URL(fixture.file, formatsRoot));
    expect(bytes.length).toBe(fixture.bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(fixture.sha256);
  });

  it("keeps readable text/table content and the documented WPS/ET aliases", () => {
    const read = (file: string): Buffer => readFileSync(new URL(file, formatsRoot));
    expect(read("26-md.md").toString("utf8")).toContain("| Example | 42 |");
    expect(read("27-markdown.markdown")).toEqual(read("26-md.md"));
    expect(read("11-csv.csv").toString("utf8")).toBe("Name,Value\nExample,42\n");
    expect(read("12-tsv.tsv").toString("utf8")).toBe("Name\tValue\nExample\t42\n");
    expect(read("04-rtf.rtf").toString("utf8")).toMatch(/^\{\\rtf/u);
    expect(read("05-wps.wps")).toEqual(read("02-doc.doc"));
    expect(read("10-et.et")).toEqual(read("08-xls.xls"));
  });
});

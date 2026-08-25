import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { inflateRawSync } from "node:zlib";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DocWenCapabilityService, DocWenClient, DocWenMachineClient, type TaskInput } from "../src/docwen";
// @ts-expect-error The acceptance wrapper is intentionally a native ESM production script.
import { loadPackageAcceptanceReceipt } from "../scripts/run-docwen-package-acceptance.mjs";

const packageBinding = await loadPackageAcceptanceReceipt(process.env);

describe.skipIf(packageBinding === null)("fixed packaged DocWen Machine v1", () => {
  let root: string;
  let machine: DocWenMachineClient;
  let client: DocWenClient;

  beforeAll(async () => {
    if (packageBinding === null) throw new Error("Packaged acceptance requires a wrapper-bound receipt.");
    root = await mkdtemp(join(tmpdir(), "docwen-assistant-package-"));
    machine = new DocWenMachineClient(
      () => packageBinding.binaryPath,
      () => "en_US",
      packageBinding.productVersion,
    );
    client = new DocWenClient(machine);
  });

  afterAll(async () => {
    client?.dispose();
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("reads health and versioned Machine capabilities", async () => {
    await expect(client.doctor()).resolves.toMatchObject({ allOk: true });
    const projection = await client.runtimeCapabilities();
    expect(projection.contractId).toBe("docwen.machine.v1");
    expect(projection.capabilities.map((item) => item.capability_id)).toContain("convert.markdown.to_docx");

    const source = join(root, "capability-adapter.md");
    await writeFile(source, "# Current contract\n", "utf8");
    const service = new DocWenCapabilityService(client);
    const file = await service.requireAction(source, "convert");
    const route = service.requireConversionRoute(file, "docx");
    expect(route.capabilityId).toBe("convert.markdown.to_docx");
    expect(route.inputShape.slots.map((slot) => slot.role)).toEqual([
      "neutral_document",
      "numbering_export_plan",
    ]);
  }, 120_000);

  it("returns a typed local admission error for a missing file", async () => {
    await expect(client.inspect(join(root, "不存在 空格 #.md"))).rejects.toMatchObject({
      name: "LocalCliError",
      code: "cli_input_invalid",
    });
  });

  it("validates a Bundle and commits only the explicit Unicode target", async () => {
    const source = join(root, "输入 空格 #.md");
    const output = join(root, "输出 空格 #.md");
    const original = "# Title\n\n## Section\n";
    await writeFile(source, original, "utf8");

    await expect(client.numberMarkdown(source, output, "add", "hierarchical_standard")).resolves.toMatchObject({
      output,
      bundleId: expect.stringMatching(/^bundle\./u),
    });
    expect(await readFile(source, "utf8")).toBe(original);
    expect(await readFile(output, "utf8")).toContain("Title");
  }, 120_000);

  it("round-trips extended headings and note domains through a document-node Bundle", async () => {
    const caseRoot = join(root, "extended-heading-note-roundtrip");
    const source = join(caseRoot, "authored.md");
    const docx = join(caseRoot, "authored.docx");
    const markdown = join(caseRoot, "published", "roundtrip.md");
    const authored = [
      "####### Level seven",
      "",
      "######## Level eight",
      "",
      "######### Level nine",
      "",
      "Default footnote[^alpha], explicit footnote[^footnote:beta], first endnote[^endnote:omega], and second endnote[^endnote:second].",
      "",
      "[^alpha]: Default footnote body.",
      "[^footnote:beta]: Explicit footnote body.",
      "[^endnote:omega]: Canonical endnote body.",
      "[^endnote:second]: Second endnote body.",
      "",
    ].join("\n");
    await mkdir(caseRoot, { recursive: true });
    await writeFile(source, authored, "utf8");

    const sourceInput: TaskInput = {
      path: source,
      kind: "document",
      role: "source",
      logicalPath: "notes/authored.md",
      mediaType: "text/markdown",
    };
    const resolvedInputs = await writeResolvedTextPort(join(caseRoot, "port"), authored);
    await expect(client.convert({
      sourceInput,
      inputs: resolvedInputs,
      outputPath: docx,
      target: "docx",
      capabilityId: "convert.markdown.to_docx",
    })).resolves.toMatchObject({ output: docx, outputs: [docx] });
    expect(await readFile(source, "utf8")).toBe(authored);

    const docxArchive = readStrictZip(await readFile(docx));
    expect(docxArchive.has("word/footnotes.xml")).toBe(true);
    expect(docxArchive.has("word/endnotes.xml")).toBe(true);
    const documentXml = docxArchive.get("word/document.xml")?.toString("utf8") ?? "";
    for (const level of [7, 8, 9]) expect(documentXml).toContain(`Heading${level}`);

    const docxInput: TaskInput = {
      path: docx,
      kind: "document",
      role: "source",
      logicalPath: "notes/authored.docx",
      mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    const roundtrip = await client.convert({
      sourceInput: docxInput,
      inputs: [docxInput],
      outputPath: markdown,
      target: "md",
      capabilityId: "convert.docx.to_markdown",
    });
    expect(roundtrip.output).toBe(markdown);
    expect(roundtrip.outputs).toContain(markdown);
    const manifestOutput = roundtrip.outputs.find((output) => basename(output) === "docwen-node.json");
    expect(manifestOutput).toBeDefined();
    const manifest = JSON.parse(await readFile(manifestOutput!, "utf8")) as { schema?: unknown };
    expect(manifest.schema).toBe("docwen.document_node.v1");

    const restored = await readFile(markdown, "utf8");
    expect(restored).toContain("####### Level seven");
    expect(restored).toContain("######## Level eight");
    expect(restored).toContain("######### Level nine");
    expect(restored).toMatch(/\[\^1\].*\[\^2\]/u);
    expect(restored).toMatch(/\[\^endnote:1\].*\[\^endnote:2\]/u);
    expect(restored).toContain("[^1]: Default footnote body.");
    expect(restored).toContain("[^2]: Explicit footnote body.");
    expect(restored).toContain("[^endnote:1]: Canonical endnote body.");
    expect(restored).toContain("[^endnote:2]: Second endnote body.");
    expect(restored).not.toMatch(/\[\^endnote-/u);
  }, 240_000);

  it("runs the v4 neutral port for a cross-folder short Wiki image with spaces", async () => {
    const source = join(root, "physical-source", "typed-source.md");
    const linked = join(root, "declared-pool", "typed linked.png");
    const decoy = join(root, "physical-source", "assets", "typed linked.png");
    const output = join(root, "typed-output.docx");
    await mkdir(join(root, "physical-source", "assets"), { recursive: true });
    await mkdir(join(root, "declared-pool"), { recursive: true });
    const sourceBytes = Buffer.from("# Typed input\n\n![[typed linked.png]]\n", "utf8");
    const declaredBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP8zwACTGCSAQANHQEDgslx/wAAAABJRU5ErkJggg==", "base64");
    const decoyBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGNkYPjPwMDAxAAGAAsfAQMU4wsAAAAAAElFTkSuQmCC", "base64");
    await writeFile(source, sourceBytes);
    await writeFile(linked, declaredBytes);
    await writeFile(decoy, decoyBytes);
    const originalInputs = [
      { path: source, bytes: sourceBytes, sha256: sha256(sourceBytes) },
      { path: linked, bytes: declaredBytes, sha256: sha256(declaredBytes) },
      { path: decoy, bytes: decoyBytes, sha256: sha256(decoyBytes) },
    ];

    const sourceInput: TaskInput = {
      path: source,
      kind: "document",
      role: "source",
      logicalPath: "notes/typed-source.md",
      mediaType: "text/markdown",
    };
    const resolvedInputs = await writeResolvedPort(root, sourceBytes.toString("utf8"), declaredBytes);
    await expect(client.convert({
      sourceInput,
      inputs: resolvedInputs,
      outputPath: output,
      target: "docx",
      capabilityId: "convert.markdown.to_docx",
    })).resolves.toMatchObject({ output, bundleId: expect.any(String) });
    const outputBytes = await readFile(output);
    const archive = readStrictZip(outputBytes);
    expect(archive.has("[Content_Types].xml")).toBe(true);
    expect(archive.has("word/document.xml")).toBe(true);
    const media = [...archive.entries()]
      .filter(([name]) => name.startsWith("word/media/") && !name.endsWith("/"))
      .map(([, bytes]) => bytes);
    expect(media.length).toBeGreaterThan(0);
    expect(media.some((bytes) => bytes.equals(declaredBytes))).toBe(true);
    expect(media.some((bytes) => bytes.equals(decoyBytes))).toBe(false);
    for (const input of originalInputs) {
      const after = await readFile(input.path);
      expect(after.equals(input.bytes)).toBe(true);
      expect(sha256(after)).toBe(input.sha256);
    }
  }, 120_000);
});

async function writeResolvedPort(portRoot: string, source: string, imageBytes: Buffer): Promise<TaskInput[]> {
  const token = "![[typed linked.png]]";
  const sourceStart = Array.from(source.slice(0, source.indexOf(token))).length;
  const sourceEnd = sourceStart + Array.from(token).length;
  const sourceSha256 = sha256(Buffer.from(source, "utf8"));
  const inputId = `obsidian-${sourceSha256.slice(0, 32)}`;
  const headingLine = "# Typed input";
  const heading = {
    source_start: 0,
    source_end: Array.from(headingLine).length,
    source_slice_sha256: sha256(Buffer.from(headingLine, "utf8")),
    kind: "heading",
    target_id: null,
    heading_level: 1,
    authored_text: "Typed input",
  };
  const plan = {
    heading_definitions: [],
    heading_instances: [],
    targets: [{
      source_start: heading.source_start,
      source_end: heading.source_end,
      kind: "heading",
      enabled: false,
      target_id: null,
      derived_number: null,
      materialization: null,
    }],
  };
  const planSha256 = sha256(Buffer.from(canonicalJson(plan), "utf8"));
  const neutral = {
    $schema: "urn:docwen:schema:resolved-document:v1",
    schema: "docwen.resolved_document.v1",
    input_id: inputId,
    source_sha256: sourceSha256,
    plan_sha256: planSha256,
    document: {
      authored_markdown: source,
      targets: [heading],
      references: [],
      resource_occurrences: [{
        source_start: sourceStart,
        source_end: sourceEnd,
        source_slice_sha256: sha256(Buffer.from(token, "utf8")),
        authored_token: token,
        authored_locator: "typed linked.png",
        resource_id: "image-1",
      }],
      citations: [],
      resources: [{
        resource_id: "image-1",
        role: "linked_resource",
        media_type: "image/png",
        size_bytes: imageBytes.length,
        sha256: sha256(imageBytes),
        content_base64: imageBytes.toString("base64"),
      }],
    },
  };
  const numbering = {
    $schema: "urn:docwen:schema:numbering-export-plan:v1",
    schema: "docwen.numbering_export_plan.v1",
    input_id: inputId,
    source_sha256: sourceSha256,
    plan_sha256: planSha256,
    plan,
  };
  const neutralPath = join(portRoot, "resolved-document.json");
  const numberingPath = join(portRoot, "numbering-export-plan.json");
  await writeFile(neutralPath, JSON.stringify(neutral), "utf8");
  await writeFile(numberingPath, JSON.stringify(numbering), "utf8");
  return [
    {
      path: neutralPath,
      kind: "document",
      role: "neutral_document",
      logicalPath: "resolved-document.json",
      mediaType: "application/vnd.docwen.resolved-document+json",
    },
    {
      path: numberingPath,
      kind: "resource",
      role: "numbering_export_plan",
      logicalPath: "numbering-export-plan.json",
      mediaType: "application/vnd.docwen.numbering-export-plan+json",
    },
  ];
}

async function writeResolvedTextPort(portRoot: string, source: string): Promise<TaskInput[]> {
  const sourceSha256 = sha256(Buffer.from(source, "utf8"));
  const inputId = `obsidian-${sourceSha256.slice(0, 32)}`;
  const headings = [...source.matchAll(/^(#{7,9})[ \t]+([^\r\n]+)$/gmu)].map((match) => {
    const sourceStart = Array.from(source.slice(0, match.index)).length;
    const sourceSlice = match[0];
    return {
      source_start: sourceStart,
      source_end: sourceStart + Array.from(sourceSlice).length,
      source_slice_sha256: sha256(Buffer.from(sourceSlice, "utf8")),
      kind: "heading",
      target_id: null,
      heading_level: match[1]!.length,
      authored_text: match[2]!,
    };
  });
  const plan = {
    heading_definitions: [],
    heading_instances: [],
    targets: headings.map((heading) => ({
      source_start: heading.source_start,
      source_end: heading.source_end,
      kind: "heading",
      enabled: false,
      target_id: null,
      derived_number: null,
      materialization: null,
    })),
  };
  const planSha256 = sha256(Buffer.from(canonicalJson(plan), "utf8"));
  const neutral = {
    $schema: "urn:docwen:schema:resolved-document:v1",
    schema: "docwen.resolved_document.v1",
    input_id: inputId,
    source_sha256: sourceSha256,
    plan_sha256: planSha256,
    document: {
      authored_markdown: source,
      targets: headings,
      references: [],
      resource_occurrences: [],
      citations: [],
      resources: [],
    },
  };
  const numbering = {
    $schema: "urn:docwen:schema:numbering-export-plan:v1",
    schema: "docwen.numbering_export_plan.v1",
    input_id: inputId,
    source_sha256: sourceSha256,
    plan_sha256: planSha256,
    plan,
  };
  await mkdir(portRoot, { recursive: true });
  const neutralPath = join(portRoot, "resolved-document.json");
  const numberingPath = join(portRoot, "numbering-export-plan.json");
  await writeFile(neutralPath, JSON.stringify(neutral), "utf8");
  await writeFile(numberingPath, JSON.stringify(numbering), "utf8");
  return [
    {
      path: neutralPath,
      kind: "document",
      role: "neutral_document",
      logicalPath: "resolved-document.json",
      mediaType: "application/vnd.docwen.resolved-document+json",
    },
    {
      path: numberingPath,
      kind: "resource",
      role: "numbering_export_plan",
      logicalPath: "numbering-export-plan.json",
      mediaType: "application/vnd.docwen.numbering-export-plan+json",
    },
  ];
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortJsonValue(item)]),
    );
  }
  return value;
}

function readStrictZip(archive: Buffer): Map<string, Buffer> {
  const end = findEndOfCentralDirectory(archive);
  const disk = archive.readUInt16LE(end + 4);
  const centralDisk = archive.readUInt16LE(end + 6);
  const entriesOnDisk = archive.readUInt16LE(end + 8);
  const entryCount = archive.readUInt16LE(end + 10);
  const centralSize = archive.readUInt32LE(end + 12);
  const centralOffset = archive.readUInt32LE(end + 16);
  if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) throw new Error("multi-disk ZIP is unsupported");
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error("ZIP64 is unsupported for the D2 fixture");
  }
  if (centralOffset + centralSize !== end) throw new Error("ZIP central directory bounds are invalid");

  const entries = new Map<string, Buffer>();
  let cursor = centralOffset;
  let totalOutputBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    requireRange(archive, cursor, 46);
    if (archive.readUInt32LE(cursor) !== 0x02014b50) throw new Error("invalid ZIP central directory signature");
    const flags = archive.readUInt16LE(cursor + 8);
    const method = archive.readUInt16LE(cursor + 10);
    const expectedCrc = archive.readUInt32LE(cursor + 16);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const uncompressedSize = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    if ((flags & 1) !== 0) throw new Error("encrypted ZIP entries are unsupported");
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) {
      throw new Error("ZIP64 entries are unsupported for the D2 fixture");
    }
    const centralRecordLength = 46 + nameLength + extraLength + commentLength;
    requireRange(archive, cursor, centralRecordLength);
    const nameBytes = archive.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = decodeZipName(nameBytes, flags);
    if (entries.has(name)) throw new Error("duplicate ZIP entry name");

    requireRange(archive, localOffset, 30);
    if (archive.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("invalid ZIP local header signature");
    const localFlags = archive.readUInt16LE(localOffset + 6);
    const localMethod = archive.readUInt16LE(localOffset + 8);
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    if (localFlags !== flags || localMethod !== method) throw new Error("ZIP local and central metadata disagree");
    requireRange(archive, localOffset + 30, localNameLength + localExtraLength);
    const localName = archive.subarray(localOffset + 30, localOffset + 30 + localNameLength);
    if (!localName.equals(nameBytes)) throw new Error("ZIP local and central names disagree");
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    requireRange(archive, dataOffset, compressedSize);
    if (localOffset >= centralOffset || dataOffset + compressedSize > centralOffset) {
      throw new Error("ZIP entry overlaps the central directory");
    }
    if (uncompressedSize > 64 * 1024 * 1024) throw new Error("ZIP entry exceeds the D2 safety limit");
    const compressed = archive.subarray(dataOffset, dataOffset + compressedSize);
    const bytes = method === 0
      ? Buffer.from(compressed)
      : method === 8
        ? inflateRawSync(compressed, { maxOutputLength: uncompressedSize + 1 })
        : (() => { throw new Error(`unsupported ZIP compression method ${method}`); })();
    if (bytes.length !== uncompressedSize) throw new Error("ZIP entry size is invalid");
    if (crc32(bytes) !== expectedCrc) throw new Error("ZIP entry CRC-32 is invalid");
    totalOutputBytes += bytes.length;
    if (totalOutputBytes > 128 * 1024 * 1024) throw new Error("ZIP output exceeds the D2 safety limit");
    entries.set(name, bytes);
    cursor += centralRecordLength;
  }
  if (cursor !== end) throw new Error("ZIP central directory entry count is invalid");
  return entries;
}

function findEndOfCentralDirectory(archive: Buffer): number {
  if (archive.length < 22) throw new Error("DOCX is too short to be a ZIP archive");
  const minimum = Math.max(0, archive.length - 22 - 0xffff);
  for (let offset = archive.length - 22; offset >= minimum; offset -= 1) {
    if (archive.readUInt32LE(offset) !== 0x06054b50) continue;
    const commentLength = archive.readUInt16LE(offset + 20);
    if (offset + 22 + commentLength === archive.length) return offset;
  }
  throw new Error("DOCX has no valid ZIP end record");
}

function decodeZipName(bytes: Buffer, flags: number): string {
  if ((flags & 0x0800) === 0 && bytes.some((value) => value > 0x7f)) {
    throw new Error("non-ASCII legacy ZIP names are unsupported");
  }
  const name = bytes.toString("utf8");
  const parts = name.split("/");
  const pathParts = name.endsWith("/") ? parts.slice(0, -1) : parts;
  if (
    name.length === 0
    || name.includes("\ufffd")
    || name.includes("\0")
    || name.includes("\\")
    || name.startsWith("/")
    || pathParts.some((part) => part.length === 0 || part === "." || part === "..")
  ) {
    throw new Error("unsafe ZIP entry name");
  }
  return name;
}

function requireRange(buffer: Buffer, offset: number, length: number): void {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > buffer.length) {
    throw new Error("ZIP record exceeds archive bounds");
  }
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const value of bytes) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

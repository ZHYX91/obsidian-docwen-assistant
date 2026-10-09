import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { inflateRawSync } from "node:zlib";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { DocWenCapabilityService, DocWenClient, DocWenMachineClient, type TaskInput } from "../src/docwen";
import { loadPackageAcceptanceReceipt } from "../scripts/run-docwen-package-acceptance.mjs";

vi.mock("obsidian", () => ({ MarkdownView: class MarkdownView {}, TFile: class TFile {} }));

const packageBinding = await loadPackageAcceptanceReceipt(process.env);
const formatFixtures = join(import.meta.dirname, "../acceptance/fixtures/Formats");
const formatFixtureNames = (await readdir(formatFixtures)).filter((name) => /^\d{2}-/u.test(name)).sort();

describe.skipIf(packageBinding === null)("fixed packaged DocWen Machine v2", () => {
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
    expect(projection.contractId).toBe("docwen.machine.v2");
    expect(projection.capabilities.map((item) => item.capability_id)).toContain("convert.markdown_source.to_docx");

    const source = join(root, "capability-adapter.md");
    await writeFile(source, "# Current contract\n", "utf8");
    const service = new DocWenCapabilityService(client);
    const file = await service.requireAction(source, "convert");
    const route = service.requireConversionRoute(file, "docx");
    expect(route.capabilityId).toBe("convert.markdown_source.to_docx");
    expect(route.inputShape.slots.map((slot) => slot.role)).toEqual([
      "source",
      "linked_resource",
    ]);
  }, 120_000);

  it("returns a typed local admission error for a missing file", async () => {
    await expect(client.inspect(join(root, "不存在 空格 #.md"))).rejects.toMatchObject({
      name: "LocalCliError",
      code: "cli_input_invalid",
    });
  });

  describe("format fixture admission", () => {
    let service: DocWenCapabilityService;
    let projection: Awaited<ReturnType<DocWenClient["runtimeCapabilities"]>>;

    beforeAll(async () => {
      expect(formatFixtureNames).toHaveLength(35);
      service = new DocWenCapabilityService(client);
      projection = await client.runtimeCapabilities();
    }, 30_000);

    // Each source owns its deadline so process startup costs across unrelated
    // formats cannot exhaust one shared timeout or obscure the failing fixture.
    it.each(formatFixtureNames)("matches %s to the exact advertised Machine capabilities", async (name) => {
      const source = join(root, name);
      await copyFile(join(formatFixtures, name), source);
      const inspection = await client.inspect(source);
      expect(inspection.mediaType, name).not.toBe("application/octet-stream");
      const advertised = projection.capabilities.filter((capability) =>
        capability.availability !== "unavailable"
        && capability.input_shape.slots.some((slot) =>
          slot.role === "source" && slot.media_types.includes(inspection.mediaType)));
      if (advertised.length === 0) {
        await expect(service.forFile(source), name).rejects.toMatchObject({
          code: "cli_capability_unavailable", details: { mediaType: inspection.mediaType },
        });
      } else {
        const file = await service.forFile(source);
        expect(file.machineCapabilities.map((item) => item.capability_id), name)
          .toEqual(advertised.map((item) => item.capability_id));
      }
    }, 30_000);
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
    const markdownParent = join(caseRoot, "published");
    await mkdir(markdownParent, { recursive: true });
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
    const generated = await client.convert({
      sourceInput,
      inputs: [sourceInput],
      outputDirectory: caseRoot,
      target: "docx",
      capabilityId: "convert.markdown_source.to_docx",
      markdownExtensions: { input: { structural_tables: true, captions_references: true, extended_headings: true, typed_endnotes: true } },
    });
    const docx = generated.output;
    expect(generated.outputs).toEqual([docx]);
    expect(basename(dirname(docx))).toBe(basename(docx, ".docx"));
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
      outputDirectory: markdownParent,
      target: "md",
      capabilityId: "convert.docx.to_markdown",
      markdownExtensions: { output: { structural_tables: true, captions_references: true, extended_headings: true, typed_endnotes: true } },
    });
    const markdown = roundtrip.output;
    expect(dirname(dirname(markdown))).toBe(markdownParent);
    expect(roundtrip.outputs).toContain(markdown);
    expect(roundtrip.outputs.some((output) => basename(output) === "docwen-node.json")).toBe(false);
    const secondParent = join(caseRoot, "second");
    await mkdir(secondParent);
    const second = await client.convert({
      sourceInput: docxInput,
      inputs: [docxInput],
      outputDirectory: secondParent,
      target: "md",
      capabilityId: "convert.docx.to_markdown",
    });
    expect(second.outputs).toEqual([second.output]);
    expect(dirname(dirname(second.output))).toBe(secondParent);

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

  it("exports a real VaultReadSnapshot through the packaged source route with a cross-folder Wiki image", async () => {
    const source = join(root, "physical-source", "typed-source.md");
    const linked = join(root, "declared-pool", "typed linked.png");
    const decoy = join(root, "physical-source", "assets", "typed linked.png");
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

    const { TFile } = await import("obsidian");
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const note = Object.assign(new TFile(), { path: "notes/typed-source.md", extension: "md" });
    const image = Object.assign(new TFile(), { path: "assets/typed linked.png", extension: "png" });
    const token = "![[typed linked.png]]";
    const authored = sourceBytes.toString("utf8");
    const start = authored.indexOf(token);
    const app = {
      workspace: { getLeavesOfType: () => [] },
      vault: { getFileByPath: (filePath: string) => filePath === note.path ? note : null, readBinary: async (file: unknown) => Uint8Array.from(file === note ? sourceBytes : declaredBytes).buffer },
      metadataCache: {
        getFileCache: () => ({ embeds: [{ link: "typed linked.png", original: token, position: { start: { offset: start }, end: { offset: start + token.length } } }] }),
        getFirstLinkpathDest: () => image,
      },
      get plugins(): never { throw new Error("Source conversion must not consult Number Suite state"); },
    };
    const completed = await new VaultReadSnapshot(app as never).run(note, new AbortController().signal, async (snapshot) => {
      const declared = await snapshot.getDeclaredMarkdownInputs();
      expect(declared?.resourceBindings?.authored_sha256).toBe(sha256(sourceBytes));
      const service = new DocWenCapabilityService(client);
      const capability = await service.requireAction(snapshot.sourceInput, "convert");
      const route = service.requireConversionRoute(capability, "docx");
      service.requireTaskInputs(route, declared!.inputs);
      return client.convert({
        sourceInput: snapshot.sourceInput,
        inputs: declared!.inputs,
        markdownResourceBindings: declared!.resourceBindings,
        supportedOptions: route.options,
        selectedCapability: route.capability,
        outputDirectory: root,
        target: "docx",
        capabilityId: route.capabilityId,
      });
    });
    const generated = completed.value;
    const output = generated.output;
    expect(generated.outputs).toEqual([output]);
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

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
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

import { readFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({ MarkdownView: class MarkdownView {}, TFile: class TFile {} }));

describe("VaultReadSnapshot", () => {
  it("copies an unsaved editor buffer from a background Markdown split", async () => {
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const file = { path: "note.md", extension: "md" };
    const editor = { getValue: vi.fn(() => "# Unsaved\n") };
    const view = { file, editor };
    const leaf = { view };
    const app = {
      workspace: { getLeavesOfType: vi.fn(() => [leaf]) },
      vault: { readBinary: vi.fn() },
    };

    const content = await new VaultReadSnapshot(app as never).run(
      file as never,
      new AbortController().signal,
      async ({ inputPath }) => readFile(inputPath, "utf8"),
    );

    expect(content).toBe("# Unsaved\n");
    expect(app.vault.readBinary).not.toHaveBeenCalled();
  });

  it("fails closed when the source is open in multiple Markdown editors", async () => {
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const file = { path: "note.md", extension: "md" };
    const createLeaf = () => ({
      view: { file, editor: { getValue: vi.fn(() => "# Unsaved\n") } },
    });
    const app = {
      workspace: { getLeavesOfType: vi.fn(() => [createLeaf(), createLeaf()]) },
      vault: { readBinary: vi.fn() },
    };

    await expect(new VaultReadSnapshot(app as never).run(
      file as never,
      new AbortController().signal,
      async () => undefined,
    )).rejects.toMatchObject({ code: "vault_target_changed" });
    expect(app.vault.readBinary).not.toHaveBeenCalled();
  });

  it("preserves binary Vault input and detects concurrent file changes", async () => {
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const file = { path: "source.docx", extension: "docx" };
    const initial = Uint8Array.from([0x50, 0x4b, 0x00, 0xff]).buffer;
    const changed = Uint8Array.from([0x50, 0x4b, 0x01, 0xff]).buffer;
    const readBinary = vi.fn()
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(changed);
    const app = {
      workspace: { getLeavesOfType: vi.fn(() => []) },
      vault: { readBinary },
    };

    const pending = new VaultReadSnapshot(app as never).run(
      file as never,
      new AbortController().signal,
      async ({ inputPath }) => {
        expect([...await readFile(inputPath)]).toEqual([0x50, 0x4b, 0x00, 0xff]);
        return "done";
      },
    );

    await expect(pending).rejects.toMatchObject({ code: "vault_content_conflict" });
  });

  it("builds exact neutral inputs from Obsidian-resolved cross-folder embeds", async () => {
    const { TFile } = await import("obsidian");
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const file = Object.assign(new TFile(), { path: "notes/note.md", extension: "md" });
    const actual = Object.assign(new TFile(), { path: "assets/actual.png", extension: "png" });
    const decoy = Object.assign(new TFile(), { path: "assets/decoy.png", extension: "png" });
    const source = "😀 ![[actual.png]]\n![[actual.png|200]]\n";
    const firstToken = "![[actual.png]]";
    const secondToken = "![[actual.png|200]]";
    const firstStart = source.indexOf(firstToken);
    const secondStart = source.indexOf(secondToken);
    const readBinary = vi.fn(async (target: { path: string }) => {
      if (target === file) return new TextEncoder().encode(source).buffer;
      if (target === actual) return Uint8Array.from([1, 2, 3]).buffer;
      if (target === decoy) throw new Error("physical decoy must not be read");
      throw new Error(`unexpected read: ${target.path}`);
    });
    const app = {
      workspace: { getLeavesOfType: vi.fn(() => []) },
      vault: { readBinary },
      metadataCache: {
        getFileCache: vi.fn(() => ({
          embeds: [
            {
              link: "actual.png",
              original: secondToken,
              position: { start: { offset: secondStart }, end: { offset: secondStart + secondToken.length } },
            },
            {
              link: "actual.png",
              original: firstToken,
              position: { start: { offset: firstStart }, end: { offset: firstStart + firstToken.length } },
            },
          ],
        })),
        getFirstLinkpathDest: vi.fn(() => actual),
      },
    };

    const captured = await new VaultReadSnapshot(app as never).run(
      file as never,
      new AbortController().signal,
      async (snapshot) => ({
        sourceInput: snapshot.sourceInput,
        resolvedInputs: snapshot.resolvedMarkdownInputs,
        neutral: JSON.parse(await readFile(snapshot.resolvedMarkdownInputs![0].path, "utf8")),
        plan: JSON.parse(await readFile(snapshot.resolvedMarkdownInputs![1].path, "utf8")),
      }),
    );

    expect(captured.sourceInput).toMatchObject(
      { kind: "document", role: "source", logicalPath: "notes/note.md", mediaType: "text/markdown" },
    );
    expect(captured.resolvedInputs).toMatchObject([
      { kind: "document", role: "neutral_document", mediaType: "application/vnd.docwen.resolved-document+json" },
      { kind: "resource", role: "numbering_export_plan", mediaType: "application/vnd.docwen.numbering-export-plan+json" },
    ]);
    expect(captured.neutral.document.authored_markdown).toBe(source);
    expect(captured.neutral.document.resources).toHaveLength(1);
    expect(captured.neutral.document.resources[0]).toMatchObject({
      resource_id: "image-1",
      role: "linked_resource",
      media_type: "image/png",
      size_bytes: 3,
    });
    expect(captured.neutral.document.resource_occurrences).toMatchObject([
      { source_start: 2, authored_token: "![[actual.png]]", authored_locator: "actual.png", resource_id: "image-1" },
      { authored_token: "![[actual.png|200]]", authored_locator: "actual.png", resource_id: "image-1" },
    ]);
    expect(captured.plan.plan).toEqual({ heading_definitions: [], heading_instances: [], targets: [] });
    expect(captured.neutral.plan_sha256).toBe(captured.plan.plan_sha256);
    expect(readBinary).toHaveBeenCalledTimes(3);
    expect(readBinary).toHaveBeenCalledWith(actual);
    expect(app.metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith("actual.png", "notes/note.md");
  });

  it("authenticates the complete ATX heading inventory with Unicode offsets", async () => {
    const { TFile } = await import("obsidian");
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const file = Object.assign(new TFile(), { path: "notes/headings.md", extension: "md" });
    const headingLine = "# **Title** ^title-id";
    const source = `😀 intro\n${headingLine}\n\`\`\`\n## not a heading\n\`\`\`\n`;
    const headingStart = source.indexOf(headingLine);
    const app = {
      workspace: { getLeavesOfType: vi.fn(() => []) },
      vault: { readBinary: vi.fn(async () => new TextEncoder().encode(source).buffer) },
      metadataCache: {
        getFileCache: vi.fn(() => ({
          headings: [{
            heading: "Title",
            level: 1,
            position: {
              start: { offset: headingStart },
              end: { offset: headingStart + headingLine.length },
            },
          }],
        })),
        getFirstLinkpathDest: vi.fn(),
      },
    };

    const captured = await new VaultReadSnapshot(app as never).run(
      file as never,
      new AbortController().signal,
      async (snapshot) => ({
        neutral: JSON.parse(await readFile(snapshot.resolvedMarkdownInputs![0].path, "utf8")),
        plan: JSON.parse(await readFile(snapshot.resolvedMarkdownInputs![1].path, "utf8")),
      }),
    );

    expect(captured.neutral.document.targets).toEqual([expect.objectContaining({
      source_start: Array.from(source.slice(0, headingStart)).length,
      source_end: Array.from(source.slice(0, headingStart + headingLine.length)).length,
      kind: "heading",
      target_id: "title-id",
      heading_level: 1,
      authored_text: "Title",
    })]);
    expect(captured.plan.plan.targets).toEqual([{
      source_start: captured.neutral.document.targets[0].source_start,
      source_end: captured.neutral.document.targets[0].source_end,
      kind: "heading",
      enabled: false,
      target_id: "title-id",
      derived_number: null,
      materialization: null,
    }]);
    expect(captured.neutral.plan_sha256).toBe(captured.plan.plan_sha256);
  });

  it("materializes a validated Number Suite v2 snapshot into DocWen exact-two inputs", async () => {
    const { TFile } = await import("obsidian");
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const file = Object.assign(new TFile(), { path: "notes/numbered.md", extension: "md" });
    const heading = "# Scope";
    const headingId = "^scope";
    const caption = "Table: Results";
    const captionId = "^results";
    const emptyCaption = "Equation: ^energy";
    const headingReference = "@[[#^scope|section]]";
    const captionReference = "@[[#^results|table]]";
    const source = [
      heading,
      headingId,
      "",
      caption,
      captionId,
      "| A |",
      "| --- |",
      "| 1 |",
      "",
      emptyCaption,
      "$$E=mc^2$$",
      "",
      `See ${headingReference} and ${captionReference}.`,
    ].join("\n");
    const headingStart = source.indexOf(heading);
    const captionStart = source.indexOf(caption);
    const emptyCaptionStart = source.indexOf(emptyCaption);
    const headingReferenceStart = source.indexOf(headingReference);
    const captionReferenceStart = source.indexOf(captionReference);
    const semanticSnapshot = {
      schema: "number-suite.interop.v2",
      offsetEncoding: "utf16",
      disabled: false,
      headingTargets: [{
        sourceStartUtf16: headingStart,
        sourceEndUtf16: headingStart + heading.length,
        line: 0,
        level: 1,
        targetId: "scope",
        authoredText: "Scope",
        enabled: true,
        derivedNumber: "1",
        counters: [1, 0, 0, 0, 0, 0, 0, 0, 0],
        display: [{ kind: "counter", level: 1, numberFormat: "arabic" }],
      }],
      captionTargets: [{
        sourceStartUtf16: captionStart,
        sourceEndUtf16: captionStart + caption.length,
        line: 3,
        kind: "Table",
        targetId: "results",
        authoredText: "Results",
        enabled: true,
        derivedNumber: "1",
      }, {
        sourceStartUtf16: emptyCaptionStart,
        sourceEndUtf16: emptyCaptionStart + emptyCaption.length,
        line: 9,
        kind: "Equation",
        targetId: "energy",
        authoredText: "",
        enabled: true,
        derivedNumber: "1",
      }],
      references: [
        {
          sourceStartUtf16: headingReferenceStart,
          sourceEndUtf16: headingReferenceStart + headingReference.length,
          targetSourceStartUtf16: headingStart,
          targetSourceEndUtf16: headingStart + heading.length,
          alias: "section",
        },
        {
          sourceStartUtf16: captionReferenceStart,
          sourceEndUtf16: captionReferenceStart + captionReference.length,
          targetSourceStartUtf16: captionStart,
          targetSourceEndUtf16: captionStart + caption.length,
          alias: "table",
        },
      ],
    };
    const exportSemanticSnapshot = vi.fn(() => semanticSnapshot);
    const app = {
      workspace: { getLeavesOfType: vi.fn(() => []) },
      vault: { readBinary: vi.fn(async () => new TextEncoder().encode(source).buffer) },
      plugins: {
        getPlugin: vi.fn(() => ({
          getInteropApi: () => ({
            schema: "number-suite.interop.v2",
            exportSemanticSnapshot,
          }),
        })),
      },
      metadataCache: {
        getFileCache: vi.fn(() => ({
          frontmatter: { "number-suite-show-virtual": true },
          headings: [{
            heading: "Scope",
            level: 1,
            position: {
              start: { offset: headingStart },
              end: { offset: headingStart + heading.length },
            },
          }],
        })),
        getFirstLinkpathDest: vi.fn(),
      },
    };

    const captured = await new VaultReadSnapshot(app as never).run(
      file as never,
      new AbortController().signal,
      async (snapshot) => ({
        neutral: JSON.parse(await readFile(snapshot.resolvedMarkdownInputs![0].path, "utf8")),
        plan: JSON.parse(await readFile(snapshot.resolvedMarkdownInputs![1].path, "utf8")),
      }),
    );

    expect(exportSemanticSnapshot).toHaveBeenCalledWith({
      schema: "number-suite.interop.v2",
      authoredMarkdown: source,
      frontmatter: { "number-suite-show-virtual": true },
    });
    expect(captured.neutral.document.targets).toHaveLength(3);
    expect(captured.neutral.document.targets).toMatchObject([
      { kind: "heading", target_id: "scope" },
      { kind: "table", target_id: "results" },
      { kind: "equation", target_id: "energy" },
    ]);
    expect(captured.neutral.document.references).toHaveLength(2);
    expect(captured.plan.plan.heading_definitions).toHaveLength(1);
    expect(captured.plan.plan.heading_instances).toHaveLength(1);
    expect(captured.plan.plan.targets).toMatchObject([
      { kind: "heading", enabled: true, derived_number: "1" },
      {
        kind: "table",
        enabled: true,
        derived_number: "1",
        materialization: { type: "simple_seq", sequence_action: "reset_to_start" },
      },
      {
        kind: "equation",
        enabled: true,
        derived_number: "1",
        materialization: { type: "simple_seq", sequence_action: "reset_to_start" },
      },
    ]);
    expect(captured.neutral.plan_sha256).toBe(captured.plan.plan_sha256);
  });

  it("rejects a Number Suite block ID when inline and following IDs conflict", async () => {
    const { TFile } = await import("obsidian");
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const file = Object.assign(new TFile(), { path: "notes/ambiguous-id.md", extension: "md" });
    const heading = "# Scope ^inline";
    const source = `${heading}\n^following\n`;
    const semanticSnapshot = {
      schema: "number-suite.interop.v2",
      offsetEncoding: "utf16",
      disabled: false,
      headingTargets: [{
        sourceStartUtf16: 0,
        sourceEndUtf16: heading.length,
        line: 0,
        level: 1,
        targetId: "inline",
        authoredText: "Scope",
        enabled: true,
        derivedNumber: "1",
        counters: [1, 0, 0, 0, 0, 0, 0, 0, 0],
        display: [{ kind: "counter", level: 1, numberFormat: "arabic" }],
      }],
      captionTargets: [],
      references: [],
    };
    const app = {
      workspace: { getLeavesOfType: vi.fn(() => []) },
      vault: { readBinary: vi.fn(async () => new TextEncoder().encode(source).buffer) },
      plugins: {
        getPlugin: vi.fn(() => ({
          getInteropApi: () => ({
            schema: "number-suite.interop.v2",
            exportSemanticSnapshot: () => semanticSnapshot,
          }),
        })),
      },
      metadataCache: {
        getFileCache: vi.fn(() => ({
          headings: [{
            heading: "Scope",
            level: 1,
            position: { start: { offset: 0 }, end: { offset: heading.length } },
          }],
        })),
        getFirstLinkpathDest: vi.fn(),
      },
    };

    await expect(new VaultReadSnapshot(app as never).run(
      file as never,
      new AbortController().signal,
      async () => undefined,
    )).rejects.toMatchObject({
      code: "vault_input_invalid",
      details: { cause: expect.stringContaining("block ID") },
    });
  });

  it.each([
    [
      "a percent sign",
      [{ kind: "literal", literal: "%" }, { kind: "counter", level: 1, numberFormat: "arabic" }],
      [1, 0, 0, 0, 0, 0, 0, 0, 0],
      "literal",
    ],
    [
      "more than 32 Unicode characters",
      [{ kind: "literal", literal: "一".repeat(33) }, { kind: "counter", level: 1, numberFormat: "arabic" }],
      [1, 0, 0, 0, 0, 0, 0, 0, 0],
      "literal",
    ],
    [
      "an XML control character",
      [{ kind: "literal", literal: "\u0007" }, { kind: "counter", level: 1, numberFormat: "arabic" }],
      [1, 0, 0, 0, 0, 0, 0, 0, 0],
      "literal",
    ],
    [
      "more than 19 display segments",
      [
        ...Array.from({ length: 19 }, (_unused, index) => ({ kind: "literal", literal: String(index % 10) })),
        { kind: "counter", level: 1, numberFormat: "arabic" },
      ],
      [1, 0, 0, 0, 0, 0, 0, 0, 0],
      "segment",
    ],
    [
      "a counter above the DOCX integer boundary",
      [{ kind: "counter", level: 1, numberFormat: "arabic" }],
      [2_147_483_648, 0, 0, 0, 0, 0, 0, 0, 0],
      "counters",
    ],
  ])("rejects a Number Suite Heading plan containing %s", async (_label, display, counters, cause) => {
    const { TFile } = await import("obsidian");
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const file = Object.assign(new TFile(), { path: "notes/literal.md", extension: "md" });
    const source = "# Scope";
    const semanticSnapshot = {
      schema: "number-suite.interop.v2",
      offsetEncoding: "utf16",
      disabled: false,
      headingTargets: [{
        sourceStartUtf16: 0,
        sourceEndUtf16: source.length,
        line: 0,
        level: 1,
        targetId: null,
        authoredText: "Scope",
        enabled: true,
        derivedNumber: "1",
        counters,
        display,
      }],
      captionTargets: [],
      references: [],
    };
    const app = {
      workspace: { getLeavesOfType: vi.fn(() => []) },
      vault: { readBinary: vi.fn(async () => new TextEncoder().encode(source).buffer) },
      plugins: {
        getPlugin: vi.fn(() => ({
          getInteropApi: () => ({
            schema: "number-suite.interop.v2",
            exportSemanticSnapshot: () => semanticSnapshot,
          }),
        })),
      },
      metadataCache: {
        getFileCache: vi.fn(() => ({
          headings: [{
            heading: "Scope",
            level: 1,
            position: { start: { offset: 0 }, end: { offset: source.length } },
          }],
        })),
        getFirstLinkpathDest: vi.fn(),
      },
    };

    await expect(new VaultReadSnapshot(app as never).run(
      file as never,
      new AbortController().signal,
      async () => undefined,
    )).rejects.toMatchObject({
      code: "vault_input_invalid",
      details: { cause: expect.stringContaining(cause) },
    });
  });

  it("authenticates DocWen heading levels seven through nine without invalidating standard cached headings", async () => {
    const { TFile } = await import("obsidian");
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const file = Object.assign(new TFile(), { path: "notes/extended-headings.md", extension: "md" });
    const standard = "# **Cached title**";
    const levelSeven = "####### Seven";
    const levelEight = "######## Eight ^eight-id";
    const levelNine = "######### Nine";
    const source = [
      standard,
      levelSeven,
      "> " + levelEight,
      "- " + levelNine,
      "########## Ten remains paragraph text",
      "```",
      "######### fenced text",
      "```",
      "",
    ].join("\n");
    const app = {
      workspace: { getLeavesOfType: vi.fn(() => []) },
      vault: { readBinary: vi.fn(async () => new TextEncoder().encode(source).buffer) },
      metadataCache: {
        getFileCache: vi.fn(() => ({
          headings: [{
            heading: "Cached title",
            level: 1,
            position: {
              start: { offset: source.indexOf(standard) },
              end: { offset: source.indexOf(standard) + standard.length },
            },
          }],
        })),
        getFirstLinkpathDest: vi.fn(),
      },
    };

    const captured = await new VaultReadSnapshot(app as never).run(
      file as never,
      new AbortController().signal,
      async (snapshot) => ({
        neutral: JSON.parse(await readFile(snapshot.resolvedMarkdownInputs![0].path, "utf8")),
        plan: JSON.parse(await readFile(snapshot.resolvedMarkdownInputs![1].path, "utf8")),
      }),
    );

    expect(captured.neutral.document.targets.map((target: Record<string, unknown>) => ({
      authored_text: target.authored_text,
      heading_level: target.heading_level,
      target_id: target.target_id,
    }))).toEqual([
      { authored_text: "Cached title", heading_level: 1, target_id: null },
      { authored_text: "Seven", heading_level: 7, target_id: null },
      { authored_text: "Eight", heading_level: 8, target_id: "eight-id" },
      { authored_text: "Nine", heading_level: 9, target_id: null },
    ]);
    expect(captured.plan.plan.targets).toHaveLength(4);
    expect(captured.neutral.plan_sha256).toBe(captured.plan.plan_sha256);
  });
});

describe("VaultReadSnapshot Number Suite authentication", () => {
  it("authenticates a heading block ID on the next standalone line", async () => {
    const heading = "# Scope";
    const source = `${heading}\n^scope\n`;
    const snapshot = semanticSnapshot({
      headings: [headingFact(0, heading.length, 0, "Scope", { targetId: null, enabled: false })],
    });

    await expect(captureNumberSuiteProjection(source, snapshot, [{
      heading: "Scope",
      level: 1,
      position: { start: { offset: 0 }, end: { offset: heading.length } },
    }])).rejects.toMatchObject({
      code: "vault_input_invalid",
      details: { cause: expect.stringContaining("block ID") },
    });
  });

  it.each([
    ["inline and following IDs", "# Scope ^inline\n^following\n", "# Scope ^inline"],
    ["multiple following IDs", "# Scope\n^first\n^second\n", "# Scope"],
    ["a repeated inline/following ID", "# Scope ^same\n^same\n", "# Scope ^same"],
  ])("accepts targetId null for one target with %s", async (_case, source, heading) => {
    const snapshot = semanticSnapshot({
      headings: [headingFact(0, heading.length, 0, "Scope", { targetId: null, enabled: false })],
    });

    const captured = await captureNumberSuiteProjection(source, snapshot, [{
      heading: "Scope",
      level: 1,
      position: { start: { offset: 0 }, end: { offset: heading.length } },
    }]);

    expect(captured.neutral.document.targets).toMatchObject([{ target_id: null }]);
  });

  it("accepts the producer shape for one globally repeated ID on two targets", async () => {
    const first = "# One ^duplicate";
    const second = "# Two ^duplicate";
    const secondStart = first.length + 1;
    const source = `${first}\n${second}\n`;
    const snapshot = semanticSnapshot({
      headings: [
        headingFact(0, first.length, 0, "One", { targetId: null, enabled: false }),
        headingFact(secondStart, secondStart + second.length, 1, "Two", {
          targetId: null,
          enabled: false,
        }),
      ],
    });

    const captured = await captureNumberSuiteProjection(source, snapshot, [
      {
        heading: "One",
        level: 1,
        position: { start: { offset: 0 }, end: { offset: first.length } },
      },
      {
        heading: "Two",
        level: 1,
        position: { start: { offset: secondStart }, end: { offset: secondStart + second.length } },
      },
    ]);

    expect(captured.neutral.document.targets).toMatchObject([
      { authored_text: "One", target_id: null },
      { authored_text: "Two", target_id: null },
    ]);
  });

  it("does not count a fenced pseudo-ID as a global duplicate", async () => {
    const heading = "# Scope ^scope";
    const source = `${heading}\n\`\`\`text\nparagraph ^scope\n\`\`\`\n`;
    const snapshot = semanticSnapshot({
      headings: [headingFact(0, heading.length, 0, "Scope", { targetId: null, enabled: false })],
    });

    await expect(captureNumberSuiteProjection(source, snapshot, [{
      heading: "Scope",
      level: 1,
      position: { start: { offset: 0 }, end: { offset: heading.length } },
    }])).rejects.toMatchObject({
      code: "vault_input_invalid",
      details: { cause: expect.stringContaining("globally unique block ID") },
    });
  });

  it("trims an authored alias with the same semantics as Number Suite", async () => {
    const heading = "# Scope";
    const reference = "@[[#Scope|  section  ]]";
    const source = `${heading}\n\nSee ${reference}.`;
    const referenceStart = source.indexOf(reference);
    const snapshot = semanticSnapshot({
      headings: [headingFact(0, heading.length, 0, "Scope")],
      references: [{
        sourceStartUtf16: referenceStart,
        sourceEndUtf16: referenceStart + reference.length,
        targetSourceStartUtf16: 0,
        targetSourceEndUtf16: heading.length,
        alias: "section",
      }],
    });

    const captured = await captureNumberSuiteProjection(source, snapshot, [{
      heading: "Scope",
      level: 1,
      position: { start: { offset: 0 }, end: { offset: heading.length } },
    }]);

    expect(captured.neutral.document.references).toMatchObject([{
      authored_token: reference,
      alias: "section",
      cached_number: "1",
    }]);
  });

  it("keeps a valid unnumbered reference in Markdown without inventing cached_number", async () => {
    const heading = "# Scope";
    const reference = "@[[#Scope]]";
    const source = `${heading}\n\nSee ${reference}.`;
    const referenceStart = source.indexOf(reference);
    const snapshot = semanticSnapshot({
      headings: [headingFact(0, heading.length, 0, "Scope", { enabled: false })],
      references: [{
        sourceStartUtf16: referenceStart,
        sourceEndUtf16: referenceStart + reference.length,
        targetSourceStartUtf16: 0,
        targetSourceEndUtf16: heading.length,
        alias: null,
      }],
    });

    const captured = await captureNumberSuiteProjection(source, snapshot, [{
      heading: "Scope",
      level: 1,
      position: { start: { offset: 0 }, end: { offset: heading.length } },
    }]);

    expect(captured.neutral.document.authored_markdown).toBe(source);
    expect(captured.neutral.document.references).toEqual([]);
    expect(captured.plan.plan.targets).toMatchObject([{ enabled: false, derived_number: null }]);
  });

  it("projects CRLF UTF-16 ranges with astral text and an empty Code caption title", async () => {
    const caption = "Code: ^snippet";
    const reference = "@[[#^snippet|  code 🐈  ]]";
    const source = [
      "😀 intro",
      caption,
      "",
      "```ts",
      "const x = 1;",
      "```",
      "",
      `See ${reference}.`,
    ].join("\r\n");
    const captionStart = source.indexOf(caption);
    const referenceStart = source.indexOf(reference);
    const snapshot = semanticSnapshot({
      captions: [{
        sourceStartUtf16: captionStart,
        sourceEndUtf16: captionStart + caption.length,
        line: 1,
        kind: "Code",
        targetId: "snippet",
        authoredText: "",
        enabled: true,
        derivedNumber: "1",
      }],
      references: [{
        sourceStartUtf16: referenceStart,
        sourceEndUtf16: referenceStart + reference.length,
        targetSourceStartUtf16: captionStart,
        targetSourceEndUtf16: captionStart + caption.length,
        alias: "code 🐈",
      }],
    });

    const captured = await captureNumberSuiteProjection(source, snapshot);

    expect(captured.neutral.document.targets).toMatchObject([{
      source_start: Array.from(source.slice(0, captionStart)).length,
      source_end: Array.from(source.slice(0, captionStart + caption.length)).length,
      kind: "code_block",
      target_id: "snippet",
      authored_text: "",
    }]);
    expect(captured.neutral.document.references).toMatchObject([{
      source_start: Array.from(source.slice(0, referenceStart)).length,
      source_end: Array.from(source.slice(0, referenceStart + reference.length)).length,
      target_source_start: Array.from(source.slice(0, captionStart)).length,
      target_source_end: Array.from(source.slice(0, captionStart + caption.length)).length,
      alias: "code 🐈",
      cached_number: "1",
    }]);
  });

  it("requires a caption target to cover its complete physical source line", async () => {
    const completeCaption = "Figure: Miao ^figure-id";
    const authenticatedPrefix = "Figure: Miao";
    const source = `${completeCaption}\n\n![[miao.png]]`;
    const snapshot = semanticSnapshot({
      captions: [{
        sourceStartUtf16: 0,
        sourceEndUtf16: authenticatedPrefix.length,
        line: 0,
        kind: "Figure",
        targetId: null,
        authoredText: "Miao",
        enabled: true,
        derivedNumber: "1",
      }],
    });

    await expect(captureNumberSuiteProjection(source, snapshot)).rejects.toMatchObject({
      code: "vault_input_invalid",
      details: { cause: expect.stringContaining("complete physical source line") },
    });
  });

  it.each([
    ["title mismatch", "# Scope", null, "@[[#Other]]", "Other", "title contradicts"],
    ["block ID mismatch", "# Scope ^scope", "scope", "@[[#^wrong]]", "wrong", "block ID contradicts"],
  ])("rejects a reference whose %s its authenticated target", async (
    _case,
    heading,
    targetId,
    reference,
    _tokenTarget,
    cause,
  ) => {
    const title = "Scope";
    const source = `${heading}\n\nSee ${reference}.`;
    const referenceStart = source.indexOf(reference);
    const snapshot = semanticSnapshot({
      headings: [headingFact(0, heading.length, 0, title, { targetId, enabled: false })],
      references: [{
        sourceStartUtf16: referenceStart,
        sourceEndUtf16: referenceStart + reference.length,
        targetSourceStartUtf16: 0,
        targetSourceEndUtf16: heading.length,
        alias: null,
      }],
    });

    await expect(captureNumberSuiteProjection(source, snapshot, [{
      heading: title,
      level: 1,
      position: { start: { offset: 0 }, end: { offset: heading.length } },
    }])).rejects.toMatchObject({
      code: "vault_input_invalid",
      details: { cause: expect.stringContaining(cause) },
    });
  });

  it("rejects an ambiguous title reference even when Number Suite supplies a target range", async () => {
    const first = "# Same";
    const second = "# Same";
    const secondStart = first.length + 1;
    const reference = "@[[#Same]]";
    const source = `${first}\n${second}\n\n${reference}`;
    const referenceStart = source.indexOf(reference);
    const snapshot = semanticSnapshot({
      headings: [
        headingFact(0, first.length, 0, "Same", { enabled: false }),
        headingFact(secondStart, secondStart + second.length, 1, "Same", { enabled: false }),
      ],
      references: [{
        sourceStartUtf16: referenceStart,
        sourceEndUtf16: referenceStart + reference.length,
        targetSourceStartUtf16: 0,
        targetSourceEndUtf16: first.length,
        alias: null,
      }],
    });

    await expect(captureNumberSuiteProjection(source, snapshot, [
      {
        heading: "Same",
        level: 1,
        position: { start: { offset: 0 }, end: { offset: first.length } },
      },
      {
        heading: "Same",
        level: 1,
        position: { start: { offset: secondStart }, end: { offset: secondStart + second.length } },
      },
    ])).rejects.toMatchObject({
      code: "vault_input_invalid",
      details: { cause: expect.stringContaining("title is ambiguous") },
    });
  });

  it("authenticates a title reference against the source title, not an exported title claim", async () => {
    const heading = "# Scope";
    const reference = "@[[#Forged]]";
    const source = `${heading}\n\n${reference}`;
    const referenceStart = source.indexOf(reference);
    const snapshot = semanticSnapshot({
      headings: [headingFact(0, heading.length, 0, "Forged", { enabled: false })],
      references: [{
        sourceStartUtf16: referenceStart,
        sourceEndUtf16: referenceStart + reference.length,
        targetSourceStartUtf16: 0,
        targetSourceEndUtf16: heading.length,
        alias: null,
      }],
    });

    await expect(captureNumberSuiteProjection(source, snapshot, [{
      heading: "Scope",
      level: 1,
      position: { start: { offset: 0 }, end: { offset: heading.length } },
    }])).rejects.toMatchObject({
      code: "vault_input_invalid",
      details: { cause: expect.stringContaining("title contradicts") },
    });
  });

  it("treats a heading and caption with the same full title as an ambiguous reference", async () => {
    const heading = "# Figure: Miao";
    const caption = "Figure: Miao";
    const captionStart = heading.length + 1;
    const reference = "@[[#Figure: Miao]]";
    const source = `${heading}\n${caption}\n\n${reference}`;
    const referenceStart = source.indexOf(reference);
    const snapshot = semanticSnapshot({
      headings: [headingFact(0, heading.length, 0, "Figure: Miao", { enabled: false })],
      captions: [{
        sourceStartUtf16: captionStart,
        sourceEndUtf16: captionStart + caption.length,
        line: 1,
        kind: "Figure",
        targetId: null,
        authoredText: "Miao",
        enabled: false,
        derivedNumber: null,
      }],
      references: [{
        sourceStartUtf16: referenceStart,
        sourceEndUtf16: referenceStart + reference.length,
        targetSourceStartUtf16: 0,
        targetSourceEndUtf16: heading.length,
        alias: null,
      }],
    });

    await expect(captureNumberSuiteProjection(source, snapshot, [{
      heading: "Figure: Miao",
      level: 1,
      position: { start: { offset: 0 }, end: { offset: heading.length } },
    }])).rejects.toMatchObject({
      code: "vault_input_invalid",
      details: { cause: expect.stringContaining("title is ambiguous") },
    });
  });

  it("preserves a Markdown table while projecting its Figure caption as a figure plan", async () => {
    const caption = "Figure: Comparison";
    const source = [
      caption,
      "",
      "| Before | After |",
      "| --- | --- |",
      "| A | B |",
    ].join("\n");
    const snapshot = semanticSnapshot({
      captions: [{
        sourceStartUtf16: 0,
        sourceEndUtf16: caption.length,
        line: 0,
        kind: "Figure",
        targetId: null,
        authoredText: "Comparison",
        enabled: true,
        derivedNumber: "1",
      }],
    });

    const captured = await captureNumberSuiteProjection(source, snapshot);

    expect(captured.inputs).toHaveLength(2);
    expect(captured.neutral.document.authored_markdown).toBe(source);
    expect(captured.neutral.document.targets).toMatchObject([{ kind: "figure" }]);
    expect(captured.plan.plan.targets).toMatchObject([{
      kind: "figure",
      enabled: true,
      derived_number: "1",
      materialization: { type: "simple_seq", counter: "Figure" },
    }]);
  });
});

function headingFact(
  sourceStartUtf16: number,
  sourceEndUtf16: number,
  line: number,
  authoredText: string,
  options: Readonly<{ targetId?: string | null; enabled?: boolean }> = {},
) {
  const enabled = options.enabled ?? true;
  return {
    sourceStartUtf16,
    sourceEndUtf16,
    line,
    level: 1,
    targetId: options.targetId ?? null,
    authoredText,
    enabled,
    derivedNumber: enabled ? "1" : null,
    counters: [1, 0, 0, 0, 0, 0, 0, 0, 0],
    display: enabled ? [{ kind: "counter", level: 1, numberFormat: "arabic" }] : [],
  };
}

function semanticSnapshot(options: Readonly<{
  headings?: readonly unknown[];
  captions?: readonly unknown[];
  references?: readonly unknown[];
}>) {
  return {
    schema: "number-suite.interop.v2",
    offsetEncoding: "utf16",
    disabled: false,
    headingTargets: options.headings ?? [],
    captionTargets: options.captions ?? [],
    references: options.references ?? [],
  };
}

async function captureNumberSuiteProjection(
  source: string,
  semantic: unknown,
  headings: readonly unknown[] = [],
) {
  const { TFile } = await import("obsidian");
  const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
  const file = Object.assign(new TFile(), { path: "notes/interop.md", extension: "md" });
  const app = {
    workspace: { getLeavesOfType: vi.fn(() => []) },
    vault: { readBinary: vi.fn(async () => new TextEncoder().encode(source).buffer) },
    plugins: {
      getPlugin: vi.fn(() => ({
        getInteropApi: () => ({
          schema: "number-suite.interop.v2",
          exportSemanticSnapshot: () => semantic,
        }),
      })),
    },
    metadataCache: {
      getFileCache: vi.fn(() => ({ headings, embeds: [] })),
      getFirstLinkpathDest: vi.fn(),
    },
  };
  return new VaultReadSnapshot(app as never).run(
    file as never,
    new AbortController().signal,
    async (resolved) => ({
      inputs: resolved.resolvedMarkdownInputs,
      neutral: JSON.parse(await readFile(resolved.resolvedMarkdownInputs![0].path, "utf8")),
      plan: JSON.parse(await readFile(resolved.resolvedMarkdownInputs![1].path, "utf8")),
    }),
  );
}

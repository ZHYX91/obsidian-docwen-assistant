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

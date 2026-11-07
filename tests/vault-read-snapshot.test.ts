import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({ MarkdownView: class MarkdownView {}, TFile: class TFile {} }));

describe("VaultReadSnapshot", () => {
  it.each(["stat", "modify-event"])("rejects a closed-source %s change after the final read", async (change) => {
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const file = { path: "note.md", extension: "md", stat: { mtime: 1, ctime: 1, size: 7 } };
    let onModify: (changed: unknown) => void = () => undefined;
    const offref = vi.fn();
    const app = { workspace: { getLeavesOfType: () => [] }, vault: {
      getFileByPath: () => file,
      readBinary: async () => new TextEncoder().encode("# Before\n").buffer,
      on: (_event: string, listener: typeof onModify) => { onModify = listener; return {}; },
      offref,
    } };
    let published = false;
    await expect(new VaultReadSnapshot(app as never).run(file as never, new AbortController().signal,
      snapshot => snapshot.publish(async guard => {
        await Promise.resolve();
        if (change === "stat") file.stat.mtime += 1;
        else onModify(file); // Same byte count and stat resolution must still conflict.
        guard();
        published = true;
      }))).rejects.toMatchObject({ code: "vault_content_conflict" });
    expect(published).toBe(false);
    expect(offref).toHaveBeenCalledOnce();
  });

  it.each(["capture", "publication"])("rejects a same-path editor rebound at %s", async (stage) => {
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const file = { path: "note.md", extension: "md" };
    const replacement = { ...file };
    const editor = { getValue: vi.fn(() => "# Unchanged\n") };
    const view = { file: stage === "capture" ? replacement : file, editor };
    const leaf = { view };
    const app = {
      workspace: { getLeavesOfType: () => [leaf] },
      vault: { getFileByPath: () => file },
    };
    const publish = vi.fn();
    const work = vi.fn(async (snapshot: { publish: (commit: () => Promise<void>) => Promise<void> }) => {
      view.file = replacement;
      return snapshot.publish(publish);
    });
    await expect(new VaultReadSnapshot(app as never).run(
      file as never, new AbortController().signal, work,
    )).rejects.toMatchObject({ code: "vault_target_changed" });
    expect(publish).not.toHaveBeenCalled();
    if (stage === "capture") {
      expect(editor.getValue).not.toHaveBeenCalled();
      expect(work).not.toHaveBeenCalled();
    }
  });

  it("preserves Structural Tables authored bytes in the source-native port", async () => {
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const file = { path: "tables/structural.md", extension: "md" };
    const source = [
      "| Region | Sales | < |",
      "| Quarter | Q1 | Q2 |",
      "| --- || --- | --- |",
      "| North | 10 | 12 |",
      "| ^ | 8 | 11 |",
      "",
      "| --- | --- |",
      "| Alice | 10 |",
      "| Bob | 20 |",
      "",
      "| Literal | Markers |",
      "| --- | --- |",
      "| \\< | \\^ |",
      "",
    ].join("\n");
    const app = {
      workspace: { getLeavesOfType: () => [] },
      vault: { getFileByPath: (filePath: string) => filePath === file.path ? file : null, readBinary: async () => new TextEncoder().encode(source).buffer },
      get plugins(): never { throw new Error("Source export must not consult editing plugins"); },
    };
    await new VaultReadSnapshot(app as never).run(file as never, new AbortController().signal, async (snapshot) => {
      const declared = await snapshot.getDeclaredMarkdownInputs();
      expect(declared?.inputs.map((input) => input.role)).toEqual(["source"]);
      expect(await readFile(declared!.inputs[0].path)).toEqual(Buffer.from(source));
      expect(declared?.resourceBindings).toBeUndefined();
    });
  });
  it.each([
    ["note.md", "md", "document", "text/markdown"],
    ["letter.docx", "docx", "document", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["layout.pdf", "pdf", "resource", "application/pdf"],
    ["table.xlsx", "xlsx", "resource", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["scan.png", "png", "resource", "image/png"],
    ["pages.tiff", "tiff", "resource", "image/tiff"],
  ])(
    "builds %s with the Core-compatible source kind",
    async (filePath, extension, expectedKind, expectedMediaType) => {
      const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
      const file = { path: filePath, extension };
      const app = {
        workspace: { getLeavesOfType: () => [] },
        vault: { getFileByPath: (filePath: string) => filePath === file.path ? file : null, readBinary: async () => Uint8Array.from([1, 2, 3]).buffer },
      };

      await new VaultReadSnapshot(app as never).run(
        file as never,
        new AbortController().signal,
        async (snapshot) => {
          expect(snapshot.sourceInput).toMatchObject({
            kind: expectedKind,
            role: "source",
            logicalPath: filePath,
            mediaType: expectedMediaType,
          });
        },
      );
    },
  );

  it.each([
    ["layout.pdf", "pdf", "application/pdf"],
    ["table.xlsx", "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["scan.png", "png", "image/png"],
    ["pages.tiff", "tiff", "image/tiff"],
  ])(
    "passes the actual %s snapshot through the resource input-slot contract",
    async (filePath, extension, mediaType) => {
      const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
      const { DocWenCapabilityService } = await import("../src/docwen/capability-service");
      const file = { path: filePath, extension };
      const app = {
        workspace: { getLeavesOfType: () => [] },
        vault: { getFileByPath: (filePath: string) => filePath === file.path ? file : null, readBinary: async () => Uint8Array.from([1, 2, 3]).buffer },
      };
      const service = new DocWenCapabilityService({} as never);
      const route = {
        capabilityId: "probe",
        inputShape: {
          undeclared_roles: "reject",
          slots: [{ role: "source", kind: "resource", media_types: [mediaType], min_items: 1, max_items: 1 }],
        },
      } as never;

      await new VaultReadSnapshot(app as never).run(
        file as never,
        new AbortController().signal,
        async (snapshot) => {
          expect(() => service.requireTaskInputs(route, [snapshot.sourceInput])).not.toThrow();
        },
      );
    },
  );
  it("passes a long raw source to proofreading without reading semantic metadata or plugins", async () => {
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const source = "# 中文标题😀\n\n正文。\n".repeat(4_000);
    const file = { path: "long.md", extension: "md" };
    const app = {
      workspace: { getLeavesOfType: () => [] },
      vault: { getFileByPath: (filePath: string) => filePath === file.path ? file : null, readBinary: async () => new TextEncoder().encode(source).buffer },
      get metadataCache(): never { throw new Error("Raw operations must not read metadata"); },
      get plugins(): never { throw new Error("Raw operations must not load interop plugins"); },
    };
    await new VaultReadSnapshot(app as never).run(file as never, new AbortController().signal, async (snapshot) => {
      expect(await readFile(snapshot.sourceInput.path, "utf8")).toBe(source);
    });
  });

  it.each([false, true])("builds source-native DOCX inputs without consulting Number Suite plugins (BOM=%s)", async (bom) => {
    const { TFile } = await import("obsidian");
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const file = Object.assign(new TFile(), { path: "notes/note.md", extension: "md" });
    const image = Object.assign(new TFile(), { path: "assets/chart.png", extension: "png" });
    const token = "![[chart.png]]";
    const source = `# Scope\n\nFigure: Chart ^chart\n\n${token}\n`;
    const sourceBytes = Buffer.from((bom ? "\uFEFF" : "") + source);
    const tokenStart = source.indexOf(token);
    const app = {
      workspace: { getLeavesOfType: () => [] },
      vault: { getFileByPath: (filePath: string) => filePath === file.path ? file : null,
        readBinary: vi.fn(async (target: unknown) =>
          target === file
            ? Uint8Array.from(sourceBytes).buffer
            : Uint8Array.from([1, 2, 3]).buffer),
      },
      metadataCache: {
        getFileCache: vi.fn(() => ({
          embeds: [{
            link: "chart.png",
            original: token,
            position: { start: { offset: tokenStart }, end: { offset: tokenStart + token.length } },
          }],
        })),
        getFirstLinkpathDest: vi.fn(() => image),
      },
      get plugins(): never {
        throw new Error("source-native export must not inspect Number Suite");
      },
    };

    await new VaultReadSnapshot(app as never).run(
      file as never,
      new AbortController().signal,
      async (snapshot) => {
        const declared = await snapshot.getDeclaredMarkdownInputs();
        const inputs = declared?.inputs;
        expect(declared?.resourceBindings).toEqual({
          authored_sha256: createHash("sha256").update(sourceBytes).digest("hex"),
          images: [{ authored_token: token, logical_path: "assets/chart.png" }],
        });
        expect(inputs).toMatchObject([
          { role: "source", logicalPath: "notes/note.md", mediaType: "text/markdown" },
          { role: "linked_resource", logicalPath: "assets/chart.png", mediaType: "image/png" },
        ]);
        expect(await readFile(inputs![0].path)).toEqual(sourceBytes);
        expect([...await readFile(inputs![1].path)]).toEqual([1, 2, 3]);
      },
    );
  });

  it("memoizes declared inputs and handles cancellation before metadata access", async () => {
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const file = { path: "note.md", extension: "md" };
    const metadataCache = { getFileCache: vi.fn(() => ({})) };
    const app = {
      workspace: { getLeavesOfType: () => [] },
      vault: { getFileByPath: (filePath: string) => filePath === file.path ? file : null, readBinary: async () => new TextEncoder().encode("# Title\n").buffer },
      metadataCache,
    };
    await new VaultReadSnapshot(app as never).run(file as never, new AbortController().signal, async (snapshot) => {
      expect(metadataCache.getFileCache).not.toHaveBeenCalled();
      const first = await snapshot.getDeclaredMarkdownInputs();
      expect(await snapshot.getDeclaredMarkdownInputs()).toBe(first);
      expect(metadataCache.getFileCache).toHaveBeenCalledTimes(1);
    });
    metadataCache.getFileCache.mockClear();
    const controller = new AbortController();
    await expect(new VaultReadSnapshot(app as never).run(file as never, controller.signal, async (snapshot) => {
      const pending = snapshot.getDeclaredMarkdownInputs();
      setTimeout(() => controller.abort(), 0);
      return pending;
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(metadataCache.getFileCache).not.toHaveBeenCalled();
  });

  it.each(["md", "markdown"])("preserves authored content and source name for a closed .%s file", async (extension) => {
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const file = { path: `笔记/报告 v2.${extension}`, extension };
    const source = "# 标题\n\n当前正文。\n";
    const app = {
      workspace: { getLeavesOfType: () => [] },
      vault: { getFileByPath: (filePath: string) => filePath === file.path ? file : null, readBinary: async () => new TextEncoder().encode(source).buffer },
    };
    await new VaultReadSnapshot(app as never).run(file as never, new AbortController().signal, async (snapshot) => {
      const declared = await snapshot.getDeclaredMarkdownInputs();
      expect(declared?.inputs[0].logicalPath).toBe(file.path);
      expect(await readFile(declared!.inputs[0].path, "utf8")).toBe(source);
      expect(declared?.inputs.map((input) => input.role)).toEqual(["source"]);
    });
  });

  it("rejects changed source before publishing and does not recheck after successful publication", async () => {
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const file = { path: "note.md", extension: "md" };
    let buffer = "# Original\n";
    const editor = { getValue: () => buffer };
    const leaf = { view: { file, editor } };
    const app = {
      workspace: { getLeavesOfType: () => [leaf] },
      vault: { getFileByPath: (filePath: string) => filePath === file.path ? file : null, readBinary: vi.fn() },
    };
    const publishResult = vi.fn(async () => "visible");
    await expect(new VaultReadSnapshot(app as never).run(file as never, new AbortController().signal,
      async (snapshot) => {
        buffer = "# Edited while converting\n";
        return snapshot.publish(publishResult);
      })).rejects.toMatchObject({ code: "vault_content_conflict" });
    expect(publishResult).not.toHaveBeenCalled();

    await expect(new VaultReadSnapshot(app as never).run(file as never, new AbortController().signal,
      async (snapshot) => snapshot.publish(async () => {
        buffer = "# Later edit after the publication boundary\n";
        return "published";
      }))).resolves.toEqual({ value: "published", warnings: [] });
  });

  it.each([
    ["renamed", (file: { path: string }, identity: { current: object | null }) => { file.path = "renamed.md"; }],
    ["deleted", (_file: { path: string }, identity: { current: object | null }) => { identity.current = null; }],
    ["replaced", (_file: { path: string }, identity: { current: object | null }) => {
      identity.current = { path: "note.md", extension: "md" };
    }],
  ])("rejects a %s closed-source identity before publishing any result", async (_case, mutate) => {
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const file = { path: "note.md", extension: "md" };
    const identity: { current: object | null } = { current: file };
    const contents = "# Unchanged source\\n";
    const publishResult = vi.fn(async () => "must not publish");
    const vault = {
      getFileByPath: vi.fn(() => identity.current),
      readBinary: vi.fn(async () => new TextEncoder().encode(contents).buffer),
    };
    const app = { vault, workspace: { getLeavesOfType: () => [] } };
    await expect(new VaultReadSnapshot(app as never).run(
      file as never, new AbortController().signal, async (snapshot) => {
        mutate(file, identity);
        return snapshot.publish(publishResult);
      },
    )).rejects.toMatchObject({ code: "vault_target_changed" });
    expect(publishResult).not.toHaveBeenCalled();
  });

  it("rejects a rename that happens during the initial asynchronous source read", async () => {
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const file = { path: "note.md", extension: "md" };
    const app = {
      workspace: { getLeavesOfType: () => [] },
      vault: {
        getFileByPath: (path: string) => path === file.path ? file : null,
        readBinary: async () => {
          file.path = "renamed.md";
          return new TextEncoder().encode("# Same contents\\n").buffer;
        },
      },
    };
    const work = vi.fn();
    await expect(new VaultReadSnapshot(app as never).run(
      file as never, new AbortController().signal, work,
    )).rejects.toMatchObject({ code: "vault_target_changed" });
    expect(work).not.toHaveBeenCalled();
  });

  it.each(["renamed", "deleted", "replaced"])("rejects a source %s during the final asynchronous read", async (change) => {
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const file = { path: "note.md", extension: "md" };
    let current: object | null = file;
    let reads = 0;
    const publish = vi.fn();
    const app = {
      workspace: { getLeavesOfType: () => [] },
      vault: {
        getFileByPath: () => current,
        readBinary: async () => {
          if (++reads === 2) {
            await Promise.resolve();
            if (change === "renamed") file.path = "renamed.md";
            else current = change === "deleted" ? null : { path: "note.md", extension: "md" };
          }
          return new TextEncoder().encode("# Same contents\n").buffer;
        },
      },
    };
    await expect(new VaultReadSnapshot(app as never).run(
      file as never, new AbortController().signal, snapshot => snapshot.publish(publish),
    )).rejects.toMatchObject({ code: "vault_target_changed" });
    expect(publish).not.toHaveBeenCalled();
    expect(reads).toBe(2);
  });

  it("rejects a renamed source that is still open in the original editor", async () => {
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const file = { path: "note.md", extension: "md" };
    const editor = { getValue: () => "# Unchanged\\n" };
    const app = {
      workspace: { getLeavesOfType: () => [{ view: { file, editor } }] },
      vault: { getFileByPath: (path: string) => path === file.path ? file : null },
    };
    const publish = vi.fn();
    await expect(new VaultReadSnapshot(app as never).run(
      file as never, new AbortController().signal, async snapshot => {
        file.path = "renamed.md";
        return snapshot.publish(publish);
      },
    )).rejects.toMatchObject({ code: "vault_target_changed" });
    expect(publish).not.toHaveBeenCalled();
  });

  it("copies an unsaved editor buffer from a background Markdown split", async () => {
    const { VaultReadSnapshot } = await import("../src/host/vault-read-snapshot");
    const file = { path: "note.md", extension: "md" };
    const editor = { getValue: vi.fn(() => "# Unsaved\n") };
    const view = { file, editor };
    const leaf = { view };
    const app = {
      workspace: { getLeavesOfType: vi.fn(() => [leaf]) },
      vault: { getFileByPath: (filePath: string) => filePath === file.path ? file : null, readBinary: vi.fn() },
    };

    const content = await new VaultReadSnapshot(app as never).run(
      file as never,
      new AbortController().signal,
      async ({ inputPath }) => readFile(inputPath, "utf8"),
    );

    expect(content.value).toBe("# Unsaved\n");
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
      vault: { getFileByPath: (filePath: string) => filePath === file.path ? file : null, readBinary: vi.fn() },
    };

    await expect(new VaultReadSnapshot(app as never).run(
      file as never,
      new AbortController().signal,
      async (snapshot) => { await snapshot.getDeclaredMarkdownInputs(); },
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
      vault: { getFileByPath: (filePath: string) => filePath === file.path ? file : null, readBinary },
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

  it("deduplicates Obsidian-resolved cross-folder images without reading a physical decoy", async () => {
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
      vault: { getFileByPath: (filePath: string) => filePath === file.path ? file : null, readBinary },
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

    const { value: captured } = await new VaultReadSnapshot(app as never).run(
      file as never,
      new AbortController().signal,
      async (snapshot) => {
        const declared = await snapshot.getDeclaredMarkdownInputs();
        return {
          declared,
          sourceBytes: await readFile(declared!.inputs[0].path, "utf8"),
          imageBytes: await readFile(declared!.inputs[1].path),
        };
      },
    );

    expect(captured.declared?.inputs).toMatchObject([
      { kind: "document", role: "source", logicalPath: "notes/note.md", mediaType: "text/markdown" },
      { kind: "resource", role: "linked_resource", logicalPath: "assets/actual.png", mediaType: "image/png" },
    ]);
    expect(captured.declared?.inputs).toHaveLength(2);
    expect(captured.sourceBytes).toBe(source);
    expect([...captured.imageBytes]).toEqual([1, 2, 3]);
    expect(captured.declared?.resourceBindings).toEqual({
      authored_sha256: createHash("sha256").update(source).digest("hex"),
      images: [
        { authored_token: firstToken, logical_path: "assets/actual.png" },
        { authored_token: secondToken, logical_path: "assets/actual.png" },
      ],
    });
    expect(readBinary.mock.calls.filter(([target]) => target === actual)).toHaveLength(1);
    expect(readBinary).toHaveBeenCalledWith(actual);
    expect(app.metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith("actual.png", "notes/note.md");
  });

});

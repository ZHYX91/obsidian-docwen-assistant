import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ExportActions } from "../src/actions/export-actions";
import { DocWenCapabilityService, DocWenClient, DocWenMachineClient } from "../src/docwen";
import { DEFAULT_SETTINGS } from "../src/settings-model";
import { loadPackageAcceptanceReceipt } from "../scripts/run-docwen-package-acceptance.mjs";

const ui = vi.hoisted(() => ({
  sourcePath: "", outputDirectory: "", confirm: vi.fn(), review: vi.fn(), completed: vi.fn(),
}));
vi.mock("obsidian", () => ({
  TFile: class TFile {}, MarkdownView: class MarkdownView {}, Modal: class Modal {},
  SuggestModal: class SuggestModal {}, getLanguage: () => "en",
}));
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, writeFile: vi.fn(actual.writeFile) };
});
vi.mock("../src/host/notices", () => ({ showNotice: vi.fn() }));
vi.mock("../src/host/confirm", () => ({ confirmDetectedFormat: ui.confirm }));
vi.mock("../src/host/export-review", () => ({ confirmExport: ui.review }));
vi.mock("../src/host/vault-files", () => ({ resolveAbsoluteFilePath: () => ui.sourcePath }));
vi.mock("../src/host/electron-dialogs", () => ({
  getElectronOpenDialog: () => ({ showOpenDialog: async () => ({ canceled: false, filePaths: [ui.outputDirectory] }) }),
}));
vi.mock("../src/utils/suggest-modal", () => ({ pickItem: async () => ({ id: "__none__" }) }));

const packageBinding = await loadPackageAcceptanceReceipt(process.env);
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const fixturePath = new URL("../acceptance/fixtures/Formats/01-docx.docx", import.meta.url);

describe.skipIf(packageBinding === null)("fixed-package detected-format export action", () => {
  let root: string;
  let client: DocWenClient;
  let original: Buffer;
  let counter = 0;

  beforeAll(async () => {
    if (packageBinding === null) throw new Error("Packaged acceptance requires a wrapper-bound receipt.");
    root = await mkdtemp(join(tmpdir(), "docwen-assistant-detected-package-"));
    original = await readFile(fixturePath);
    expect(digest(original)).toBe("dcd26f085a7a833a09ded3b95c33d3187cc8202aeb668dd2510ceb747212fd05");
    client = new DocWenClient(new DocWenMachineClient(
      () => packageBinding.binaryPath, () => "en_US", packageBinding.productVersion,
    ));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    ui.confirm.mockResolvedValue(true);
    ui.review.mockResolvedValue(true);
  });

  afterAll(async () => {
    client?.dispose();
    if (root) await rm(root, { recursive: true, force: true });
  });

  it.each(["continue", "cancel", "changed-at-confirmation", "changed-at-review", "replaced-at-review"])(
    "executes the real action/client/Core path for %s",
    async (scenario) => {
      const caseRoot = join(root, `case-${counter++}`);
      await mkdir(caseRoot);
      ui.sourcePath = join(caseRoot, "Detected-format.txt");
      ui.outputDirectory = join(caseRoot, "published");
      await mkdir(ui.outputDirectory);
      await writeFile(ui.sourcePath, original);
      const file = { path: "Detected-format.txt", name: "Detected-format.txt", extension: "txt" };
      let currentFile = file;
      const app = {
        workspace: { getLeavesOfType: () => [] },
        vault: {
          getFileByPath: (filePath: string) => filePath === file.path ? currentFile : null,
          readBinary: async () => Uint8Array.from(await readFile(ui.sourcePath)).buffer,
        },
      };
      const signal = new AbortController().signal;
      const runner = {
        run: async (_key: unknown, _notice: string, action: (lease: unknown) => Promise<void>) =>
          action({ signal, isCurrent: () => true }),
        presentWarnings: vi.fn(), presentCompletion: ui.completed,
      };
      const inspected = vi.spyOn(client, "inspect");
      const converted = vi.spyOn(client, "convert");
      const actions = new ExportActions(
        app as never, client, new DocWenCapabilityService(client),
        () => ({ ...DEFAULT_SETTINGS, proofreadOnConvert: false }), runner as never,
      );
      ui.confirm.mockImplementation(async () => {
        const captured = inspected.mock.calls.at(-1)![0];
        expect(typeof captured).toBe("object");
        expect(await readdir(dirname((captured as { path: string }).path))).toEqual(["source.txt"]);
        if (scenario === "changed-at-confirmation") await writeFile(ui.sourcePath, "User changed the source");
        return scenario !== "cancel";
      });
      ui.review.mockImplementation(async (appArg: unknown, rows: Array<{ value: string }>) => {
        expect(appArg).toBe(app);
        expect(rows[0].value).toBe(file.path);
        if (scenario === "changed-at-review") await writeFile(ui.sourcePath, "User changed the source");
        if (scenario === "replaced-at-review") currentFile = { ...file };
        return true;
      });
      try {
        if (scenario.startsWith("changed-") || scenario === "replaced-at-review") {
          await expect(actions.toMarkdown(file as never)).rejects.toMatchObject({
            code: scenario === "replaced-at-review" ? "vault_target_changed" : "vault_content_conflict",
          });
        } else {
          await actions.toMarkdown(file as never);
        }

        const acceptedWrites = vi.mocked(writeFile).mock.calls.filter(([target]) => String(target).includes("accepted-source."));
        if (scenario === "cancel" || scenario === "changed-at-confirmation") {
          expect(acceptedWrites).toHaveLength(0);
          expect(converted).not.toHaveBeenCalled();
          expect(ui.review).not.toHaveBeenCalled();
        } else {
          expect(acceptedWrites).toHaveLength(1);
          expect(inspected.mock.results[2].type).toBe("return");
          await expect(inspected.mock.results[2].value).resolves.toMatchObject({
            decision: "allow", detectedFormat: "docx", contentSha256: digest(original),
          });
          expect(converted).toHaveBeenCalledOnce();
          const request = converted.mock.calls[0][0];
          expect(request.sourceInput?.path).toMatch(/accepted-source\.docx$/u);
          expect(request.sourceInput?.logicalPath).toBe(file.path);
          expect(request.inputs).toEqual([request.sourceInput]);
        }

        const directories = await readdir(ui.outputDirectory);
        if (scenario === "continue") {
          expect(directories).toHaveLength(1);
          const result = await converted.mock.results[0].value;
          const markdown = await readFile(result.output, "utf8");
          expect(markdown).toContain("A short document with readable text and a small table.");
          expect(markdown).toContain("| Example | 42 |");
          expect(digest(Buffer.from(markdown))).toBe("cad17cb7e82f5cb4b0f9e0df3a761def67e5121d1c4881d2e91d526b99f3fbba");
          expect(ui.completed).toHaveBeenCalledOnce();
        } else {
          expect(directories).toEqual([]);
          expect(ui.completed).not.toHaveBeenCalled();
        }
        if (!scenario.startsWith("changed-")) expect(await readFile(ui.sourcePath)).toEqual(original);
        expect(await readFile(fixturePath)).toEqual(original);
      } finally {
        inspected.mockRestore();
        converted.mockRestore();
      }
    }, 120_000,
  );
});

import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import * as path from "node:path";

const SIDECAR_SCHEMA = "docwen.round_trip_sidecar.v1" as const;
const SIDECAR_FILES = [
  "authored-source.md",
  "manifest.json",
  "neutral-document.json",
  "numbering-export-plan.json",
] as const;

export interface RoundTripSidecarInputs {
  readonly neutralDocumentPath: string;
  readonly numberingExportPlanPath: string;
  readonly authoredSourcePath: string;
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

async function assertOwnedSidecar(target: string): Promise<void> {
  const info = await lstat(target);
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error("The existing DocWen sidecar path is not an owned directory.");
  }
  const names = (await readdir(target)).sort();
  if (JSON.stringify(names) !== JSON.stringify([...SIDECAR_FILES].sort())) {
    throw new Error("The existing DocWen sidecar has an unexpected inventory.");
  }
  const manifest = JSON.parse(await readFile(path.join(target, "manifest.json"), "utf8")) as unknown;
  if (
    typeof manifest !== "object"
    || manifest == null
    || (manifest as { schema?: unknown }).schema !== SIDECAR_SCHEMA
  ) {
    throw new Error("The existing DocWen sidecar has an unsupported ownership manifest.");
  }
}

export async function assertRoundTripSidecarTargetAvailable(docxPath: string): Promise<void> {
  const target = `${path.resolve(docxPath)}.docwen`;
  try {
    await assertOwnedSidecar(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function publishRoundTripSidecar(
  docxPath: string,
  inputs: RoundTripSidecarInputs,
): Promise<string> {
  const resolvedDocx = path.resolve(docxPath);
  const docxInfo = await lstat(resolvedDocx);
  if (!docxInfo.isFile() || docxInfo.isSymbolicLink()) {
    throw new Error("The DocWen round-trip output is not a regular DOCX file.");
  }
  const target = `${resolvedDocx}.docwen`;
  const parent = path.dirname(target);
  const temporary = await mkdtemp(path.join(parent, `.${path.basename(target)}-`));
  let backup: string | null = null;
  try {
    const [docx, neutral, plan, authored] = await Promise.all([
      readFile(resolvedDocx),
      readFile(inputs.neutralDocumentPath),
      readFile(inputs.numberingExportPlanPath),
      readFile(inputs.authoredSourcePath),
    ]);
    const files = {
      "neutral-document.json": neutral,
      "numbering-export-plan.json": plan,
      "authored-source.md": authored,
    } as const;
    for (const [name, bytes] of Object.entries(files)) {
      await writeFile(path.join(temporary, name), bytes, { flag: "wx" });
    }
    const manifest = {
      schema: SIDECAR_SCHEMA,
      docx_sha256: sha256(docx),
      files: Object.fromEntries(
        Object.entries(files).map(([name, bytes]) => [name, {
          bytes: bytes.length,
          sha256: sha256(bytes),
        }]),
      ),
    };
    await writeFile(
      path.join(temporary, "manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
      { encoding: "utf8", flag: "wx" },
    );

    try {
      await lstat(target);
      await assertOwnedSidecar(target);
      backup = `${target}.backup-${randomUUID()}`;
      await rename(target, backup);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    try {
      await rename(temporary, target);
    } catch (error) {
      if (backup !== null) await rename(backup, target).catch(() => undefined);
      throw error;
    }
    if (backup !== null) {
      await rm(backup, { recursive: true, force: true });
      backup = null;
    }
    return target;
  } finally {
    await rm(temporary, { recursive: true, force: true }).catch(() => undefined);
  }
}

import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { bindAcceptedDetectedSource } from "../docwen/capability-service";
import type { FileInspection, RuntimeRoute, TaskInput } from "../docwen/client";
import { sourceFormatForExtension } from "../docwen/formats";
import { VaultWriteError } from "./vault-write-transaction";

export async function materializeDetectedSource(
  sourceInput: TaskInput, contentSha256: string, inspection: FileInspection, route: RuntimeRoute,
  inspect: (input: TaskInput) => Promise<FileInspection>, assertCurrent: () => void | Promise<void>,
): Promise<TaskInput> {
  const bound = bindAcceptedDetectedSource(sourceInput, contentSha256, inspection, route);
  const format = inspection.detectedFormat;
  const canonical = sourceFormatForExtension(format);
  if (
    !/^[a-z0-9]{1,16}$/u.test(format)
    || !canonical
    || canonical.mediaType !== inspection.mediaType
    || canonical.kind !== bound.kind
  ) {
    throw new VaultWriteError("vault_input_invalid", "The accepted format has no matching canonical snapshot extension.");
  }
  await assertCurrent();
  const acceptedPath = join(dirname(sourceInput.path), `accepted-source.${format}`);
  await copyFile(sourceInput.path, acceptedPath, constants.COPYFILE_EXCL);
  if (createHash("sha256").update(await readFile(acceptedPath)).digest("hex") !== contentSha256) {
    throw new VaultWriteError("vault_input_invalid", "The accepted snapshot bytes changed.");
  }
  const accepted = { ...bound, path: acceptedPath };
  const verified = await inspect(accepted);
  if (
    verified.decision !== "allow"
    || verified.filePath !== accepted.path
    || verified.contentSha256 !== contentSha256
    || verified.sizeBytes !== inspection.sizeBytes
    || verified.detectedFormat !== format
    || verified.mediaType !== bound.mediaType
  ) {
    throw new VaultWriteError("vault_input_invalid", "The canonical snapshot does not match the accepted inspection.");
  }
  await assertCurrent();
  return accepted;
}

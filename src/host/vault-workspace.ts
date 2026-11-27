import { mkdtemp, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Core reports canonical paths during inspection, even when TEMP is an alias. */
export async function createVaultWorkspace(kind: "snapshot" | "numbering"): Promise<string> {
  return mkdtemp(join(await realpath(tmpdir()), `docwen-assistant-${kind}-`));
}

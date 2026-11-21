import { createHash } from "node:crypto";

/** Identity for navigating line/column ranges. File inspection still authenticates the original bytes. */
export function proofreadSourceDigest(source: string | ArrayBuffer): string {
  const hash = createHash("sha256");
  if (typeof source === "string") return hash.update(source.replace(/\r\n?/gu, "\n"), "utf8").digest("hex");
  const bytes = Buffer.from(source);
  if (!bytes.includes(13)) return hash.update(bytes).digest("hex");
  // A one-to-one byte mapping preserves the BOM and malformed input that UTF-8 decoding would collapse.
  return hash.update(bytes.toString("latin1").replace(/\r\n?/gu, "\n"), "latin1").digest("hex");
}

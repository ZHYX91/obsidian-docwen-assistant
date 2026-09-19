/** Shareable facts only: never serialize arbitrary exception details or messages. */
export function diagnosticCode(value: unknown): string {
  return typeof value === "string" && /^[a-zA-Z][a-zA-Z0-9_.-]{0,95}$/u.test(value) ? value : "";
}

export function diagnosticDetails(value: unknown): Record<string, unknown> {
  const details: Record<string, unknown> = {};
  if (typeof value !== "object" || value === null) return details;
  const read = (key: string): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  };
  for (const key of ["actualProductVersion", "expectedProductVersion"]) {
    const version = read(key);
    if (typeof version === "string" && /^\d{1,8}(?:\.\d{1,8}){1,3}(?:[-+][a-zA-Z0-9.-]{1,32})?$/u.test(version)) {
      details[key] = version;
    }
  }
  for (const key of ["timeoutMs", "exitCode", "limitBytes", "maxBytes", "sizeBytes", "expectedSize", "actualSize"]) {
    const count = read(key);
    if (typeof count === "number" && Number.isSafeInteger(count)) details[key] = count;
  }
  const outputState = read("outputState");
  if (outputState === "published" || outputState === "not_published" || outputState === "unconfirmed") {
    details.outputState = outputState;
  }
  const mode = read("mode");
  if (mode === "automatic" || mode === "manual") details.mode = mode;
  const primaryCode = diagnosticCode(read("primaryCode"));
  if (primaryCode) details.primaryCode = primaryCode;
  return details;
}

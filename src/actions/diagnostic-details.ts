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
  for (const key of ["actualProductVersion", "expectedProductVersion", "minimumProductVersion"]) {
    const version = read(key);
    if (typeof version === "string" && /^\d{1,8}(?:\.\d{1,8}){1,3}(?:[-+][a-zA-Z0-9.-]{1,32})?$/u.test(version)) {
      details[key] = version;
    }
  }
  for (const key of ["timeoutMs", "exitCode", "limitBytes", "maxBytes", "sizeBytes", "expectedSize", "actualSize"]) {
    const count = read(key);
    if (typeof count === "number" && Number.isSafeInteger(count)) details[key] = count;
  }
  const incompatibility = read("incompatibility");
  if (read("phase") === "initialize") details.phase = "initialize";
  if (
    incompatibility === "machine_protocol"
    || incompatibility === "artifact_bundle"
    || incompatibility === "product_version"
    || incompatibility === "server_identity"
  ) {
    details.incompatibility = incompatibility;
  }
  for (const key of ["sentProtocol", "receivedProtocol", "supportedProtocol", "received_protocol", "supported_protocol"]) {
    const protocol = safeProtocolIdentity(read(key));
    if (protocol) details[key] = protocol;
  }
  for (const key of ["client", "server"]) {
    const identity = safeProductIdentity(read(key));
    if (identity) details[key] = identity;
  }
  for (const key of ["expectedArtifactBundleSchema", "actualArtifactBundleSchema"]) {
    const contract = read(key);
    if (typeof contract === "string" && /^[a-zA-Z0-9._-]{1,128}$/u.test(contract)) {
      details[key] = contract;
    }
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


function safeProtocolIdentity(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  const name = typeof item.name === "string" && /^[a-zA-Z0-9._-]{1,128}$/u.test(item.name)
    ? item.name
    : null;
  const major = Number.isSafeInteger(item.major) ? item.major : null;
  const minor = Number.isSafeInteger(item.minor) ? item.minor : null;
  if (name === null && major === null && minor === null) return null;
  return {
    ...(name !== null ? { name } : {}),
    ...(major !== null ? { major } : {}),
    ...(minor !== null ? { minor } : {}),
  };
}

function safeProductIdentity(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  const name = typeof item.name === "string" && /^[a-zA-Z0-9 ._-]{1,128}$/u.test(item.name)
    ? item.name
    : null;
  const version = typeof item.version === "string"
    && /^\d{1,8}(?:\.\d{1,8}){1,3}(?:[-+][a-zA-Z0-9.-]{1,32})?$/u.test(item.version)
    ? item.version
    : null;
  if (name === null && version === null) return null;
  return {
    ...(name !== null ? { name } : {}),
    ...(version !== null ? { version } : {}),
  };
}

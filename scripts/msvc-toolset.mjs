/** Discover either installation component; exact toolset selection remains separate. */
export function recordedMsvcComponents(record) {
  const family = recordedMsvcVersion(record).split(".").slice(0, 2).join(".");
  return ["Microsoft.VisualStudio.Component.VC.Tools.x86.x64", `Microsoft.VisualStudio.Component.VC.${family}.x86.x64`];
}

/** Servicing build identity; it is not necessarily the installation directory name. */
export function recordedMsvcVersion(record) {
  const version = /Version (\d+\.\d+\.\d+)\.\d+$/u.exec(record?.librarian ?? "")?.[1];
  if (!version) throw new Error("The recorded MSVC librarian identity has no exact toolset version.");
  return version;
}

/** All three binaries must match in one candidate; directory names confer no trust. */
export function selectRecordedToolset(candidates, record) {
  const selected = candidates.find((candidate) => ["compiler", "librarian", "linker"].every(
    (key) => typeof record[key] === "string" && candidate.identities?.[key] === record[key],
  ));
  if (!selected) throw new Error("No installed MSVC candidate matches all three recorded tool identities. Discovered: " + JSON.stringify(candidates));
  return { installation: selected.installation, version: selected.version };
}

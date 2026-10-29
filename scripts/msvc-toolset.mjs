/** Discover either installation component; exact toolset selection remains separate. */
export function recordedMsvcComponents(record) {
  const family = recordedMsvcVersion(record).split(".").slice(0, 2).join(".");
  return ["Microsoft.VisualStudio.Component.VC.Tools.x86.x64", `Microsoft.VisualStudio.Component.VC.${family}.x86.x64`];
}

/** Select the recorded toolset, never the newest directory on a rolling host. */
export function recordedMsvcVersion(record) {
  const version = /Version (\d+\.\d+\.\d+)\.\d+$/u.exec(record?.librarian ?? "")?.[1];
  if (!version) throw new Error("The recorded MSVC librarian identity has no exact toolset version.");
  return version;
}

export function selectRecordedToolset(installations, version) {
  const selected = installations.find((installation) => installation.versions.includes(version));
  if (!selected) throw new Error("Required recorded MSVC toolset " + version + " is not installed.");
  return { installation: selected.path, version };
}

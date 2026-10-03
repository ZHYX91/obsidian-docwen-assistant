import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = process.argv[2];
if (process.platform !== "win32" || process.arch !== "x64") {
  throw new Error("Windows x64 build host required for the pinned Windows owner build.");
}
if (!output || !isAbsolute(output) || !existsSync(output)) {
  throw new Error("An existing owned output directory is required.");
}

const source = join(repository, "native", "windows-job.c");
const definitions = join(repository, "native", "windows-job.def");
const object = join(output, "windows-job.obj");
const importLibrary = join(output, "kernel32.lib");
const binary = join(output, "windows-x64.exe");
for (const filename of [object, importLibrary, binary]) {
  if (existsSync(filename)) throw new Error("Native output already exists: " + filename);
}

const tools = resolveMsvcTools();
const compilerFlags = ["/nologo", "/std:c11", "/O1", "/GS-", "/Zl", "/W4", "/WX", "/c"];
const librarianFlags = ["/nologo", "/machine:x64"];
const linkerFlags = [
  "/nologo",
  "/entry:entry",
  "/subsystem:console",
  "/nodefaultlib",
  "/machine:x64",
  "/Brepro",
];

run(tools.compiler, [...compilerFlags, source, "/Fo" + object]);
run(tools.librarian, [
  ...librarianFlags,
  "/def:" + definitions,
  "/out:" + importLibrary,
]);
run(tools.linker, [...linkerFlags, object, importLibrary, "/out:" + binary]);

const bytes = readFileSync(binary);
const pe = bytes.readUInt32LE(0x3c);
if (
  bytes.readUInt32LE(pe) !== 0x00004550
  || bytes.readUInt16LE(pe + 4) !== 0x8664
  || bytes.readUInt16LE(pe + 24) !== 0x020b
) {
  throw new Error("Unexpected Windows owner PE identity.");
}
bytes.writeUInt32LE(0, pe + 8);
writeFileSync(binary, bytes);

const sha256 = (filename) => createHash("sha256").update(readFileSync(filename)).digest("hex");
const record = {
  sourceSha256: sha256(source),
  defSha256: sha256(definitions),
  binarySha256: sha256(binary),
  binaryBytes: bytes.length,
  platform: "win32",
  arch: "x64",
  minimumWindows: "10",
  peMachine: "0x8664",
  peMagic: "0x020b",
  subsystem: "windows-cui",
  timestamp: 0,
  compiler: toolIdentity(tools.compiler, /C\/C\+\+.*Compiler/iu),
  librarian: toolIdentity(tools.librarian, /Library Manager/iu),
  linker: toolIdentity(tools.linker, /Linker Version/iu),
  compilerTarget: "x64-msvc",
  compilerFlags,
  librarianFlags,
  linkerFlags,
  timestampNormalization: "COFF TimeDateStamp zeroed after deterministic MSVC link",
  provenance: {
    repository: "ZHYX91/docwen-openclaw",
    commit: "d7ad7294b9cadcfea0d430d0dc42ea0bdb48fc10",
    sourcePath: "native/windows-job.c",
    license: "MIT",
    adaptation: "Assistant target environment and reserved controller statuses distinct from target exits",
  },
};
writeFileSync(
  join(output, "WINDOWS-BUILD.json"),
  JSON.stringify(record, null, 2) + "\n",
  { flag: "wx" },
);
writeEmbeddedModule(bytes, record.binarySha256, join(output, "windows-machine-owner-x64.ts"));

function resolveMsvcTools() {
  const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const vswhere = join(programFilesX86, "Microsoft Visual Studio", "Installer", "vswhere.exe");
  const found = spawnSync(vswhere, [
    "-latest",
    "-products",
    "*",
    "-requires",
    "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
    "-property",
    "installationPath",
  ], {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 10_000,
  });
  if (found.error) throw found.error;
  const installation = found.stdout.trim();
  if (found.status !== 0 || !installation) {
    throw new Error("MSVC x64 build tools were not found.");
  }

  const versionsRoot = join(installation, "VC", "Tools", "MSVC");
  const versions = readdirSync(versionsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
  const version = versions.at(-1);
  if (!version) throw new Error("MSVC toolset directory is empty.");
  const bin = join(versionsRoot, version, "bin", "Hostx64", "x64");
  const compiler = join(bin, "cl.exe");
  const librarian = join(bin, "lib.exe");
  const linker = join(bin, "link.exe");
  for (const executable of [compiler, librarian, linker]) {
    if (!existsSync(executable)) throw new Error("Required MSVC tool is missing: " + executable);
  }
  return { compiler, librarian, linker };
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: output,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 60_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(command + " failed: " + result.stdout + "\n" + result.stderr);
  }
}

function toolIdentity(command, preferredLine) {
  const result = spawnSync(command, [], {
    env: { ...process.env, VSLANG: "1033" },
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 10_000,
  });
  if (result.error) throw result.error;
  const lines = (result.stdout + "\n" + result.stderr)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.find((line) => preferredLine.test(line)) ?? lines[0] ?? "";
}

function writeEmbeddedModule(binaryBytes, digest, filename) {
  const encoded = binaryBytes.toString("base64");
  const chunks = [];
  for (let index = 0; index < encoded.length; index += 120) {
    chunks.push(encoded.slice(index, index + 120));
  }
  const sourceText = [
    "/** Generated from the pinned Windows x64 Job Object controller recorded in native/WINDOWS-BUILD.json. */",
    'export const WINDOWS_X64_MACHINE_OWNER_SHA256 = "' + digest + '";',
    "export const WINDOWS_X64_MACHINE_OWNER_BYTES = " + binaryBytes.length + ";",
    "export const WINDOWS_X64_MACHINE_OWNER_BASE64 = [",
    ...chunks.map((chunk) => '  "' + chunk + '",'),
    '].join("");',
    "",
  ].join("\n");
  writeFileSync(filename, sourceText, { flag: "wx" });
}

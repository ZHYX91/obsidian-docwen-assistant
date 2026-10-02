import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = process.argv[2];
if (process.platform !== "linux" || process.arch !== "x64") {
  throw new Error("Linux x64 build host required for the pinned Windows owner build.");
}
if (!output || !isAbsolute(output) || !existsSync(output)) {
  throw new Error("An existing owned output directory is required.");
}
const source = join(repository, "native/windows-job.c");
const definitions = join(repository, "native/windows-job.def");
const object = join(output, "windows-job.obj");
const importLibrary = join(output, "kernel32.lib");
const binary = join(output, "windows-x64.exe");
for (const filename of [object, importLibrary, binary]) {
  if (existsSync(filename)) throw new Error("Native output already exists: " + filename);
}
const compiler = process.env.CLANG || "clang";
const linker = process.env.LLD_LINK || "lld-link";
const compilerFlags = [
  "--target=x86_64-pc-windows-msvc",
  "-std=c11",
  "-Oz",
  "-fno-stack-protector",
  "-fno-ident",
  "-Wall",
  "-Wextra",
  "-Werror",
];
run(compiler, [...compilerFlags, "-c", source, "-o", object]);
run(linker, ["/lib", "/def:" + definitions, "/machine:x64", "/out:" + importLibrary]);
const linkerFlags = ["/entry:entry", "/subsystem:console", "/nodefaultlib", "/machine:x64", "/Brepro"];
run(linker, [...linkerFlags, object, importLibrary, "/out:" + binary]);

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
const compilerVersion = firstLine(runCapture(compiler, ["--version"]));
const linkerVersion = firstLine(runCapture(linker, ["--version"]));
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
  compiler: compilerVersion,
  linker: linkerVersion,
  compilerTarget: "x86_64-pc-windows-msvc",
  compilerFlags: compilerFlags.slice(1),
  linkerFlags,
  timestampNormalization: "PE COFF TimeDateStamp zeroed after deterministic lld-link",
  provenance: {
    repository: "ZHYX91/docwen-openclaw",
    commit: "d7ad7294b9cadcfea0d430d0dc42ea0bdb48fc10",
    sourcePath: "native/windows-job.c",
    license: "MIT",
    adaptation: "Assistant target environment name plus distinct target-not-found exit status",
  },
};
writeFileSync(join(output, "WINDOWS-BUILD.json"), JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
writeEmbeddedModule(bytes, record.binarySha256, join(output, "windows-machine-owner-x64.ts"));

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: output,
    encoding: "utf8",
    shell: false,
    timeout: 60_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(command + " failed: " + result.stdout + "\n" + result.stderr);
}

function runCapture(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", shell: false, timeout: 10_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(command + " failed: " + result.stdout + "\n" + result.stderr);
  return (result.stdout + result.stderr).trim();
}

function firstLine(value) {
  return value.split(/\r?\n/u).find(Boolean) ?? "";
}

function writeEmbeddedModule(binaryBytes, digest, filename) {
  const encoded = binaryBytes.toString("base64");
  const chunks = [];
  for (let index = 0; index < encoded.length; index += 120) chunks.push(encoded.slice(index, index + 120));
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

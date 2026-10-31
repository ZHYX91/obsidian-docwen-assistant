import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, constants, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = process.argv[2];
const targets = {
  x64: { machine: 62, archive: "/usr/lib/x86_64-linux-musl/libc.a" },
  arm64: { machine: 183, archive: "/usr/lib/aarch64-linux-musl/libc.a" },
};
const target = targets[process.arch];
if (process.platform !== "linux" || !target) throw new Error("A native Linux x64 or arm64 build host is required.");
const binaryName = `linux-owner-${process.arch}`;
const moduleName = `linux-native-owner-${process.arch}.ts`;
if (!output || !isAbsolute(output) || !existsSync(output))
  throw new Error("An existing owned output directory is required.");
const binary = join(output, binaryName);
if (existsSync(binary)) throw new Error("Native output already exists.");
const source = join(repository, "native", "linux-owner.c");
const compiler = "musl-gcc";
const args = [
  "-static",
  "-std=c11",
  "-O2",
  "-Wall",
  "-Wextra",
  "-Werror",
  "-fno-ident",
  "-Wl,--build-id=none",
  source,
  "-o",
  binary,
];
const built = spawnSync(compiler, args, { stdio: "inherit", shell: false });
if (built.error) throw built.error;
if (built.status !== 0) throw new Error("Linux process owner build failed.");
const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const payload = readFileSync(binary);
if (payload.subarray(0, 6).toString("hex") !== "7f454c460201"
  || payload.readUInt16LE(18) !== target.machine) {
  throw new Error("Native ELF identity does not match the build host architecture.");
}
const programOffset = Number(payload.readBigUInt64LE(32));
const programSize = payload.readUInt16LE(54);
for (let index = 0; index < payload.readUInt16LE(56); index++) {
  const type = payload.readUInt32LE(programOffset + index * programSize);
  if (type === 2 || type === 3) throw new Error("Linux owner must have no dynamic section or interpreter.");
}
const libc = spawnSync("dpkg-query", ["-W", "-f=${Version}", "musl-dev"], { encoding: "utf8", shell: false });
if (libc.status !== 0) throw new Error("The recorded Ubuntu musl-dev build package is required.");
const linkage = { kind: "static-musl", packageVersion: libc.stdout.trim(),
  archiveSha256: sha256(target.archive),
  licenseSha256: sha256(join(repository, "native", "MUSL-LICENSE.txt")) };
writeFileSync(
  join(output, "LINUX-OWNER-BUILD.json"),
  `${JSON.stringify({ sourceSha256: sha256(source), binarySha256: sha256(binary), binaryBytes: payload.length, platform: "linux", arch: process.arch, linkage, provenance: JSON.parse(readFileSync(join(repository, "native", "LINUX-OWNER-BUILD.json"), "utf8")).provenance, compiler: spawnSync(compiler, ["--version"], { encoding: "utf8", shell: false }).stdout.trim(), args: args.map((value) => value === source ? "native/linux-owner.c" : value === binary ? `<output>/${binaryName}` : value) }, null, 2)}\n`,
  { flag: "wx" },
);
copyFileSync(source, join(output, "linux-owner.c"), constants.COPYFILE_EXCL);

const chunks = payload.toString("base64").match(/.{1,120}/gu);
const license = readFileSync(join(repository, "native", "MUSL-LICENSE.txt"), "utf8").replaceAll("*/", "* /");
writeFileSync(join(output, moduleName),
  "// Generated from native/linux-owner.c; rebuild with the recorded toolchain.\n"
  + "/*! musl libc third-party notices\n" + license + "*/\n"
  + `export const LINUX_MACHINE_OWNER_SHA256 = "${sha256(binary)}";\n`
  + "export const LINUX_MACHINE_OWNER_BASE64 = [\n"
  + chunks.map((chunk) => `  "${chunk}",`).join("\n") + "\n].join(\"\");\n");

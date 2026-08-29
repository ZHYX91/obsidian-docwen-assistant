import { spawnSync } from "node:child_process";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { constants as fsConstants, createReadStream } from "node:fs";
import { access, lstat, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const DOCWEN_VERSION_PATTERN = /^0\.9\.(?:0|[1-9]\d*)$/u;
const ACCEPTANCE_RECEIPT_SCHEMA = "docwen.assistant.package_acceptance.v1";
const ACCEPTANCE_RECEIPT_ENV = "DOCWEN_PACKAGE_ACCEPTANCE_RECEIPT";
const ACCEPTANCE_TOKEN_ENV = "DOCWEN_PACKAGE_ACCEPTANCE_TOKEN";
const RAW_ACCEPTANCE_ENVIRONMENT = Object.freeze([
  "DOCWEN_PACKAGE_ACCEPTANCE",
  "DOCWEN_TEST_BINARY",
  "DOCWEN_TEST_SHA256",
  "DOCWEN_TEST_SIZE_BYTES",
  "DOCWEN_TEST_VERSION",
  ACCEPTANCE_RECEIPT_ENV,
  ACCEPTANCE_TOKEN_ENV,
]);

export async function validateDocWenPackageCandidate(environment) {
  const candidate = requiredEnvironment(environment, "DOCWEN_TEST_BINARY");
  const expectedSha256 = requiredEnvironment(environment, "DOCWEN_TEST_SHA256");
  const expectedSizeSource = requiredEnvironment(environment, "DOCWEN_TEST_SIZE_BYTES");
  const expectedVersion = requiredEnvironment(environment, "DOCWEN_TEST_VERSION");

  if (!path.isAbsolute(candidate)) {
    throw new Error("DOCWEN_TEST_BINARY must be an absolute path.");
  }
  const expectedFilename = packagedCliFilename();
  if (path.basename(candidate) !== expectedFilename) {
    throw new Error(`DOCWEN_TEST_BINARY must name ${expectedFilename} exactly.`);
  }
  if (!SHA256_PATTERN.test(expectedSha256)) {
    throw new Error("DOCWEN_TEST_SHA256 must be exactly 64 lowercase hexadecimal characters.");
  }
  if (!/^(?:0|[1-9]\d*)$/u.test(expectedSizeSource)) {
    throw new Error("DOCWEN_TEST_SIZE_BYTES must be a canonical non-negative decimal integer.");
  }
  const expectedSize = Number(expectedSizeSource);
  if (!Number.isSafeInteger(expectedSize) || expectedSize === 0) {
    throw new Error("DOCWEN_TEST_SIZE_BYTES must be a positive safe integer.");
  }
  if (!DOCWEN_VERSION_PATTERN.test(expectedVersion)) {
    throw new Error("DOCWEN_TEST_VERSION must be an exact stable DocWen 0.9.x version.");
  }

  let candidateInfo;
  try {
    candidateInfo = await lstat(candidate);
  } catch (error) {
    throw new Error(`DOCWEN_TEST_BINARY cannot be inspected: ${errorMessage(error)}`);
  }
  if (candidateInfo.isSymbolicLink() || !candidateInfo.isFile()) {
    throw new Error("DOCWEN_TEST_BINARY must be a regular non-link file.");
  }
  const canonicalCandidate = await realpath(candidate);
  const canonicalInfo = await lstat(canonicalCandidate);
  if (canonicalInfo.isSymbolicLink() || !canonicalInfo.isFile()) {
    throw new Error("DOCWEN_TEST_BINARY must resolve to a regular non-link file.");
  }
  if (candidateInfo.size !== canonicalInfo.size || canonicalInfo.size !== expectedSize) {
    throw new Error(`DocWen candidate size mismatch: expected ${expectedSize}, got ${canonicalInfo.size}.`);
  }
  const actualSha256 = await sha256File(canonicalCandidate);
  if (actualSha256 !== expectedSha256) {
    throw new Error(`DocWen candidate SHA-256 mismatch: expected ${expectedSha256}, got ${actualSha256}.`);
  }
  if (process.platform === "linux") {
    try {
      await access(canonicalCandidate, fsConstants.X_OK);
    } catch {
      throw new Error("DOCWEN_TEST_BINARY must be executable on Linux.");
    }
  }

  return Object.freeze({
    binaryPath: canonicalCandidate,
    sizeBytes: canonicalInfo.size,
    sha256: actualSha256,
    productVersion: expectedVersion,
  });
}

function packagedCliFilename() {
  if (process.platform === "win32") return "DocWenCLI.exe";
  if (process.platform === "linux") return "DocWenCLI";
  throw new Error("Packaged DocWen release acceptance requires a recognized desktop host.");
}

export async function validateDocWenCandidateIdentity(expected) {
  if (!isPlainObject(expected) || !hasExactKeys(expected, [
    "binaryPath",
    "productVersion",
    "sha256",
    "sizeBytes",
  ])) {
    throw new Error("DocWen candidate identity is malformed.");
  }
  if (!Number.isSafeInteger(expected.sizeBytes) || expected.sizeBytes <= 0) {
    throw new Error("DocWen candidate identity size is invalid.");
  }
  return validateDocWenPackageCandidate({
    DOCWEN_TEST_BINARY: expected.binaryPath,
    DOCWEN_TEST_SHA256: expected.sha256,
    DOCWEN_TEST_SIZE_BYTES: String(expected.sizeBytes),
    DOCWEN_TEST_VERSION: expected.productVersion,
  });
}

export async function revalidateDocWenCandidateIdentity(expected) {
  const actual = await validateDocWenCandidateIdentity(expected);
  if (
    actual.binaryPath !== expected.binaryPath
    || actual.productVersion !== expected.productVersion
    || actual.sha256 !== expected.sha256
    || actual.sizeBytes !== expected.sizeBytes
  ) {
    throw new Error("DocWen candidate identity changed during packaged acceptance.");
  }
  return actual;
}

export async function createPackageAcceptanceReceipt(candidate) {
  const validated = await revalidateDocWenCandidateIdentity(candidate);
  const directory = await mkdtemp(path.join(tmpdir(), "docwen-assistant-package-receipt-"));
  const receiptPath = path.join(directory, "receipt.json");
  const token = randomBytes(32).toString("hex");
  const receipt = {
    schema: ACCEPTANCE_RECEIPT_SCHEMA,
    token_sha256: sha256(Buffer.from(token, "utf8")),
    candidate: {
      binary_path: validated.binaryPath,
      product_version: validated.productVersion,
      sha256: validated.sha256,
      size_bytes: validated.sizeBytes,
    },
  };
  receipt.binding_sha256 = acceptanceBindingSha256(token, receipt.candidate);
  try {
    await writeFile(receiptPath, `${JSON.stringify(receipt)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  return Object.freeze({ directory, receiptPath, token });
}

export async function loadPackageAcceptanceReceipt(environment) {
  const receiptPath = environment[ACCEPTANCE_RECEIPT_ENV];
  const token = environment[ACCEPTANCE_TOKEN_ENV];
  if (receiptPath === undefined && token === undefined) return null;
  if (typeof receiptPath !== "string" || receiptPath.length === 0 || !path.isAbsolute(receiptPath)) {
    throw new Error(`${ACCEPTANCE_RECEIPT_ENV} must be an absolute receipt path.`);
  }
  if (typeof token !== "string" || !SHA256_PATTERN.test(token)) {
    throw new Error(`${ACCEPTANCE_TOKEN_ENV} must be the wrapper's 256-bit token.`);
  }
  const receiptInfo = await lstat(receiptPath);
  if (receiptInfo.isSymbolicLink() || !receiptInfo.isFile() || receiptInfo.size <= 0 || receiptInfo.size > 8192) {
    throw new Error("Packaged acceptance receipt must be a small regular non-link file.");
  }
  const receiptBytes = await readFile(receiptPath);
  const receiptText = new TextDecoder("utf-8", { fatal: true }).decode(receiptBytes);
  if (receiptText.startsWith("\ufeff") || receiptText.includes("\r") || !receiptText.endsWith("\n")) {
    throw new Error("Packaged acceptance receipt must be canonical UTF-8 JSON.");
  }
  let receipt;
  try {
    receipt = JSON.parse(receiptText);
  } catch (error) {
    throw new Error(`Packaged acceptance receipt is invalid JSON: ${errorMessage(error)}`);
  }
  if (receiptText !== `${JSON.stringify(receipt)}\n`) {
    throw new Error("Packaged acceptance receipt must be canonical UTF-8 JSON.");
  }
  if (!isPlainObject(receipt) || !hasExactKeys(receipt, [
    "binding_sha256",
    "candidate",
    "schema",
    "token_sha256",
  ])) {
    throw new Error("Packaged acceptance receipt shape is invalid.");
  }
  if (
    receipt.schema !== ACCEPTANCE_RECEIPT_SCHEMA
    || !SHA256_PATTERN.test(receipt.token_sha256)
    || !SHA256_PATTERN.test(receipt.binding_sha256)
  ) {
    throw new Error("Packaged acceptance receipt identity is invalid.");
  }
  const expectedTokenHash = Buffer.from(receipt.token_sha256, "hex");
  const actualTokenHash = Buffer.from(sha256(Buffer.from(token, "utf8")), "hex");
  if (!timingSafeEqual(expectedTokenHash, actualTokenHash)) {
    throw new Error("Packaged acceptance receipt token does not match.");
  }
  if (!isPlainObject(receipt.candidate) || !hasExactKeys(receipt.candidate, [
    "binary_path",
    "product_version",
    "sha256",
    "size_bytes",
  ])) {
    throw new Error("Packaged acceptance receipt candidate is invalid.");
  }
  const expectedBinding = Buffer.from(receipt.binding_sha256, "hex");
  const actualBinding = Buffer.from(acceptanceBindingSha256(token, receipt.candidate), "hex");
  if (!timingSafeEqual(expectedBinding, actualBinding)) {
    throw new Error("Packaged acceptance receipt candidate binding does not match.");
  }
  return validateDocWenCandidateIdentity({
    binaryPath: receipt.candidate.binary_path,
    productVersion: receipt.candidate.product_version,
    sha256: receipt.candidate.sha256,
    sizeBytes: receipt.candidate.size_bytes,
  });
}

async function run() {
  const candidate = await validateDocWenPackageCandidate(process.env);
  process.stdout.write(
    `Pinned DocWen package input: ${candidate.binaryPath} (${candidate.sizeBytes} bytes, ${candidate.sha256}, ${candidate.productVersion}).\n`,
  );
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const vitestEntrypoint = path.join(repositoryRoot, "node_modules", "vitest", "vitest.mjs");
  const binding = await createPackageAcceptanceReceipt(candidate);
  try {
    const childEnvironment = Object.fromEntries(
      Object.entries(process.env).filter(([name]) => !RAW_ACCEPTANCE_ENVIRONMENT.some(
        (blocked) => blocked.toLowerCase() === name.toLowerCase(),
      )),
    );
    childEnvironment[ACCEPTANCE_RECEIPT_ENV] = binding.receiptPath;
    childEnvironment[ACCEPTANCE_TOKEN_ENV] = binding.token;
    const result = spawnSync(
      process.execPath,
      [vitestEntrypoint, "run", "tests/docwen-machine-integration.test.ts"],
      {
        cwd: repositoryRoot,
        env: childEnvironment,
        shell: false,
        stdio: "inherit",
      },
    );
    const postflightCandidate = await revalidateDocWenCandidateIdentity(candidate);
    const postflightReceipt = await loadPackageAcceptanceReceipt(childEnvironment);
    if (postflightReceipt === null) throw new Error("Packaged acceptance receipt disappeared after execution.");
    if (!sameCandidateIdentity(postflightCandidate, postflightReceipt)) {
      throw new Error("Packaged acceptance receipt changed candidate identity during execution.");
    }
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`Packaged DocWen acceptance failed with exit code ${String(result.status)}.`);
    }
    process.stdout.write("Packaged DocWen candidate identity remained exact after acceptance.\n");
  } finally {
    await rm(binding.directory, { recursive: true, force: true });
  }
}

function requiredEnvironment(environment, name) {
  const value = environment[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} is required for packaged DocWen acceptance.`);
  }
  return value;
}

async function sha256File(filename) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest("hex");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function acceptanceBindingSha256(token, candidate) {
  const canonicalCandidate = JSON.stringify({
    binary_path: candidate.binary_path,
    product_version: candidate.product_version,
    sha256: candidate.sha256,
    size_bytes: candidate.size_bytes,
  });
  return createHmac("sha256", Buffer.from(token, "hex")).update(canonicalCandidate, "utf8").digest("hex");
}

function hasExactKeys(value, expected) {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
}

function sameCandidateIdentity(left, right) {
  return left.binaryPath === right.binaryPath
    && left.productVersion === right.productVersion
    && left.sha256 === right.sha256
    && left.sizeBytes === right.sizeBytes;
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    process.stderr.write(`Packaged DocWen acceptance refused: ${errorMessage(error)}\n`);
    process.exitCode = 1;
  });
}

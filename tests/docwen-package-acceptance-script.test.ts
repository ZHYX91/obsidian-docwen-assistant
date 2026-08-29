import { createHash } from "node:crypto";
import { chmod, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

// The production gate is a directly executable Node.js module; Vitest exercises
// its exported fail-closed validator without adding a second implementation.
// @ts-expect-error The repository intentionally keeps production scripts as native ESM.
import {
  createPackageAcceptanceReceipt,
  loadPackageAcceptanceReceipt,
  revalidateDocWenCandidateIdentity,
  validateDocWenPackageCandidate,
} from "../scripts/run-docwen-package-acceptance.mjs";

const temporaryRoots: string[] = [];

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function fixture(): Promise<{ environment: Record<string, string>; binary: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "assistant-package-gate-"));
  temporaryRoots.push(root);
  const binary = path.join(root, process.platform === "linux" ? "DocWenCLI" : "DocWenCLI.exe");
  const bytes = Buffer.from("fixed packaged candidate", "utf8");
  await writeFile(binary, bytes, { mode: 0o755 });
  return {
    binary,
    environment: {
      DOCWEN_TEST_BINARY: binary,
      DOCWEN_TEST_SHA256: createHash("sha256").update(bytes).digest("hex"),
      DOCWEN_TEST_SIZE_BYTES: String(bytes.length),
      DOCWEN_TEST_VERSION: "0.9.0",
    },
  };
}

describe("packaged DocWen acceptance input gate", () => {
  it("requires an explicit candidate, SHA-256, byte length, and product version", async () => {
    for (const name of [
      "DOCWEN_TEST_BINARY",
      "DOCWEN_TEST_SHA256",
      "DOCWEN_TEST_SIZE_BYTES",
      "DOCWEN_TEST_VERSION",
    ]) {
      const { environment } = await fixture();
      delete environment[name];
      await expect(validateDocWenPackageCandidate(environment)).rejects.toThrow(`${name} is required`);
    }
  });

  it("rejects relative, missing, non-file, and wrongly named paths", async () => {
    const { environment, binary } = await fixture();
    const expectedFilename = path.basename(binary);

    await expect(validateDocWenPackageCandidate({
      ...environment,
      DOCWEN_TEST_BINARY: expectedFilename,
    })).rejects.toThrow("must be an absolute path");
    await expect(validateDocWenPackageCandidate({
      ...environment,
      DOCWEN_TEST_BINARY: path.join(path.dirname(binary), "missing", expectedFilename),
    })).rejects.toThrow("cannot be inspected");

    const directoryCandidate = path.join(path.dirname(binary), "directory", expectedFilename);
    await mkdir(directoryCandidate, { recursive: true });
    await expect(validateDocWenPackageCandidate({
      ...environment,
      DOCWEN_TEST_BINARY: directoryCandidate,
    })).rejects.toThrow("regular non-link file");
    await expect(validateDocWenPackageCandidate({
      ...environment,
      DOCWEN_TEST_BINARY: path.join(path.dirname(binary), "docwencli.exe"),
    })).rejects.toThrow(`must name ${expectedFilename} exactly`);
  });

  it.runIf(process.platform === "linux")("rejects a Linux candidate without execute permission", async () => {
    const { environment, binary } = await fixture();
    await chmod(binary, 0o644);

    await expect(validateDocWenPackageCandidate(environment)).rejects.toThrow("must be executable on Linux");
  });

  it("rejects a mismatched size or SHA-256", async () => {
    const { environment } = await fixture();
    await expect(validateDocWenPackageCandidate({
      ...environment,
      DOCWEN_TEST_SIZE_BYTES: String(Number(environment.DOCWEN_TEST_SIZE_BYTES) + 1),
    })).rejects.toThrow("candidate size mismatch");
    await expect(validateDocWenPackageCandidate({
      ...environment,
      DOCWEN_TEST_SHA256: "0".repeat(64),
    })).rejects.toThrow("candidate SHA-256 mismatch");
  });

  it("rejects any version expectation outside exact stable DocWen 0.9.x", async () => {
    const { environment } = await fixture();
    await expect(validateDocWenPackageCandidate({
      ...environment,
      DOCWEN_TEST_VERSION: "0.10.0",
    })).rejects.toThrow("exact stable DocWen 0.9.x version");
    await expect(validateDocWenPackageCandidate({
      ...environment,
      DOCWEN_TEST_VERSION: "0.9.x",
    })).rejects.toThrow("exact stable DocWen 0.9.x version");
    await expect(validateDocWenPackageCandidate({
      ...environment,
      DOCWEN_TEST_VERSION: "0.9.0-rc.1",
    })).rejects.toThrow("exact stable DocWen 0.9.x version");
  });

  it("accepts only a regular file and rejects a symlink when the host supports creating one", async () => {
    const { environment, binary } = await fixture();
    await expect(validateDocWenPackageCandidate(environment)).resolves.toMatchObject({
      sizeBytes: Number(environment.DOCWEN_TEST_SIZE_BYTES),
      sha256: environment.DOCWEN_TEST_SHA256,
      productVersion: "0.9.0",
    });

    const linkRoot = await mkdtemp(path.join(tmpdir(), "assistant-package-link-"));
    temporaryRoots.push(linkRoot);
    const linkedCandidate = path.join(linkRoot, path.basename(binary));
    try {
      await symlink(binary, linkedCandidate, "file");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }
    await expect(validateDocWenPackageCandidate({
      ...environment,
      DOCWEN_TEST_BINARY: linkedCandidate,
    })).rejects.toThrow("regular non-link file");
  });

  it("requires a wrapper receipt and token instead of the obsolete bare switch", async () => {
    await expect(loadPackageAcceptanceReceipt({
      DOCWEN_PACKAGE_ACCEPTANCE: "1",
      DOCWEN_TEST_BINARY: "C:\\unbound\\DocWenCLI.exe",
      DOCWEN_TEST_VERSION: "0.9.0",
    })).resolves.toBeNull();

    const { environment } = await fixture();
    const candidate = await validateDocWenPackageCandidate(environment);
    const binding = await createPackageAcceptanceReceipt(candidate);
    temporaryRoots.push(binding.directory);
    await expect(loadPackageAcceptanceReceipt({
      DOCWEN_PACKAGE_ACCEPTANCE_RECEIPT: binding.receiptPath,
      DOCWEN_PACKAGE_ACCEPTANCE_TOKEN: binding.token,
    })).resolves.toEqual(candidate);
    await expect(loadPackageAcceptanceReceipt({
      DOCWEN_PACKAGE_ACCEPTANCE_RECEIPT: binding.receiptPath,
      DOCWEN_PACKAGE_ACCEPTANCE_TOKEN: "0".repeat(64),
    })).rejects.toThrow("receipt token does not match");
    await expect(loadPackageAcceptanceReceipt({
      DOCWEN_PACKAGE_ACCEPTANCE_RECEIPT: binding.receiptPath,
    })).rejects.toThrow("256-bit token");

    const canonicalReceipt = await readFile(binding.receiptPath, "utf8");
    await writeFile(binding.receiptPath, `${canonicalReceipt}\n`, "utf8");
    await expect(loadPackageAcceptanceReceipt({
      DOCWEN_PACKAGE_ACCEPTANCE_RECEIPT: binding.receiptPath,
      DOCWEN_PACKAGE_ACCEPTANCE_TOKEN: binding.token,
    })).rejects.toThrow("canonical UTF-8 JSON");

    const receipt = JSON.parse(canonicalReceipt) as {
      candidate: { product_version: string };
    };
    receipt.candidate.product_version = "0.9.1";
    await writeFile(binding.receiptPath, `${JSON.stringify(receipt)}\n`, "utf8");
    await expect(loadPackageAcceptanceReceipt({
      DOCWEN_PACKAGE_ACCEPTANCE_RECEIPT: binding.receiptPath,
      DOCWEN_PACKAGE_ACCEPTANCE_TOKEN: binding.token,
    })).rejects.toThrow("candidate binding does not match");
  });

  it("fails postflight when candidate bytes change after the receipt is created", async () => {
    const { binary, environment } = await fixture();
    const candidate = await validateDocWenPackageCandidate(environment);
    const binding = await createPackageAcceptanceReceipt(candidate);
    temporaryRoots.push(binding.directory);
    await writeFile(binary, Buffer.alloc(candidate.sizeBytes, 0x78));

    await expect(revalidateDocWenCandidateIdentity(candidate)).rejects.toThrow("SHA-256 mismatch");
    await expect(loadPackageAcceptanceReceipt({
      DOCWEN_PACKAGE_ACCEPTANCE_RECEIPT: binding.receiptPath,
      DOCWEN_PACKAGE_ACCEPTANCE_TOKEN: binding.token,
    })).rejects.toThrow("SHA-256 mismatch");
  });
});

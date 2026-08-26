import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createDeterministicZip, readDeterministicZip } from "../scripts/deterministic-zip.mjs";
import {
  selectPublicDocWenRelease,
  selectReleaseNotesBaseline,
} from "../scripts/github-release-contract.mjs";
import {
  MAIN_BUNDLE_BUDGET_BYTES,
  PUBLICATION_HANDOFF_NAME,
  publicReleaseAssetNames,
  releaseAssetNames,
} from "../scripts/release-assets.mjs";
import {
  packagePublicationHandoff,
  verifyPublicationHandoff,
} from "../scripts/package-publication-handoff.mjs";
import { verifyReproducibleRelease } from "../scripts/verify-reproducible-release.mjs";
import { verifyReleaseDirectory } from "../scripts/verify-release-assets.mjs";
import { verifyExistingReleaseAttestations } from "../scripts/verify-release-attestations.mjs";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })));
});

describe("release governance", () => {
  it("creates a byte-identical sorted ZIP from the same production assets", () => {
    const entries = [
      { name: "docwen-assistant/styles.css", data: Buffer.from("css") },
      { name: "docwen-assistant/main.js", data: Buffer.from("js") },
      { name: "docwen-assistant/manifest.json", data: Buffer.from("{}") },
    ];
    const first = createDeterministicZip(entries);
    const second = createDeterministicZip([...entries].reverse());
    expect(first.equals(second)).toBe(true);
    expect(readStoredZipNames(first)).toEqual([
      "docwen-assistant/main.js",
      "docwen-assistant/manifest.json",
      "docwen-assistant/styles.css",
    ]);
    expect(readDeterministicZip(first).map(({ mode, name }) => ({ mode, name }))).toEqual([
      { mode: 0o100644, name: "docwen-assistant/main.js" },
      { mode: 0o100644, name: "docwen-assistant/manifest.json" },
      { mode: 0o100644, name: "docwen-assistant/styles.css" },
    ]);
  });

  it("binds two byte-identical clean outputs into one deterministic publication handoff", async () => {
    const first = await mkdtemp(join(tmpdir(), "docwen-release-first-"));
    const second = await mkdtemp(join(tmpdir(), "docwen-release-second-"));
    const publication = await mkdtemp(join(tmpdir(), "docwen-release-publication-"));
    temporaryDirectories.push(first, second, publication);
    await Promise.all([writeReleaseFixture(first), writeReleaseFixture(second)]);

    const records = await verifyReproducibleRelease(first, second, "2.0.0");
    expect(records).toHaveLength(5);
    const outputPath = join(publication, PUBLICATION_HANDOFF_NAME);
    const packaged = await packagePublicationHandoff({
      metadata: {
        repository: "ZHYX91/obsidian-docwen-assistant",
        sourceCommit: "a".repeat(40),
        sourceRef: "refs/tags/2.0.0",
        defaultBranch: "main",
        runId: "123",
        runAttempt: "2",
        version: "2.0.0",
        previousReleaseTag: "v1.2.0",
        publicationArtifactName: "docwen-assistant-publication-123-2",
        docwenCore: {
          tag: "0.9.0",
          version: "0.9.0",
          assetDigest: `sha256:${"b".repeat(64)}`,
        },
      },
      outputPath,
      releaseDirectory: first,
    });

    const verified = verifyPublicationHandoff(await readFile(outputPath), packaged.document);
    expect(verified.document.runId).toBe("123");
    expect(verified.document.runAttempt).toBe("2");
    expect(verified.document.previousReleaseTag).toBe("v1.2.0");
    expect(verified.document.mainBundleBudgetBytes).toBe(MAIN_BUNDLE_BUDGET_BYTES);
    expect(verified.entries.map(({ name }) => name)).toEqual([
      "handoff.json",
      "release/docwen-assistant-2.0.0.zip",
      "release/main.js",
      "release/manifest.json",
      "release/SHA256SUMS",
      "release/styles.css",
    ]);
  });

  it("fails closed on unsafe ZIP paths and mutated deterministic metadata", () => {
    expect(() => createDeterministicZip([{ name: "../escape", data: Buffer.from("x") }]))
      .toThrow("Unsafe ZIP entry name");
    expect(() => createDeterministicZip([
      { name: "same", data: Buffer.from("a") },
      { name: "same", data: Buffer.from("b") },
    ])).toThrow("must be unique");

    const mutated = Buffer.from(createDeterministicZip([{ name: "safe", data: Buffer.from("x") }]));
    const centralOffset = mutated.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    expect(centralOffset).toBeGreaterThan(0);
    mutated.writeUInt32LE(0, centralOffset + 38);
    expect(() => readDeterministicZip(mutated)).toThrow("central metadata is not deterministic");
  });

  it("fails closed on extra release assets and checksum drift", async () => {
    const releaseDirectory = await mkdtemp(join(tmpdir(), "docwen-release-fail-closed-"));
    temporaryDirectories.push(releaseDirectory);
    await writeReleaseFixture(releaseDirectory);
    await expect(verifyReleaseDirectory(releaseDirectory, "2.0.0")).resolves.toHaveLength(5);

    const extraPath = join(releaseDirectory, "unexpected.txt");
    await writeFile(extraPath, "unexpected", "utf8");
    await expect(verifyReleaseDirectory(releaseDirectory, "2.0.0"))
      .rejects.toThrow("Release asset set mismatch");
    await rm(extraPath);

    await writeFile(join(releaseDirectory, "SHA256SUMS"), `${"0".repeat(64)}  main.js\n`, "utf8");
    await expect(verifyReleaseDirectory(releaseDirectory, "2.0.0"))
      .rejects.toThrow("SHA256SUMS does not exactly match");
  });

  it("keeps a five-file handoff contract and a four-file public contract", () => {
    expect(releaseAssetNames("2.0.0")).toEqual([
      "SHA256SUMS",
      "docwen-assistant-2.0.0.zip",
      "main.js",
      "manifest.json",
      "styles.css",
    ]);
    expect(publicReleaseAssetNames("2.0.0")).toEqual([
      "docwen-assistant-2.0.0.zip",
      "main.js",
      "manifest.json",
      "styles.css",
    ]);
    expect(() => releaseAssetNames("02.0.0")).toThrow("must use x.y.z");
    const packager = readFileSync("scripts/package-release.mjs", "utf8");
    const verifier = readFileSync("scripts/verify-release-state.mjs", "utf8");
    expect(packager).toContain("releaseAssetNames(manifest.version)");
    expect(verifier).toContain("releaseAssetNames(tag)");
  });

  it("pins Actions, Node, and npm and forbids mutable release replacement", () => {
    const releaseWorkflow = readFileSync(".github/workflows/release.yml", "utf8");
    const ciWorkflow = readFileSync(".github/workflows/ci.yml", "utf8");
    const workflows = `${releaseWorkflow}\n${ciWorkflow}`;
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const actionRefs = [...workflows.matchAll(/uses:\s+actions\/[^@\s]+@([^\s#]+)/gu)]
      .map((match) => match[1]);
    const nodeVersionFiles = [...workflows.matchAll(/node-version-file:\s+([^\s]+)/gu)]
      .map((match) => match[1]);
    expect(actionRefs.length).toBeGreaterThan(0);
    expect(actionRefs.every((reference) => /^[0-9a-f]{40}$/u.test(reference))).toBe(true);
    expect(nodeVersionFiles).toEqual([".node-version", ".node-version", ".node-version"]);
    expect(releaseWorkflow).not.toContain(packageJson.packageManager);
    expect(workflows.match(/runs-on: ubuntu-24\.04/gu)).toHaveLength(4);
    expect(packageJson.engines.node).toBe("24.19.0");
    expect(packageJson.packageManager).toBe("npm@11.17.0");
    expect(packageJson.scripts.check).toContain("npm run check:runtime");
    expect(packageJson.scripts.check).toContain("npm run format:check");
    expect(packageJson.scripts.check).toContain("npm run check:readme-i18n");
    expect(packageJson.scripts.check).toContain("npm run check:docs-i18n");
    expect(packageJson.scripts.check).toContain("npm run test:coverage");
    expect(packageJson.scripts.check).toContain("npm run audit:all");
    expect(packageJson.scripts["audit:all"]).toBe("node scripts/check-dependencies.mjs");
    expect(packageJson.scripts["release:check"]).toContain("npm run check");
    expect(packageJson.scripts.check).not.toContain("github-release-contract");
    expect(releaseWorkflow).not.toContain("--clobber");
    expect(releaseWorkflow).not.toContain("gh release upload");
    expect(releaseWorkflow).not.toContain("gh release edit");
    expect(releaseWorkflow).not.toContain("--draft");
  });

  it("bootstraps npm only from a strictly validated packageManager value", async () => {
    const workflow = readFileSync(".github/workflows/release.yml", "utf8");
    const bootstrap = workflow.match(/node --input-type=module <<'NODE'\r?\n([\s\S]*?)\r?\n\s+NODE/u)?.[1];
    expect(bootstrap).toBeDefined();

    const validDirectory = await npmBootstrapFixture({ packageManager: "npm@1.2.3" });
    expect(runNpmBootstrap(bootstrap!, validDirectory)).toMatchObject({
      status: 0,
      stdout: "npm@1.2.3",
    });

    for (const packageManager of [
      undefined,
      null,
      "",
      "pnpm@1.2.3",
      "npm@^1.2.3",
      "npm@latest",
      "npm@1.2",
    ]) {
      const directory = await npmBootstrapFixture(
        packageManager === undefined ? {} : { packageManager },
      );
      expect(runNpmBootstrap(bootstrap!, directory).status).not.toBe(0);
    }

    expect(workflow).toContain('readFileSync("package.json", "utf8")');
    expect(workflow).not.toContain("npm@11.17.0");
    const packageManager = JSON.parse(readFileSync("package.json", "utf8")).packageManager as string;
    const duplicateSources = [
      "README.md",
      ...filesUnder(".github/workflows"),
      ...filesUnder("scripts"),
      ...filesUnder("docs"),
    ].filter((path) => readFileSync(path, "utf8").includes(packageManager));
    expect(duplicateSources).toEqual([]);
  });

  it("keeps build execution read-only and grants writes only to a fixed no-checkout boundary", () => {
    const workflow = readFileSync(".github/workflows/release.yml", "utf8");
    const buildJob = workflow.split("\n  verify-release:\n", 1)[0].split("\n  build-release:\n", 2)[1];
    const verifyJob = workflow.split("\n  publish:\n", 1)[0].split("\n  verify-release:\n", 2)[1];
    const publishJob = workflow.split("\n  publish:\n", 2)[1];

    expect(buildJob).toContain("permissions:\n      contents: read");
    expect(buildJob).not.toContain("contents: write");
    expect(buildJob).toContain("npm ci\n          npm run release:check");
    expect(buildJob).toContain("replica: [a, b]");
    expect(buildJob).toContain("overwrite: false");

    expect(verifyJob).toContain("permissions:\n      actions: read\n      contents: read");
    expect(verifyJob).not.toContain("contents: write");
    expect(verifyJob).not.toContain("attestations: write");
    expect(verifyJob).not.toContain("id-token: write");
    expect(verifyJob).toContain("npm ci");
    expect(verifyJob).toContain("npm run release:check");
    expect(verifyJob).toContain("Verify independent clean builds byte for byte");
    expect(verifyJob).toContain("Verify previous stable Release is a source ancestor");
    expect(verifyJob).toContain("Upload the sole current-run publication artifact");
    expect(verifyJob).toContain("name: ${{ env.PUBLICATION_ARTIFACT_NAME }}");
    expect(verifyJob).toContain("overwrite: false");

    expect(publishJob).toContain("if: github.event_name == 'push'");
    expect(publishJob).toContain("needs: verify-release");
    expect(publishJob).toContain("actions: read");
    expect(publishJob).toContain("contents: write");
    expect(publishJob).toContain("attestations: write");
    expect(publishJob).toContain("id-token: write");
    expect(publishJob).toContain("Materialize the fixed no-checkout publication boundary");
    expect(publishJob).toContain("EXPECTED_ARTIFACT_ID: ${{ needs.verify-release.outputs.artifact_id }}");
    expect(publishJob).toContain("EXPECTED_ARTIFACT_DIGEST: ${{ needs.verify-release.outputs.artifact_digest }}");
    expect(publishJob).toContain("python3 \"$RUNNER_TEMP/docwen-publication-boundary.py\"");
    expect(publishJob).not.toContain("actions/checkout@");
    expect(publishJob).not.toContain("gh run download");
    expect(publishJob).not.toMatch(/\bnpm(?:\s|@)/u);
    expect(publishJob).not.toContain("node scripts/");
    expect(workflow).not.toContain("overwrite: true");
  });

  it("preflights the default-branch head and serializes every version", () => {
    const workflow = readFileSync(".github/workflows/release.yml", "utf8");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("group: release-${{ github.repository }}");
    expect(workflow).not.toContain("release-${{ github.ref }}");
    expect(workflow).toContain("fetch-depth: 0");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow.match(/verify-release-source\.mjs preflight/gu)).toHaveLength(2);
    expect(workflow.match(/verify-release-source\.mjs release/gu)).toHaveLength(2);
    expect(workflow).toContain("verify-release-source.mjs previous-ancestor");
    expect(workflow).toContain("publication-boundary.py\" source");

    const sourceVerifier = readFileSync("scripts/verify-release-source.mjs", "utf8");
    expect(sourceVerifier).toContain("current remote default-branch head");
    expect(sourceVerifier).toContain("reachable from the current remote default branch");
    expect(sourceVerifier).toContain("unused tag");
    expect(sourceVerifier).toContain("ls-remote");
    expect(sourceVerifier).toContain("first published stable Release");
    expect(sourceVerifier).toContain("Previous stable Release is not older than");
    expect(sourceVerifier.match(/"merge-base",\s*"--is-ancestor"/gu)).toHaveLength(2);
  });

  it("uses the previous published stable Release rather than the previous tag for notes", () => {
    const baseline = selectReleaseNotesBaseline([
      release("1.2.0"),
      release("1.9.0", { draft: true }),
      release("1.8.0", { prerelease: true }),
      release("not-a-version"),
    ], "2.0.0");
    expect(baseline?.tag_name).toBe("1.2.0");
    expect(() => selectReleaseNotesBaseline([release("2.1.0")], "2.0.0"))
      .toThrow("not older than 2.0.0");
    expect(selectReleaseNotesBaseline([release("v1.2.0")], "2.0.0")?.tag_name).toBe("v1.2.0");
    expect(selectReleaseNotesBaseline([
      release("1.0.0"),
      release("v1.2.0"),
    ], "2.0.0")?.tag_name).toBe("v1.2.0");
    expect(() => selectReleaseNotesBaseline([
      release("1.2.0"),
      release("v1.2.0"),
    ], "2.0.0")).toThrow("ambiguous tags for 1.2.0");

    const workflow = readFileSync(".github/workflows/release.yml", "utf8");
    expect(workflow).toContain("github-release-contract.mjs baseline");
    expect(workflow).toContain("--notes-start-tag");
  });

  it("fails closed on malformed GitHub Release records before baseline filtering", () => {
    const malformed = [
      { ...release("1.0.0"), published_at: undefined },
      release("1.0.0", { published_at: null }),
      release("1.0.0", { published_at: "" }),
      release("1.0.0", { published_at: "2026-02-30T00:00:00Z" }),
      release("1.0.0", { draft: "false" }),
      release("1.0.0", { prerelease: 0 }),
      release("1.0.0", { tag_name: 100 }),
      null,
      [],
    ];
    for (const record of malformed) {
      expect(() => selectReleaseNotesBaseline([record], "2.0.0")).toThrow();
    }

    const validHistoricalDraft = release("draft-history", {
      draft: true,
      published_at: null,
    });
    expect(runPythonReleaseRecords([...malformed, validHistoricalDraft])).toEqual([
      ...malformed.map(() => false),
      true,
    ]);

    expect(() => selectReleaseNotesBaseline([{
      tag_name: "2.1.0",
      draft: false,
      prerelease: false,
    }], "2.0.0")).toThrow();

    expect(selectReleaseNotesBaseline([
      release("draft-history", { draft: true, published_at: null }),
      release("preview-history", { prerelease: true, published_at: null }),
      release("not-a-version"),
    ], "2.0.0")).toBeNull();
    expect(selectReleaseNotesBaseline([
      release("1.2.0"),
      release("1.10.0"),
      release("legacy-name"),
    ], "2.0.0")?.tag_name).toBe("1.10.0");
    const boundary = readFileSync("scripts/publication-boundary.py", "utf8");
    expect(boundary).toContain("validate_release_record(release)");
    expect(boundary).toContain("HISTORICAL_VERSION_RE");
    expect(boundary).toContain("ambiguous tags");
  }, 30_000);

  it("documents repository-admin protections as external publication prerequisites", () => {
    const documentation = readFileSync("scripts/README.md", "utf8");
    expect(documentation).toContain("existing same-tag Release");
    expect(documentation).toContain("externally administered publication prerequisites");
    expect(documentation).toContain("Record evidence that both protections are enabled");
    expect(documentation).toContain("post-publication `isImmutable` checks");
    expect(documentation).toContain("cannot make an unsafe publication attempt recoverable");
    expect(documentation).toContain("does not check out repository content, install dependencies, build, or execute checked-out repository code");
    expect(documentation).toContain("fixed dependency-free publication boundary");
    expect(documentation).not.toContain("rerun project code under that token");
    expect(documentation).not.toContain("fails closed unless repository Release immutability is enabled");
  });

  it("requires an immutable canonical public DocWen full package", () => {
    const selected = selectPublicDocWenRelease([
      release("0.9.0", {
        immutable: true,
        html_url: "https://github.com/ZHYX91/docwen/releases/tag/0.9.0",
        assets: [{
          name: "DocWen-windows-x64.zip",
          state: "uploaded",
          size: 42,
          digest: `sha256:${"a".repeat(64)}`,
          browser_download_url: "https://github.com/ZHYX91/docwen/releases/download/0.9.0/DocWen-windows-x64.zip",
        }],
      }),
    ]);
    expect(selected.version).toEqual(["0", "9", "0"]);
    expect(selectPublicDocWenRelease([
      selected.release,
      release("0.9.7", {
        immutable: true,
        html_url: "https://github.com/ZHYX91/docwen/releases/tag/0.9.7",
        assets: [{
          name: "DocWen-windows-x64.zip",
          state: "uploaded",
          size: 84,
          digest: `sha256:${"b".repeat(64)}`,
          browser_download_url: "https://github.com/ZHYX91/docwen/releases/download/0.9.7/DocWen-windows-x64.zip",
        }],
      }),
    ])).toMatchObject({ version: ["0", "9", "7"] });
    expect(() => selectPublicDocWenRelease([release("0.9.0")])).toThrow("not immutable");
    expect(selectPublicDocWenRelease([
      selected.release,
      release("0.10.0", { immutable: true }),
    ])).toMatchObject({ version: ["0", "9", "0"] });
    expect(selectPublicDocWenRelease([
      selected.release,
      release("0.9.9-rc.1", { prerelease: true }),
    ])).toMatchObject({ version: ["0", "9", "0"] });
    expect(() => selectPublicDocWenRelease([
      release("0.10.0", { immutable: true }),
    ])).toThrow("No public stable DocWen 0.9.x Release exists");
    expect(() => selectPublicDocWenRelease([
      release("v0.9.0", { immutable: true }),
    ])).toThrow("No public stable DocWen 0.9.x Release exists");

    const workflow = readFileSync(".github/workflows/release.yml", "utf8");
    expect(workflow).toContain("github-release-contract.mjs docwen-core");
  });

  it("retries immutable post-publication verification and accepts only explicit 404 before creation", () => {
    const workflow = readFileSync(".github/workflows/release.yml", "utf8");
    const verifier = readFileSync("scripts/publication-boundary.py", "utf8");
    expect(workflow).toContain("publication-boundary.py\" before");
    expect(workflow).toContain("publication-boundary.py\" after");
    expect(verifier.match(/allow_404=/gu)).toHaveLength(1);
    expect(verifier).toContain("allow_404=allow_missing");
    expect(verifier).toContain("for attempt in range(1, 11)");
    expect(verifier).toContain("isImmutable");
    expect(verifier).toContain("Remote Release asset bytes differ");
    expect(verifier).toContain("verify_source(identity, document)");
    expect(verifier).toContain("verify_baseline(identity, document)");
    expect(verifier).toContain("exhausted retries");
  });

  it("embeds the exact reviewed publication boundary and binds the current attempt artifact", () => {
    const workflow = readFileSync(".github/workflows/release.yml", "utf8");
    const boundary = readFileSync("scripts/publication-boundary.py");
    const attributes = readFileSync(".gitattributes", "utf8");
    expect(workflow).not.toContain("\r");
    expect(boundary.includes(0x0d)).toBe(false);
    expect(attributes).toContain("*.py text eol=lf");
    expect(attributes).toContain("*.yml text eol=lf");
    expect(attributes).toContain("*.cjs text eol=lf");
    expect(attributes).toContain("LICENSE text eol=lf");
    const encoded = workflow.match(/PUBLICATION_BOUNDARY_B64:\s+([A-Za-z0-9+/=]+)/u)?.[1];
    const recordedDigest = workflow.match(/PUBLICATION_BOUNDARY_SHA256:\s+([0-9a-f]{64})/u)?.[1];
    expect(encoded).toBeDefined();
    expect(Buffer.from(encoded!, "base64").equals(boundary)).toBe(true);
    expect(recordedDigest).toBe(createHash("sha256").update(boundary).digest("hex"));

    expect(workflow).toContain("docwen-assistant-publication-${{ github.run_id }}-${{ github.run_attempt }}");
    expect(workflow).toContain("artifact_id: ${{ steps.publication_artifact.outputs.artifact-id }}");
    expect(workflow).toContain("artifact_digest: ${{ steps.publication_artifact.outputs.artifact-digest }}");
    const verifier = boundary.toString("utf8");
    expect(verifier).toContain("GitHub artifact owner/run/source/digest identity mismatch");
    expect(verifier).toContain("GitHub workflow attempt identity mismatch");
    expect(verifier).toContain("Downloaded GitHub artifact does not match the server digest");
    expect(verifier).toContain("service_zip = request_bytes(archive_url)");
    expect(verifier).not.toContain(
      'service_zip = request_bytes(archive_url, accept="application/octet-stream")',
    );
  });

  it("strips GitHub credentials from signed asset redirects", () => {
    const python = process.platform === "win32" ? "python" : "python3";
    const source = [
      "import importlib.util, urllib.request",
      "spec = importlib.util.spec_from_file_location('publication_boundary', 'scripts/publication-boundary.py')",
      "module = importlib.util.module_from_spec(spec)",
      "spec.loader.exec_module(module)",
      "request = urllib.request.Request('https://api.github.com/repos/example/actions/artifacts/1/zip', headers={'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer secret', 'X-GitHub-Api-Version': module.API_VERSION})",
      "redirected = module.SafeRedirectHandler().redirect_request(request, None, 302, 'Found', {}, 'https://signed.example.test/artifact.zip?sig=trusted')",
      "headers = {name.lower(): value for name, value in redirected.header_items()}",
      "assert redirected.full_url == 'https://signed.example.test/artifact.zip?sig=trusted'",
      "assert headers == {'user-agent': 'docwen-assistant-publication-boundary'}",
      "try:",
      "    module.SafeRedirectHandler().redirect_request(request, None, 302, 'Found', {}, 'http://signed.example.test/artifact.zip')",
      "except module.BoundaryError:",
      "    pass",
      "else:",
      "    raise AssertionError('insecure redirect was accepted')",
    ].join("\n");
    const result = spawnSync(python, ["-c", source], {
      encoding: "utf8",
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    });
    expect(result.status, result.stderr).toBe(0);
  });

  it("requires trusted same-ref and same-commit provenance for all four public assets", async () => {
    const releaseDirectory = await mkdtemp(join(tmpdir(), "docwen-release-attestations-"));
    temporaryDirectories.push(releaseDirectory);
    const assets = releaseAssetNames("2.0.0");
    await Promise.all(assets.map((asset) => writeFile(join(releaseDirectory, asset), asset, "utf8")));
    const calls: Array<{ arguments_: string[]; command: string }> = [];
    const runner = (command: string, arguments_: string[]) => {
      calls.push({ arguments_, command });
      return { error: undefined, status: 0 };
    };

    await verifyExistingReleaseAttestations({
      releaseDirectory,
      repository: "ZHYX91/obsidian-docwen-assistant",
      sourceDigest: "a".repeat(40),
      sourceRef: "refs/tags/2.0.0",
      tag: "2.0.0",
    }, runner);

    const publicAssets = publicReleaseAssetNames("2.0.0");
    expect(calls).toHaveLength(4);
    expect(calls.every(({ command }) => command === "gh")).toBe(true);
    expect(calls.map(({ arguments_ }) => basename(arguments_[2]))).toEqual(publicAssets);
    for (const { arguments_ } of calls) {
      expect(arguments_).toEqual(expect.arrayContaining([
        "attestation",
        "verify",
        "--repo",
        "ZHYX91/obsidian-docwen-assistant",
        "--signer-workflow",
        "ZHYX91/obsidian-docwen-assistant/.github/workflows/release.yml",
        "--source-ref",
        "refs/tags/2.0.0",
        "--source-digest",
        "a".repeat(40),
        "--deny-self-hosted-runners",
      ]));
    }

    await expect(verifyExistingReleaseAttestations({
      releaseDirectory,
      repository: "ZHYX91/obsidian-docwen-assistant",
      sourceDigest: "a".repeat(40),
      sourceRef: "refs/tags/2.0.0",
      tag: "2.0.0",
    }, () => ({ error: undefined, status: 1 })))
      .rejects.toThrow("no matching trusted provenance attestation");

    const workflow = readFileSync(".github/workflows/release.yml", "utf8");
    expect(workflow).toContain("Final immutable Release and byte readback with finite retry");
    expect(workflow).toContain("Verify exact signer, repository, tag, commit, and hosted provenance");
    expect(workflow).toContain("--signer-workflow \"$GITHUB_REPOSITORY/.github/workflows/release.yml\"");
    expect(workflow).toContain("--source-ref \"$GITHUB_REF\"");
    expect(workflow).toContain("--source-digest \"$GITHUB_SHA\"");
    expect(workflow).toContain("--deny-self-hosted-runners");
    expect(workflow).toContain("if: steps.release_state.outputs.decision == 'create'");
  });
});

function release(tag_name: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tag_name,
    draft: false,
    prerelease: false,
    published_at: "2026-08-01T00:00:00Z",
    immutable: false,
    assets: [],
    ...overrides,
  };
}

async function npmBootstrapFixture(packageJson: Record<string, unknown>): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "docwen-npm-bootstrap-"));
  temporaryDirectories.push(directory);
  await writeFile(join(directory, "package.json"), JSON.stringify(packageJson), "utf8");
  return directory;
}

function runNpmBootstrap(
  source: string,
  cwd: string,
): { status: number | null; stderr: string; stdout: string } {
  const result = spawnSync(process.execPath, ["--input-type=module"], {
    cwd,
    encoding: "utf8",
    input: source,
  });
  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

function runPythonReleaseRecords(records: unknown[]): boolean[] {
  const python = process.platform === "win32" ? "python" : "python3";
  const source = [
    "import importlib.util, json, sys",
    "spec = importlib.util.spec_from_file_location('publication_boundary', 'scripts/publication-boundary.py')",
    "module = importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(module)",
    "results = []",
    "for record in json.load(sys.stdin):",
    "    try:",
    "        module.validate_release_record(record)",
    "    except BaseException:",
    "        results.append(False)",
    "    else:",
    "        results.append(True)",
    "json.dump(results, sys.stdout, separators=(',', ':'))",
  ].join("\n");
  const result = spawnSync(python, ["-c", source], {
    encoding: "utf8",
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    input: JSON.stringify(records),
  });
  if (result.status !== 0) {
    throw new Error(`Python release-record parity check failed: ${result.stderr}`);
  }
  const parsed: unknown = JSON.parse(result.stdout);
  if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== "boolean")) {
    throw new Error("Python release-record parity check returned an invalid result");
  }
  return parsed;
}

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

function readStoredZipNames(zip: Buffer): string[] {
  const names: string[] = [];
  let offset = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    const compressedSize = zip.readUInt32LE(offset + 18);
    const nameLength = zip.readUInt16LE(offset + 26);
    const extraLength = zip.readUInt16LE(offset + 28);
    names.push(zip.subarray(offset + 30, offset + 30 + nameLength).toString("utf8"));
    offset += 30 + nameLength + extraLength + compressedSize;
  }
  return names;
}

async function writeReleaseFixture(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  const looseAssets = new Map<string, Buffer>([
    ["main.js", Buffer.from("console.log('fixture');\n", "utf8")],
    [
      "manifest.json",
      Buffer.from(JSON.stringify({
        id: "docwen-assistant",
        version: "2.0.0",
        minAppVersion: "1.12.7",
        isDesktopOnly: true,
      }), "utf8"),
    ],
    ["styles.css", Buffer.from(".fixture {}\n", "utf8")],
  ]);
  const installZip = createDeterministicZip(
    [...looseAssets].map(([name, data]) => ({ name: `docwen-assistant/${name}`, data })),
  );
  const archiveName = "docwen-assistant-2.0.0.zip";
  const hashedAssets = new Map([...looseAssets, [archiveName, installZip]]);
  const checksums = [...hashedAssets]
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([name, data]) => `${createHash("sha256").update(data).digest("hex")}  ${name}`)
    .join("\n") + "\n";
  await Promise.all([
    ...[...looseAssets].map(([name, data]) => writeFile(join(directory, name), data)),
    writeFile(join(directory, archiveName), installZip),
    writeFile(join(directory, "SHA256SUMS"), checksums, "utf8"),
  ]);
}

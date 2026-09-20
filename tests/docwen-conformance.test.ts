import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { Ajv2020 } from "ajv/dist/2020.js";
import { afterEach, describe, expect, it } from "vitest";

import { validateArtifactBundle } from "../src/docwen/machine-client";
import { MachineFrameDecoder, type JsonObject } from "../src/docwen/machine-framing";

type Fixture = { path: string; schema: string; document_type: string; expect: string; error_code?: string };
type Schema = { name: string; id: string; path: string };
const contractRoot = path.resolve("contracts/docwen");
const readJson = (name: string): unknown => JSON.parse(readFileSync(path.join(contractRoot, name), "utf8"));
const manifest = readJson("conformance-manifest.json") as { schemas: Schema[]; fixtures: Fixture[] };
const fixtures = manifest.fixtures.map((fixture) => ({ ...fixture, data: readJson(fixture.path) }));
const ajv = new Ajv2020({ strict: false, validateFormats: false });
for (const schema of manifest.schemas) ajv.addSchema(readJson(schema.path) as object, schema.id);
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe("pinned DocWen normative contract snapshot", () => {

  it.each(["bundle", "producer", "artifact", "entry", "relation", "page_fragment", "page_resource"])("rejects unknown %s fields before file access", async (section) => {
    const bundle = structuredClone(readJson("fixtures/valid/artifact-bundle.ocr.json")) as JsonObject;
    const relations = bundle.relations as JsonObject[];
    const parts: Record<string, unknown> = {
      bundle,
      producer: bundle.producer,
      artifact: (bundle.artifacts as JsonObject[])[0],
      entry: (bundle.entries as JsonObject[])[0],
      relation: relations[0],
      page_fragment: relations[0].page_fragment,
      page_resource: relations.find((relation) => relation.page_resource)!.page_resource,
    };
    (parts[section] as JsonObject).consumer_private_field = true;
    await expect(validateArtifactBundle(bundle, path.join(contractRoot, "unavailable-staging"), bundle.task_id as string, (bundle.producer as JsonObject).product_version as string))
      .rejects.toMatchObject({ code: expect.stringMatching(/protocol_error$/u) });
  });

  it.each(fixtures.filter((fixture) => fixture.document_type === "bundle"
    && /page|resource_page/u.test(fixture.error_code ?? "")))("$path: rejects physical-page errors before file access", async (fixture) => {
    const bundle = structuredClone(fixture.data) as JsonObject;
    await expect(validateArtifactBundle(bundle, path.join(contractRoot, "unavailable-staging"), bundle.task_id as string, (bundle.producer as JsonObject).product_version as string))
      .rejects.toMatchObject({ message: expect.stringContaining(fixture.error_code!) });
  });

  it("accepts an explicit audit manifest owned by the preferred resource", async () => {
    const bundle = structuredClone(readJson("fixtures/valid/artifact-bundle.gongwen.json")) as JsonObject;
    const root = await mkdtemp(path.join(tmpdir(), "docwen-audit-conformance-"));
    roots.push(root);
    const bytes = Buffer.from("{}\n");
    const resource = {
      artifact_id: "resource.image", kind: "resource", locator: "image.png", logical_path: "image.png",
      suggested_name: "image.png", media_type: "image/png", size_bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
    bundle.artifacts = [resource, { ...resource, artifact_id: "resource.audit", locator: "docwen-node.json",
      logical_path: "docwen-node.json", suggested_name: "docwen-node.json", media_type: "application/vnd.docwen.document-node+json" }];
    bundle.entries = [{ artifact_id: resource.artifact_id, role: "image", ordinal: 0, preferred: true }];
    bundle.relations = [{ type: "resource_of", source_artifact_id: "resource.audit", target_artifact_id: resource.artifact_id, role: "manifest" }];
    await writeFile(path.join(root, "image.png"), bytes);
    await writeFile(path.join(root, "docwen-node.json"), bytes);
    expect((await validateArtifactBundle(bundle, root, bundle.task_id as string, (bundle.producer as JsonObject).product_version as string)).artifacts).toHaveLength(2);
    (bundle.artifacts as JsonObject[])[1].suggested_name = "unrelated.json";
    await expect(validateArtifactBundle(bundle, root, bundle.task_id as string, (bundle.producer as JsonObject).product_version as string))
      .rejects.toMatchObject({ code: expect.stringMatching(/integrity_error$/u) });
  });
  it("has the recorded complete inventory and digests", () => {
    const snapshot = readJson("snapshot.json") as {
      source_commit: string;
      files: Array<{ path: string; source_sha256: string; sha256: string; size_bytes: number }>;
    };
    expect(snapshot.source_commit).toMatch(/^[0-9a-f]{40}$/u);
    const inventory = readdirSync(contractRoot, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => path.relative(contractRoot, path.join(entry.parentPath, entry.name)).replaceAll("\\", "/"));
    expect(inventory.sort()).toEqual([...snapshot.files.map((file) => file.path), "snapshot.json"].sort());
    expect(new Set(snapshot.files.map((file) => file.path)).size).toBe(snapshot.files.length);
    for (const file of snapshot.files) {
      expect(file.source_sha256).toMatch(/^[0-9a-f]{64}$/u);
      const bytes = readFileSync(path.join(contractRoot, file.path));
      expect(bytes.length, file.path).toBe(file.size_bytes);
      expect(createHash("sha256").update(bytes).digest("hex"), file.path).toBe(file.sha256);
    }
    expect(manifest.schemas).toHaveLength(9);
    expect(manifest.fixtures).toHaveLength(93);
  });

  it.each(fixtures.filter((fixture) => fixture.document_type !== "framing"))("$path: schema expectation", (fixture) => {
    const schema = manifest.schemas.find((item) => item.name === fixture.schema)!;
    const validator = ajv.getSchema(schema.id)!;
    const documents: unknown[] = fixture.document_type === "trace" ? fixture.data as unknown[] : [fixture.data];
    const valid = documents.map((document) => validator(document)).every(Boolean);
    expect(valid).toBe(fixture.expect !== "invalid_schema");
  });

  it.each(fixtures.filter((fixture) => fixture.document_type === "framing"))("$path: actual frame decoder", (fixture) => {
    const data = fixture.data as { chunks: string[]; expected_messages?: JsonObject[] };
    const decode = (): JsonObject[] => {
      const decoder = new MachineFrameDecoder();
      const result = data.chunks.flatMap((chunk) => decoder.feed(Buffer.from(chunk, "utf8")));
      decoder.finish();
      return result;
    };
    if (fixture.expect === "valid") expect(decode()).toEqual(data.expected_messages);
    else expect(decode).toThrow();
  });

  it.each(fixtures.filter((fixture) => fixture.document_type === "bundle"))("$path: actual bundle validator", async (fixture) => {
    const bundle = structuredClone(fixture.data) as JsonObject;
    const root = await mkdtemp(path.join(tmpdir(), "docwen-conformance-"));
    roots.push(root);
    // Fixture bytes are symbolic. Change only size/hash in the test copy; keep the graph unchanged.
    for (const artifact of bundle.artifacts as JsonObject[]) {
      const locator = artifact.locator as string;
      if (locator.includes("\\") || locator.includes(":")
        || locator.split("/").some((segment) => ["", ".", ".."].includes(segment))) continue;
      const filename = path.resolve(root, locator);
      expect(path.relative(root, filename)).not.toMatch(/^\.\./u);
      const bytes = Buffer.from("normative fixture payload: " + locator);
      await mkdir(path.dirname(filename), { recursive: true });
      await writeFile(filename, bytes);
      artifact.size_bytes = bytes.length;
      artifact.sha256 = createHash("sha256").update(bytes).digest("hex");
    }
    const result = validateArtifactBundle(bundle, root, bundle.task_id as string, (bundle.producer as JsonObject).product_version as string);
    if (fixture.expect === "valid") {
      expect((await result).artifacts).toHaveLength((bundle.artifacts as unknown[]).length);
    } else {
      // An absent fixture file must never masquerade as a successful semantic rejection.
      await expect(result).rejects.toMatchObject({ code: expect.stringMatching(/(?:integrity|protocol)_error$/u) });
    }
  });
});

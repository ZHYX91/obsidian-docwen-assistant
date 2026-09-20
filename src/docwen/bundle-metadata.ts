import { isJsonObject, type JsonObject } from "./machine-framing";

type Invalid = (message: string) => Error;
type Artifact = { artifact_id: string; kind: string };

function fields(value: unknown, required: string[], optional: string[], name: string, invalid: Invalid): JsonObject {
  if (!isJsonObject(value)
    || required.some((key) => !Object.prototype.hasOwnProperty.call(value, key))
    || Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key))) {
    throw invalid(`Artifact Bundle has invalid or unknown fields in ${name}.`);
  }
  return value;
}

function boundedText(value: unknown, maximum: number, name: string, invalid: Invalid, pattern?: RegExp): void {
  if (typeof value !== "string" || [...value].length === 0 || [...value].length > maximum
    || (pattern && !pattern.test(value))) {
    throw invalid(`Artifact Bundle has invalid ${name}.`);
  }
}

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;

/** Closed wire metadata checks. Filesystem safety and publication remain host-owned. */
export function validateBundleFields(bundle: JsonObject, invalid: Invalid): void {
  fields(bundle, ["schema", "bundle_id", "task_id", "producer", "layout_schema", "artifacts", "entries", "relations"], [], "bundle", invalid);
  boundedText(bundle.bundle_id, 128, "bundle_id", invalid, IDENTIFIER);
  boundedText(bundle.task_id, 128, "task_id", invalid, IDENTIFIER);
  const producer = fields(bundle.producer, ["name", "product_version", "machine_protocol"], [], "producer", invalid);
  boundedText(producer.product_version, 64, "product_version", invalid);
  for (const collection of ["artifacts", "entries", "relations"]) {
    if (!Array.isArray(bundle[collection])) throw invalid(`Artifact Bundle ${collection} must be an array.`);
  }
  for (const raw of bundle.artifacts as unknown[]) {
    const artifact = fields(raw, ["artifact_id", "kind", "locator", "logical_path", "suggested_name", "media_type", "size_bytes", "sha256"], [], "artifact", invalid);
    boundedText(artifact.artifact_id, 128, "artifact_id", invalid, IDENTIFIER);
    boundedText(artifact.locator, 1024, "locator", invalid);
    boundedText(artifact.logical_path, 1024, "logical_path", invalid);
    boundedText(artifact.suggested_name, 255, "suggested_name", invalid);
    boundedText(artifact.media_type, 255, "media_type", invalid, /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+(?:;.*)?$/u);
  }
  for (const raw of bundle.entries as unknown[]) {
    const entry = fields(raw, ["artifact_id", "role", "ordinal", "preferred"], [], "entry", invalid);
    boundedText(entry.artifact_id, 128, "entry.artifact_id", invalid, IDENTIFIER);
  }
  for (const raw of bundle.relations as unknown[]) {
    const relation = fields(raw, ["type", "source_artifact_id", "target_artifact_id", "role"], ["ordinal", "page_fragment", "page_resource"], "relation", invalid);
    boundedText(relation.source_artifact_id, 128, "source_artifact_id", invalid, IDENTIFIER);
    boundedText(relation.target_artifact_id, 128, "target_artifact_id", invalid, IDENTIFIER);
    if (Object.prototype.hasOwnProperty.call(relation, "page_fragment")) {
      fields(relation.page_fragment, ["fragment_kind", "page_index", "page_count", "ocr_status", "source_page"], [], "page_fragment", invalid);
    }
    if (Object.prototype.hasOwnProperty.call(relation, "page_resource")) fields(relation.page_resource, ["source_page"], [], "page_resource", invalid);
  }
}

type Page = { page_index: number; page_count: number; source_page: number };
const OCR_STATUSES = new Set(["success", "no_text", "input_missing", "unavailable", "model_missing", "initialization_failed", "recognition_failed"]);

function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/** Validate physical-page metadata before reading artifact files. */
export function validateBundlePages(
  bundle: JsonObject,
  invalid: Invalid,
): void {
  const artifacts = bundle.artifacts as Artifact[];
  const entries = bundle.entries as JsonObject[];
  const relations = bundle.relations as JsonObject[];
  const fail = (code: string): never => { throw invalid(`Artifact Bundle physical pages: ${code}.`); };
  const byId = new Map(artifacts.map((item) => [item.artifact_id, item]));
  const primary = new Set(entries.filter((entry) => entry.role === "primary" && byId.get(String(entry.artifact_id))?.kind === "document").map((entry) => entry.artifact_id));
  const pageByArtifact = new Map<unknown, Page>();
  const pagesByOwner = new Map<unknown, Page[]>();
  for (const relation of relations) {
    const isPage = relation.type === "fragment_of" && relation.role === "ocr_page";
    const page = relation.page_fragment;
    if (isPage) {
      if (!isJsonObject(page)) fail("missing_page_fragment_semantics");
      if (!primary.has(relation.target_artifact_id)) fail("unexpected_page_semantics");
      const data = page as JsonObject;
      if (data.fragment_kind !== "page" || !positive(data.page_index) || !positive(data.page_count)
        || !positive(data.source_page) || data.page_index > data.page_count || data.source_page > data.page_count
        || typeof data.ocr_status !== "string" || !OCR_STATUSES.has(data.ocr_status)) fail("invalid_page_range");
      if (relation.ordinal !== (data.page_index as number) - 1) fail("page_ordinal_mismatch");
      const validated = data as Page;
      pageByArtifact.set(relation.source_artifact_id, validated);
      const pages = pagesByOwner.get(relation.target_artifact_id) ?? [];
      pages.push(validated);
      pagesByOwner.set(relation.target_artifact_id, pages);
    } else if (page !== undefined) fail("unexpected_page_semantics");
    if (relation.page_resource !== undefined
      && (relation.type !== "resource_of" || !["image", "original", "preview"].includes(String(relation.role)))) fail("unexpected_page_semantics");
  }
  for (const pages of pagesByOwner.values()) {
    const counts = new Set(pages.map((page) => page.page_count));
    if (counts.size !== 1) fail("page_count_mismatch");
    const count = pages[0].page_count;
    if (new Set(pages.map((page) => page.page_index)).size !== pages.length) fail("duplicate_page_index");
    // Each index is already a positive integer <= count; cardinality proves full coverage.
    if (pages.length !== count) fail("incomplete_page_sequence");
    if (new Set(pages.map((page) => page.source_page)).size !== count) fail("page_source_mismatch");
  }
  for (const relation of relations) {
    if (relation.type !== "resource_of" || !["image", "original", "preview"].includes(String(relation.role))) continue;
    const resource = relation.page_resource;
    if (resource !== undefined && (!isJsonObject(resource) || !positive(resource.source_page))) fail("invalid_page_range");
    const targetPage = pageByArtifact.get(relation.target_artifact_id);
    if (targetPage) {
      if (!isJsonObject(resource) || resource.source_page !== targetPage.source_page) fail("resource_page_mismatch");
    } else if (resource !== undefined
      && (!primary.has(relation.target_artifact_id) || pagesByOwner.has(relation.target_artifact_id))) {
      fail("resource_page_mismatch");
    }
  }
}

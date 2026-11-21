import { extname } from "node:path";

/** Machine source slots classify some office and Markdown inputs as documents; other file formats are resources. */
export interface SourceFormat {
  readonly kind: "document" | "resource";
  readonly mediaType: string;
}

export const CONVERSION_MEDIA_TYPES = {
  md: "text/markdown",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;
export type ConvertTarget = keyof typeof CONVERSION_MEDIA_TYPES;

const mediaTypesByKind = {
  document: {
    md: CONVERSION_MEDIA_TYPES.md,
    markdown: CONVERSION_MEDIA_TYPES.md,
    txt: "text/plain",
    docx: CONVERSION_MEDIA_TYPES.docx,
    doc: "application/msword",
    odt: "application/vnd.oasis.opendocument.text",
    rtf: "application/rtf",
    wps: "application/vnd.ms-works",
  },
  resource: {
    csv: "text/csv",
    tsv: "text/tab-separated-values",
    xlsx: CONVERSION_MEDIA_TYPES.xlsx,
    xls: "application/vnd.ms-excel",
    et: "application/vnd.ms-excel",
    ods: "application/vnd.oasis.opendocument.spreadsheet",
    pdf: "application/pdf",
    ofd: "application/vnd.ofd",
    xps: "application/vnd.ms-xpsdocument",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    bmp: "image/bmp",
    webp: "image/webp",
    tif: "image/tiff",
    tiff: "image/tiff",
    heic: "image/heic",
    heif: "image/heif",
    html: "text/html",
    htm: "text/html",
    mhtml: "multipart/related",
    mht: "multipart/related",
    epub: "application/epub+zip",
    enex: "application/x-evernote",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ppt: "application/vnd.ms-powerpoint",
  },
} as const;
const formats = new Map<string, SourceFormat>();
for (const kind of ["document", "resource"] as const) {
  for (const [extension, mediaType] of Object.entries(mediaTypesByKind[kind])) {
    formats.set(extension, { kind, mediaType });
  }
}
export const UNKNOWN_SOURCE_FORMAT: SourceFormat = { kind: "resource", mediaType: "application/octet-stream" };

export function sourceFormatForExtension(extension: string): SourceFormat | undefined {
  return formats.get(extension.toLowerCase());
}

export function sourceFormatForPath(filePath: string): SourceFormat {
  return sourceFormatForExtension(extname(filePath).slice(1)) ?? UNKNOWN_SOURCE_FORMAT;
}

export function mediaTypeForPath(filePath: string): string {
  return sourceFormatForPath(filePath).mediaType;
}

export function sourceKindForPath(filePath: string): SourceFormat["kind"] {
  return sourceFormatForPath(filePath).kind;
}

export interface FileInspection {
  filePath: string;
  contentSha256: string;
  sizeBytes: number;
  decision: string;
  supportedActions: string[];
  declaredFormat: string;
  detectedFormat: string;
  warningCode: string;
  reasonCode: string;
  workflowCategory: string;
  mediaType: string;
}

export interface AdmittedSourceFormat {
  readonly mediaType: string;
  readonly binding: "original" | "detected" | "confirm-detected";
}

/** Project Core's inspection onto the input handle used for discovery and execution. */
export function admittedSourceFormat(inspection: FileInspection, sourceMediaType?: string): AdmittedSourceFormat {
  const mediaType = inspection.mediaType;
  if (inspection.decision === "require_explicit_acceptance") return { mediaType, binding: "confirm-detected" };
  if (inspection.decision !== "allow_with_warning") return { mediaType, binding: "original" };
  const declared = sourceFormatForExtension(inspection.declaredFormat)?.mediaType ?? UNKNOWN_SOURCE_FORMAT.mediaType;
  if (sourceMediaType !== undefined && sourceMediaType !== declared) return { mediaType, binding: "original" };
  if (inspection.warningCode === "FILE_FORMAT_COMPATIBLE_TEXT") {
    // Core's source-native Markdown route also accepts plain paragraphs under a Markdown handle.
    if (declared === CONVERSION_MEDIA_TYPES.md && mediaType === "text/plain") {
      return { mediaType: declared, binding: "original" };
    }
    return { mediaType, binding: declared === "text/plain" && mediaType === CONVERSION_MEDIA_TYPES.md ? "detected" : "original" };
  }
  return { mediaType, binding: inspection.warningCode === "FILE_FORMAT_SAME_FAMILY_MISMATCH" ? "detected" : "original" };
}

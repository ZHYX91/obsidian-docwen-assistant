import { TextDecoder } from "node:util";

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const MAX_MESSAGE_BYTES = 16 * 1024 * 1024;
const HEADER_LIMIT_BYTES = 64;
const HEADER_SOURCE = String.raw`Content-Length: ([1-9][0-9]*)\r\n\r\n`;
const HEADER_PATTERN = new RegExp(`^${HEADER_SOURCE}$`, "u");
const EMBEDDED_HEADER_PATTERN = new RegExp(HEADER_SOURCE, "gu");

export type JsonObject = Record<string, unknown>;

export function encodeMachineFrame(message: JsonObject): Buffer {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  if (body.length > MAX_MESSAGE_BYTES) throw new Error("docwen_machine_frame_too_large");
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii"), body]);
}

/** Look for complete Machine frames in a separately bounded diagnostic stream. */
export function containsMachineProtocolFrame(bytes: Buffer): boolean {
  // Latin-1 preserves byte offsets, including when surrounding logs contain Unicode.
  const headers = [...bytes.toString("latin1").matchAll(EMBEDDED_HEADER_PATTERN)];
  for (const [index, header] of headers.entries()) {
    if (header[0].length > HEADER_LIMIT_BYTES) continue;
    const contentLength = Number(header[1]);
    if (!Number.isSafeInteger(contentLength) || contentLength > MAX_MESSAGE_BYTES) continue;
    const bodyStart = header.index + header[0].length;
    const bodyEnd = bodyStart + contentLength;
    // A second raw header cannot be part of valid JSON. Keep candidate ranges disjoint.
    if (bodyEnd > (headers[index + 1]?.index ?? bytes.length)) continue;
    try {
      if (decodeMachinePayload(bytes.subarray(bodyStart, bodyEnd)).jsonrpc === "2.0") return true;
    } catch {
      // Header-like diagnostics are allowed when the bytes do not form a protocol frame.
    }
  }
  return false;
}

export class MachineFrameDecoder {
  private header = Buffer.alloc(0);
  private body?: Buffer;
  private received = 0;

  feed(chunk: Buffer): JsonObject[] {
    const messages: JsonObject[] = [];
    let offset = 0;
    while (offset < chunk.length) {
      if (!this.body) {
        const remainingHeader = HEADER_LIMIT_BYTES - this.header.length;
        const prefix = chunk.subarray(offset, offset + remainingHeader);
        const header = this.header.length ? Buffer.concat([this.header, prefix]) : prefix;
        const headerEnd = header.indexOf("\r\n\r\n");
        if (headerEnd < 0) {
          if (header.length === HEADER_LIMIT_BYTES || header.indexOf("\n\n") >= 0)
            throw new Error("docwen_machine_invalid_frame_header");
          this.header = Buffer.from(header);
          break;
        }
        const headerLength = headerEnd + 4;
        const match = HEADER_PATTERN.exec(header.toString("latin1", 0, headerLength));
        if (!match?.[1]) throw new Error("docwen_machine_invalid_frame_header");
        const length = Number(match[1]);
        if (!Number.isSafeInteger(length) || length > MAX_MESSAGE_BYTES)
          throw new Error("docwen_machine_frame_too_large");
        offset += headerLength - this.header.length;
        this.header = Buffer.alloc(0);
        if (chunk.length - offset >= length) {
          messages.push(decodeMachinePayload(chunk.subarray(offset, offset + length)));
          offset += length;
          continue;
        }
        this.body = Buffer.allocUnsafe(length);
        this.received = 0;
      }
      const count = Math.min(this.body.length - this.received, chunk.length - offset);
      chunk.copy(this.body, this.received, offset, offset + count);
      this.received += count;
      offset += count;
      if (this.received === this.body.length) {
        messages.push(decodeMachinePayload(this.body));
        this.body = undefined;
      }
    }
    return messages;
  }

  finish(): void {
    if (this.header.length || this.body) throw new Error("docwen_machine_truncated_frame");
  }
}

function decodeMachinePayload(body: Buffer): JsonObject {
  let value: unknown;
  try {
    value = JSON.parse(UTF8_DECODER.decode(body));
  } catch {
    throw new Error("docwen_machine_invalid_frame_payload");
  }
  if (!isJsonObject(value)) throw new Error("docwen_machine_invalid_frame_payload");
  return value;
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

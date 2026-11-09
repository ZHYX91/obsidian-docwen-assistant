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
  private buffer = Buffer.alloc(0);

  feed(chunk: Buffer): JsonObject[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const messages: JsonObject[] = [];
    while (this.buffer.length > 0) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) {
        if (this.buffer.indexOf("\n\n") >= 0 || this.buffer.length > HEADER_LIMIT_BYTES) {
          throw new Error("docwen_machine_invalid_frame_header");
        }
        break;
      }
      const header = this.buffer.subarray(0, headerEnd + 4);
      if (header.length > HEADER_LIMIT_BYTES) throw new Error("docwen_machine_invalid_frame_header");
      const match = HEADER_PATTERN.exec(header.toString("latin1"));
      if (!match?.[1]) throw new Error("docwen_machine_invalid_frame_header");
      const contentLength = Number(match[1]);
      if (!Number.isSafeInteger(contentLength) || contentLength > MAX_MESSAGE_BYTES) {
        throw new Error("docwen_machine_frame_too_large");
      }
      const frameEnd = header.length + contentLength;
      if (this.buffer.length < frameEnd) break;
      const body = this.buffer.subarray(header.length, frameEnd);
      this.buffer = this.buffer.subarray(frameEnd);
      messages.push(decodeMachinePayload(body));
    }
    return messages;
  }

  finish(): void {
    if (this.buffer.length !== 0) throw new Error("docwen_machine_truncated_frame");
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

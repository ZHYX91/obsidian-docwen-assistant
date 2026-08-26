const MAX_MESSAGE_BYTES = 16 * 1024 * 1024;
const HEADER_LIMIT_BYTES = 64;
const HEADER_PATTERN = /^Content-Length: ([1-9][0-9]*)\r\n\r\n$/;

export type JsonObject = Record<string, unknown>;

export function encodeMachineFrame(message: JsonObject): Buffer {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  if (body.length > MAX_MESSAGE_BYTES) throw new Error("docwen_machine_frame_too_large");
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii"), body]);
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
      const match = HEADER_PATTERN.exec(header.toString("ascii"));
      if (!match?.[1]) throw new Error("docwen_machine_invalid_frame_header");
      const contentLength = Number(match[1]);
      if (!Number.isSafeInteger(contentLength) || contentLength > MAX_MESSAGE_BYTES) {
        throw new Error("docwen_machine_frame_too_large");
      }
      const frameEnd = header.length + contentLength;
      if (this.buffer.length < frameEnd) break;
      const body = this.buffer.subarray(header.length, frameEnd);
      this.buffer = this.buffer.subarray(frameEnd);
      let value: unknown;
      try {
        value = JSON.parse(body.toString("utf8"));
      } catch {
        throw new Error("docwen_machine_invalid_frame_payload");
      }
      if (!isJsonObject(value)) throw new Error("docwen_machine_invalid_frame_payload");
      messages.push(value);
    }
    return messages;
  }

  finish(): void {
    if (this.buffer.length !== 0) throw new Error("docwen_machine_truncated_frame");
  }
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

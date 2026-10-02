import { describe, expect, it } from "vitest";

import {
  encodeMachineFrame,
  MachineFrameDecoder,
} from "../src/docwen/machine-framing";

describe("DocWen Machine v2 framing", () => {

  it("rejects high-bit header aliases instead of masking them to ASCII", () => {
    const frame = Buffer.from("Content-Length: 2\r\n\r\n{}", "ascii");
    frame[0] = 0xc3; // ASCII decoding used to turn this byte into C.
    expect(() => new MachineFrameDecoder().feed(frame)).toThrow("docwen_machine_invalid_frame_header");
  });

  it.each([
    Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d]),
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("{}")]),
  ])("rejects malformed UTF-8 and a leading BOM", (body) => {
    const frame = Buffer.concat([Buffer.from("Content-Length: " + body.length + "\r\n\r\n", "ascii"), body]);
    expect(() => new MachineFrameDecoder().feed(frame)).toThrow("docwen_machine_invalid_frame_payload");
  });

  it("preserves multibyte characters split at every byte boundary", () => {
    const message = { text: "中文🙂" };
    const frame = encodeMachineFrame(message);
    const decoder = new MachineFrameDecoder();
    const decoded = [...frame].flatMap((byte) => decoder.feed(Buffer.from([byte])));
    decoder.finish();
    expect(decoded).toEqual([message]);
  });
  it("round-trips UTF-8 messages across arbitrary chunks", () => {
    const message = { jsonrpc: "2.0", id: 1, method: "health/check", params: { label: "文档" } };
    const frame = encodeMachineFrame(message);
    const decoder = new MachineFrameDecoder();

    expect(decoder.feed(frame.subarray(0, 7))).toEqual([]);
    expect(decoder.feed(frame.subarray(7, 23))).toEqual([]);
    expect(decoder.feed(frame.subarray(23))).toEqual([message]);
    expect(() => decoder.finish()).not.toThrow();
  });

  it.each([
    Buffer.from("Content-Length: 0\r\n\r\n", "ascii"),
    Buffer.from("content-length: 2\r\n\r\n{}", "ascii"),
    Buffer.from("Content-Length: 2\n\n{}", "ascii"),
  ])("rejects non-canonical headers", (frame) => {
    expect(() => new MachineFrameDecoder().feed(frame)).toThrow("docwen_machine_invalid_frame_header");
  });

  it("rejects truncated frames at EOF", () => {
    const decoder = new MachineFrameDecoder();
    decoder.feed(Buffer.from("Content-Length: 10\r\n\r\n{}", "ascii"));
    expect(() => decoder.finish()).toThrow("docwen_machine_truncated_frame");
  });
});

import { describe, expect, it } from "vitest";

import {
  encodeMachineFrame,
  MachineFrameDecoder,
} from "../src/docwen/machine-framing";

describe("DocWen Machine v1 framing", () => {
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

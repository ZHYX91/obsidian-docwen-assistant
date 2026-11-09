import { describe, expect, it } from "vitest";
import {
  assertRunnerObservable,
  assertSentinelObservable,
  parseLinuxProcessIdentity,
  type LinuxProcessIdentity,
} from "./helpers/linux-native-prerequisites";

const sentinel: LinuxProcessIdentity = { pid: 200, parent: 100, group: 200, session: 200, state: "S", startTime: "98765" };

describe("Linux native fixture process observations", () => {
  it("reads starttime after the complete command name, including spaces and parentheses", () => {
    const fields = ["R", "100", "200", "200", ...Array<string>(15).fill("0"), "98765"];
    expect(parseLinuxProcessIdentity(`200 (sentinel (ready) test) ${fields.join(" ")}\n`)).toEqual({ ...sentinel, state: "R" });
  });

  it.each(["", "200 (broken)", "200 missing command R 100 200 200", "x (sentinel) S 100 200 200"])(
    "rejects malformed procfs observations: %s", text => {
      expect(() => parseLinuxProcessIdentity(text)).toThrow("Malformed /proc process identity");
    },
  );

  it("accepts a live detached child observed as the same lifetime by both processes", () => {
    expect(() => assertRunnerObservable(200, sentinel)).not.toThrow();
    expect(() => assertSentinelObservable(100, 200, sentinel, { ...sentinel, state: "R" })).not.toThrow();
  });

  it("rejects a procfs mount that reports a different runner PID", () => {
    expect(() => assertRunnerObservable(100, sentinel)).toThrow("Node's PID differs from /proc/self");
  });

  it("identifies different PID namespaces rather than waiting for a business timeout", () => {
    expect(() => assertSentinelObservable(100, 300, sentinel, null)).toThrow("differs from the sentinel's own PID");
  });

  it("identifies a live child missing from the runner's procfs", () => {
    expect(() => assertSentinelObservable(100, 200, sentinel, null)).toThrow("not visible at /proc/200/stat");
  });

  it("rejects a parent identity inconsistent with the test runner", () => {
    expect(() => assertSentinelObservable(100, 200, sentinel, { ...sentinel, parent: 10 })).toThrow("direct child");
  });

  it.each([
    { pid: 201 }, { startTime: "98766" }, { group: 201 }, { session: 201 },
  ])("rejects a changed observed identity: %j", mutation => {
    expect(() => assertSentinelObservable(100, 200, sentinel, { ...sentinel, ...mutation })).toThrow("self-reported identity differs");
  });

  it("rejects a sentinel that did not establish the requested session", () => {
    const attached = { ...sentinel, group: 100, session: 100 };
    expect(() => assertSentinelObservable(100, 200, attached, attached)).toThrow("detached session");
  });

  it("does not mistake a zombie for a running sentinel", () => {
    expect(() => assertSentinelObservable(100, 200, sentinel, { ...sentinel, state: "Z" })).toThrow("state=Z");
  });
});

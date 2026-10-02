import { describe, expect, it, vi } from "vitest";

import { RuntimeDisposer } from "../src/runtime/disposer";

describe("RuntimeDisposer", () => {
  it("runs cleanups in reverse order, isolates errors and is idempotent", () => {
    const calls: string[] = [];
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const owner = new RuntimeDisposer();
    owner.add(() => calls.push("first"));
    owner.add(() => { calls.push("second"); throw new Error("cleanup"); });
    owner.add(() => calls.push("third"));

    owner.dispose();
    owner.dispose();

    expect(calls).toEqual(["third", "second", "first"]);
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it("immediately cleans resources registered after disposal", () => {
    const cleanup = vi.fn();
    const owner = new RuntimeDisposer();
    owner.dispose();
    owner.add(cleanup);
    expect(cleanup).toHaveBeenCalledOnce();
  });
});

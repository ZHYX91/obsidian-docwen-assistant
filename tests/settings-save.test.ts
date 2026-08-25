import { describe, expect, it, vi } from "vitest";

import { SettingsSaveCoordinator } from "../src/runtime/settings-save";

describe("SettingsSaveCoordinator", () => {
  it("serializes immutable snapshots", async () => {
    const order: number[] = [];
    const persist = vi.fn(async (snapshot: { value: number }) => {
      await Promise.resolve();
      order.push(snapshot.value);
    });
    const owner = new SettingsSaveCoordinator(persist);

    await Promise.all([owner.save({ value: 1 }), owner.save({ value: 2 })]);

    expect(order).toEqual([1, 2]);
    expect(owner.getState()).toBe("saved");
  });

  it("retains a failed snapshot for explicit retry without blocking startup", async () => {
    const persist = vi.fn()
      .mockRejectedValueOnce(new Error("disk full"))
      .mockResolvedValueOnce(undefined);
    const owner = new SettingsSaveCoordinator<{ value: number }>(persist);

    await expect(owner.save({ value: 1 })).rejects.toThrow("disk full");
    expect(owner.getState()).toBe("pending");
    await owner.retry();

    expect(owner.getState()).toBe("saved");
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it("does not retry an old failure after a newer snapshot is requested", async () => {
    let releaseSecond!: () => void;
    let markSecondStarted!: () => void;
    const secondStarted = new Promise<void>((resolve) => {
      markSecondStarted = resolve;
    });
    const secondRelease = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    const persisted: number[] = [];
    const owner = new SettingsSaveCoordinator<{ value: number }>(async (snapshot) => {
      persisted.push(snapshot.value);
      if (snapshot.value === 1) throw new Error("disk full");
      markSecondStarted();
      await secondRelease;
    });

    await expect(owner.save({ value: 1 })).rejects.toThrow("disk full");
    const newerSave = owner.save({ value: 2 });
    await secondStarted;
    expect(owner.getState()).toBe("saving");
    const staleRetry = owner.retry();
    releaseSecond();
    await Promise.all([newerSave, staleRetry]);

    expect(persisted).toEqual([1, 2]);
    expect(owner.getState()).toBe("saved");
  });
});

import { describe, expect, it, vi } from "vitest";
import type { Command } from "obsidian";
import { registerCommands } from "../src/app/register-commands";

describe("proofread command target", () => {
  it("retains the selected note when activating the results changes focus", async () => {
    const source = { path: "Source.md" };
    const view = {};
    let activeFile: typeof source | null = source;
    const commands = new Map<string, Omit<Command, "name">>();
    const run = vi.fn().mockResolvedValue(undefined);
    registerCommands({
      app: { workspace: { getActiveFile: () => activeFile } },
      addLocalizedCommand: (key: string, command: Omit<Command, "name">) => commands.set(key, command),
      activeFileSupports: () => true,
      proofreadActions: {
        activateView: async () => { activeFile = null; return view; },
        run,
        runActive: vi.fn(),
      },
    } as never);
    expect(commands.get("commandProofread")?.checkCallback?.(true)).toBe(true);
    expect(run).not.toHaveBeenCalled();
    commands.get("commandProofread")?.checkCallback?.(false);
    await vi.waitFor(() => expect(run).toHaveBeenCalledWith(source, view));
  });
});

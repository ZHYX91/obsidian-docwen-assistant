import { TFile, TFolder } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { resolveTargetFile } from "../src/host/vault-files";

vi.mock("obsidian", () => ({ TFile: class {}, TFolder: class {}, TAbstractFile: class {}, FileSystemAdapter: class {} }));

function note(basename: string, extension = "md"): TFile {
  return Object.assign(new TFile(), { basename, extension, name: `${basename}.${extension}` });
}

describe("folder menu target", () => {
  it.each([
    ["Project", "project", "MD"],
    ["Café", "Cafe\u0301", "Md"],
    ["ΟΣ", "ος", "md"],
    ["A[1]", "a[1]", "md"],
  ])("opens the unique matching note in %s", (name, basename, extension) => {
    const target = note(basename, extension);
    const folder = Object.assign(new TFolder(), { name, children: [note("Other"), note(name, "pdf"), target] });
    expect(resolveTargetFile(folder)).toBe(target);
  });

  it.each([false, true])("leaves the choice to the user for equivalent siblings (reverse=%s)", (reverse) => {
    const notes = [note("Project"), note("project", "Md")];
    const folder = Object.assign(new TFolder(), { name: "Project", children: reverse ? notes.reverse() : notes });
    expect(resolveTargetFile(folder)).toBeNull();
    for (const child of notes) expect(resolveTargetFile(child)).toBe(child);
  });

  it("does not match a differently accented, expanded or wildcard spelling", () => {
    for (const [name, other] of [["Café", "Cafe"], ["Straße", "Strasse"], ["A.1", "Ab1"]]) {
      expect(resolveTargetFile(Object.assign(new TFolder(), { name, children: [note(other)] }))).toBeNull();
    }
  });
});

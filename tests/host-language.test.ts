import { beforeEach, describe, expect, it, vi } from "vitest";

const getLanguage = vi.hoisted(() => vi.fn());

vi.mock("obsidian", () => ({
  getLanguage,
}));

import {
  getDocWenLanguage,
  initializePluginI18n,
  resolveObsidianLanguage,
  resolvePluginLocale,
} from "../src/host-language";
import { initI18n, t } from "../src/i18n";

describe("plugin language", () => {
  beforeEach(() => {
    getLanguage.mockReset();
    initI18n("en");
  });

  it("uses Obsidian's configured language", () => {
    getLanguage.mockReturnValue("zh");

    initializePluginI18n("auto");

    expect(getLanguage).toHaveBeenCalledOnce();
    expect(t("settingsTitle")).toBe("DocWen 助手设置");
  });

  it("lets plugin locale rules fall back for an unsupported host language", () => {
    getLanguage.mockReturnValue("ar");

    initializePluginI18n("auto");

    expect(t("settingsTitle")).toBe("DocWen Assistant Settings");
  });

  it.each([
    ["zh-CN", "zh_CN"],
    ["zh-Hant", "zh_TW"],
    ["zh-Hant-HK", "zh_TW"],
    ["zh-Hans-SG", "zh_CN"],
    ["en-GB", "en_US"],
    ["pt-PT", "pt_BR"],
    ["ja", "ja_JP"],
  ])("maps Obsidian language %s to DocWen locale %s", (host, expected) => {
    expect(getDocWenLanguage(resolveObsidianLanguage(host))).toBe(expected);
  });

  it("uses the same Obsidian language for CLI calls", () => {
    getLanguage.mockReturnValue("de");

    expect(getDocWenLanguage("auto")).toBe("de_DE");
    expect(getLanguage).toHaveBeenCalledOnce();
  });

  it("falls back to English for an unsupported Obsidian language", () => {
    expect(resolveObsidianLanguage("ar")).toBe("en");
  });

  it("lets an explicit plugin language override Obsidian", () => {
    getLanguage.mockReturnValue("de");

    expect(resolvePluginLocale("zh-TW")).toBe("zh-TW");
    expect(getDocWenLanguage("pt-BR")).toBe("pt_BR");
    expect(getLanguage).not.toHaveBeenCalled();
  });
});

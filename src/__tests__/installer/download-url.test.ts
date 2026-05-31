import { describe, it, expect, vi, beforeEach } from "vitest";

import type * as types from "../../types";
import { makeActionInputs } from "../helpers";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("@actions/io", () => ({
  mv: vi.fn(),
}));

vi.mock("@actions/tool-cache", () => ({
  find: vi.fn(() => ""),
  downloadTool: vi.fn(async () => "/tmp/raw-download"),
  cacheFile: vi.fn(async () => "/tmp/cached"),
}));

const mockEnsureLocalInstaller = vi.fn();
vi.mock("../../installer/base", () => ({
  ensureLocalInstaller: (...args: any[]) => mockEnsureLocalInstaller(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInputs(
  overrides: Partial<types.IActionInputs> = {},
): types.IActionInputs {
  return makeActionInputs(overrides);
}

function makeOptions(
  overrides: Partial<types.IDynamicOptions> = {},
): types.IDynamicOptions {
  return {
    useBundled: false,
    useMamba: false,
    mambaInInstaller: false,
    condaConfig: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("urlDownloader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("provides()", () => {
    it("returns true when installerUrl is set", async () => {
      const { urlDownloader } = await import("../../installer/download-url");
      const inputs = makeInputs({
        installerUrl: "https://example.com/Miniconda3-latest-Linux-x86_64.sh",
      });
      const result = await urlDownloader.provides(inputs, makeOptions());
      expect(result).toBe(true);
    });

    it("returns true for file:// URLs", async () => {
      const { urlDownloader } = await import("../../installer/download-url");
      const inputs = makeInputs({
        installerUrl: "file:///tmp/my-installer.sh",
      });
      const result = await urlDownloader.provides(inputs, makeOptions());
      expect(result).toBe(true);
    });

    it("returns false when installerUrl is empty", async () => {
      const { urlDownloader } = await import("../../installer/download-url");
      const inputs = makeInputs({ installerUrl: "" });
      const result = await urlDownloader.provides(inputs, makeOptions());
      expect(result).toBe(false);
    });
  });

  describe("installerPath()", () => {
    it("calls ensureLocalInstaller with the URL", async () => {
      mockEnsureLocalInstaller.mockResolvedValue("/tmp/installer.sh");
      const { urlDownloader } = await import("../../installer/download-url");
      const url = "https://example.com/Miniconda3-latest-Linux-x86_64.sh";
      const inputs = makeInputs({ installerUrl: url });
      const result = await urlDownloader.installerPath(inputs, makeOptions());

      expect(mockEnsureLocalInstaller).toHaveBeenCalledWith({ url });
      expect(result.localInstallerPath).toBe("/tmp/installer.sh");
      expect(result.options.useBundled).toBe(false);
    });

    it("preserves other option fields and sets useBundled to false", async () => {
      mockEnsureLocalInstaller.mockResolvedValue("/tmp/installer.sh");
      const { urlDownloader } = await import("../../installer/download-url");
      const inputs = makeInputs({
        installerUrl: "https://example.com/installer.sh",
      });
      const options = makeOptions({ useMamba: true, mambaInInstaller: true });
      const result = await urlDownloader.installerPath(inputs, options);

      expect(result.options.useMamba).toBe(true);
      expect(result.options.mambaInInstaller).toBe(true);
      expect(result.options.useBundled).toBe(false);
    });
  });
});

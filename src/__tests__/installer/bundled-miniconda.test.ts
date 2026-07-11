import { describe, it, expect, vi, beforeEach } from "vitest";

import type * as types from "../../types";
import { makeActionInputs } from "../helpers";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// We need to control the MINICONDA_DIR_PATH constant per-test, so we mock
// the constants module.
let mockMinicondaDirPath = "";
vi.mock("../../constants", () => ({
  get MINICONDA_DIR_PATH() {
    return mockMinicondaDirPath;
  },
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

describe("bundledMinicondaUser", () => {
  beforeEach(() => {
    mockMinicondaDirPath = "";
  });

  describe("provides()", () => {
    it("returns true when all conditions are met (no version inputs, x64, CONDA env set)", async () => {
      mockMinicondaDirPath = "/opt/miniconda";
      const { bundledMinicondaUser } =
        await import("../../installer/bundled-miniconda");
      const inputs = makeInputs({ architecture: "x64" });
      const result = await bundledMinicondaUser.provides(inputs, makeOptions());
      expect(result).toBe(true);
    });

    it("returns false when minicondaVersion is set", async () => {
      mockMinicondaDirPath = "/opt/miniconda";
      const { bundledMinicondaUser } =
        await import("../../installer/bundled-miniconda");
      const inputs = makeInputs({ minicondaVersion: "py39_4.12.0" });
      const result = await bundledMinicondaUser.provides(inputs, makeOptions());
      expect(result).toBe(false);
    });

    it("returns false when miniforgeVariant is set", async () => {
      mockMinicondaDirPath = "/opt/miniconda";
      const { bundledMinicondaUser } =
        await import("../../installer/bundled-miniconda");
      const inputs = makeInputs({ miniforgeVariant: "Mambaforge" });
      const result = await bundledMinicondaUser.provides(inputs, makeOptions());
      expect(result).toBe(false);
    });

    it("returns false when miniforgeVersion is set", async () => {
      mockMinicondaDirPath = "/opt/miniconda";
      const { bundledMinicondaUser } =
        await import("../../installer/bundled-miniconda");
      const inputs = makeInputs({ miniforgeVersion: "4.9.2-5" });
      const result = await bundledMinicondaUser.provides(inputs, makeOptions());
      expect(result).toBe(false);
    });

    it("returns false when architecture is not x64", async () => {
      mockMinicondaDirPath = "/opt/miniconda";
      const { bundledMinicondaUser } =
        await import("../../installer/bundled-miniconda");
      const inputs = makeInputs({ architecture: "arm64" });
      const result = await bundledMinicondaUser.provides(inputs, makeOptions());
      expect(result).toBe(false);
    });

    it("returns false when installerUrl is set", async () => {
      mockMinicondaDirPath = "/opt/miniconda";
      const { bundledMinicondaUser } =
        await import("../../installer/bundled-miniconda");
      const inputs = makeInputs({
        installerUrl: "https://example.com/installer.sh",
      });
      const result = await bundledMinicondaUser.provides(inputs, makeOptions());
      expect(result).toBe(false);
    });

    it("returns false when MINICONDA_DIR_PATH is empty", async () => {
      mockMinicondaDirPath = "";
      const { bundledMinicondaUser } =
        await import("../../installer/bundled-miniconda");
      const inputs = makeInputs({ architecture: "x64" });
      const result = await bundledMinicondaUser.provides(inputs, makeOptions());
      expect(result).toBe(false);
    });
  });

  describe("installerPath()", () => {
    it("returns empty localInstallerPath and sets useBundled to true", async () => {
      mockMinicondaDirPath = "/opt/miniconda";
      const { bundledMinicondaUser } =
        await import("../../installer/bundled-miniconda");
      const options = makeOptions({ useBundled: false });
      const result = await bundledMinicondaUser.installerPath(
        makeInputs(),
        options,
      );
      expect(result.localInstallerPath).toBe("");
      expect(result.options.useBundled).toBe(true);
    });

    it("preserves other option fields", async () => {
      mockMinicondaDirPath = "/opt/miniconda";
      const { bundledMinicondaUser } =
        await import("../../installer/bundled-miniconda");
      const options = makeOptions({
        useMamba: true,
        mambaInInstaller: true,
      });
      const result = await bundledMinicondaUser.installerPath(
        makeInputs(),
        options,
      );
      expect(result.options.useMamba).toBe(true);
      expect(result.options.mambaInInstaller).toBe(true);
      expect(result.options.useBundled).toBe(true);
    });
  });
});

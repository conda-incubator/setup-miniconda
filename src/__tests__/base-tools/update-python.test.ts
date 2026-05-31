import { describe, it, expect, vi, beforeEach } from "vitest";

import type * as types from "../../types";
import { makeActionInputs } from "../helpers";

// Mock @actions/core
vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
}));

// Track isBaseEnv calls so we can control return value per test
const mockIsBaseEnv = vi.fn(() => false);

// Mock utils
vi.mock("../../utils", () => ({
  makeSpec: vi.fn((pkg: string, spec: string) => {
    if (spec.match(/[=<>!\|]/)) {
      return `${pkg}${spec}`;
    }
    return `${pkg}=${spec}`;
  }),
  isBaseEnv: (...args: any[]) => mockIsBaseEnv(...args),
}));

function makeInputs(
  overrides: Partial<types.IActionInputs> = {},
): types.IActionInputs {
  return makeActionInputs({
    ...overrides,
    condaConfig: { channels: "conda-forge", ...overrides.condaConfig },
  });
}

function makeOptions(
  overrides: Partial<types.IDynamicOptions> = {},
): types.IDynamicOptions {
  return {
    useBundled: true,
    useMamba: false,
    mambaInInstaller: false,
    condaConfig: {},
    ...overrides,
  };
}

describe("updatePython", () => {
  let updatePython: types.IToolProvider;

  beforeEach(async () => {
    vi.resetModules();
    mockIsBaseEnv.mockReset();
    const mod = await import("../../base-tools/update-python");
    updatePython = mod.updatePython;
  });

  describe("provides", () => {
    it("returns true when pythonVersion is set and activateEnvironment is base", async () => {
      mockIsBaseEnv.mockReturnValue(true);
      const inputs = makeInputs({
        pythonVersion: "3.11",
        activateEnvironment: "base",
      });
      expect(await updatePython.provides(inputs, makeOptions())).toBe(true);
      expect(mockIsBaseEnv).toHaveBeenCalledWith("base");
    });

    it("returns false when pythonVersion is empty", async () => {
      mockIsBaseEnv.mockReturnValue(true);
      const inputs = makeInputs({
        pythonVersion: "",
        activateEnvironment: "base",
      });
      expect(await updatePython.provides(inputs, makeOptions())).toBe(false);
    });

    it("returns false when activateEnvironment is not base", async () => {
      mockIsBaseEnv.mockReturnValue(false);
      const inputs = makeInputs({
        pythonVersion: "3.11",
        activateEnvironment: "myenv",
      });
      expect(await updatePython.provides(inputs, makeOptions())).toBe(false);
    });

    it("returns false when both pythonVersion is empty and env is not base", async () => {
      mockIsBaseEnv.mockReturnValue(false);
      const inputs = makeInputs();
      expect(await updatePython.provides(inputs, makeOptions())).toBe(false);
    });
  });

  describe("toolPackages", () => {
    it("returns python with version spec", async () => {
      const inputs = makeInputs({ pythonVersion: "3.11" });
      const options = makeOptions();
      const result = await updatePython.toolPackages(inputs, options);
      expect(result.tools).toEqual(["python=3.11"]);
      expect(result.options).toBe(options);
    });

    it("passes through version spec operators", async () => {
      const inputs = makeInputs({ pythonVersion: ">=3.10,<3.12" });
      const result = await updatePython.toolPackages(inputs, makeOptions());
      expect(result.tools).toEqual(["python>=3.10,<3.12"]);
    });
  });

  it("has the correct label", () => {
    expect(updatePython.label).toBe("update python");
  });

  it("does not define postInstall", () => {
    expect(updatePython.postInstall).toBeUndefined();
  });
});

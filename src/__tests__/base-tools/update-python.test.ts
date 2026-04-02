import { describe, it, expect, vi, beforeEach } from "vitest";

import type * as types from "../../types";

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
  return Object.freeze({
    activateEnvironment: "test",
    architecture: "x64",
    condaBuildVersion: "",
    condaConfigFile: "",
    condaVersion: "",
    environmentFile: "",
    installerUrl: "",
    installationDir: "",
    mambaVersion: "",
    minicondaVersion: "",
    miniforgeVariant: "",
    miniforgeVersion: "",
    condaRemoveDefaults: "false",
    pythonVersion: "",
    removeProfiles: "true",
    runInit: "true",
    useMamba: "",
    cleanPatchedEnvironmentFile: "true",
    runPost: "true",
    condaConfig: Object.freeze({
      add_anaconda_token: "",
      add_pip_as_python_dependency: "",
      allow_softlinks: "",
      auto_activate: "false",
      auto_update_conda: "false",
      channel_alias: "",
      channel_priority: "",
      channels: "conda-forge",
      default_activation_env: "",
      show_channel_urls: "",
      use_only_tar_bz2: "",
      always_yes: "true",
      changeps1: "false",
      solver: "",
      pkgs_dirs: "",
    }),
    ...overrides,
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

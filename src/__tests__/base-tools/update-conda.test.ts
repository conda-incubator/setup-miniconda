import { describe, it, expect, vi, beforeEach } from "vitest";

import type * as types from "../../types";

// Mock @actions/core
vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
}));

// Mock utils
vi.mock("../../utils", () => ({
  makeSpec: vi.fn((pkg: string, spec: string) => {
    if (spec.match(/[=<>!\|]/)) {
      return `${pkg}${spec}`;
    }
    return `${pkg}=${spec}`;
  }),
  isBaseEnv: vi.fn(() => false),
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

describe("updateConda", () => {
  let updateConda: types.IToolProvider;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../../base-tools/update-conda");
    updateConda = mod.updateConda;
  });

  describe("provides", () => {
    it("returns true when condaVersion is set", async () => {
      const inputs = makeInputs({ condaVersion: "23.1.0" });
      expect(await updateConda.provides(inputs, makeOptions())).toBe(true);
    });

    it("returns true when auto_update_conda is 'yes'", async () => {
      const inputs = makeInputs({
        condaConfig: {
          ...makeInputs().condaConfig,
          auto_update_conda: "yes",
        },
      });
      expect(await updateConda.provides(inputs, makeOptions())).toBe(true);
    });

    it("returns false when condaVersion is empty and auto_update_conda is not 'yes'", async () => {
      const inputs = makeInputs();
      expect(await updateConda.provides(inputs, makeOptions())).toBe(false);
    });

    it("returns false when auto_update_conda is 'false'", async () => {
      const inputs = makeInputs({
        condaConfig: {
          ...makeInputs().condaConfig,
          auto_update_conda: "false",
        },
      });
      expect(await updateConda.provides(inputs, makeOptions())).toBe(false);
    });
  });

  describe("toolPackages", () => {
    it("returns conda with version spec when condaVersion is set", async () => {
      const inputs = makeInputs({ condaVersion: "23.1.0" });
      const options = makeOptions();
      const result = await updateConda.toolPackages(inputs, options);
      expect(result.tools).toEqual(["conda=23.1.0"]);
      expect(result.options).toBe(options);
    });

    it("returns bare 'conda' when condaVersion is empty", async () => {
      const inputs = makeInputs({
        condaConfig: {
          ...makeInputs().condaConfig,
          auto_update_conda: "yes",
        },
      });
      const options = makeOptions();
      const result = await updateConda.toolPackages(inputs, options);
      expect(result.tools).toEqual(["conda"]);
      expect(result.options).toBe(options);
    });

    it("passes through version spec operators", async () => {
      const inputs = makeInputs({ condaVersion: ">=23.1.0" });
      const result = await updateConda.toolPackages(inputs, makeOptions());
      expect(result.tools).toEqual(["conda>=23.1.0"]);
    });
  });

  it("has the correct label", () => {
    expect(updateConda.label).toBe("update conda");
  });

  it("does not define postInstall", () => {
    expect(updateConda.postInstall).toBeUndefined();
  });
});

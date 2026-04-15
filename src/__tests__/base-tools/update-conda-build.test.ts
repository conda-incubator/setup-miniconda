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

describe("updateCondaBuild", () => {
  let updateCondaBuild: types.IToolProvider;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../../base-tools/update-conda-build");
    updateCondaBuild = mod.updateCondaBuild;
  });

  describe("provides", () => {
    it("returns true when condaBuildVersion is set", async () => {
      const inputs = makeInputs({ condaBuildVersion: "3.27.0" });
      expect(await updateCondaBuild.provides(inputs, makeOptions())).toBe(true);
    });

    it("returns false when condaBuildVersion is empty", async () => {
      const inputs = makeInputs({ condaBuildVersion: "" });
      expect(await updateCondaBuild.provides(inputs, makeOptions())).toBe(
        false,
      );
    });

    it("returns false by default", async () => {
      const inputs = makeInputs();
      expect(await updateCondaBuild.provides(inputs, makeOptions())).toBe(
        false,
      );
    });
  });

  describe("toolPackages", () => {
    it("returns conda-build with version spec", async () => {
      const inputs = makeInputs({ condaBuildVersion: "3.27.0" });
      const options = makeOptions();
      const result = await updateCondaBuild.toolPackages(inputs, options);
      expect(result.tools).toEqual(["conda-build=3.27.0"]);
      expect(result.options).toBe(options);
    });

    it("passes through version spec operators", async () => {
      const inputs = makeInputs({ condaBuildVersion: ">=3.27" });
      const result = await updateCondaBuild.toolPackages(inputs, makeOptions());
      expect(result.tools).toEqual(["conda-build>=3.27"]);
    });
  });

  it("has the correct label", () => {
    expect(updateCondaBuild.label).toBe("update conda-build");
  });

  it("does not define postInstall", () => {
    expect(updateCondaBuild.postInstall).toBeUndefined();
  });
});

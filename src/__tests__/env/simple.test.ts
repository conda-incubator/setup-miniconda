import { describe, it, expect, vi, beforeEach } from "vitest";

import type * as types from "../../types";
import { ensureSimple } from "../../env/simple";

// Mock @actions/core
vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
}));

// Mock utils — keep makeSpec real, mock execute
vi.mock("../../utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils")>();
  return {
    ...actual,
    execute: vi.fn(async () => ""),
  };
});

// Mock conda
vi.mock("../../conda", () => ({
  envCommandFlag: vi.fn(() => ["--name", "test"]),
}));

/**
 * Build minimal IActionInputs for simple env testing
 */
function makeInputs(
  overrides: Partial<{
    pythonVersion: string;
    activateEnvironment: string;
  }> = {},
): types.IActionInputs {
  return Object.freeze({
    activateEnvironment: overrides.activateEnvironment ?? "test",
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
    pythonVersion: overrides.pythonVersion ?? "",
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
  });
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

describe("ensureSimple", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("provides", () => {
    it("returns true when no envSpec is provided", async () => {
      const inputs = makeInputs();
      const options = makeOptions({ envSpec: undefined });
      expect(await ensureSimple.provides(inputs, options)).toBe(true);
    });

    it("returns true when envSpec is an empty object", async () => {
      const inputs = makeInputs();
      const options = makeOptions({ envSpec: {} });
      expect(await ensureSimple.provides(inputs, options)).toBe(true);
    });

    it("returns true when envSpec has empty explicit and empty yaml", async () => {
      const inputs = makeInputs();
      const options = makeOptions({ envSpec: { explicit: "", yaml: {} } });
      expect(await ensureSimple.provides(inputs, options)).toBe(true);
    });

    it("returns false when envSpec.explicit has content", async () => {
      const inputs = makeInputs();
      const options = makeOptions({
        envSpec: { explicit: "@EXPLICIT\nhttps://repo/pkg.tar.bz2" },
      });
      expect(await ensureSimple.provides(inputs, options)).toBe(false);
    });

    it("returns false when envSpec.yaml has keys", async () => {
      const inputs = makeInputs();
      const options = makeOptions({
        envSpec: { yaml: { name: "test", channels: ["conda-forge"] } },
      });
      expect(await ensureSimple.provides(inputs, options)).toBe(false);
    });

    it("returns true when envSpec.yaml is an empty object and explicit is undefined", async () => {
      const inputs = makeInputs();
      const options = makeOptions({ envSpec: { yaml: {} } });
      expect(await ensureSimple.provides(inputs, options)).toBe(true);
    });
  });

  describe("condaArgs", () => {
    it("returns create with env command flag when no pythonVersion", async () => {
      const inputs = makeInputs();
      const options = makeOptions();

      const args = await ensureSimple.condaArgs(inputs, options);
      expect(args).toEqual(["create", "--name", "test"]);
    });

    it("appends python spec when pythonVersion is set", async () => {
      const inputs = makeInputs({ pythonVersion: "3.11" });
      const options = makeOptions();

      const args = await ensureSimple.condaArgs(inputs, options);
      expect(args).toEqual(["create", "--name", "test", "python=3.11"]);
    });

    it("handles pythonVersion with operator syntax (e.g. >=3.9)", async () => {
      const inputs = makeInputs({ pythonVersion: ">=3.9" });
      const options = makeOptions();

      const args = await ensureSimple.condaArgs(inputs, options);
      // makeSpec should detect the operator and not add extra '='
      expect(args).toEqual(["create", "--name", "test", "python>=3.9"]);
    });

    it("logs the spec being added via core.info", async () => {
      const inputs = makeInputs({ pythonVersion: "3.10" });
      const options = makeOptions();

      await ensureSimple.condaArgs(inputs, options);

      const core = await import("@actions/core");
      expect(core.info).toHaveBeenCalledWith(
        expect.stringContaining("python=3.10"),
      );
    });

    it("uses the env command flag from conda module", async () => {
      const inputs = makeInputs();
      const options = makeOptions();

      await ensureSimple.condaArgs(inputs, options);

      const conda = await import("../../conda");
      expect(conda.envCommandFlag).toHaveBeenCalledWith(inputs);
    });
  });

  describe("label", () => {
    it("has a descriptive label", () => {
      expect(ensureSimple.label).toBe("conda create (simple)");
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

import type * as types from "../../types";
import { ensureExplicit } from "../../env/explicit";

// Mock @actions/core
vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
}));

// Mock conda
vi.mock("../../conda", () => ({
  envCommandFlag: vi.fn(() => ["--name", "test"]),
}));

// Mock outputs
vi.mock("../../outputs", () => ({
  setEnvironmentFileOutputs: vi.fn(),
}));

/**
 * Build minimal IActionInputs for explicit env testing
 */
function makeInputs(
  overrides: Partial<{
    pythonVersion: string;
    environmentFile: string;
    activateEnvironment: string;
  }> = {},
): types.IActionInputs {
  return Object.freeze({
    activateEnvironment: overrides.activateEnvironment ?? "test",
    architecture: "x64",
    condaBuildVersion: "",
    condaConfigFile: "",
    condaVersion: "",
    environmentFile: overrides.environmentFile ?? "environment.lock",
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

describe("ensureExplicit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("provides", () => {
    it("returns true when envSpec.explicit has content", async () => {
      const inputs = makeInputs();
      const options = makeOptions({
        envSpec: { explicit: "@EXPLICIT\nhttps://repo/pkg-1.0.tar.bz2" },
      });
      expect(await ensureExplicit.provides(inputs, options)).toBe(true);
    });

    it("returns false when envSpec.explicit is an empty string", async () => {
      const inputs = makeInputs();
      const options = makeOptions({ envSpec: { explicit: "" } });
      expect(await ensureExplicit.provides(inputs, options)).toBe(false);
    });

    it("returns false when envSpec.explicit is undefined", async () => {
      const inputs = makeInputs();
      const options = makeOptions({ envSpec: {} });
      expect(await ensureExplicit.provides(inputs, options)).toBe(false);
    });

    it("returns false when envSpec is undefined", async () => {
      const inputs = makeInputs();
      const options = makeOptions({ envSpec: undefined });
      expect(await ensureExplicit.provides(inputs, options)).toBe(false);
    });
  });

  describe("condaArgs", () => {
    it("returns create command with env flag and --file for explicit spec", async () => {
      const inputs = makeInputs({ environmentFile: "env.lock" });
      const options = makeOptions({
        envSpec: { explicit: "@EXPLICIT\nhttps://repo/pkg-1.0.tar.bz2" },
      });

      const args = await ensureExplicit.condaArgs(inputs, options);
      expect(args).toEqual(["create", "--name", "test", "--file", "env.lock"]);
    });

    it("calls setEnvironmentFileOutputs when explicit spec exists", async () => {
      const explicitContent = "@EXPLICIT\nhttps://repo/pkg-1.0.tar.bz2";
      const inputs = makeInputs({ environmentFile: "env.lock" });
      const options = makeOptions({
        envSpec: { explicit: explicitContent },
      });

      await ensureExplicit.condaArgs(inputs, options);

      const outputs = await import("../../outputs");
      expect(outputs.setEnvironmentFileOutputs).toHaveBeenCalledWith(
        "env.lock",
        explicitContent,
      );
    });

    it("throws when pythonVersion is set", async () => {
      const inputs = makeInputs({ pythonVersion: "3.11" });
      const options = makeOptions({
        envSpec: { explicit: "@EXPLICIT\nhttps://repo/pkg-1.0.tar.bz2" },
      });

      await expect(ensureExplicit.condaArgs(inputs, options)).rejects.toThrow(
        "'python-version: 3.11' is incompatible",
      );
    });

    it("throws with the exact pythonVersion in the error message", async () => {
      const inputs = makeInputs({ pythonVersion: "3.9.7" });
      const options = makeOptions({
        envSpec: { explicit: "@EXPLICIT\nhttps://repo/pkg-1.0.tar.bz2" },
      });

      await expect(ensureExplicit.condaArgs(inputs, options)).rejects.toThrow(
        "3.9.7",
      );
    });
  });

  describe("label", () => {
    it("has a descriptive label", () => {
      expect(ensureExplicit.label).toBe("conda create (from explicit)");
    });
  });

  describe("condaArgs — explicit branch coverage (line 19)", () => {
    it("does not call setEnvironmentFileOutputs when envSpec.explicit is undefined", async () => {
      // pythonVersion is empty so we don't throw on line 13–17,
      // but envSpec.explicit is undefined so the if-block on line 19 is skipped.
      const inputs = makeInputs({
        pythonVersion: "",
        environmentFile: "env.lock",
      });
      const options = makeOptions({
        envSpec: { explicit: undefined },
      });

      const args = await ensureExplicit.condaArgs(inputs, options);

      // Should still return valid create args
      expect(args).toEqual(["create", "--name", "test", "--file", "env.lock"]);

      // setEnvironmentFileOutputs should NOT have been called
      const outputs = await import("../../outputs");
      expect(outputs.setEnvironmentFileOutputs).not.toHaveBeenCalled();
    });
  });
});

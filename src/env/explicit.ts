import * as types from "../types";

/**
 * Install an environment from an explicit file generated `conda list --explicit`
 * or `conda-lock`
 */
export const ensureExplicit: types.IEnvProvider = {
  label: "conda create (from explicit)",
  provides: async (inputs, options) => !!options.envSpec?.explicit?.length,
  condaArgs: async (inputs, options) => {
    if (inputs.pythonVersion) {
      throw Error(
        `'python-version: ${inputs.pythonVersion}' is incompatible with an explicit 'environmentFile`
      );
    }

    return [
      "create",
      "--name",
      inputs.activateEnvironment,
      "--file",
      inputs.environmentFile,
    ];
  },
};

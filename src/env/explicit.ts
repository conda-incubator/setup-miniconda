import * as types from "../types";
import * as conda from "../conda";

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
      ...conda.envCommandFlag(inputs),
      "--file",
      inputs.environmentFile,
    ];
  },
};

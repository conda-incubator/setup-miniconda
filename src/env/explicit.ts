import * as types from "../types";
import * as conda from "../conda";
import * as outputs from "../outputs";

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

    if (options.envSpec?.explicit) {
      outputs.setEnvironmentFileOutputs(
        inputs.environmentFile,
        options.envSpec.explicit
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

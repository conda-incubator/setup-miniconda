import * as types from "../_types";

export const ensureExplicit: types.IEnvProvider = {
  label: "create (explicit)",
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

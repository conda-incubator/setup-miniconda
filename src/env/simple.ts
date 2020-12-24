import * as core from "@actions/core";

import * as types from "../types";
import * as utils from "../utils";

/**
 * Install an environment with `conda create` when no `envSpec` is detected
 *
 * ## Notes
 * Can presently install the given version of `python`.
 *
 * In the future, this may need its own providers of environment patches.
 */
export const ensureSimple: types.IEnvProvider = {
  label: "conda create (simple)",
  provides: async (inputs, options) => {
    return !(
      options.envSpec?.explicit?.length ||
      Object.keys(options.envSpec?.yaml || {}).length
    );
  },
  condaArgs: async (inputs, options) => {
    const args = ["create", "--name", inputs.activateEnvironment];

    if (inputs.pythonVersion) {
      const spec = utils.makeSpec("python", inputs.pythonVersion);
      core.info(`Adding spec: ${spec}`);
      args.push(spec);
    }

    return args;
  },
};

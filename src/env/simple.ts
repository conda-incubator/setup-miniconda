import * as core from "@actions/core";

import * as utils from "../_utils";
import * as types from "../_types";

export const ensureSimple: types.IEnvProvider = {
  label: "create (simple)",
  provides: async (inputs, options) => {
    core.info(JSON.stringify(options));
    return !(
      options.envSpec?.explicit?.length ||
      Object.keys(options.envSpec?.yaml || {}).length
    );
  },
  condaArgs: async (inputs, options) => {
    const args = ["create", "--name", inputs.activateEnvironment];

    if (inputs.pythonVersion) {
      args.push(utils.makeSpec("python", inputs.pythonVersion));
    }

    return args;
  },
};

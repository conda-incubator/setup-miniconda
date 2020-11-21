import * as types from "../_types";
import * as utils from "../_utils";

export const updatePython: types.IToolProvider = {
  label: "Update python",
  provides: async (inputs, options) =>
    !!(inputs.pythonVersion && utils.isBaseEnv(inputs.activateEnvironment)),
  toolPackages: async (inputs, options) => {
    let updates: types.IToolUpdates = {
      tools: [],
      options,
    };

    updates.tools.push(utils.makeSpec("python", inputs.pythonVersion));

    return updates;
  },
};

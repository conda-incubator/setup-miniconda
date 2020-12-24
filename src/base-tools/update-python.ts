import * as types from "../types";
import * as utils from "../utils";

/** Install `python` in the `base` env at a specified version
 *
 * ### Note
 * The env providers have separate mechanisms for updating conda.
 */
export const updatePython: types.IToolProvider = {
  label: "Update python",
  provides: async (inputs, options) =>
    !!(inputs.pythonVersion && utils.isBaseEnv(inputs.activateEnvironment)),
  toolPackages: async (inputs, options) => {
    let updates: types.IToolUpdates = {
      tools: [utils.makeSpec("python", inputs.pythonVersion)],
      options,
    };

    return updates;
  },
};

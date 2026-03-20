/**
 * @module base-tools/update-conda-build
 * Tool provider for installing or pinning `conda-build` in the `base`
 * environment.
 *
 * @category Base Tools
 */

import * as types from "../types";
import * as utils from "../utils";

/** Install `conda-build` in the `base` env at a specified version. */
export const updateCondaBuild: types.IToolProvider = {
  label: "update conda-build",
  provides: async (inputs, _options) => inputs.condaBuildVersion !== "",
  toolPackages: async (inputs, options) => {
    return {
      tools: [utils.makeSpec("conda-build", inputs.condaBuildVersion)],
      options,
    };
  },
};

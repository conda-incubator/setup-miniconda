import * as types from "../types";
import * as utils from "../utils";

/** Install `conda-build` in the `base` env at a specified version */
export const updateCondaBuild: types.IToolProvider = {
  label: "Update conda-build",
  provides: async (inputs, options) => inputs.condaBuildVersion !== "",
  toolPackages: async (inputs, options) => {
    return {
      tools: [utils.makeSpec("conda-build", inputs.condaBuildVersion)],
      options,
    };
  },
};

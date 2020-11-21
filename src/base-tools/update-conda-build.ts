import * as types from "../_types";
import * as utils from "../_utils";

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

import * as types from "../types";
import * as utils from "../utils";

/** Install `conda` in the `base` env at a specified version */
export const updateConda: types.IToolProvider = {
  label: "update conda",
  provides: async (inputs, options) =>
    inputs.condaVersion !== "" ||
    inputs.condaConfig.auto_update_conda === "yes",
  toolPackages: async (inputs, options) => {
    let updates: types.IToolUpdates = {
      tools: [
        inputs.condaVersion !== ""
          ? utils.makeSpec("conda", inputs.condaVersion)
          : "conda",
      ],
      options,
    };

    return updates;
  },
};

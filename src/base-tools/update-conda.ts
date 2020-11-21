import * as types from "../_types";
import * as utils from "../_utils";

export const updateConda: types.IToolProvider = {
  label: "Update conda",
  provides: async (inputs, options) =>
    inputs.condaVersion !== "" ||
    inputs.condaConfig.auto_update_conda === "yes",
  toolPackages: async (inputs, options) => {
    let updates: types.IToolUpdates = {
      tools: [],
      options,
    };

    if (inputs.condaVersion !== "") {
      updates.tools.push(utils.makeSpec("conda", inputs.condaVersion));
    } else if (inputs.condaConfig.auto_update_conda === "yes") {
      updates.tools.push(`conda`);
    }

    return updates;
  },
};

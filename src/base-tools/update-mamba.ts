import * as fs from "fs";

import * as core from "@actions/core";

import * as constants from "../_constants";
import * as types from "../_types";
import * as utils from "../_utils";

import * as conda from "../conda";

export const updateMamba: types.IToolProvider = {
  label: "Update mamba",
  provides: async (inputs, options) => inputs.mambaVersion !== "",
  toolPackages: async (inputs, options) => {
    core.warning(
      `Mamba support is still experimental and can result in differently solved environments!`
    );
    return {
      tools: [utils.makeSpec("mamba", inputs.mambaVersion)],
      options,
    };
  },
  postInstall: async (inputs, options) => {
    if (constants.IS_WINDOWS) {
      // add bat-less forwarder for bash users on Windows
      const mambaBat = conda.condaExecutable(options).replace("\\", "/");
      const contents = `bash.exe -c "exec '${mambaBat}' $*"`;
      fs.writeFileSync(mambaBat.slice(0, -4), contents);
    }
  },
};

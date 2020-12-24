import * as fs from "fs";

import * as core from "@actions/core";

import * as constants from "../constants";
import * as types from "../types";
import * as utils from "../utils";

import * as conda from "../conda";

/** Install `mamba` in the `base` env at a specified version */
export const updateMamba: types.IToolProvider = {
  label: "update mamba",
  provides: async (inputs, options) => inputs.mambaVersion !== "",
  toolPackages: async (inputs, options) => {
    core.warning(
      `Mamba support is still experimental and can result in differently solved environments!`
    );
    return {
      tools: [utils.makeSpec("mamba", inputs.mambaVersion)],
      options: { ...options, useMamba: true },
    };
  },
  postInstall: async (inputs, options) => {
    if (!constants.IS_WINDOWS) {
      return;
    }
    core.info("Creating bash wrapper for `mamba`...");
    // Add bat-less forwarder for bash users on Windows
    const mambaBat = conda.condaExecutable(options).replace("\\", "/");

    const contents = `bash.exe -c "exec '${mambaBat}' $*"`;
    fs.writeFileSync(mambaBat.slice(0, -4), contents);
    core.info(`... wrote ${mambaBat}:\n${contents}`);
  },
};

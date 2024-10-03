import * as fs from "fs";
import * as path from "path";

import * as core from "@actions/core";

import * as constants from "../constants";
import * as types from "../types";
import * as utils from "../utils";

import * as conda from "../conda";

/** Install `mamba` in the `base` env at a specified version */
export const updateMamba: types.IToolProvider = {
  label: "update mamba",
  provides: async (inputs, options) =>
    inputs.mambaVersion !== "" || options.mambaInInstaller,
  toolPackages: async (inputs, options) => {
    return {
      tools:
        inputs.mambaVersion !== ""
          ? [utils.makeSpec("mamba", inputs.mambaVersion)]
          : [],
      options: { ...options, useMamba: true },
    };
  },
  postInstall: async (inputs, options) => {
    let mambaExec = conda.condaExecutable(options);
    const parentDirName = path.basename(path.dirname(mambaExec));
    if (parentDirName !== "condabin") {
      const condabinLocation = path.join(
        conda.condaBasePath(options),
        "condabin",
        path.basename(mambaExec),
      );
      if (!fs.existsSync(condabinLocation)) {
        core.info(`Copying ${mambaExec} to ${condabinLocation}...`);
        fs.copyFileSync(mambaExec, condabinLocation);
      }
      mambaExec = condabinLocation;
    }
    if (!constants.IS_WINDOWS) {
      core.info("`mamba` is already executable");
      return;
    }
    mambaExec = mambaExec.replace(/\\/g, "/");
    core.info(`Creating bash wrapper for 'mamba'...`);
    // Add bat-less forwarder for bash users on Windows
    const contents = `bash.exe -c "source '${path.join(
      conda.condaBasePath(options),
      "etc",
      "profile.d",
      "conda.sh",
    )}' && exec '${mambaExec}' $*" || exit 1`;
    fs.writeFileSync(mambaExec.slice(0, -4), contents);
    if (mambaExec.slice(-4) !== ".bat") {
      fs.writeFileSync(mambaExec.slice(0, -4) + ".bat", contents);
    }
    core.info(`... wrote ${mambaExec.slice(0, -4)}:\n${contents}`);
  },
};

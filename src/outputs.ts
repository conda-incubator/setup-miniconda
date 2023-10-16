/**
 * Modify environment variables and action outputs.
 */
import * as path from "path";

import * as core from "@actions/core";

import * as types from "./types";
import * as constants from "./constants";
import * as conda from "./conda";
import * as utils from "./utils";

/**
 * Add Conda executable to PATH environment variable
 */
export async function setPathVariables(
  options: types.IDynamicOptions,
): Promise<void> {
  const condaBin: string = path.join(conda.condaBasePath(options), "condabin");
  const condaPath: string = conda.condaBasePath(options);
  core.info(`Add "${condaBin}" to PATH`);
  core.addPath(condaBin);
  if (!options.useBundled) {
    core.info(`Set 'CONDA="${condaPath}"'`);
    core.exportVariable("CONDA", condaPath);
  }
}

/**
 * Ensure the conda cache path is available as an environment variable
 */
export async function setCacheVariable(options: types.IDynamicOptions) {
  const folder = utils.cacheFolder();
  await conda.condaCommand(["config", "--add", "pkgs_dirs", folder], options);
  core.exportVariable(constants.ENV_VAR_CONDA_PKGS, folder);
}

/**
 * Export the effective environment-file path
 */
export function setEnvironmentFileOutputs(
  envFile: string,
  envContent: string,
  patched = false,
): void {
  core.setOutput(constants.OUTPUT_ENV_FILE_PATH, path.resolve(envFile));
  core.setOutput(constants.OUTPUT_ENV_FILE_CONTENT, envContent);
  core.setOutput(
    constants.OUTPUT_ENV_FILE_WAS_PATCHED,
    patched ? "true" : "false",
  );
  core.saveState(constants.OUTPUT_ENV_FILE_WAS_PATCHED, patched);
}

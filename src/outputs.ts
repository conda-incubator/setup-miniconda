/**
 * Modify environment variables and action outputs.
 */
import * as path from "path";

import * as core from "@actions/core";

import * as types from "./types";
import * as constants from "./constants";
import * as conda from "./conda";

/**
 * Add Conda executable to PATH environment variable
 */
export async function setPathVariables(
  inputs: types.IActionInputs,
  options: types.IDynamicOptions,
): Promise<void> {
  const condaBin: string = path.join(
    conda.condaBasePath(inputs, options),
    "condabin",
  );
  const condaPath: string = conda.condaBasePath(inputs, options);
  core.info(`Add "${condaBin}" to PATH`);
  core.addPath(condaBin);
  if (!options.useBundled) {
    core.info(`Set 'CONDA="${condaPath}"'`);
    core.exportVariable("CONDA", condaPath);
  }
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

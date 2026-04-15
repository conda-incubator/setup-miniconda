/**
 * @module outputs
 * Modify environment variables and action outputs.
 *
 * @category Core
 */
import * as path from "path";

import * as core from "@actions/core";

import * as types from "./types";
import * as constants from "./constants";
import * as conda from "./conda";

/**
 * Add the conda `condabin` directory to PATH and export the CONDA env variable.
 *
 * @param inputs - The parsed action inputs.
 * @param options - The current dynamic options.
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
  core.info(`Set 'CONDA="${condaPath}"'`);
  core.exportVariable("CONDA", condaPath);
}

/**
 * Set the action outputs and state for the effective environment-file.
 *
 * @param envFile - The path to the environment file used.
 * @param envContent - The text content of the environment file.
 * @param patched - Whether the environment file was patched from the original.
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

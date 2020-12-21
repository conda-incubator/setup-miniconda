import * as path from "path";

import * as core from "@actions/core";

import * as types from "./types";
import * as conda from "./conda";

/**
 * Add Conda executable to PATH
 */
export async function setVariables(
  options: types.IDynamicOptions
): Promise<void> {
  // Set environment variables
  const condaBin: string = path.join(conda.condaBasePath(options), "condabin");
  const condaVar: string = conda.condaBasePath(options);
  core.info(`Add "${condaBin}" to PATH`);
  core.addPath(condaBin);
  if (!options.useBundled) {
    core.info(`Set 'CONDA="${condaVar}"'`);
    core.exportVariable("CONDA", condaVar);
  }
}

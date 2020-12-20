import * as path from "path";

import * as core from "@actions/core";

import { minicondaPath } from "./conda";
import * as types from "./types";

/**
 * Add Conda executable to PATH
 */
export async function setVariables(
  options: types.IDynamicOptions
): Promise<void> {
  // Set environment variables
  const condaBin: string = path.join(minicondaPath(options), "condabin");
  const conda: string = minicondaPath(options);
  core.info(`Add "${condaBin}" to PATH`);
  core.addPath(condaBin);
  if (!options.useBundled) {
    core.info(`Set 'CONDA="${conda}"'`);
    core.exportVariable("CONDA", conda);
  }
}

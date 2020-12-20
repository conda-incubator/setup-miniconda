import { condaCommand } from "./conda";

import * as types from "./types";

/**
 * Setup python test environment
 */
export async function setupPython(
  inputs: types.IActionInputs,
  options: types.IDynamicOptions
): Promise<void> {
  return await condaCommand(
    [
      "install",
      "--name",
      inputs.activateEnvironment,
      `python=${inputs.pythonVersion}`,
    ],
    options
  );
}

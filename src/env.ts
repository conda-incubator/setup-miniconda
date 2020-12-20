import * as fs from "fs";
import * as path from "path";

import * as core from "@actions/core";

import { minicondaPath, condaCommand } from "./conda";
import * as types from "./types";

/**
 * Check if a given conda environment exists
 */
export function environmentExists(
  inputs: types.IActionInputs,
  options: types.IDynamicOptions
): boolean {
  const condaMetaPath: string = path.join(
    minicondaPath(options),
    "envs",
    inputs.activateEnvironment,
    "conda-meta"
  );
  return fs.existsSync(condaMetaPath);
}

/**
 * Create test environment
 */
export async function createTestEnvironment(
  inputs: types.IActionInputs,
  options: types.IDynamicOptions
): Promise<void> {
  if (
    inputs.activateEnvironment !== "root" &&
    inputs.activateEnvironment !== "base" &&
    inputs.activateEnvironment !== ""
  ) {
    if (!environmentExists(inputs, options)) {
      core.startGroup("Create test environment...");
      await condaCommand(
        ["create", "--name", inputs.activateEnvironment],
        options
      );
      core.endGroup();
    }
  } else {
    throw new Error(
      'To activate "base" environment use the "auto-activate-base" action input!'
    );
  }
}

import * as fs from "fs";
import * as path from "path";

import * as core from "@actions/core";

import { minicondaPath, condaCommand } from "./conda";

/**
 * Check if a given conda environment exists
 */
export function environmentExists(name: string, useBundled: boolean): boolean {
  const condaMetaPath: string = path.join(
    minicondaPath(useBundled),
    "envs",
    name,
    "conda-meta"
  );
  return fs.existsSync(condaMetaPath);
}

/**
 * Create test environment
 */
export async function createTestEnvironment(
  activateEnvironment: string,
  useBundled: boolean,
  useMamba: boolean
): Promise<void> {
  if (
    activateEnvironment !== "root" &&
    activateEnvironment !== "base" &&
    activateEnvironment !== ""
  ) {
    if (!environmentExists(activateEnvironment, useBundled)) {
      core.startGroup("Create test environment...");
      await condaCommand(
        ["create", "--name", activateEnvironment],
        useBundled,
        useMamba
      );
      core.endGroup();
    }
  } else {
    throw new Error(
      'To activate "base" environment use the "auto-activate-base" action input!'
    );
  }
}

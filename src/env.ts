import * as fs from "fs";
import * as path from "path";

import * as core from "@actions/core";

import { minicondaPath, condaCommand } from "./conda";
import { Result } from "./types";

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
): Promise<Result> {
  let result: Result;
  if (
    activateEnvironment !== "root" &&
    activateEnvironment !== "base" &&
    activateEnvironment !== ""
  ) {
    if (!environmentExists(activateEnvironment, useBundled)) {
      core.startGroup("Create test environment...");
      result = await condaCommand(
        ["create", "--name", activateEnvironment],
        useBundled,
        useMamba
      );
      if (!result.ok) return result;
      core.endGroup();
    }
  } else {
    return {
      ok: false,
      error: new Error(
        'To activate "base" environment use the "auto-activate-base" action input!'
      ),
    };
  }
  return { ok: true, data: "ok" };
}

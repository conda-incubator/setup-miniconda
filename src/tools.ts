import { condaCommand } from "./conda";

/**
 * Setup python test environment
 */
export async function setupPython(
  activateEnvironment: string,
  pythonVersion: string,
  useBundled: boolean,
  useMamba: boolean
): Promise<void> {
  return await condaCommand(
    ["install", "--name", activateEnvironment, `python=${pythonVersion}`],
    useBundled,
    useMamba
  );
}

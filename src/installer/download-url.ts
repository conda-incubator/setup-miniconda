import { ensureLocalInstaller } from "./base";
import * as types from "../types";

/**
 * @param url A URL for a file with the CLI of a `constructor`-built artifact
 */
export async function downloadCustomInstaller(
  inputs: types.IActionInputs
): Promise<string> {
  return await ensureLocalInstaller({ url: inputs.installerUrl });
}

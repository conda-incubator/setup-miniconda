import { ensureLocalInstaller } from "./base";

/**
 * @param url A URL for a file with the CLI of a `constructor`-built artifact
 */
export async function downloadCustomInstaller(url: string): Promise<string> {
  return await ensureLocalInstaller({ url });
}

import { Result } from "../types";
import { ensureLocalInstaller } from "./base";

/**
 * @param url A URL for a file with the CLI of a `constructor`-built artifact
 */
export async function downloadCustomInstaller(url: string): Promise<Result> {
  try {
    const downloadPath = await ensureLocalInstaller({ url });
    return { ok: true, data: downloadPath };
  } catch (error) {
    return { ok: false, error };
  }
}

import * as os from "os";
import * as path from "path";

/** Where to put files. Should eventually be configurable */
const CONDA_CACHE_FOLDER = "conda_pkgs_dir";

/** the environment variable exported */
export const ENV_VAR_CONDA_PKGS = "CONDA_PKGS_DIR";

export function cacheFolder() {
  return path.join(os.homedir(), CONDA_CACHE_FOLDER);
}

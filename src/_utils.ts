import * as os from "os";
import * as path from "path";
import * as constants from "./_constants";
import * as core from "@actions/core";
import * as stream from "stream";
import * as exec from "@actions/exec";

export function isBaseEnv(envName: string) {
  return constants.BASE_ENV_NAMES.includes(envName);
}

/**
 * Get the cache folder
 *
 * TODO: this should probably be configurable
 */
export function cacheFolder() {
  return path.join(os.homedir(), constants.CONDA_CACHE_FOLDER);
}

/**
 * create a spec string. Generally favors '=' unless specified more tightly
 */
export function makeSpec(pkg: string, spec: string) {
  if (spec.match(/=<>!\|/)) {
    return `${pkg}${spec}`;
  } else {
    return `${pkg}=${spec}`;
  }
}

/**
 * Run exec.exec with error handling
 */
export async function execute(command: string[]): Promise<void> {
  let options: exec.ExecOptions = {
    errStream: new stream.Writable(),
    listeners: {
      stdout: (data: Buffer) => {
        const stringData = data.toString();
        for (const forced_error of constants.FORCED_ERRORS) {
          if (stringData.includes(forced_error)) {
            throw new Error(`"${command}" failed with "${forced_error}"`);
          }
        }
        return data;
      },
      stderr: (data: Buffer) => {
        const stringData = data.toString();
        for (const ignore of constants.IGNORED_WARNINGS) {
          if (stringData.includes(ignore)) {
            return;
          }
        }
        core.warning(stringData);
      },
    },
  };

  const rc = await exec.exec(command[0], command.slice(1), options);
  if (rc !== 0) {
    throw Error(`${command[0]} exited with error code ${rc}`);
  }
}

import * as os from "os";
import * as path from "path";
import * as stream from "stream";

import * as exec from "@actions/exec";
import * as core from "@actions/core";
import * as constants from "./constants";

/**
 * Split a comma-separated string into trimmed, non-empty entries.
 */
/**
 * Split a comma-separated string into trimmed, non-empty entries.
 *
 * @param value - Comma-separated string to split.
 * @returns An array of trimmed, non-empty string entries.
 */
export function parseCommaSeparated(value: string): string[] {
  return value
    .trim()
    .split(/,/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** The folder to use as the conda package cache */
/**
 * Parse the configured `pkgs_dirs` into a list of directories, falling
 * back to a default under the user home if none are configured.
 *
 * @param configuredPkgsDirs - Comma-separated string of package directory paths.
 * @returns An array of resolved package directory paths.
 */
export function parsePkgsDirs(configuredPkgsDirs: string) {
  const pkgsDirs = parseCommaSeparated(configuredPkgsDirs);

  // Falling back to our default package directories value
  if (pkgsDirs.length) {
    return pkgsDirs;
  } else {
    return [path.join(os.homedir(), constants.DEFAULT_PKGS_DIR)];
  }
}

/**
 * Whether the given env is a conda `base` env
 */
export function isBaseEnv(envName: string) {
  return constants.BASE_ENV_NAMES.includes(envName);
}

/**
 * Run exec.exec with error handling
 */
export async function execute(
  command: string[],
  env = {},
  captureOutput: boolean = false,
): Promise<void | string> {
  let capturedOutput = "";

  const options: exec.ExecOptions = {
    errStream: new stream.Writable(),
    listeners: {
      stdout: (data: Buffer) => {
        const stringData = data.toString();
        if (captureOutput) {
          capturedOutput += stringData;
        }
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
    env: { ...process.env, ...env },
  };

  const exe = command[0];
  if (!exe) {
    throw new Error("execute() called with empty command array");
  }
  const rc = await exec.exec(exe, command.slice(1), options);
  if (rc !== 0) {
    throw new Error(`${exe} return error code ${rc}`);
  }
  if (captureOutput) {
    return capturedOutput;
  }
}

/**
 * Create a conda version spec string.
 *
 * ### Note
 * Generally favors '=' unless specified more tightly.
 */
export function makeSpec(pkg: string, spec: string) {
  if (spec.match(/[=<>!\|]/)) {
    return `${pkg}${spec}`;
  } else {
    return `${pkg}=${spec}`;
  }
}

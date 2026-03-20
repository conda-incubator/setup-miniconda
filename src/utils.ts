import * as os from "os";
import * as path from "path";
import * as stream from "stream";

import * as exec from "@actions/exec";
import * as core from "@actions/core";
import * as constants from "./constants";

/**
 * Parse the configured `pkgs_dirs` into a list of directories, falling
 * back to a default under the user home if none are configured.
 *
 * @param configuredPkgsDirs - Comma-separated string of package directory paths.
 * @returns An array of resolved package directory paths.
 */
export function parsePkgsDirs(configuredPkgsDirs: string) {
  // Package directories are also comma-separated, like channels
  // We're also setting the appropriate conda config env var, to be safe
  let pkgsDirs = configuredPkgsDirs
    .trim()
    .split(/,/)
    .map((p) => p.trim())
    .filter((p) => p.length);

  // Falling back to our default package directories value
  if (pkgsDirs.length) {
    return pkgsDirs;
  } else {
    return [path.join(os.homedir(), constants.DEFAULT_PKGS_DIR)];
  }
}

/**
 * Check whether the given environment name refers to a conda `base` environment.
 *
 * @param envName - The environment name to check.
 * @returns `true` if the name is a known base environment alias.
 */
export function isBaseEnv(envName: string) {
  return constants.BASE_ENV_NAMES.includes(envName);
}

/**
 * Execute a shell command with custom environment variables, stdout/stderr
 * filtering for known warnings and forced errors, and optional output capture.
 *
 * @param command - The command and arguments to execute.
 * @param env - Additional environment variables to merge with `process.env`.
 * @param captureOutput - When `true`, returns stdout as a string instead of void.
 * @returns The captured stdout string if `captureOutput` is `true`, otherwise void.
 */
export async function execute(
  command: string[],
  env = {},
  captureOutput: boolean = false,
): Promise<void | string> {
  let capturedOutput = "";

  let options: exec.ExecOptions = {
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

  const rc = await exec.exec(command[0], command.slice(1), options);
  if (rc !== 0) {
    throw new Error(`${command[0]} return error code ${rc}`);
  }
  if (captureOutput) {
    return capturedOutput;
  }
}

/**
 * Create a conda version spec string.
 *
 * ### Note
 * Generally favors `=` unless the spec already contains an operator.
 *
 * @param pkg - The package name.
 * @param spec - The version spec, optionally prefixed with an operator.
 * @returns A formatted `pkg=spec` or `pkg<operator>spec` string.
 */
export function makeSpec(pkg: string, spec: string) {
  if (spec.match(/[=<>!\|]/)) {
    return `${pkg}${spec}`;
  } else {
    return `${pkg}=${spec}`;
  }
}

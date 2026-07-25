/**
 * @module utils
 * Low-level helpers for running shell commands, building conda package
 * specs, and working with package directories.
 *
 * @category Core
 */

import * as os from "os";
import * as path from "path";
import * as stream from "stream";

import * as exec from "@actions/exec";
import * as core from "@actions/core";
import * as constants from "./constants";

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
 * @throws {Error} If the command exits with a non-zero return code.
 * @throws {Error} If stdout contains any substring in {@link constants.FORCED_ERRORS}.
 *
 * @example
 * ```ts
 * // Run conda info
 * await execute(["conda", "info", "--json"]);
 *
 * // Capture output
 * const output = await execute(["conda", "info", "--json"], {}, true);
 * ```
 */
export async function execute(
  command: string[],
  env = {},
  captureOutput: boolean = false,
): Promise<void | string> {
  let capturedOutput = "";
  // First detected FORCED_ERROR marker. Thrown after exec resolves rather than
  // from inside the stream listener, where an exception could escape as an
  // uncaught error and bypass the controlled-failure path (#116 review).
  let forcedError = "";
  // Keep a bounded tail of recent output so a failure can surface *why* the
  // underlying conda/mamba command failed (see #116).
  const MAX_OUTPUT_TAIL = 4000;
  let outputTail = "";
  const appendTail = (tail: string, chunk: string): string => {
    // If a single chunk already exceeds the cap, keep only its tail to avoid
    // building a large `tail + chunk` intermediate string.
    if (chunk.length >= MAX_OUTPUT_TAIL) {
      return chunk.slice(-MAX_OUTPUT_TAIL);
    }
    const next = tail + chunk;
    return next.length > MAX_OUTPUT_TAIL ? next.slice(-MAX_OUTPUT_TAIL) : next;
  };

  const options: exec.ExecOptions = {
    errStream: new stream.Writable(),
    listeners: {
      stdout: (data: Buffer) => {
        const stringData = data.toString();
        if (captureOutput) {
          capturedOutput += stringData;
        }
        outputTail = appendTail(outputTail, stringData);
        if (!forcedError) {
          for (const forced_error of constants.FORCED_ERRORS) {
            if (stringData.includes(forced_error)) {
              forcedError = forced_error;
              break;
            }
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
        // Only keep non-ignored stderr in the failure tail so suppressed,
        // known-spurious warnings don't pollute the error message.
        outputTail = appendTail(outputTail, stringData);
        core.warning(stringData);
      },
    },
    env: { ...process.env, ...env },
    // Handle the exit code ourselves so we can attach a descriptive message
    // instead of @actions/exec's generic "failed with exit code N" (#116).
    ignoreReturnCode: true,
  };

  const exe = command[0];
  if (!exe) {
    throw new Error("execute() called with empty command array");
  }
  const rc: number | null = await exec.exec(exe, command.slice(1), options);
  // Display-only: quote args containing whitespace or quotes so the failed
  // command reads clearly and stays balanced. We select a quote style rather
  // than escaping (this string is never executed; args go to exec separately),
  // which keeps embedded quotes and Windows paths (C:\...) intact and avoids
  // the incomplete-escaping pattern.
  const quoteArg = (arg: string): string => {
    if (!/[\s"']/.test(arg)) {
      return arg;
    }
    // Choose a quote style that needs no escaping, so backslashes (Windows
    // paths) stay intact and there is no incomplete-escaping pattern.
    if (!arg.includes('"')) {
      return `"${arg}"`;
    }
    if (!arg.includes("'")) {
      return `'${arg}'`;
    }
    // Rare: the arg contains both quote types. JSON.stringify keeps it balanced
    // (a complete encoder, not an incomplete-escaping sink).
    return JSON.stringify(arg);
  };
  const displayCommand = command.map(quoteArg).join(" ");
  if (forcedError) {
    throw new Error(`${displayCommand} failed with "${forcedError}"`);
  }
  if (rc !== 0) {
    const oomHint =
      rc === null
        ? " A null exit code means the process was terminated by a signal, " +
          "most commonly the OS out-of-memory killer while solving the " +
          "environment. Consider using the libmamba solver, reducing the " +
          "environment size, or a runner with more memory."
        : "";
    // Trim trailing whitespace/newlines only, so leading indentation of error
    // blocks in the captured output is preserved.
    const tail = outputTail.trimEnd();
    throw new Error(
      `${displayCommand} failed with exit code ${rc}.${oomHint}` +
        (tail ? `\n\n--- last output before failure ---\n${tail}` : ""),
    );
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
 *
 * @example
 * ```ts
 * makeSpec("python", "3.11");       // "python=3.11"
 * makeSpec("conda", ">=23.1");      // "conda>=23.1"
 * makeSpec("numpy", "1.24|1.25");   // "numpy1.24|1.25"
 * ```
 */
export function makeSpec(pkg: string, spec: string) {
  if (spec.match(/[=<>!\|]/)) {
    return `${pkg}${spec}`;
  } else {
    return `${pkg}=${spec}`;
  }
}

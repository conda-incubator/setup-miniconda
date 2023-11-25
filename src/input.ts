import * as path from "path";
import * as core from "@actions/core";
import * as semver from "semver";
import * as constants from "./constants";
import * as types from "./types";

/**
 * A validator for action inputs: any findings will stop the action.
 *
 * ### Note
 * Should return `false` if there are no findings,
 * or a string providing an as-informative-as-possible message.
 *
 * All messages should be provided, so no errors should be thrown (e.g. from
 * network calls or subprocesses).
 */
interface IRule {
  (
    inputs: types.IActionInputs,
    condaConfig: types.ICondaConfig,
  ): string | false;
}

const urlExt = (url: string) => path.posix.extname(new URL(url).pathname);

/**
 * The currrent known set of input validation rules.
 *
 * ### Note
 * Adding a new validation rule:
 * - implement IRule
 * - add it here
 * - add a test!
 *
 * When the #107 changes have been completed, some of these rules can be moved to
 * specific providers, but still checked up-front, with the name and type of provider
 * for additional context.
 */
const RULES: IRule[] = [
  (i, c) =>
    !!(i.condaVersion && c.auto_update_conda === "true") &&
    `only one of 'conda-version: ${i.condaVersion}' or 'auto-update-conda: true' may be provided`,
  (i) =>
    !!(i.pythonVersion && !i.activateEnvironment) &&
    `'python-version: ${i.pythonVersion}' requires 'activate-environment: true'`,
  (i) =>
    !!(i.minicondaVersion && i.miniforgeVersion) &&
    `only one of 'miniconda-version: ${i.minicondaVersion}' or 'miniforge-version: ${i.miniforgeVersion}' may be provided`,
  (i) =>
    !!(i.installerUrl && i.minicondaVersion) &&
    `only one of 'installer-url: ${i.installerUrl}' or 'miniconda-version: ${i.minicondaVersion}' may be provided`,
  (i) =>
    !!(i.installerUrl && i.miniforgeVersion) &&
    `only one of 'installer-url: ${i.installerUrl}' or 'miniforge-version: ${i.miniforgeVersion}' may be provided`,
  (i) =>
    !!(
      i.installerUrl &&
      !constants.KNOWN_EXTENSIONS.includes(urlExt(i.installerUrl))
    ) &&
    `'installer-url' extension '${urlExt(i.installerUrl)}' must be one of: ${
      constants.KNOWN_EXTENSIONS
    }`,
  (i) =>
    !!(!i.minicondaVersion && i.architecture !== "x64") &&
    `'architecture: ${i.architecture}' requires "miniconda-version"`,
  (
    i, // Miniconda x86 is only published for Windows lately (last Linux was 2019, last MacOS 2015)
  ) =>
    !!(i.architecture === "x86" && !constants.IS_WINDOWS) &&
    `'architecture: ${i.architecture}' is only available for recent versions on Windows`,
  (
    i, // We only support miniconda 4.6 or later (`conda init` and /condabin were added here, which we need)
  ) =>
    !!(
      !["latest", ""].includes(i.minicondaVersion) &&
      semver.lt(i.minicondaVersion, "4.6.0")
    ) &&
    `'architecture: ${i.architecture}' requires "miniconda-version">=4.6 but you chose '${i.minicondaVersion}'`,
];

/*
 * Parse, validate, and normalize string-ish inputs from a workflow action's `with`
 */
export async function parseInputs(): Promise<types.IActionInputs> {
  const inputs: types.IActionInputs = Object.freeze({
    activateEnvironment: core.getInput("activate-environment"),
    architecture: core.getInput("architecture"),
    condaBuildVersion: core.getInput("conda-build-version"),
    condaConfigFile: core.getInput("condarc-file"),
    condaVersion: core.getInput("conda-version"),
    environmentFile: core.getInput("environment-file"),
    installerUrl: core.getInput("installer-url"),
    mambaVersion: core.getInput("mamba-version"),
    useMamba: core.getInput("use-mamba"),
    minicondaVersion: core.getInput("miniconda-version"),
    miniforgeVariant: core.getInput("miniforge-variant"),
    miniforgeVersion: core.getInput("miniforge-version"),
    pythonVersion: core.getInput("python-version"),
    removeProfiles: core.getInput("remove-profiles"),
    condaConfig: Object.freeze({
      add_anaconda_token: core.getInput("add-anaconda-token"),
      add_pip_as_python_dependency: core.getInput(
        "add-pip-as-python-dependency",
      ),
      allow_softlinks: core.getInput("allow-softlinks"),
      auto_activate_base: core.getInput("auto-activate-base"),
      auto_update_conda: core.getInput("auto-update-conda"),
      channel_alias: core.getInput("channel-alias"),
      channel_priority: core.getInput("channel-priority"),
      channels: core.getInput("channels"),
      show_channel_urls: core.getInput("show-channel-urls"),
      use_only_tar_bz2: core.getInput("use-only-tar-bz2"),
      solver: core.getInput("conda-solver"),
      // These are always set to avoid terminal issues
      always_yes: "true",
      changeps1: "false",
    }),
    cleanPatchedEnvironmentFile: core.getInput(
      "clean-patched-environment-file",
    ),
    runPost: core.getInput("run-post"),
  });
  // Export input var to be able to skip `post-if` using the env context
  core.exportVariable("INPUT_RUN_POST", inputs.runPost);

  const errors = RULES.reduce((errors, rule) => {
    const msg = rule(inputs, inputs.condaConfig);
    if (msg) {
      core.error(msg);
      errors.push(msg);
    }
    return errors;
  }, [] as string[]);

  if (errors.length) {
    throw Error(`${errors.length} errors found in action inputs`);
  }

  return inputs;
}

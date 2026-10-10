/**
 * @module env/yaml
 * Create or update a conda environment from a YAML `environment.yml` file,
 * optionally patching dependencies (for example, pinning `python-version`).
 *
 * @category Environments
 */

import * as fs from "fs";
import * as path from "path";

import * as yaml from "js-yaml";

import * as core from "@actions/core";
import * as types from "../types";
import * as constants from "../constants";
import * as conda from "../conda";
import * as utils from "../utils";
import * as redact from "../redact";
import * as outputs from "../outputs";

/**
 * Describes whether and how a YAML env should be patched to add a specific package
 *
 * ## Notes
 * This is only applied for `python` at this point, but could in turn be made
 * configurable for other complex options, e.g. GPU, etc.
 */
interface IYAMLEnvPatchProvider {
  /** The human-readable name shown in logs. */
  label: string;
  /** Whether this patch should be applied for the given `inputs` and `options`. */
  provides: (
    inputs: types.IActionInputs,
    options: types.IDynamicOptions,
  ) => boolean;
  /** A regular expression for detecting whether a spec will need to be replaced. */
  specMatch: RegExp;
  /** The new conda version spec that should be added/patched into the environment. */
  spec: (inputs: types.IActionInputs, options: types.IDynamicOptions) => string;
}

/**
 * The current known providers of patches to `environment.yml`
 *
 * ### Note
 * To add a new patch
 * - implement IEnvPatchProvider and add it here
 * - probably add inputs to `../../action.yaml`
 * - add any new RULEs in ../input.ts, for example if certain inputs make no sense
 * - add a test!
 */
const PATCH_PROVIDERS: IYAMLEnvPatchProvider[] = [
  {
    label: "python",
    provides: (inputs) => !!inputs.pythonVersion,
    specMatch: constants.PYTHON_SPEC,
    spec: ({ pythonVersion }) => utils.makeSpec("python", pythonVersion),
  },
];

/**
 * Install an environment from an `env` file as accepted by `conda env update`.
 *
 * ### Note
 * May apply patches to ensure consistency with `inputs`.
 * If patched, a temporary file will be created with the patches.
 */
export const ensureYaml: types.IEnvProvider = {
  label: "conda env update",
  provides: async (_inputs, options) =>
    !!Object.keys(options.envSpec?.yaml || {}).length,
  condaArgs: async (inputs, options) => {
    const yamlData = options.envSpec?.yaml;
    if (yamlData == null) {
      throw Error(
        `'environment-file: ${inputs.environmentFile}' appears to be malformed`,
      );
    }

    let envFile = inputs.environmentFile;
    const patchesApplied: string[] = [];

    // Make a copy, update with each patch
    let dependencies: types.TYamlDependencies = [
      ...(yamlData.dependencies || []),
    ];

    for (const provider of PATCH_PROVIDERS) {
      if (!provider.provides(inputs, options)) {
        continue;
      }

      const newSpec = provider.spec(inputs, options);
      let didPatch = false;
      const patchedDeps = [];

      for (const spec of dependencies || []) {
        // Ignore pip deps
        if (typeof spec !== "string" || !spec.match(provider.specMatch)) {
          patchedDeps.push(spec);
          continue;
        }
        patchedDeps.push(newSpec);
        didPatch = true;
      }

      // If there was nothing to patch, just append
      if (!didPatch) {
        patchedDeps.push(newSpec);
      }

      patchesApplied.push(newSpec);
      dependencies = patchedDeps;
    }

    if (patchesApplied.length) {
      const patchedYaml = yaml.dump({ ...yamlData, dependencies });
      const origPath = path.resolve(inputs.environmentFile);
      const origParent = path.dirname(origPath);
      envFile = path.join(
        origParent,
        `setup-miniconda-patched-${path.basename(origPath)}`,
      );
      core.info(
        `Making patched copy of 'environment-file: ${inputs.environmentFile}'`,
      );
      // Mask any anaconda.org channel tokens before logging the patched env.
      for (const token of redact.findTokens(patchedYaml)) {
        core.setSecret(token);
      }
      core.info(`Using: ${envFile}\n${redact.redactTokens(patchedYaml)}`);
      fs.writeFileSync(envFile, patchedYaml, "utf8");
      // Redact the output value too: setSecret only masks logs, not the
      // action output that downstream steps can read. patchedYaml is already
      // YAML, so it must not be dumped again.
      outputs.setEnvironmentFileOutputs(
        envFile,
        redact.redactTokens(patchedYaml),
        true,
      );
    } else {
      core.info(`Using 'environment-file: ${inputs.environmentFile}' as-is`);
      const originalContent = fs.readFileSync(inputs.environmentFile, "utf8");
      // Mask any anaconda.org channel tokens carried by the environment file,
      // and redact the output value so the token is not exposed via the
      // environment-file-content output (setSecret only masks logs).
      for (const token of redact.findTokens(originalContent)) {
        core.setSecret(token);
      }
      outputs.setEnvironmentFileOutputs(
        envFile,
        redact.redactTokens(originalContent),
      );
    }
    const [flag, nameOrPath] = conda.envCommandFlag(inputs);
    let subcommand: string;
    if (options.useMamba) {
      const envPath =
        flag === "--name"
          ? path.join(conda.condaBasePath(inputs, options), "envs", nameOrPath)
          : nameOrPath;
      subcommand = fs.existsSync(envPath) ? "update" : "create";
    } else {
      subcommand = "update";
    }
    return ["env", subcommand, flag, nameOrPath, "--file", envFile];
  },
};

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import * as yaml from "js-yaml";

import * as core from "@actions/core";

import * as types from "../types";
import * as constants from "../constants";
import * as utils from "../utils";

/**
 * Describes whether and how a YAML env should be patched to add a specific package
 *
 * ## Notes
 * This is only applied for `python` at this point, but could in turn be made
 * configurable for other complex options, e.g. GPU, etc.
 */
interface IYAMLEnvPatchProvider {
  /** The human-readable name shown in logs */
  label: string;
  /** Whether this patch should be applied for the given `inputs` and `options` */
  provides: (
    inputs: types.IActionInputs,
    options: types.IDynamicOptions
  ) => boolean;
  /** A regular expression for detecting whether a spec will need to be replaced */
  specMatch: RegExp;
  /** The new conda version spec that should be added/patched into the environment */
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
 * May apply patches to ensure consistency with `inputs`
 *
 * If patched, a temporary file will be created with the patches
 */
export const ensureYaml: types.IEnvProvider = {
  label: "conda env update",
  provides: async (inputs, options) =>
    !!Object.keys(options.envSpec?.yaml || {}).length,
  condaArgs: async (inputs, options) => {
    const yamlData = options.envSpec?.yaml;
    if (yamlData == null) {
      throw Error(
        `'environment-file: ${inputs.environmentFile}' appears to be malformed`
      );
    }

    let envFile = inputs.environmentFile;
    let patchesApplied: string[] = [];

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
      let patchedDeps = [];

      for (const spec of dependencies || []) {
        // Ignore pip deps
        if (!(spec instanceof String) || !spec.match(constants.PYTHON_SPEC)) {
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
      const patchedYaml = yaml.safeDump({ ...yamlData, dependencies });
      envFile = path.join(os.tmpdir(), "environment-patched.yml");
      core.info(
        `Making patched copy of 'environment-file: ${inputs.environmentFile}'`
      );
      core.info(patchedYaml);
      fs.writeFileSync(envFile, patchedYaml, "utf8");
    } else {
      core.info(`Using 'environment-file: ${inputs.environmentFile}' as-is`);
    }

    return [
      "env",
      "update",
      "--name",
      inputs.activateEnvironment,
      "--file",
      envFile,
    ];
  },
};

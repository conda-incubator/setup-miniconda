import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import * as yaml from "js-yaml";

import * as core from "@actions/core";

import * as types from "../_types";
import * as constants from "../_constants";
import * as utils from "../_utils";

interface IEnvPatchProvider {
  label: string;
  provides: (
    inputs: types.IActionInputs,
    options: types.IDynamicOptions
  ) => boolean;
  specMatch: RegExp;
  spec: (inputs: types.IActionInputs, options: types.IDynamicOptions) => string;
}

const providers: IEnvPatchProvider[] = [
  {
    label: "python",
    provides: (inputs) => !!inputs.pythonVersion,
    specMatch: constants.PYTHON_SPEC,
    spec: ({ pythonVersion }) => utils.makeSpec("python", pythonVersion),
  },
];
export const ensureYaml: types.IEnvProvider = {
  label: "env update",
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

    // make a copy, update with each patch
    let dependencies: types.TYamlDependencies = [
      ...(yamlData.dependencies || []),
    ];

    for (const provider of providers) {
      if (!provider.provides(inputs, options)) {
        continue;
      }

      const newSpec = provider.spec(inputs, options);
      let didPatch = false;
      let patchedDeps = [];

      for (const spec of dependencies || []) {
        // ignore pip
        if (!(spec instanceof String) || !spec.match(constants.PYTHON_SPEC)) {
          patchedDeps.push(spec);
          continue;
        }
        patchedDeps.push(newSpec);
        didPatch = true;
      }

      // if there was nothing to patch, just append
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
        `Making copy of 'environment-file: ${inputs.environmentFile}'\n${patchedYaml}`
      );
      fs.writeFileSync(envFile, patchedYaml, "utf8");
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

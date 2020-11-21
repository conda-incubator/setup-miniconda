import * as types from "../_types";

import * as core from "@actions/core";

import * as conda from "../conda";

import { updateConda } from "./update-conda";
import { updateMamba } from "./update-mamba";
import { updatePython } from "./update-python";
import { updateCondaBuild } from "./update-conda-build";

/**
 * The providers of tool updates: order isn't _really_ important
 */
const providers: types.IToolProvider[] = [
  updateConda,
  updateMamba,
  updatePython,
  updateCondaBuild,
];

/**
 * Update the 'base' env with relevant tools
 *
 * Do this in one step to avoid multiple solves
 */
export async function installBaseTools(
  inputs: types.IActionInputs,
  options: types.IDynamicOptions
) {
  let tools = [];
  let postInstallOptions = { ...options };
  let postInstallActions = [];
  for (const provider of providers) {
    if (await provider.provides(inputs, options)) {
      core.info(provider.label);
      const toolUpdates = await provider.toolPackages(inputs, options);
      tools.push(...toolUpdates.tools);
      postInstallOptions = { ...postInstallOptions, ...toolUpdates.options };
      if (provider.postInstall) {
        postInstallActions.push(provider.postInstall);
      }
    }
  }

  if (tools.length) {
    await conda.condaCommand(
      ["install", "--name", "base", ...tools],
      // use the original `options`, as we can't guarantee `mamba` is available
      // TODO: allow declaring that the installer already has `mamba`
      options
    );

    // now use the new options, as we may have a new conda/mamba with more supported
    // options that previously failed
    await conda.applyCondaConfiguration(inputs, postInstallOptions);

    if (postInstallActions.length) {
      for (const action of postInstallActions) {
        await action(inputs, postInstallOptions);
      }
    }
  }

  return postInstallOptions;
}

import * as types from "../types";

import * as core from "@actions/core";

import * as conda from "../conda";

import { updateConda } from "./update-conda";
import { updateMamba } from "./update-mamba";
import { updatePython } from "./update-python";
import { updateCondaBuild } from "./update-conda-build";

/**
 * The providers of tool updates: order isn't _really_ important
 *
 * ### Note
 * To add a new tool provider,
 * - implement IToolProvider and add it here
 * - probably add inputs to `../../action.yaml`
 * - add any new RULEs in ../input.ts, for example if certain inputs make no sense
 * - add a test!
 */
const TOOL_PROVIDERS: types.IToolProvider[] = [
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
  options: types.IDynamicOptions,
) {
  let tools = [];
  let postInstallOptions = { ...options };
  let postInstallActions = [];
  for (const provider of TOOL_PROVIDERS) {
    core.info(`Do we need to ${provider.label}?`);
    if (await provider.provides(inputs, options)) {
      core.info(`... we will ${provider.label}.`);
      const toolUpdates = await provider.toolPackages(inputs, options);
      tools.push(...toolUpdates.tools);
      postInstallOptions = { ...postInstallOptions, ...toolUpdates.options };
      if (provider.postInstall) {
        core.info(
          `... we will perform post-install steps after we ${provider.label}.`,
        );
        postInstallActions.push(provider.postInstall);
      }
    }
  }

  if (tools.length) {
    await conda.condaCommand(["install", "--name", "base", ...tools], options);

    // *Now* use the new options, as we may have a new conda/mamba with more supported
    // options that previously failed
    await conda.applyCondaConfiguration(inputs, postInstallOptions);
  } else {
    core.info("No tools were installed in 'base' env.");
  }

  if (postInstallActions.length) {
    for (const action of postInstallActions) {
      await action(inputs, postInstallOptions);
    }
  } else {
    core.info("No post-install actions were taken on 'base' env.");
  }

  return postInstallOptions;
}

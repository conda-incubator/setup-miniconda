/**
 * @module base-tools
 * Tool provider registry. Collects {@link types.IToolProvider} strategies
 * for installing or updating conda, mamba, python, and conda-build in the
 * `base` environment.
 *
 * @category Base Tools
 */

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
 * Install all requested tools into the `base` environment in a single solve,
 * then run any post-install actions and reapply configuration.
 *
 * @param inputs - The parsed action inputs.
 * @param options - The current dynamic options.
 * @returns The updated dynamic options after tool installation.
 */
export async function installBaseTools(
  inputs: types.IActionInputs,
  options: types.IDynamicOptions,
) {
  const tools = [];
  let postInstallOptions = { ...options };
  const postInstallActions = [];
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
    await conda.condaCommand(
      ["install", "--name", "base", ...tools],
      inputs,
      options,
    );
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

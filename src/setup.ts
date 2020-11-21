import * as fs from "fs";

import * as core from "@actions/core";

import * as input from "./input";
import * as types from "./_types";
import * as constants from "./_constants";

import * as installer from "./installer";
import * as env from "./env";
import * as conda from "./conda";
import * as outputs from "./outputs";
import * as baseTools from "./base-tools";

/**
 * Main conda setup method to handle all configuration options
 */
async function setupMiniconda(inputs: types.IActionInputs): Promise<void> {
  // initialize options, preferring a pre-bundled miniconda, but not yet ready to decide to use mamba
  let options: types.IDynamicOptions = {
    useBundled: true,
    useMamba: false,
  };

  await core.group(
    `Creating bootstrap .condarc file in ${constants.CONDARC_PATH}...`,
    conda.bootstrapConfig
  );

  const installerInfo = await core.group("Ensuring installer...", () =>
    installer.getLocalInstallerPath(inputs, options)
  );
  options = { ...options, ...installerInfo.options };
  const basePath = conda.condaBasePath(options);

  if (installerInfo.localInstallerPath && !options.useBundled) {
    await core.group("Running installer...", () =>
      installer.runInstaller(installerInfo.localInstallerPath, basePath)
    );
  }

  if (!fs.existsSync(basePath)) {
    throw Error(`No installed conda 'base' enviroment found at ${basePath}`);
  }

  await core.group("Setup environment variables...", () =>
    outputs.setPathVariables(options)
  );

  if (inputs.condaConfigFile) {
    await core.group("Copying condarc file...", () => conda.copyConfig(inputs));
  }

  // for potential 'channels'
  options.envSpec = await core.group("Parsing environment...", () =>
    env.getEnvSpec(inputs)
  );

  await core.group("Configuring conda package cache...", () =>
    outputs.setCacheVariable(options)
  );

  await core.group("Applying initial configuration...", () =>
    conda.applyCondaConfiguration(inputs, options)
  );

  await core.group("Initializing conda shell integration...", () =>
    conda.condaInit(inputs, options)
  );

  const toolOptions = await core.group("Adding tools to 'base' env", () =>
    baseTools.installBaseTools(inputs, options)
  );

  // `useMamba` may have changed
  options = { ...options, ...toolOptions };

  if (inputs.activateEnvironment) {
    await core.group("Ensuring environment...", () =>
      env.ensureEnvironment(inputs, options)
    );
  }
}

/**
 * Run
 */
async function run(): Promise<void> {
  try {
    const inputs = await core.group("Gathering Inputs...", input.parseInputs);
    await setupMiniconda(inputs);
  } catch (err) {
    core.setFailed(err.message);
  }
}

void run();

export default run;

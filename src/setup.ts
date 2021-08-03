import * as fs from "fs";

import * as core from "@actions/core";

import * as types from "./types";
import * as constants from "./constants";
import * as input from "./input";
import * as outputs from "./outputs";
import * as installer from "./installer";
import * as conda from "./conda";
import * as env from "./env";
import * as baseTools from "./base-tools";

/**
 * Main conda setup method to handle all configuration options
 */
async function setupMiniconda(inputs: types.IActionInputs): Promise<void> {
  let options: types.IDynamicOptions = {
    useBundled: true,
    useMamba: false,
    mambaInInstaller: false,
    condaConfig: { ...inputs.condaConfig },
  };

  await core.group(
    `Creating bootstrap condarc file in ${constants.CONDARC_PATH}...`,
    conda.bootstrapConfig
  );

  const installerInfo = await core.group("Ensuring installer...", () =>
    installer.getLocalInstallerPath(inputs, options)
  );

  // The desired installer may change the options
  options = { ...options, ...installerInfo.options };

  const basePath = conda.condaBasePath(options);

  if (installerInfo.localInstallerPath && !options.useBundled) {
    options = await core.group("Running installer...", () =>
      installer.runInstaller(
        installerInfo.localInstallerPath,
        basePath,
        inputs,
        options
      )
    );
  }

  if (!fs.existsSync(basePath)) {
    throw Error(`No installed conda 'base' enviroment found at ${basePath}!` +
                'If you are using this action in a self-hosted runner that already provides ' +
                'its own Miniconda installation, please specify its location with a `CONDA` ' +
                'environment variable. If you want us to download and install Miniconda for ' +
                'you, use `miniconda-version: "latest"` in the parameters for this action.');
  }

  await core.group("Setup environment variables...", () =>
    outputs.setPathVariables(options)
  );

  if (inputs.condaConfigFile) {
    await core.group("Copying condarc file...", () => conda.copyConfig(inputs));
  }

  // For potential 'channels' that may alter configuration
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

  // New base tools may change options
  options = await core.group("Adding tools to 'base' env...", () =>
    baseTools.installBaseTools(inputs, options)
  );

  if (inputs.activateEnvironment) {
    await core.group("Ensuring environment...", () =>
      env.ensureEnvironment(inputs, options)
    );
  }

  if (core.getState(constants.OUTPUT_ENV_FILE_WAS_PATCHED)) {
    await core.group(
      "Maybe cleaning up patched environment-file...",
      async () => {
        const patchedEnv = core.getState(constants.OUTPUT_ENV_FILE_PATH);
        if (inputs.cleanPatchedEnvironmentFile === "true") {
          fs.unlinkSync(patchedEnv);
          core.info(`Cleaned ${patchedEnv}`);
        } else {
          core.info(`Leaving ${patchedEnv} in place`);
        }
      }
    );
  }

  core.info("setup-miniconda ran successfully");
}

/**
 * Main `setup-miniconda` entry point
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

import * as fs from "fs";

import * as core from "@actions/core";

import * as types from "./types";
import * as constants from "./constants";
import * as input from "./input";
import * as outputs from "./outputs";
import * as installer from "./installer";
import * as conda from "./conda";
import * as env from "./env";

/**
 * Main conda setup method to handle all configuration options
 */
async function setupMiniconda(inputs: types.IActionInputs): Promise<void> {
  let options: types.IDynamicOptions = {
    useBundled: true,
    useMamba: false,
    condaConfig: { ...inputs.condaConfig },
  };

  await core.group(
    `Creating bootstrap condarc file in ${constants.CONDARC_PATH}...`,
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

  core.startGroup("Setup Conda basic configuration...");
  await conda.condaCommand(
    ["config", "--set", "always_yes", "yes", "--set", "changeps1", "no"],
    options
  );
  core.endGroup();

  core.startGroup("Initialize Conda and fix ownership...");
  await conda.condaInit(inputs, options);
  core.endGroup();

  if (inputs.condaVersion) {
    core.startGroup("Installing Conda...");
    await conda.condaCommand(
      ["install", "--name", "base", `conda=${inputs.condaVersion}`],
      options
    );
    core.endGroup();
  }

  if (options.condaConfig["auto_update_conda"] == "true") {
    core.startGroup("Updating conda...");
    await conda.condaCommand(["update", "conda"], options);
    core.endGroup();

    if (options.condaConfig) {
      core.startGroup("Applying conda configuration after update...");
      await conda.applyCondaConfiguration(inputs, options);
      core.endGroup();
    }
  }

  // Any conda commands run here after init and setup
  if (inputs.mambaVersion) {
    core.startGroup("Installing Mamba...");
    core.warning(
      `Mamba support is still experimental and can result in differently solved environments!`
    );

    await conda.condaCommand(
      ["install", "--name", "base", `mamba=${inputs.mambaVersion}`],
      options
    );

    if (constants.IS_WINDOWS) {
      // add bat-less forwarder for bash users on Windows
      const mambaBat = conda
        .condaExecutable({ ...options, useMamba: true })
        .replace("\\", "/");
      const contents = `bash.exe -c "exec '${mambaBat}' $*"`;
      fs.writeFileSync(mambaBat.slice(0, -4), contents);
    }

    options.useMamba = true;
  }

  if (inputs.condaBuildVersion) {
    core.startGroup("Installing Conda Build...");
    await conda.condaCommand(
      ["install", "--name", "base", `conda-build=${inputs.condaBuildVersion}`],
      options
    );
    core.endGroup();
  }

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

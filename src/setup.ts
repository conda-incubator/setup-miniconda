import * as fs from "fs";
import * as path from "path";

import * as core from "@actions/core";
import * as yaml from "js-yaml";

import * as types from "./types";
import * as constants from "./constants";
import * as input from "./input";
import * as outputs from "./outputs";
import * as installer from "./installer";
import * as conda from "./conda";
import * as env from "./env";
import * as tools from "./tools";

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

  // Read the environment yaml to use channels if provided and avoid conda solver conflicts
  let environmentYaml: any;
  let environmentExplicit: boolean;
  if (inputs.environmentFile) {
    const sourceEnvironmentPath: string = path.join(
      process.env["GITHUB_WORKSPACE"] || "",
      inputs.environmentFile
    );
    environmentExplicit =
      fs.readFileSync(sourceEnvironmentPath, "utf8").match(/^@EXPLICIT/m) !=
      null;
    if (environmentExplicit) {
      environmentYaml = {};
    } else {
      environmentYaml = yaml.safeLoad(
        fs.readFileSync(sourceEnvironmentPath, "utf8")
      );
    }
  } else {
    environmentExplicit = false;
  }

  await core.group("Configuring conda package cache...", () =>
    outputs.setCacheVariable(options)
  );

  if (options.condaConfig) {
    if (inputs.environmentFile) {
      let channels: Array<string> | undefined;
      channels = environmentYaml["channels"];

      if (options.condaConfig["channels"] === "" && channels !== undefined) {
        // TODO: avoid mutating state
        options.condaConfig["channels"] = channels.join(",");
      } else if (!environmentExplicit) {
        core.warning(
          '"channels" set on the "environment-file" do not match "channels" set on the action!'
        );
      }
    }
    core.startGroup("Applying conda configuration...");
    await conda.applyCondaConfiguration(options);
    core.endGroup();
  }

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
      await conda.applyCondaConfiguration(options);
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
    await env.createTestEnvironment(inputs, options);
  }

  if (inputs.pythonVersion && inputs.activateEnvironment) {
    core.startGroup(
      `Installing Python="${inputs.pythonVersion}" on "${inputs.activateEnvironment}" environment...`
    );
    await tools.setupPython(inputs, options);
    core.endGroup();
  }

  if (inputs.environmentFile) {
    let environmentYaml: types.TEnvironment;
    let condaAction: string[];
    let activateEnvironmentToUse: string;

    const sourceEnvironmentPath: string = path.join(
      process.env["GITHUB_WORKSPACE"] || "",
      inputs.environmentFile
    );
    if (environmentExplicit) {
      environmentYaml = {};
    } else {
      environmentYaml = await yaml.safeLoad(
        fs.readFileSync(sourceEnvironmentPath, "utf8")
      );
    }

    let group: string = "";

    if (environmentExplicit) {
      condaAction = ["install"];
      activateEnvironmentToUse = inputs.activateEnvironment;
      group = `Creating conda environment from explicit specs file...`;
    } else if (
      inputs.activateEnvironment &&
      environmentYaml["name"] !== undefined &&
      environmentYaml["name"] !== inputs.activateEnvironment
    ) {
      condaAction = ["env", "create"];
      activateEnvironmentToUse = environmentYaml["name"];
      group = `Creating conda environment from yaml file...`;
      core.warning(
        'The environment name on "environment-file" is not the same as "enviroment-activate", using "environment-file"!'
      );
    } else if (
      inputs.activateEnvironment &&
      inputs.activateEnvironment === environmentYaml["name"]
    ) {
      group = `Updating conda environment from yaml file...`;
      condaAction = ["env", "update"];
      activateEnvironmentToUse = inputs.activateEnvironment;
    } else if (
      inputs.activateEnvironment &&
      environmentYaml["name"] === undefined
    ) {
      core.warning(
        'The environment name on "environment-file" is not defined, using "enviroment-activate"!'
      );
      condaAction = ["env", "update"];
      activateEnvironmentToUse = inputs.activateEnvironment;
    } else {
      activateEnvironmentToUse = inputs.activateEnvironment;
      condaAction = ["env", "create"];
    }

    core.startGroup(group.length ? group : `Running ${condaAction.join(" ")}`);

    await conda.condaCommand(
      [
        ...condaAction,
        "--file",
        inputs.environmentFile,
        "--name",
        activateEnvironmentToUse,
      ],
      options
    );
    core.endGroup();
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

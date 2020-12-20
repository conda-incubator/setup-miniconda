import * as fs from "fs";
import * as path from "path";

import * as core from "@actions/core";
import * as io from "@actions/io";
import * as yaml from "js-yaml";

import * as utils from "./utils";
import * as input from "./input";

// TODO: move these to namespace imports
import { setVariables } from "./vars";
import {
  downloadMiniconda,
  runInstaller,
  downloadCustomInstaller,
} from "./installer";

import * as types from "./types";

import {
  BOOTSTRAP_CONDARC,
  CONDARC_PATH,
  ENV_VAR_CONDA_PKGS,
  IS_WINDOWS,
} from "./constants";

import {
  minicondaPath,
  condaExecutable,
  condaCommand,
  applyCondaConfiguration,
  condaInit,
} from "./conda";

import { setupPython } from "./tools";

import { createTestEnvironment } from "./env";

/**
 * Main conda setup method to handle all configuration options
 */
async function setupMiniconda(inputs: types.IActionInputs): Promise<void> {
  let options: types.IDynamicOptions = {
    useBundled: true,
    useMamba: false,
    condaConfig: { ...inputs.condaConfig },
  };

  core.startGroup(`Creating bootstrap condarc file in ${CONDARC_PATH}...`);
  await fs.promises.writeFile(CONDARC_PATH, BOOTSTRAP_CONDARC);
  core.endGroup();

  if (inputs.installerUrl !== "") {
    options.useBundled = false;
    const installerPath = await downloadCustomInstaller(inputs);
    core.startGroup("Installing Custom Installer...");
    await runInstaller(installerPath, options);
    core.endGroup();
  } else if (inputs.minicondaVersion !== "" || inputs.architecture !== "x64") {
    core.startGroup("Downloading Miniconda...");
    options.useBundled = false;
    const installerPath = await downloadMiniconda(3, inputs);
    core.endGroup();

    core.startGroup("Installing Miniconda...");
    await runInstaller(installerPath, options);
    core.endGroup();
  } else {
    core.startGroup("Locating Miniconda...");
    core.info(minicondaPath(options));
    if (!fs.existsSync(minicondaPath(options))) {
      throw new Error("Bundled Miniconda not found!");
    }
    core.endGroup();
  }

  core.startGroup("Setup environment variables...");
  await setVariables(options);
  core.endGroup();

  if (inputs.condaConfigFile) {
    core.startGroup("Copying condarc file...");
    const sourcePath: string = path.join(
      process.env["GITHUB_WORKSPACE"] || "",
      inputs.condaConfigFile
    );
    core.info(`"${sourcePath}" to "${CONDARC_PATH}"`);
    await io.cp(sourcePath, CONDARC_PATH);
    core.endGroup();
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

  const cacheFolder = utils.cacheFolder();
  await condaCommand(["config", "--add", "pkgs_dirs", cacheFolder], options);
  core.exportVariable(ENV_VAR_CONDA_PKGS, cacheFolder);

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
    await applyCondaConfiguration(options);
    core.endGroup();
  }

  core.startGroup("Setup Conda basic configuration...");
  await condaCommand(
    ["config", "--set", "always_yes", "yes", "--set", "changeps1", "no"],
    options
  );
  core.endGroup();

  core.startGroup("Initialize Conda and fix ownership...");
  await condaInit(inputs, options);
  core.endGroup();

  if (inputs.condaVersion) {
    core.startGroup("Installing Conda...");
    await condaCommand(
      ["install", "--name", "base", `conda=${inputs.condaVersion}`],
      options
    );
    core.endGroup();
  }

  if (options.condaConfig["auto_update_conda"] == "true") {
    core.startGroup("Updating conda...");
    await condaCommand(["update", "conda"], options);
    core.endGroup();

    if (options.condaConfig) {
      core.startGroup("Applying conda configuration after update...");
      await applyCondaConfiguration(options);
      core.endGroup();
    }
  }

  // Any conda commands run here after init and setup
  if (inputs.mambaVersion) {
    core.startGroup("Installing Mamba...");
    core.warning(
      `Mamba support is still experimental and can result in differently solved environments!`
    );

    await condaCommand(
      ["install", "--name", "base", `mamba=${inputs.mambaVersion}`],
      options
    );

    if (IS_WINDOWS) {
      // add bat-less forwarder for bash users on Windows
      const mambaBat = condaExecutable({ ...options, useMamba: true }).replace(
        "\\",
        "/"
      );
      const contents = `bash.exe -c "exec '${mambaBat}' $*"`;
      fs.writeFileSync(mambaBat.slice(0, -4), contents);
    }

    options.useMamba = true;
  }

  if (inputs.condaBuildVersion) {
    core.startGroup("Installing Conda Build...");
    await condaCommand(
      ["install", "--name", "base", `conda-build=${inputs.condaBuildVersion}`],
      options
    );
    core.endGroup();
  }

  if (inputs.activateEnvironment) {
    await createTestEnvironment(inputs, options);
  }

  if (inputs.pythonVersion && inputs.activateEnvironment) {
    core.startGroup(
      `Installing Python="${inputs.pythonVersion}" on "${inputs.activateEnvironment}" environment...`
    );
    await setupPython(inputs, options);
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

    await condaCommand(
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

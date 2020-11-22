import * as fs from "fs";
import * as path from "path";
import { URL } from "url";

import * as core from "@actions/core";
import * as io from "@actions/io";
import * as yaml from "js-yaml";

import * as utils from "./utils";

// TODO: move these to namespace imports
import { setVariables } from "./vars";
import {
  downloadMiniconda,
  runInstaller,
  downloadCustomInstaller,
} from "./installer";

import { Result, TCondaConfig, TEnvironment } from "./types";

import {
  BOOTSTRAP_CONDARC,
  CONDARC_PATH,
  ENV_VAR_CONDA_PKGS,
  IS_LINUX,
  IS_WINDOWS,
  KNOWN_EXTENSIONS,
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
async function setupMiniconda(
  installerUrl: string,
  minicondaVersion: string,
  architecture: string,
  condaVersion: string,
  condaBuildVersion: string,
  pythonVersion: string,
  activateEnvironment: string,
  environmentFile: string,
  condaConfigFile: string,
  condaConfig: TCondaConfig,
  removeProfiles: string,
  mambaVersion: string
): Promise<Result> {
  let result: Result;
  let useBundled: boolean = true;
  let useMamba: boolean = false;
  try {
    core.startGroup("Checking consistency...");
    if (condaConfig["auto_update_conda"] == "true" && condaVersion) {
      core.warning(
        `"conda-version=${condaVersion}" was provided but "auto-update-conda" is also enabled!`
      );
    }
    if (pythonVersion && activateEnvironment === "") {
      return {
        ok: false,
        error: new Error(
          `"python-version=${pythonVersion}" was provided but "activate-environment" is not defined!`
        ),
      };
    }
    if (!condaConfig["channels"].includes("conda-forge") && mambaVersion) {
      return {
        ok: false,
        error: new Error(
          `"mamba-version=${mambaVersion}" requires "conda-forge" to be included in "channels!"`
        ),
      };
    }
    if (installerUrl) {
      if (minicondaVersion) {
        return {
          ok: false,
          error: new Error(
            `"installer-url" and "miniconda-version" were provided: pick one!`
          ),
        };
      }
      const { pathname } = new URL(installerUrl);
      const extname = path.posix.extname(pathname);
      if (!KNOWN_EXTENSIONS.includes(extname)) {
        return {
          ok: false,
          error: new Error(
            `"installer-url" file name ends with ${extname}, must be one of ${KNOWN_EXTENSIONS}!`
          ),
        };
      }
    } else {
      if (!minicondaVersion && architecture !== "x64") {
        return {
          ok: false,
          error: new Error(
            `"architecture" is set to something other than "x64" so "miniconda-version" must be set as well.`
          ),
        };
      }
      if (architecture === "x86" && IS_LINUX) {
        return {
          ok: false,
          error: new Error(
            `32-bit Linux is not supported by recent versions of Miniconda`
          ),
        };
      }
    }
    core.endGroup();

    try {
      core.startGroup(`Creating bootstrap condarc file in ${CONDARC_PATH}...`);
      await fs.promises.writeFile(CONDARC_PATH, BOOTSTRAP_CONDARC);
    } catch (err) {
      return { ok: false, error: err };
    }
    core.endGroup();

    if (installerUrl !== "") {
      useBundled = false;
      result = await downloadCustomInstaller(installerUrl);

      if (!result.ok) return result;

      core.startGroup("Installing Custom Installer...");
      result = await runInstaller(result.data, useBundled);
      core.endGroup();
    } else if (minicondaVersion !== "" || architecture !== "x64") {
      core.startGroup("Downloading Miniconda...");
      useBundled = false;
      result = await downloadMiniconda(3, minicondaVersion, architecture);
      if (!result.ok) return result;
      core.endGroup();

      core.startGroup("Installing Miniconda...");
      result = await runInstaller(result.data, useBundled);
      if (!result.ok) return result;
      core.endGroup();
    } else {
      core.startGroup("Locating Miniconda...");
      core.info(minicondaPath());
      if (!fs.existsSync(minicondaPath())) {
        return { ok: false, error: new Error("Bundled Miniconda not found!") };
      }
      core.endGroup();
    }

    core.startGroup("Setup environment variables...");
    result = await setVariables(useBundled);
    if (!result.ok) return result;
    core.endGroup();

    if (condaConfigFile) {
      core.startGroup("Copying condarc file...");
      const sourcePath: string = path.join(
        process.env["GITHUB_WORKSPACE"] || "",
        condaConfigFile
      );
      core.info(`"${sourcePath}" to "${CONDARC_PATH}"`);
      try {
        await io.cp(sourcePath, CONDARC_PATH);
      } catch (err) {
        return { ok: false, error: err };
      }
      core.endGroup();
    }

    // Read the environment yaml to use channels if provided and avoid conda solver conflicts
    let environmentYaml: any;
    let environmentExplicit: boolean;
    if (environmentFile) {
      try {
        const sourceEnvironmentPath: string = path.join(
          process.env["GITHUB_WORKSPACE"] || "",
          environmentFile
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
      } catch (err) {
        return { ok: false, error: err };
      }
    } else {
      environmentExplicit = false;
    }

    const cacheFolder = utils.cacheFolder();
    result = await condaCommand(
      ["config", "--add", "pkgs_dirs", cacheFolder],
      useBundled,
      useMamba
    );
    if (!result.ok) return result;
    core.exportVariable(ENV_VAR_CONDA_PKGS, cacheFolder);

    if (condaConfig) {
      if (environmentFile) {
        let channels: Array<string> | undefined;
        channels = environmentYaml["channels"];

        if (condaConfig["channels"] === "" && channels !== undefined) {
          condaConfig["channels"] = channels.join(",");
        } else if (!environmentExplicit) {
          core.warning(
            '"channels" set on the "environment-file" do not match "channels" set on the action!'
          );
        }
      }
      core.startGroup("Applying conda configuration...");
      result = await applyCondaConfiguration(condaConfig, useBundled);
      core.endGroup();
      // We do not fail because some options might not be available
      // if (!result.ok) return result;
    }

    core.startGroup("Setup Conda basic configuration...");
    result = await condaCommand(
      ["config", "--set", "always_yes", "yes", "--set", "changeps1", "no"],
      useBundled,
      useMamba
    );
    if (!result.ok) return result;
    core.endGroup();

    core.startGroup("Initialize Conda and fix ownership...");
    result = await condaInit(
      activateEnvironment,
      useBundled,
      condaConfig,
      removeProfiles
    );
    if (!result.ok) return result;
    core.endGroup();

    if (condaVersion) {
      core.startGroup("Installing Conda...");
      result = await condaCommand(
        ["install", "--name", "base", `conda=${condaVersion}`],
        useBundled,
        useMamba
      );
      if (!result.ok) return result;
      core.endGroup();
    }

    if (condaConfig["auto_update_conda"] == "true") {
      core.startGroup("Updating conda...");
      result = await condaCommand(["update", "conda"], useBundled, useMamba);
      if (!result.ok) return result;
      core.endGroup();

      if (condaConfig) {
        core.startGroup("Applying conda configuration after update...");
        result = await applyCondaConfiguration(condaConfig, useBundled);
        if (!result.ok) return result;
        core.endGroup();
      }
    }

    // Any conda commands run here after init and setup
    if (mambaVersion) {
      core.startGroup("Installing Mamba...");
      core.warning(
        `Mamba support is still experimental and can result in differently solved environments!`
      );
      result = await condaCommand(
        ["install", "--name", "base", `mamba=${mambaVersion}`],
        useBundled,
        useMamba
      );
      if (result.ok) {
        if (IS_WINDOWS) {
          // add bat-less forwarder for bash users on Windows
          const mambaBat = condaExecutable(useBundled, true).replace("\\", "/");
          const contents = `bash.exe -c "exec '${mambaBat}' $*"`;
          try {
            fs.writeFileSync(mambaBat.slice(0, -4), contents);
          } catch (err) {
            return { ok: false, error: err };
          }
        }
        useMamba = true;
      } else {
        return result;
      }
    }

    if (condaBuildVersion) {
      core.startGroup("Installing Conda Build...");
      result = await condaCommand(
        ["install", "--name", "base", `conda-build=${condaBuildVersion}`],
        useBundled,
        useMamba
      );
      if (!result.ok) return result;
      core.endGroup();
    }

    if (activateEnvironment) {
      result = await createTestEnvironment(
        activateEnvironment,
        useBundled,
        useMamba
      );
      if (!result.ok) return result;
    }

    if (pythonVersion && activateEnvironment) {
      core.startGroup(
        `Installing Python="${pythonVersion}" on "${activateEnvironment}" environment...`
      );
      result = await setupPython(
        activateEnvironment,
        pythonVersion,
        useBundled,
        useMamba
      );
      if (!result.ok) return result;
      core.endGroup();
    }

    if (environmentFile) {
      let environmentYaml: TEnvironment;
      let condaAction: string[];
      let activateEnvironmentToUse: string;
      try {
        const sourceEnvironmentPath: string = path.join(
          process.env["GITHUB_WORKSPACE"] || "",
          environmentFile
        );
        if (environmentExplicit) {
          environmentYaml = {};
        } else {
          environmentYaml = await yaml.safeLoad(
            fs.readFileSync(sourceEnvironmentPath, "utf8")
          );
        }
      } catch (err) {
        return { ok: false, error: err };
      }

      let group: string = "";

      if (environmentExplicit) {
        condaAction = ["install"];
        activateEnvironmentToUse = activateEnvironment;
        group = `Creating conda environment from explicit specs file...`;
      } else if (
        activateEnvironment &&
        environmentYaml["name"] !== undefined &&
        environmentYaml["name"] !== activateEnvironment
      ) {
        condaAction = ["env", "create"];
        activateEnvironmentToUse = environmentYaml["name"];
        group = `Creating conda environment from yaml file...`;
        core.warning(
          'The environment name on "environment-file" is not the same as "enviroment-activate", using "environment-file"!'
        );
      } else if (
        activateEnvironment &&
        activateEnvironment === environmentYaml["name"]
      ) {
        group = `Updating conda environment from yaml file...`;
        condaAction = ["env", "update"];
        activateEnvironmentToUse = activateEnvironment;
      } else if (activateEnvironment && environmentYaml["name"] === undefined) {
        core.warning(
          'The environment name on "environment-file" is not defined, using "enviroment-activate"!'
        );
        condaAction = ["env", "update"];
        activateEnvironmentToUse = activateEnvironment;
      } else {
        activateEnvironmentToUse = activateEnvironment;
        condaAction = ["env", "create"];
      }

      core.startGroup(
        group.length ? group : `Running ${condaAction.join(" ")}`
      );

      result = await condaCommand(
        [
          ...condaAction,
          "--file",
          environmentFile,
          "--name",
          activateEnvironmentToUse,
        ],
        useBundled,
        useMamba
      );
      if (!result.ok) return result;
      core.endGroup();
    }
  } catch (err) {
    return { ok: false, error: err };
  }
  return { ok: true, data: "ok" };
}

/**
 * Run
 */
async function run(): Promise<void> {
  try {
    let installerUrl: string = core.getInput("installer-url");
    let minicondaVersion: string = core.getInput("miniconda-version");
    let condaVersion: string = core.getInput("conda-version");
    let condaBuildVersion: string = core.getInput("conda-build-version");
    let pythonVersion: string = core.getInput("python-version");
    let architecture: string = core.getInput("architecture");

    // Environment behavior
    let activateEnvironment: string = core.getInput("activate-environment");
    let environmentFile: string = core.getInput("environment-file");

    // Conda configuration
    let addAnacondaToken: string = core.getInput("add-anaconda-token");
    let addPipAsPythonDependency: string = core.getInput(
      "add-pip-as-python-dependency"
    );
    let allowSoftlinks: string = core.getInput("allow-softlinks");
    let autoActivateBase: string = core.getInput("auto-activate-base");
    let autoUpdateConda: string = core.getInput("auto-update-conda");
    let condaFile: string = core.getInput("condarc-file");
    let channelAlias: string = core.getInput("channel-alias");
    let channelPriority: string = core.getInput("channel-priority");
    let channels: string = core.getInput("channels");
    let removeProfiles: string = core.getInput("remove-profiles");
    let showChannelUrls: string = core.getInput("show-channel-urls");
    let useOnlyTarBz2: string = core.getInput("use-only-tar-bz2");

    // Mamba
    let mambaVersion: string = core.getInput("mamba-version");

    const condaConfig: TCondaConfig = {
      add_anaconda_token: addAnacondaToken,
      add_pip_as_python_dependency: addPipAsPythonDependency,
      allow_softlinks: allowSoftlinks,
      auto_activate_base: autoActivateBase,
      auto_update_conda: autoUpdateConda,
      channel_alias: channelAlias,
      channel_priority: channelPriority,
      channels: channels,
      show_channel_urls: showChannelUrls,
      use_only_tar_bz2: useOnlyTarBz2,
    };
    const result = await setupMiniconda(
      installerUrl,
      minicondaVersion,
      architecture,
      condaVersion,
      condaBuildVersion,
      pythonVersion,
      activateEnvironment,
      environmentFile,
      condaFile,
      condaConfig,
      removeProfiles,
      mambaVersion
    );
    if (!result.ok) {
      throw result.error;
    }
  } catch (err) {
    core.setFailed(err.message);
  }
}

void run();

export default run;

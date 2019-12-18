import * as core from "@actions/core";
import * as conda from "./setup-conda";

async function run() {
  try {
    let minicondaVersion: string = core.getInput("miniconda-version");
    let condaVersion: string = core.getInput("conda-version");
    let condaBuildVersion: string = core.getInput("conda-build-version");
    let pythonVersion: string = core.getInput("python-version");
    let activateEnvironment: string = core.getInput("activate-environment");
    let environmentFile: string = core.getInput("environment-file");

    // Conda configuration
    let autoActivateBase: string = core.getInput("auto-activate-base");
    let autoUpdateConda: string = core.getInput("auto-update-conda");
    let condaFile: string = core.getInput("condarc-file");

    const condaConfig = {
      auto_activate_base: autoActivateBase,
      auto_update_conda: autoUpdateConda
    };
    const result = await conda.setupMiniconda(
      minicondaVersion,
      "x64",
      condaVersion,
      condaBuildVersion,
      pythonVersion,
      activateEnvironment,
      environmentFile,
      condaFile,
      condaConfig
    );
    if (!result["ok"]) {
      throw result["error"];
    }
  } catch (err) {
    core.setFailed(err.message);
  }
}

run();

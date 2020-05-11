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
    let addPipAsPythonDependency: string = core.getInput(
      "add-pip-as-python-dependency"
    );
    let autoActivateBase: string = core.getInput("auto-activate-base");
    let autoUpdateConda: string = core.getInput("auto-update-conda");
    let condaFile: string = core.getInput("condarc-file");
    let channelPriority: string = core.getInput("channel-priority");
    let channels: string = core.getInput("channels");
    let removeProfiles: string = core.getInput("remove-profiles");
    let showChannelUrls: string = core.getInput("show-channel-urls");
    let usePip: string = core.getInput("use-pip");

    const condaConfig = {
      add_pip_as_python_dependency: addPipAsPythonDependency,
      auto_activate_base: autoActivateBase,
      auto_update_conda: autoUpdateConda,
      channel_priority: channelPriority,
      channels: channels,
      show_channel_urls: showChannelUrls,
      use_pip: usePip
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
      condaConfig,
      removeProfiles
    );
    if (!result["ok"]) {
      throw result["error"];
    }
  } catch (err) {
    core.setFailed(err.message);
  }
}

run();

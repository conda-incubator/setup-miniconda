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
    let updateDependencies: string = core.getInput("update-dependencies");
    let useOnlyTarBz2: string = core.getInput("use-only-tar-bz2");
    let usePip: string = core.getInput("use-pip");

    const condaConfig = {
      add_anaconda_token: addAnacondaToken,
      add_pip_as_python_dependency: addPipAsPythonDependency,
      allow_softlinks: allowSoftlinks,
      auto_activate_base: autoActivateBase,
      auto_update_conda: autoUpdateConda,
      channel_alias: channelAlias,
      channel_priority: channelPriority,
      channels: channels,
      show_channel_urls: showChannelUrls,
      update_dependencies: updateDependencies,
      use_only_tar_bz2: useOnlyTarBz2,
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

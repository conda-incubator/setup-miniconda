import * as path from "path";
import * as os from "os";
import * as fs from "fs";

import * as io from "@actions/io";
import * as core from "@actions/core";

import * as constants from "./_constants";
import * as types from "./_types";
import * as utils from "./_utils";

/**
 * Provide current location of miniconda or location where it will be installed
 */
export function condaBasePath(options: types.IDynamicOptions): string {
  let condaPath: string = constants.MINICONDA_DIR_PATH;
  if (!options.useBundled) {
    if (constants.IS_MAC) {
      condaPath = "/Users/runner/miniconda3";
    } else {
      condaPath += "3";
    }
  }
  return condaPath;
}

/**
 * Provide cross platform location of conda/mamba executable
 */
export function condaExecutable(options: types.IDynamicOptions): string {
  const dir: string = condaBasePath(options);
  let condaExe: string;
  let commandName: string;
  commandName = options.useMamba ? "mamba" : "conda";
  commandName = constants.IS_WINDOWS ? commandName + ".bat" : commandName;
  condaExe = path.join(dir, "condabin", commandName);
  return condaExe;
}

/**
 * Run Conda command
 */
export async function condaCommand(
  cmd: string[],
  options: types.IDynamicOptions
): Promise<void> {
  const command = [condaExecutable(options), ...cmd];
  await utils.execute(command);
}

/**
 * Initialize Conda
 */
export async function condaInit(
  inputs: types.IActionInputs,
  options: types.IDynamicOptions
): Promise<void> {
  const isValidActivate = utils.isBaseEnv(inputs.activateEnvironment);
  const autoActivateBase = inputs.condaConfig.auto_activate_base === "true";

  if (options.useBundled) {
    await fixPermissions(options);
  }

  // Remove profile files
  if (inputs.removeProfiles == "true") {
    for (let rc of constants.PROFILES) {
      try {
        let file: string = path.join(os.homedir(), rc);
        if (fs.existsSync(file)) {
          core.info(`Removing "${file}"`);
          await io.rmRF(file);
        }
      } catch (err) {
        core.warning(err);
      }
    }
  }

  // Run conda init
  for (let cmd of ["--all"]) {
    await utils.execute([condaExecutable(options), "init", cmd]);
  }

  // Rename files
  let source = "";
  let dest = "";

  switch (constants.PLATFORM) {
    case "linux":
      source = ".bashrc";
      dest = ".profile";
      break;
    case "darwin":
      source = ".bash_profile";
      dest = ".profile";
      break;
    default:
      break;
  }

  if (source && dest) {
    core.info(`Renaming "~/${source}" to "~/${dest}"\n`);
    await io.mv(path.join(os.homedir(), source), path.join(os.homedir(), dest));
  }

  // PowerShell profiles
  let powerExtraText = `
  # ----------------------------------------------------------------------------`;
  if (isValidActivate) {
    powerExtraText += `
  # Conda Setup Action: Custom activation
  conda activate ${inputs.activateEnvironment}`;
  }
  powerExtraText += `
  # ----------------------------------------------------------------------------`;

  // Bash profiles
  let bashExtraText: string = `
  # ----------------------------------------------------------------------------
  # Conda Setup Action: Basic configuration
  set -eo pipefail`;
  if (isValidActivate) {
    bashExtraText += `
  # Conda Setup Action: Custom activation
  conda activate ${inputs.activateEnvironment}`;
    bashExtraText += `
  # ----------------------------------------------------------------------------`;
  }

  // Batch profiles
  let batchExtraText = `
  :: ---------------------------------------------------------------------------`;
  if (autoActivateBase) {
    batchExtraText += `
  :: Conda Setup Action: Activate base
  @CALL "%CONDA_BAT%" activate base`;
  }
  if (isValidActivate) {
    batchExtraText += `
  :: Conda Setup Action: Custom activation
  @CALL "%CONDA_BAT%" activate ${inputs.activateEnvironment}`;
  }
  batchExtraText += `
  :: Conda Setup Action: Basic configuration
  @SETLOCAL EnableExtensions
  @SETLOCAL DisableDelayedExpansion
  :: ---------------------------------------------------------------------------`;

  let extraShells: types.IShells;
  const shells: types.IShells = {
    "~/.bash_profile": bashExtraText,
    "~/.profile": bashExtraText,
    "~/.zshrc": bashExtraText,
    "~/.config/fish/config.fish": bashExtraText,
    "~/.tcshrc": bashExtraText,
    "~/.xonshrc": bashExtraText,
    "~/.config/powershell/profile.ps1": powerExtraText,
    "~/Documents/PowerShell/profile.ps1": powerExtraText,
    "~/Documents/WindowsPowerShell/profile.ps1": powerExtraText,
  };
  if (options.useBundled) {
    extraShells = {
      "C:/Miniconda/etc/profile.d/conda.sh": bashExtraText,
      "C:/Miniconda/etc/fish/conf.d/conda.fish": bashExtraText,
      "C:/Miniconda/condabin/conda_hook.bat": batchExtraText,
    };
  } else {
    extraShells = {
      "C:/Miniconda3/etc/profile.d/conda.sh": bashExtraText,
      "C:/Miniconda3/etc/fish/conf.d/conda.fish": bashExtraText,
      "C:/Miniconda3/condabin/conda_hook.bat": batchExtraText,
    };
  }
  const allShells: types.IShells = { ...shells, ...extraShells };
  Object.keys(allShells).forEach((key) => {
    let filePath: string = key.replace("~", os.homedir());
    const text = allShells[key];
    if (fs.existsSync(filePath)) {
      core.info(`Append to "${filePath}":\n ${text} \n`);
      fs.appendFileSync(filePath, text);
    }
  });
}

/**
 * fix permissions for bundled miniconda installs
 */
async function fixPermissions(options: types.IDynamicOptions): Promise<void> {
  switch (constants.PLATFORM) {
    case "darwin":
      await utils.execute([
        "sudo",
        "chown",
        "-R",
        `${process.env.USER}:staff`,
        condaBasePath(options),
      ]);
      break;
    case "win32":
      for (let folder of constants.WIN_PERMS_FOLDERS) {
        const ownPath = path.join(condaBasePath(options), folder);
        if (fs.existsSync(ownPath)) {
          await utils.execute(["takeown", "/f", ownPath, "/r", "/d", "y"]);
        }
      }
      break;
    default:
      break;
  }
}

/**
 * Setup Conda configuration
 */
export async function applyCondaConfiguration(
  inputs: types.IActionInputs,
  options: types.IDynamicOptions
): Promise<void> {
  const configEntries = Object.entries(inputs.condaConfig) as [
    keyof types.ICondaConfig,
    string
  ][];

  // channels are special: if specified as an action input, these take priority
  let channels = inputs.condaConfig.channels
    .trim()
    .split(/[,\n]/)
    .map((c) => c.trim())
    .filter((c) => c.length);

  if (!channels.length && options.envSpec?.yaml?.channels?.length) {
    channels = options.envSpec.yaml.channels;
  }

  // LIFO: reverse order to preserve higher priority as listed in the option
  for (const channel of channels.reverse()) {
    core.info(`Adding channel '${channel}'`);
    await condaCommand(["config", "--add", "channels", channel], options);
  }

  // all other options
  for (const [key, value] of configEntries) {
    if (value.trim().length === 0 || key === "channels") {
      continue;
    }
    core.info(`${key}: ${value}`);
    try {
      await condaCommand(["config", "--set", key, value], options);
    } catch (err) {
      core.warning(err);
    }
  }

  // log all config
  await condaCommand(["config", "--show-sources"], options);
  await condaCommand(["config", "--show"], options);
}

/**
 * Create a baseline .condarc
 */
export async function bootstrapConfig(): Promise<void> {
  await fs.promises.writeFile(
    constants.CONDARC_PATH,
    constants.BOOTSTRAP_CONDARC
  );
}

/**
 * Copy the given condarc file into place
 */
export async function copyConfig(inputs: types.IActionInputs) {
  const sourcePath: string = path.join(
    process.env["GITHUB_WORKSPACE"] || "",
    inputs.condaConfigFile
  );
  core.info(`Copying "${sourcePath}" to "${constants.CONDARC_PATH}..."`);
  await io.cp(sourcePath, constants.CONDARC_PATH);
}

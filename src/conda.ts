//-----------------------------------------------------------------------
// Conda helpers
//-----------------------------------------------------------------------

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import * as core from "@actions/core";
import * as io from "@actions/io";

import * as types from "./types";
import * as constants from "./constants";
import * as utils from "./utils";

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
  return await utils.execute(command);
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
 * Initialize Conda
 */
export async function condaInit(
  inputs: types.IActionInputs,
  options: types.IDynamicOptions
): Promise<void> {
  let ownPath: string;
  const isValidActivate: boolean =
    inputs.activateEnvironment !== "base" &&
    inputs.activateEnvironment !== "root" &&
    inputs.activateEnvironment !== "";
  const autoActivateBase: boolean =
    options.condaConfig["auto_activate_base"] === "true";

  // Fix ownership of folders
  if (options.useBundled) {
    if (constants.IS_MAC) {
      core.startGroup("Fixing conda folders ownership");
      const userName: string = process.env.USER as string;
      await utils.execute([
        "sudo",
        "chown",
        "-R",
        `${userName}:staff`,
        condaBasePath(options),
      ]);
      core.endGroup();
    } else if (constants.IS_WINDOWS) {
      for (let folder of [
        "condabin/",
        "Scripts/",
        "shell/",
        "etc/profile.d/",
        "/Lib/site-packages/xonsh/",
      ]) {
        ownPath = path.join(condaBasePath(options), folder);
        if (fs.existsSync(ownPath)) {
          core.startGroup(`Fixing ${folder} ownership`);
          await utils.execute(["takeown", "/f", ownPath, "/r", "/d", "y"]);
          core.endGroup();
        }
      }
    }
  }

  // Remove profile files
  if (inputs.removeProfiles == "true") {
    for (let rc of [
      ".bashrc",
      ".bash_profile",
      ".config/fish/config.fish",
      ".profile",
      ".tcshrc",
      ".xonshrc",
      ".zshrc",
      ".config/powershell/profile.ps1",
      "Documents/PowerShell/profile.ps1",
      "Documents/WindowsPowerShell/profile.ps1",
    ]) {
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
    // TODO: determine when it's safe to use mamba
    await utils.execute([
      condaExecutable({ ...options, useMamba: false }),
      "init",
      cmd,
    ]);
  }

  // Rename files
  if (constants.IS_LINUX) {
    let source: string = "~/.bashrc".replace("~", os.homedir());
    let dest: string = "~/.profile".replace("~", os.homedir());
    core.info(`Renaming "${source}" to "${dest}"\n`);
    await io.mv(source, dest);
  } else if (constants.IS_MAC) {
    let source: string = "~/.bash_profile".replace("~", os.homedir());
    let dest: string = "~/.profile".replace("~", os.homedir());
    core.info(`Renaming "${source}" to "${dest}"\n`);
    await io.mv(source, dest);
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

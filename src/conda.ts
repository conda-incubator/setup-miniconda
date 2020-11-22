//-----------------------------------------------------------------------
// Conda helpers
//-----------------------------------------------------------------------

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import * as core from "@actions/core";
import * as io from "@actions/io";

import { IS_LINUX, IS_MAC, IS_WINDOWS, MINICONDA_DIR_PATH } from "./constants";
import { IShells, TCondaConfig } from "./types";
import { execute } from "./utils";

/**
 * Provide current location of miniconda or location where it will be installed
 */
export function minicondaPath(useBundled: boolean = true): string {
  let condaPath: string = MINICONDA_DIR_PATH;
  if (!useBundled) {
    if (IS_MAC) {
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
export function condaExecutable(
  useBundled: boolean,
  useMamba: boolean = false
): string {
  const dir: string = minicondaPath(useBundled);
  let condaExe: string;
  let commandName: string;
  commandName = useMamba ? "mamba" : "conda";
  commandName = IS_WINDOWS ? commandName + ".bat" : commandName;
  condaExe = path.join(dir, "condabin", commandName);
  return condaExe;
}

/**
 * Run Conda command
 */
export async function condaCommand(
  cmd: string[],
  useBundled: boolean,
  useMamba: boolean = false
): Promise<void> {
  const command = [condaExecutable(useBundled, useMamba), ...cmd];
  return await execute(command);
}

/**
 * Setup Conda configuration
 */
export async function applyCondaConfiguration(
  condaConfig: TCondaConfig,
  useBundled: boolean
): Promise<void> {
  for (const key of Object.keys(condaConfig)) {
    core.info(`"${key}": "${condaConfig[key]}"`);
    if (condaConfig[key].length !== 0) {
      if (key === "channels") {
        // Split by comma and reverse order to preserve higher priority
        // as listed in the option
        let channels: Array<string> = condaConfig[key].split(",").reverse();
        let channel: string;
        for (channel of channels) {
          await condaCommand(
            ["config", "--add", key, channel],
            useBundled,
            false
          );
        }
      } else {
        try {
          await condaCommand(
            ["config", "--set", key, condaConfig[key]],
            useBundled,
            false
          );
        } catch (err) {
          core.warning(`Couldn't set conda configuration '${key}'`);
        }
      }
    }
  }

  await condaCommand(["config", "--show-sources"], useBundled, false);

  await condaCommand(["config", "--show"], useBundled, false);
}

/**
 * Initialize Conda
 */
export async function condaInit(
  activateEnvironment: string,
  useBundled: boolean,
  condaConfig: TCondaConfig,
  removeProfiles: string
): Promise<void> {
  let ownPath: string;
  const isValidActivate: boolean =
    activateEnvironment !== "base" &&
    activateEnvironment !== "root" &&
    activateEnvironment !== "";
  const autoActivateBase: boolean =
    condaConfig["auto_activate_base"] === "true";

  // Fix ownership of folders
  if (useBundled) {
    if (IS_MAC) {
      core.startGroup("Fixing conda folders ownership");
      const userName: string = process.env.USER as string;
      await execute([
        "sudo",
        "chown",
        "-R",
        `${userName}:staff`,
        minicondaPath(useBundled),
      ]);
      core.endGroup();
    } else if (IS_WINDOWS) {
      for (let folder of [
        "condabin/",
        "Scripts/",
        "shell/",
        "etc/profile.d/",
        "/Lib/site-packages/xonsh/",
      ]) {
        ownPath = path.join(minicondaPath(useBundled), folder);
        if (fs.existsSync(ownPath)) {
          core.startGroup(`Fixing ${folder} ownership`);
          await execute(["takeown", "/f", ownPath, "/r", "/d", "y"]);
          core.endGroup();
        }
      }
    }
  }

  // Remove profile files
  if (removeProfiles == "true") {
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
    await execute([condaExecutable(useBundled, false), "init", cmd]);
  }

  // Rename files
  if (IS_LINUX) {
    let source: string = "~/.bashrc".replace("~", os.homedir());
    let dest: string = "~/.profile".replace("~", os.homedir());
    core.info(`Renaming "${source}" to "${dest}"\n`);
    await io.mv(source, dest);
  } else if (IS_MAC) {
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
  conda activate ${activateEnvironment}`;
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
  conda activate ${activateEnvironment}`;
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
  @CALL "%CONDA_BAT%" activate ${activateEnvironment}`;
  }
  batchExtraText += `
  :: Conda Setup Action: Basic configuration
  @SETLOCAL EnableExtensions
  @SETLOCAL DisableDelayedExpansion
  :: ---------------------------------------------------------------------------`;

  let extraShells: IShells;
  const shells: IShells = {
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
  if (useBundled) {
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
  const allShells: IShells = { ...shells, ...extraShells };
  Object.keys(allShells).forEach((key) => {
    let filePath: string = key.replace("~", os.homedir());
    const text = allShells[key];
    if (fs.existsSync(filePath)) {
      core.info(`Append to "${filePath}":\n ${text} \n`);
      fs.appendFileSync(filePath, text);
    }
  });
}

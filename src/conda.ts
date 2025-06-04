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
export function condaBasePath(
  inputs: types.IActionInputs,
  options: types.IDynamicOptions,
): string {
  let condaPath: string;
  if (options.useBundled) {
    condaPath = constants.MINICONDA_DIR_PATH;
  } else if (inputs.installationDir) {
    condaPath = constants.IS_WINDOWS
      ? inputs.installationDir.replace("/", "\\")
      : inputs.installationDir;
  } else {
    condaPath = path.join(os.homedir(), "miniconda3");
  }
  return condaPath;
}

/**
 * Provide conda CLI arguments for identifying an env by name or prefix/path
 *
 * ### Note
 * Only really detects by presence of a path separator, as the path may not yet exist
 */
export function envCommandFlag(inputs: types.IActionInputs): string[] {
  return [
    inputs.activateEnvironment.match(/(\\|\/)/) ? "--prefix" : "--name",
    inputs.activateEnvironment,
  ];
}

/**
 * Provide cross platform location of conda/mamba executable in condabin and bin
 */
export function condaExecutableLocations(
  inputs: types.IActionInputs,
  options: types.IDynamicOptions,
  subcommand?: string,
): string[] {
  const dir: string = condaBasePath(inputs, options);
  let condaExes: string[] = [];
  let commandName = "conda";
  if (
    options.useMamba &&
    (subcommand == null || constants.MAMBA_SUBCOMMANDS.includes(subcommand))
  ) {
    commandName = "mamba";
  }
  condaExes.push(
    path.join(
      dir,
      "condabin",
      constants.IS_WINDOWS ? commandName + ".bat" : commandName,
    ),
  );
  if (constants.IS_WINDOWS) {
    condaExes.push(path.join(dir, "Library", "bin", commandName + ".exe"));
  } else {
    condaExes.push(path.join(dir, "bin", commandName));
  }
  return condaExes;
}

/**
 *  Return existing conda or mamba executable
 */
export function condaExecutable(
  inputs: types.IActionInputs,
  options: types.IDynamicOptions,
  subcommand?: string,
) {
  const locations = condaExecutableLocations(inputs, options, subcommand);
  for (const exe of locations) {
    if (fs.existsSync(exe)) return exe;
  }
  throw Error(
    `No existing ${
      options.useMamba ? "mamba" : "conda"
    } executable found at any of ${locations}`,
  );
}

/**
 * Detect the presence of mamba
 */
export function isMambaInstalled(
  inputs: types.IActionInputs,
  options: types.IDynamicOptions,
) {
  for (const exe of condaExecutableLocations(inputs, {
    ...options,
    useMamba: true,
  })) {
    if (fs.existsSync(exe)) return true;
  }
  return false;
}

/**
 * Run Conda command
 */
export async function condaCommand(
  cmd: string[],
  inputs: types.IActionInputs,
  options: types.IDynamicOptions,
  captureOutput: boolean = false,
): Promise<void | string> {
  const command = [condaExecutable(inputs, options, cmd[0]), ...cmd];
  let env: { [key: string]: string } = {};
  if (options.useMamba) {
    env.MAMBA_ROOT_PREFIX = condaBasePath(inputs, options);
  }
  return await utils.execute(command, env, captureOutput);
}

/**
 * Create a baseline .condarc
 */
export async function bootstrapConfig(): Promise<void> {
  await fs.promises.writeFile(
    constants.CONDARC_PATH,
    constants.BOOTSTRAP_CONDARC,
  );
}

/**
 * Copy the given condarc file into place
 */
export async function copyConfig(inputs: types.IActionInputs) {
  const sourcePath: string = path.join(
    process.env["GITHUB_WORKSPACE"] || "",
    inputs.condaConfigFile,
  );
  core.info(`Copying "${sourcePath}" to "${constants.CONDARC_PATH}..."`);
  await io.cp(sourcePath, constants.CONDARC_PATH);
}

/**
 * Setup Conda configuration
 */
export async function applyCondaConfiguration(
  inputs: types.IActionInputs,
  options: types.IDynamicOptions,
): Promise<void> {
  const configEntries = Object.entries(inputs.condaConfig) as [
    keyof types.ICondaConfig,
    string,
  ][];

  // Channels are special: if specified as an action input, these take priority
  // over what is found in (at present) a YAML-based environment
  let channels = inputs.condaConfig.channels
    .trim()
    .split(/,/)
    .map((c) => c.trim())
    .filter((c) => c.length);

  if (!channels.length && options.envSpec?.yaml?.channels?.length) {
    channels = options.envSpec.yaml.channels;
  }

  // This can be enabled via conda-remove-defaults and channels = nodefaults
  let removeDefaults: boolean = inputs.condaRemoveDefaults === "true";

  // LIFO: reverse order to preserve higher priority as listed in the option
  // .slice ensures working against a copy
  for (const channel of channels.slice().reverse()) {
    if (channel === "nodefaults") {
      core.warning(
        "'nodefaults' channel detected: will remove 'defaults' if added implicitly. " +
          "In the future, 'nodefaults' to remove 'defaults' won't be supported. " +
          "Please set 'conda-remove-defaults' = 'true' in setup-miniconda to remove this warning.",
      );
      removeDefaults = true;
      continue;
    }
    core.info(`Adding channel '${channel}'`);
    await condaCommand(
      ["config", "--add", "channels", channel],
      inputs,
      options,
    );
  }

  if (!channels.includes("defaults")) {
    if (removeDefaults) {
      core.info("Removing implicitly added 'defaults' channel");
      const configsOutput = (await condaCommand(
        ["config", "--show-sources", "--json"],
        inputs,
        options,
        true,
      )) as string;
      const configs = JSON.parse(configsOutput) as Record<
        string,
        types.ICondaConfig
      >;
      for (const fileName in configs) {
        if (configs[fileName].channels?.includes("defaults")) {
          await condaCommand(
            ["config", "--remove", "channels", "defaults", "--file", fileName],
            inputs,
            options,
          );
        }
      }
    } else {
      core.warning(
        "The 'defaults' channel might have been added implicitly. " +
          "If this is intentional, add 'defaults' to the 'channels' list. " +
          "Otherwise, consider setting 'conda-remove-defaults' to 'true'.",
      );
    }
  }

  // Package directories are also comma-separated, like channels
  let pkgsDirs = utils.parsePkgsDirs(inputs.condaConfig.pkgs_dirs);
  for (const pkgsDir of pkgsDirs) {
    core.info(`Adding pkgs_dir '${pkgsDir}'`);
    await condaCommand(
      ["config", "--add", "pkgs_dirs", pkgsDir],
      inputs,
      options,
    );
  }
  // auto_activate_base was renamed to auto_activate in 25.5.0
  core.info(`auto_activate: ${inputs.condaConfig.auto_activate_base}`);
  try {
    // 25.5.0+
    await condaCommand(
      [
        "config",
        "--set",
        "auto_activate",
        inputs.condaConfig.auto_activate_base,
      ],
      inputs,
      options,
    );
  } catch (err) {
    try {
      // <25.5.0
      await condaCommand(
        [
          "config",
          "--set",
          "auto_activate_base",
          inputs.condaConfig.auto_activate_base,
        ],
        inputs,
        options,
      );
    } catch (err2) {
      core.warning(err2 as Error);
    }
  }

  // All other options are just passed as their string representations
  for (const [key, value] of configEntries) {
    if (
      value.trim().length === 0 ||
      key === "channels" ||
      key === "pkgs_dirs" ||
      key === "auto_activate_base"
    ) {
      continue;
    }
    core.info(`${key}: ${value}`);
    try {
      await condaCommand(["config", "--set", key, value], inputs, options);
    } catch (err) {
      core.warning(err as Error);
    }
  }

  // Log all configuration information
  await condaCommand(["config", "--show-sources"], inputs, options);
  await condaCommand(["config", "--show"], inputs, options);
}

/**
 * Initialize Conda
 */
export async function condaInit(
  inputs: types.IActionInputs,
  options: types.IDynamicOptions,
): Promise<void> {
  let ownPath: string;
  const isValidActivate = !utils.isBaseEnv(inputs.activateEnvironment);
  const autoActivateBase: boolean =
    options.condaConfig["auto_activate_base"] === "true";

  // Fix ownership of folders
  if (options.useBundled) {
    if (constants.IS_MAC) {
      core.info("Fixing conda folders ownership");
      const userName: string = process.env.USER as string;
      await utils.execute([
        "sudo",
        "chown",
        "-R",
        `${userName}:staff`,
        condaBasePath(inputs, options),
      ]);
    } else if (constants.IS_WINDOWS) {
      for (let folder of constants.WIN_PERMS_FOLDERS) {
        ownPath = path.join(condaBasePath(inputs, options), folder);
        if (fs.existsSync(ownPath)) {
          core.info(`Fixing ${folder} ownership`);
          await utils.execute(["takeown", "/f", ownPath, "/r", "/d", "y"]);
        }
      }
    }
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
        core.warning(err as Error);
      }
    }
  }

  // Run conda init
  for (let cmd of ["--all"]) {
    await condaCommand(["init", cmd], inputs, options);
  }

  if (inputs.removeProfiles == "true") {
    // Rename files
    if (constants.IS_LINUX) {
      let source: string = "~/.bashrc".replace("~", os.homedir());
      let dest: string = "~/.profile".replace("~", os.homedir());
      if (fs.existsSync(source)) {
        core.info(`Renaming "${source}" to "${dest}"\n`);
        await io.mv(source, dest);
      }
    } else if (constants.IS_MAC) {
      let source: string = "~/.bash_profile".replace("~", os.homedir());
      let dest: string = "~/.profile".replace("~", os.homedir());
      if (fs.existsSync(source)) {
        core.info(`Renaming "${source}" to "${dest}"\n`);
        await io.mv(source, dest);
      }
    }
  }

  // PowerShell profiles
  let powerExtraText = `
  # ----------------------------------------------------------------------------`;
  if (isValidActivate) {
    powerExtraText += `
  # Conda Setup Action: Custom activation
  conda activate "${inputs.activateEnvironment}"`;
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
  conda activate "${inputs.activateEnvironment}"`;
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
  @CALL "%CONDA_BAT%" activate "${inputs.activateEnvironment}"`;
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
      "~/miniconda3/etc/profile.d/conda.sh": bashExtraText,
      "~/miniconda3/etc/fish/conf.d/conda.fish": bashExtraText,
      "~/miniconda3/condabin/conda_hook.bat": batchExtraText,
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

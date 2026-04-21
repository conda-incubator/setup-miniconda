/**
 * @module conda
 * High-level helpers for locating, running, and configuring a conda or
 * mamba installation, including shell initialization and `.condarc` management.
 *
 * @category Core
 */

//-----------------------------------------------------------------------
// Conda helpers
//-----------------------------------------------------------------------

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import * as yaml from "js-yaml";
import * as core from "@actions/core";
import * as io from "@actions/io";

import * as types from "./types";
import * as constants from "./constants";
import * as utils from "./utils";

/**
 * Return the base path of the conda installation, determined by whether
 * the bundled install, a custom directory, or the default `~/miniconda3` is in use.
 *
 * @param inputs - The parsed action inputs.
 * @param options - The current dynamic options.
 * @returns The absolute path to the conda base directory.
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
 * Return the conda CLI flags for identifying an environment by name or prefix.
 *
 * ### Note
 * Only really detects by presence of a path separator, as the path may not yet exist.
 *
 * @param inputs - The parsed action inputs.
 * @returns A two-element array of `["--name"|"--prefix", envName]`.
 */
export function envCommandFlag(inputs: types.IActionInputs): [string, string] {
  return [
    inputs.activateEnvironment.match(/(\\|\/)/) ? "--prefix" : "--name",
    inputs.activateEnvironment,
  ];
}

/**
 * Return candidate paths where the conda or mamba executable might exist,
 * checking both `condabin` and platform-specific binary directories.
 *
 * @param inputs - The parsed action inputs.
 * @param options - The current dynamic options.
 * @param subcommand - If provided, mamba is only used when it supports this subcommand.
 * @returns An array of candidate executable paths.
 */
export function condaExecutableLocations(
  inputs: types.IActionInputs,
  options: types.IDynamicOptions,
  subcommand?: string,
): string[] {
  const dir: string = condaBasePath(inputs, options);
  const condaExes: string[] = [];
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
 * Find and return the first existing conda or mamba executable, throwing
 * an error if none of the candidate locations exist on disk.
 *
 * @param inputs - The parsed action inputs.
 * @param options - The current dynamic options.
 * @param subcommand - If provided, mamba is only used when it supports this subcommand.
 * @returns The absolute path to the found executable.
 * @throws {Error} If no conda or mamba executable exists at any candidate location.
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
 * Check whether a mamba executable exists in the current conda installation.
 *
 * @param inputs - The parsed action inputs.
 * @param options - The current dynamic options.
 * @returns `true` if mamba is found at any candidate location.
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
 * Run a conda or mamba CLI command, resolving the executable and setting
 * `MAMBA_ROOT_PREFIX` when mamba is in use.
 *
 * @param cmd - The conda subcommand and arguments (e.g. `["install", "numpy"]`).
 * @param inputs - The parsed action inputs.
 * @param options - The current dynamic options.
 * @param captureOutput - When `true`, returns stdout as a string.
 * @returns The captured stdout if `captureOutput` is `true`, otherwise void.
 * @throws {Error} If the command exits with a non-zero return code.
 *
 * @example
 * ```ts
 * // Install numpy into the active env
 * await condaCommand(["install", "numpy"], inputs, options);
 *
 * // Capture JSON config output
 * const json = await condaCommand(
 *   ["config", "--show", "--json"], inputs, options, true
 * );
 * ```
 */
export async function condaCommand(
  cmd: string[],
  inputs: types.IActionInputs,
  options: types.IDynamicOptions,
  captureOutput: boolean = false,
): Promise<void | string> {
  const command = [condaExecutable(inputs, options, cmd[0]), ...cmd];
  const env: { [key: string]: string } = {};
  if (options.useMamba) {
    env["MAMBA_ROOT_PREFIX"] = condaBasePath(inputs, options);
  }
  return await utils.execute(command, env, captureOutput);
}

/**
 * Write a minimal bootstrap `.condarc` file to suppress early warnings.
 */
export async function bootstrapConfig(): Promise<void> {
  await fs.promises.writeFile(
    constants.CONDARC_PATH,
    constants.BOOTSTRAP_CONDARC,
  );
}

const BOOLEAN_CONDARC_KEYS = new Set([
  "add_anaconda_token",
  "add_pip_as_python_dependency",
  "allow_softlinks",
  "auto_activate_base",
  "auto_update_conda",
  "show_channel_urls",
  "use_only_tar_bz2",
  "always_yes",
  "changeps1",
  "notify_outdated_conda",
]);

const KNOWN_CONDARC_KEYS = new Set([
  ...BOOLEAN_CONDARC_KEYS,
  "channels",
  "channel_alias",
  "channel_priority",
  "channel_settings",
  "custom_channels",
  "custom_multichannels",
  "default_channels",
  "default_activation_env",
  "denylist_channels",
  "allowlist_channels",
  "create_default_packages",
  "envs_dirs",
  "override_channels_enabled",
  "pkgs_dirs",
  "proxy_servers",
  "repodata_threads",
  "restore_free_channel",
  "safety_checks",
  "solver",
  "ssl_verify",
  "auto_activate",
]);

const TRUTHY_VALUES = new Set(["true", "yes", "on", "y", "1"]);
const FALSY_VALUES = new Set(["false", "no", "off", "n", "0"]);

/**
 * Coerce a string value to its appropriate YAML type for a given condarc key.
 * Handles all YAML 1.1 boolean literals (true/false/yes/no/on/off/y/n/1/0).
 *
 * @param key - The condarc configuration key name.
 * @param value - The raw string value from the action input.
 * @returns The coerced boolean or original string value.
 */
function coerceConfigValue(key: string, value: string): boolean | string {
  if (BOOLEAN_CONDARC_KEYS.has(key)) {
    const lower = value.toLowerCase();
    if (TRUTHY_VALUES.has(lower)) return true;
    if (FALSY_VALUES.has(lower)) return false;
  }
  return value;
}

/**
 * Build the complete conda configuration and write it directly to ~/.condarc.
 *
 * This replaces the old approach of spawning N `conda config --set/--add`
 * subprocesses (each taking 2-5s for Python/conda startup overhead).
 *
 * @param inputs - The parsed action inputs.
 * @param options - The current dynamic options.
 */
export async function writeCondaConfig(
  inputs: types.IActionInputs,
  options: types.IDynamicOptions,
): Promise<void> {
  let config: Record<string, unknown> = {};

  if (fs.existsSync(constants.CONDARC_PATH)) {
    const existingConfig = yaml.load(
      fs.readFileSync(constants.CONDARC_PATH, "utf8"),
    ) as Record<string, unknown> | null;
    if (existingConfig) {
      config = { ...existingConfig };
      core.info(
        `Read existing condarc from ${constants.CONDARC_PATH} as base config`,
      );
    }
  }

  if (inputs.condaConfigFile) {
    const sourcePath = path.join(
      process.env["GITHUB_WORKSPACE"] || "",
      inputs.condaConfigFile,
    );
    core.info(`Reading user condarc from "${sourcePath}"...`);
    const userConfig = yaml.load(fs.readFileSync(sourcePath, "utf8")) as Record<
      string,
      unknown
    > | null;
    if (userConfig) {
      config = { ...config, ...userConfig };
    }
  }

  config["notify_outdated_conda"] = false;

  // --- Channels ---
  let channels = inputs.condaConfig.channels
    .trim()
    .split(/,/)
    .map((c) => c.trim())
    .filter((c) => c.length);

  if (!channels.length && options.envSpec?.yaml?.channels?.length) {
    channels = options.envSpec.yaml.channels;
  }

  let removeDefaults: boolean = inputs.condaRemoveDefaults === "true";

  const filteredChannels: string[] = [];
  for (const channel of channels) {
    if (channel === "nodefaults") {
      core.warning(
        "'nodefaults' channel detected: will remove 'defaults' if added implicitly. " +
          "In the future, 'nodefaults' to remove 'defaults' won't be supported. " +
          "Please set 'conda-remove-defaults' = 'true' in setup-miniconda to remove this warning.",
      );
      removeDefaults = true;
      continue;
    }
    filteredChannels.push(channel);
  }

  const existingChannels = (config["channels"] as string[]) || [];
  const userExplicitlyAddedDefaults = filteredChannels.includes("defaults");

  if (filteredChannels.length) {
    const merged = [
      ...filteredChannels,
      ...existingChannels.filter((c) => !filteredChannels.includes(c)),
    ];
    if (removeDefaults && !userExplicitlyAddedDefaults) {
      config["channels"] = merged.filter((c) => c !== "defaults");
      core.info("Removing implicitly added 'defaults' channel");
    } else {
      config["channels"] = merged;
    }
  } else if (removeDefaults) {
    config["channels"] = existingChannels.filter((c) => c !== "defaults");
    core.info("Removing implicitly added 'defaults' channel");
  } else if (!existingChannels.length) {
    core.warning(
      "The 'defaults' channel might have been added implicitly. " +
        "If this is intentional, add 'defaults' to the 'channels' list. " +
        "Otherwise, consider setting 'conda-remove-defaults' to 'true'.",
    );
  }

  for (const ch of (config["channels"] as string[]) || []) {
    core.info(`Channel: '${ch}'`);
  }

  // --- Package directories ---
  const inputPkgsDirs = utils.parsePkgsDirs(inputs.condaConfig.pkgs_dirs);
  const existingPkgsDirs = (config["pkgs_dirs"] as string[]) || [];
  const mergedPkgsDirs = [
    ...inputPkgsDirs,
    ...existingPkgsDirs.filter((d) => !inputPkgsDirs.includes(d)),
  ];
  config["pkgs_dirs"] = mergedPkgsDirs;
  for (const pkgsDir of mergedPkgsDirs) {
    core.info(`pkgs_dir: '${pkgsDir}'`);
  }

  // --- auto_activate_base ---
  // Write auto_activate_base for broad compatibility. Conda 25.5.0+ also
  // accepts auto_activate as the canonical name, but older versions only
  // recognize auto_activate_base.
  config["auto_activate_base"] = coerceConfigValue(
    "auto_activate_base",
    inputs.condaConfig.auto_activate,
  );
  core.info(`auto_activate_base: ${config["auto_activate_base"]}`);

  // --- All other config entries ---
  const SKIP_KEYS = new Set([
    "channels",
    "pkgs_dirs",
    "auto_activate",
    "default_activation_env",
  ]);
  const configEntries = Object.entries(inputs.condaConfig) as [
    keyof types.ICondaConfig,
    string,
  ][];

  for (const [key, value] of configEntries) {
    if (SKIP_KEYS.has(key) || value.trim().length === 0) {
      continue;
    }
    const coerced = coerceConfigValue(key, value);
    config[key] = coerced;
    core.info(`${key}: ${coerced}`);
  }

  // Strip 'defaults' from prefix-level condarc files too
  if (removeDefaults && !userExplicitlyAddedDefaults) {
    const basePath = condaBasePath(inputs, options);
    const prefixCondarcPaths = [
      path.join(basePath, ".condarc"),
      path.join(basePath, "condarc"),
    ];
    for (const condarcPath of prefixCondarcPaths) {
      if (!fs.existsSync(condarcPath)) continue;
      try {
        const prefixConfig = yaml.load(
          fs.readFileSync(condarcPath, "utf8"),
        ) as Record<string, unknown> | null;
        if (
          prefixConfig?.["channels"] &&
          Array.isArray(prefixConfig["channels"]) &&
          (prefixConfig["channels"] as string[]).includes("defaults")
        ) {
          prefixConfig["channels"] = (
            prefixConfig["channels"] as string[]
          ).filter((c: string) => c !== "defaults");
          const updatedYaml = yaml.dump(prefixConfig, { lineWidth: -1 });
          fs.writeFileSync(condarcPath, updatedYaml, "utf8");
          core.info(
            `Removed 'defaults' channel from prefix condarc at ${condarcPath}`,
          );
        }
      } catch (err) {
        core.warning(
          `Failed to process prefix condarc at ${condarcPath}: ${err}`,
        );
      }
    }
  }

  for (const key of Object.keys(config)) {
    if (!KNOWN_CONDARC_KEYS.has(key)) {
      core.warning(
        `Unrecognized condarc key '${key}'. This may be a typo or a ` +
          `key from a newer conda version. conda will ignore unknown keys.`,
      );
    }
  }

  const configYaml = yaml.dump(config, { lineWidth: -1 });
  core.info(`Writing condarc to ${constants.CONDARC_PATH}:\n${configYaml}`);
  fs.writeFileSync(constants.CONDARC_PATH, configYaml, "utf8");

  if (core.isDebug()) {
    await condaCommand(["config", "--show"], inputs, options);
  }
}

/**
 * Resolve an environment name or path to a fully-qualified absolute path.
 *
 * @param inputPathOrName - An environment name or path (e.g. `"myenv"` or `"~/envs/myenv"`).
 * @param inputs - The parsed action inputs.
 * @param options - The current dynamic options.
 * @returns The resolved absolute path to the environment directory.
 */
function _getFullEnvironmentPath(
  inputPathOrName: string,
  inputs: types.IActionInputs,
  options: types.IDynamicOptions,
): string {
  if (!inputPathOrName.includes("/")) {
    // likely an environment name
    const installationDirectory = condaBasePath(inputs, options);
    if (utils.isBaseEnv(inputPathOrName)) {
      return path.resolve(installationDirectory);
    }
    return path.resolve(installationDirectory, "envs", inputPathOrName);
  }
  if (inputPathOrName.startsWith("~/")) {
    return path.resolve(os.homedir(), inputPathOrName.slice(2));
  }
  return path.resolve(inputPathOrName);
}

/**
 * Determine whether the given environment is the default activation target,
 * either via `default_activation_env` config or by being a base environment alias.
 *
 * Determined locally from condarc files (user-level and prefix-level),
 * avoiding a conda subprocess call.
 *
 * @param envName - The environment name to check.
 * @param inputs - The parsed action inputs.
 * @param options - The current dynamic options.
 * @returns `true` if the environment is the default activation target.
 */
function isDefaultEnvironment(
  envName: string,
  inputs: types.IActionInputs,
  options: types.IDynamicOptions,
): boolean {
  if (envName === "") {
    return false;
  }

  const basePath = condaBasePath(inputs, options);
  const condarcLocations = [
    constants.CONDARC_PATH,
    path.join(basePath, ".condarc"),
    path.join(basePath, "condarc"),
  ];

  for (const condarcPath of condarcLocations) {
    if (!fs.existsSync(condarcPath)) continue;
    try {
      const condarcConfig = yaml.load(
        fs.readFileSync(condarcPath, "utf8"),
      ) as Record<string, unknown> | null;
      if (condarcConfig?.["default_activation_env"]) {
        const defaultEnv = _getFullEnvironmentPath(
          condarcConfig["default_activation_env"] as string,
          inputs,
          options,
        );
        const activationEnv = _getFullEnvironmentPath(envName, inputs, options);
        return defaultEnv === activationEnv;
      }
    } catch {
      // Continue to next condarc location
    }
  }

  return utils.isBaseEnv(envName);
}

/**
 * Initialize conda shell integration for all shells, fix folder ownership
 * on bundled installs, and remove/rename profile files.
 *
 * @param inputs - The parsed action inputs.
 * @param options - The current dynamic options.
 */
export async function condaInit(
  inputs: types.IActionInputs,
  options: types.IDynamicOptions,
): Promise<void> {
  // Fix ownership of folders
  if (options.useBundled) {
    if (constants.IS_MAC) {
      core.info("Fixing conda folders ownership");
      const userName: string = os.userInfo().username;
      await utils.execute([
        "sudo",
        "chown",
        "-R",
        `${userName}:staff`,
        condaBasePath(inputs, options),
      ]);
    } else if (constants.IS_WINDOWS) {
      const basePath = condaBasePath(inputs, options);
      const takeownPromises = constants.WIN_PERMS_FOLDERS.map((folder) => {
        const ownPath = path.join(basePath, folder);
        if (fs.existsSync(ownPath)) {
          core.info(`Fixing ${folder} ownership`);
          return utils.execute(["takeown", "/f", ownPath, "/r", "/d", "y"]);
        }
        return undefined;
      }).filter(Boolean) as Promise<void | string>[];
      await Promise.all(takeownPromises);
    }
  }

  // Skip conda init and all profile modifications if run-init is false
  if (inputs.runInit == "false") {
    core.info("Skipping conda init and profile modifications (run-init=false)");
  } else {
    // Remove profile files
    if (inputs.removeProfiles == "true") {
      for (const rc of constants.PROFILES) {
        try {
          const file: string = path.join(os.homedir(), rc);
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
    for (const cmd of ["--all"]) {
      await condaCommand(["init", cmd], inputs, options);
    }

    if (inputs.removeProfiles == "true") {
      // Rename files
      if (constants.IS_LINUX) {
        const source: string = "~/.bashrc".replace("~", os.homedir());
        const dest: string = "~/.profile".replace("~", os.homedir());
        if (fs.existsSync(source)) {
          core.info(`Renaming "${source}" to "${dest}"\n`);
          await io.mv(source, dest);
        }
      } else if (constants.IS_MAC) {
        const source: string = "~/.bash_profile".replace("~", os.homedir());
        const dest: string = "~/.profile".replace("~", os.homedir());
        if (fs.existsSync(source)) {
          core.info(`Renaming "${source}" to "${dest}"\n`);
          await io.mv(source, dest);
        }
      }
    }
  }
}

/**
 * Append activation commands to all shell profile files so that
 * subsequent workflow steps start with the correct environment active.
 *
 * This must be called AFTER the target environment has been created,
 * otherwise `.bat` wrappers (which source `conda_hook.bat`) would try
 * to activate a non-existent environment during setup and emit false
 * warnings (see #474).
 *
 * @param inputs - The parsed action inputs.
 * @param options - The current dynamic options.
 */
export async function condaInitActivation(
  inputs: types.IActionInputs,
  options: types.IDynamicOptions,
): Promise<void> {
  // Skip profile modifications when run-init is false (mirrors condaInit guard)
  if (inputs.runInit == "false") {
    core.info("Skipping activation profile modifications (run-init=false)");
    return;
  }

  const isValidActivate =
    !!inputs.activateEnvironment &&
    !isDefaultEnvironment(inputs.activateEnvironment, inputs, options);
  const autoActivateDefault: boolean =
    options.condaConfig.auto_activate === "true";
  const installationDirectory = condaBasePath(inputs, options);

  // PowerShell profiles
  // NOTE: Using array.join() to prevent auto-formatters from adding indentation
  const powerLines: string[] = [
    "",
    "# ----------------------------------------------------------------------------",
  ];
  if (isValidActivate) {
    powerLines.push(
      "# Conda Setup Action: Custom activation",
      `conda activate "${inputs.activateEnvironment}"`,
    );
  }
  powerLines.push(
    "# ----------------------------------------------------------------------------",
  );
  const powerExtraText = powerLines.join("\n");

  // Bash profiles
  // NOTE: Using array.join() to prevent auto-formatters from adding indentation
  const bashLines: string[] = [
    "",
    "# ----------------------------------------------------------------------------",
    "# Conda Setup Action: Basic configuration",
    "set -eo pipefail",
  ];
  if (isValidActivate) {
    bashLines.push(
      "# Conda Setup Action: Custom activation",
      `conda activate "${inputs.activateEnvironment}"`,
      "# ----------------------------------------------------------------------------",
    );
  }
  const bashExtraText = bashLines.join("\n");

  // Xonsh profiles
  // NOTE: Using array.join() to prevent auto-formatters from adding indentation
  const xonshLines: string[] = [
    "",
    "# ----------------------------------------------------------------------------",
    "# Conda Setup Action: Basic configuration",
    "$RAISE_SUBPROC_ERROR = True", // equivalent to: set -e
    "$XONSH_PIPEFAIL = True", // equivalent to: set -o pipefail
  ];
  if (isValidActivate) {
    xonshLines.push(
      "# Conda Setup Action: Custom activation",
      `conda activate "${inputs.activateEnvironment}"`,
      "# ----------------------------------------------------------------------------",
    );
  }
  const xonshExtraText = xonshLines.join("\n");

  // Batch profiles
  // NOTE: Using array.join() to prevent auto-formatters from adding indentation
  const batchLines: string[] = [
    "",
    ":: ---------------------------------------------------------------------------",
  ];
  if (autoActivateDefault) {
    batchLines.push(
      ":: Conda Setup Action: Activate default environment",
      '@CALL "%CONDA_BAT%" activate',
    );
  }
  if (isValidActivate) {
    batchLines.push(
      ":: Conda Setup Action: Custom activation",
      `@CALL "%CONDA_BAT%" activate "${inputs.activateEnvironment}"`,
    );
  }
  batchLines.push(
    ":: Conda Setup Action: Basic configuration",
    "@SETLOCAL EnableExtensions",
    "@SETLOCAL DisableDelayedExpansion",
    ":: ---------------------------------------------------------------------------",
  );
  const batchExtraText = batchLines.join("\n");

  const shells: types.IShells = {
    "~/.bash_profile": bashExtraText,
    "~/.profile": bashExtraText,
    "~/.zshrc": bashExtraText,
    "~/.config/fish/config.fish": bashExtraText,
    "~/.tcshrc": bashExtraText,
    "~/.xonshrc": xonshExtraText,
    "~/.config/powershell/profile.ps1": powerExtraText,
    "~/Documents/PowerShell/profile.ps1": powerExtraText,
    "~/Documents/WindowsPowerShell/profile.ps1": powerExtraText,
    [path.join(installationDirectory, "etc", "profile.d", "conda.sh")]:
      bashExtraText,
    [path.join(installationDirectory, "etc", "fish", "conf.d", "conda.fish")]:
      bashExtraText,
    [path.join(installationDirectory, "condabin", "conda_hook.bat")]:
      batchExtraText,
  };
  Object.keys(shells).forEach((key) => {
    const filePath: string = key.replace("~", os.homedir());
    const text = shells[key];
    if (text != null && fs.existsSync(filePath)) {
      core.info(`Append to "${filePath}":\n ${text} \n`);
      fs.appendFileSync(filePath, text);
    }
  });
}

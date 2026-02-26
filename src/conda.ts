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

const BOOLEAN_CONDARC_KEYS = new Set([
  "add_anaconda_token",
  "add_pip_as_python_dependency",
  "allow_softlinks",
  "auto_activate",
  "auto_update_conda",
  "show_channel_urls",
  "use_only_tar_bz2",
  "always_yes",
  "changeps1",
  "notify_outdated_conda",
]);

/**
 * Well-known conda configuration keys (from conda's context.py).
 * Used to warn about possible typos in user-provided config.
 */
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
  "auto_activate_base",
]);

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

const TRUTHY_VALUES = new Set(["true", "yes", "on", "y", "1"]);
const FALSY_VALUES = new Set(["false", "no", "off", "n", "0"]);

/**
 * Coerce a string value to its appropriate YAML type for a given condarc key.
 * Handles all YAML 1.1 boolean literals (true/false/yes/no/on/off/y/n/1/0).
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
 */
export async function writeCondaConfig(
  inputs: types.IActionInputs,
  options: types.IDynamicOptions,
): Promise<void> {
  // Start with any existing ~/.condarc that the installer may have written
  // (e.g., Miniforge sets channels: [conda-forge]). This preserves
  // installer-embedded config that users of custom installer-url may rely on.
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

  // Overlay the user-provided condarc file on top of the installer's config
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

  // Always suppress outdated conda notifications
  config.notify_outdated_conda = false;

  // --- Channels ---
  // Channels are written in the input order, which gives the first channel
  // highest priority. This matches the old behavior: the old code called
  // `conda config --add` (which prepends) in reverse order, so the two
  // inversions cancelled out and produced the same result as writing in order.
  let channels = inputs.condaConfig.channels
    .trim()
    .split(/,/)
    .map((c) => c.trim())
    .filter((c) => c.length);

  if (!channels.length && options.envSpec?.yaml?.channels?.length) {
    channels = options.envSpec.yaml.channels;
  }

  let removeDefaults: boolean = inputs.condaRemoveDefaults === "true";

  // Filter out 'nodefaults' pseudo-channel and set the removeDefaults flag
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

  // Merge action-input channels with any existing channels from the user condarc,
  // with action-input channels taking higher priority (prepended).
  const existingChannels = (config.channels as string[]) || [];

  if (filteredChannels.length) {
    const merged = [
      ...filteredChannels,
      ...existingChannels.filter((c) => !filteredChannels.includes(c)),
    ];
    if (removeDefaults) {
      config.channels = merged.filter((c) => c !== "defaults");
      core.info("Removing implicitly added 'defaults' channel");
    } else {
      config.channels = merged;
    }
  } else if (removeDefaults) {
    config.channels = existingChannels.filter((c) => c !== "defaults");
    core.info("Removing implicitly added 'defaults' channel");
  } else if (!existingChannels.length) {
    core.warning(
      "The 'defaults' channel might have been added implicitly. " +
        "If this is intentional, add 'defaults' to the 'channels' list. " +
        "Otherwise, consider setting 'conda-remove-defaults' to 'true'.",
    );
  }

  for (const ch of (config.channels as string[]) || []) {
    core.info(`Channel: '${ch}'`);
  }

  // --- Package directories ---
  // Merge with any existing pkgs_dirs from the user condarc
  const inputPkgsDirs = utils.parsePkgsDirs(inputs.condaConfig.pkgs_dirs);
  const existingPkgsDirs = (config.pkgs_dirs as string[]) || [];
  const mergedPkgsDirs = [
    ...inputPkgsDirs,
    ...existingPkgsDirs.filter((d) => !inputPkgsDirs.includes(d)),
  ];
  config.pkgs_dirs = mergedPkgsDirs;
  for (const pkgsDir of mergedPkgsDirs) {
    core.info(`pkgs_dir: '${pkgsDir}'`);
  }

  // --- auto_activate (canonical name since conda 25.5.0) ---
  // `auto_activate_base` was renamed to `auto_activate` in conda 25.5.0
  // and is deprecated, scheduled for removal in conda 26.3.
  config.auto_activate = coerceConfigValue(
    "auto_activate",
    inputs.condaConfig.auto_activate,
  );
  delete config.auto_activate_base;
  core.info(`auto_activate: ${config.auto_activate}`);

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

  // If removeDefaults is set, also strip 'defaults' from prefix-level condarc
  // files that the installer or system may have written. The old subprocess-based
  // approach handled all config sources; we need to replicate that.
  if (removeDefaults) {
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
          prefixConfig?.channels &&
          Array.isArray(prefixConfig.channels) &&
          prefixConfig.channels.includes("defaults")
        ) {
          prefixConfig.channels = prefixConfig.channels.filter(
            (c: string) => c !== "defaults",
          );
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

  // Warn about unrecognized keys (catches typos that the old conda config
  // subprocess would have warned about)
  for (const key of Object.keys(config)) {
    if (!KNOWN_CONDARC_KEYS.has(key)) {
      core.warning(
        `Unrecognized condarc key '${key}'. This may be a typo or a ` +
          `key from a newer conda version. conda will ignore unknown keys.`,
      );
    }
  }

  // Write the config file
  const configYaml = yaml.dump(config, { lineWidth: -1 });
  core.info(`Writing condarc to ${constants.CONDARC_PATH}:\n${configYaml}`);
  fs.writeFileSync(constants.CONDARC_PATH, configYaml, "utf8");

  // Single diagnostic command for debugging
  if (core.isDebug()) {
    await condaCommand(["config", "--show"], inputs, options);
  }
}

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
 * Whether an environment is the default environment.
 *
 * Determined locally from condarc files (user-level and prefix-level),
 * avoiding a conda subprocess call.
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
      const config = yaml.load(fs.readFileSync(condarcPath, "utf8")) as Record<
        string,
        unknown
      > | null;
      if (config?.default_activation_env) {
        const defaultEnv = _getFullEnvironmentPath(
          config.default_activation_env as string,
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
 * Initialize Conda
 */
export async function condaInit(
  inputs: types.IActionInputs,
  options: types.IDynamicOptions,
): Promise<void> {
  const isValidActivate = !isDefaultEnvironment(
    inputs.activateEnvironment,
    inputs,
    options,
  );
  const autoActivateDefault: boolean =
    options.condaConfig.auto_activate === "true";
  const basePath = condaBasePath(inputs, options);

  // Fix ownership of folders
  if (options.useBundled) {
    if (constants.IS_MAC) {
      core.info("Fixing conda folders ownership");
      const userName: string = process.env.USER as string;
      // chown the entire base path to ensure conda init --all has write
      // access everywhere it needs (bin, condabin, etc/profile.d, shell,
      // lib/pythonX.Y/site-packages/xonsh, etc.)
      await utils.execute([
        "sudo",
        "chown",
        "-R",
        `${userName}:staff`,
        basePath,
      ]);
    } else if (constants.IS_WINDOWS) {
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
    [path.join(basePath, "etc", "profile.d", "conda.sh")]: bashExtraText,
    [path.join(basePath, "etc", "fish", "conf.d", "conda.fish")]: bashExtraText,
    [path.join(basePath, "condabin", "conda_hook.bat")]: batchExtraText,
  };
  Object.keys(shells).forEach((key) => {
    let filePath: string = key.replace("~", os.homedir());
    const text = shells[key];
    if (fs.existsSync(filePath)) {
      core.info(`Append to "${filePath}":\n ${text} \n`);
      fs.appendFileSync(filePath, text);
    }
  });
}

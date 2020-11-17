import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as stream from "stream";
import { URL } from "url";

import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as io from "@actions/io";
import * as tc from "@actions/tool-cache";
import * as yaml from "js-yaml";
import getHrefs from "get-hrefs";
import * as utils from "./utils";

//-----------------------------------------------------------------------
// Types & Interfaces
//-----------------------------------------------------------------------
interface ISucceedResult {
  ok: true;
  data: string;
}
interface IFailedResult {
  ok: false;
  error: Error;
}
type Result = ISucceedResult | IFailedResult;

export interface IArchitectures {
  [key: string]: string;
}

export interface IOperatingSystems {
  [key: string]: string;
}

export interface IShells {
  [key: string]: string;
}

type TCondaConfig = any;
type TEnvironment = any;

/**
 * Metadata needed to attempt retrieving an installer from, or to update, the tool cache
 */
interface ILocalInstallerOpts {
  url: string;
  tool?: string;
  version?: string;
  arch?: string;
}

//-----------------------------------------------------------------------
// Constants
//-----------------------------------------------------------------------
const MINICONDA_DIR_PATH: string = process.env["CONDA"] || "";
const IS_WINDOWS: boolean = process.platform === "win32";
const IS_MAC: boolean = process.platform === "darwin";
const IS_LINUX: boolean = process.platform === "linux";
const IS_UNIX: boolean = IS_MAC || IS_LINUX;
const MINICONDA_BASE_URL: string = "https://repo.anaconda.com/miniconda/";

const ARCHITECTURES: IArchitectures = {
  x64: "x86_64",
  x86: "x86",
  ARM64: "aarch64", // To be supported by github runners
  ARM32: "armv7l", // To be supported by github runners
};

const OS_NAMES: IOperatingSystems = {
  win32: "Windows",
  darwin: "MacOSX",
  linux: "Linux",
};

const KNOWN_EXTENSIONS = [".exe", ".sh"];

/**
 * errors that are always probably spurious
 */
const IGNORED_WARNINGS = [
  // appear on win install, we can swallow them
  `menuinst_win32`,
  `Unable to register environment`,
  `0%|`,
  // appear on certain Linux/OSX installers
  `Please run using "bash"`,
  // old condas don't know what to do with these
  `Key 'use_only_tar_bz2' is not a known primitive parameter.`,
];

/**
 * warnings that should be errors
 */
const FORCED_ERRORS = [
  // conda env create will ignore invalid sections and move on
  `EnvironmentSectionNotValid`,
];

/**
 * avoid spurious conda warnings before we have a chance to update them
 */
const BOOTSTRAP_CONDARC = "notify_outdated_conda: false";

/**
 * the conda config file
 */
const CONDARC_PATH = path.join(os.homedir(), ".condarc");

/**
 * Run exec.exec with error handling
 */
async function execute(command: string[]): Promise<Result> {
  let options: exec.ExecOptions = {
    errStream: new stream.Writable(),
    listeners: {
      stdout: (data: Buffer) => {
        const stringData = data.toString();
        for (const forced_error of FORCED_ERRORS) {
          if (stringData.includes(forced_error)) {
            throw new Error(`"${command}" failed with "${forced_error}"`);
          }
        }
        return data;
      },
      stderr: (data: Buffer) => {
        const stringData = data.toString();
        for (const ignore of IGNORED_WARNINGS) {
          if (stringData.includes(ignore)) {
            return;
          }
        }
        core.warning(stringData);
      },
    },
  };

  try {
    await exec.exec(command[0], command.slice(1), options);
  } catch (err) {
    return { ok: false, error: err };
  }

  return { ok: true, data: "ok" };
}

//-----------------------------------------------------------------------
// Conda helpers
//-----------------------------------------------------------------------
/**
 * Provide current location of miniconda or location where it will be installed
 */
function minicondaPath(useBundled: boolean = true): string {
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
function condaExecutable(
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
 * Check if a given conda environment exists
 */
function environmentExists(name: string, useBundled: boolean): boolean {
  const condaMetaPath: string = path.join(
    minicondaPath(useBundled),
    "envs",
    name,
    "conda-meta"
  );
  return fs.existsSync(condaMetaPath);
}

/**
 * List available Miniconda versions
 *
 * @param arch
 */
async function minicondaVersions(arch: string): Promise<string[]> {
  try {
    let extension: string = IS_UNIX ? "sh" : "exe";
    const downloadPath: string = await tc.downloadTool(MINICONDA_BASE_URL);
    const content: string = fs.readFileSync(downloadPath, "utf8");
    let hrefs: string[] = getHrefs(content);
    hrefs = hrefs.filter((item: string) => item.startsWith("/Miniconda3"));
    hrefs = hrefs.filter((item: string) =>
      item.endsWith(`${arch}.${extension}`)
    );
    hrefs = hrefs.map((item: string) => item.substring(1));
    return hrefs;
  } catch (err) {
    core.warning(err);
    return [];
  }
}

/**
 * Download specific version miniconda defined by version, arch and python major version
 *
 * @param pythonMajorVersion
 * @param minicondaVersion
 * @param architecture
 */
async function downloadMiniconda(
  pythonMajorVersion: number,
  minicondaVersion: string,
  architecture: string
): Promise<Result> {
  // Check valid arch
  const arch: string = ARCHITECTURES[architecture];
  if (!arch) {
    return { ok: false, error: new Error(`Invalid arch "${architecture}"!`) };
  }

  let extension: string = IS_UNIX ? "sh" : "exe";
  let osName: string = OS_NAMES[process.platform];
  const minicondaInstallerName: string = `Miniconda${pythonMajorVersion}-${minicondaVersion}-${osName}-${arch}.${extension}`;
  core.info(minicondaInstallerName);

  // Check version name
  let versions: string[] = await minicondaVersions(arch);
  if (versions) {
    if (!versions.includes(minicondaInstallerName)) {
      return {
        ok: false,
        error: new Error(
          `Invalid miniconda version!\n\nMust be among ${versions.toString()}`
        ),
      };
    }
  }

  try {
    const downloadPath = await ensureLocalInstaller({
      url: MINICONDA_BASE_URL + minicondaInstallerName,
      tool: `Miniconda${pythonMajorVersion}`,
      version: minicondaVersion,
      arch: arch,
    });
    return { ok: true, data: downloadPath };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * @param url A URL for a file with the CLI of a `constructor`-built artifact
 */
async function downloadCustomInstaller(url: string): Promise<Result> {
  try {
    const downloadPath = await ensureLocalInstaller({ url });
    return { ok: true, data: downloadPath };
  } catch (error) {
    return { ok: false, error };
  }
}

/** Get the path for a locally-executable installer from cache, or as downloaded
 *
 * @returns the local path to the installer (with the correct extension)
 *
 * ### Notes
 * Assume `url` at least ends with the correct executable extension
 * for this platform, but don't make any other assumptions about `url`'s format:
 * - might include GET params (?&) and hashes (#),
 * - was not built with `constructor` (but still has the same CLI),
 * - or has been renamed during a build process
 */
async function ensureLocalInstaller(
  options: ILocalInstallerOpts
): Promise<string> {
  core.startGroup("Ensuring Installer...");

  const { pathname } = new URL(options.url);
  const installerName = path.basename(pathname);
  // as a URL, we assume posix paths
  const installerExtension = path.posix.extname(installerName);
  const tool = options.tool != null ? options.tool : installerName;
  // create a fake version if neccessary
  const version =
    options.version != null
      ? options.version
      : "0.0.0-" +
        crypto.createHash("sha256").update(options.url).digest("hex");

  core.info(`Checking for cached ${tool}@${version}...`);
  // Look for cache to use
  let executablePath = tc.find(installerName, version);

  if (executablePath !== "") {
    core.info(`Found ${installerName} cache at ${executablePath}!`);
  } else {
    core.info(`Did not find ${installerName} in cache, downloading...`);
    const rawDownloadPath = await tc.downloadTool(options.url);
    core.info(`Downloaded ${installerName}, appending ${installerExtension}`);
    // always ensure the installer ends with a known path
    executablePath = rawDownloadPath + installerExtension;
    await io.mv(rawDownloadPath, executablePath);
    core.info(`Caching ${tool}@${version}...`);
    const cacheResult = await tc.cacheFile(
      executablePath,
      installerName,
      tool,
      version,
      ...(options.arch ? [options.arch] : [])
    );
    core.info(`Cached ${tool}@${version}: ${cacheResult}!`);
  }
  core.endGroup();

  return executablePath;
}

/**
 * Install Miniconda
 *
 * @param installerPath must have an appropriate extension for this platform
 */
async function runInstaller(
  installerPath: string,
  useBundled: boolean
): Promise<Result> {
  const outputPath: string = minicondaPath(useBundled);
  const installerExtension = path.extname(installerPath);
  let command: string[];

  switch (installerExtension) {
    case ".exe":
      /* From https://docs.anaconda.com/anaconda/install/silent-mode/
        /D=<installation path> - Destination installation path.
                                - Must be the last argument.
                                - Do not wrap in quotation marks.
                                - Required if you use /S.
        For the above reasons, this is treated a monolithic arg
      */
      command = [
        `"${installerPath}" /InstallationType=JustMe /RegisterPython=0 /S /D=${outputPath}`,
      ];
      break;
    case ".sh":
      command = ["bash", installerPath, "-f", "-b", "-p", outputPath];
      break;
    default:
      return {
        ok: false,
        error: Error(`Unknown installer extension: ${installerExtension}`),
      };
  }

  core.info(`Install Command:\n\t${command}`);

  try {
    return await execute(command);
  } catch (err) {
    core.error(err);
    return { ok: false, error: err };
  }
}

/**
 * Run Conda command
 */
async function condaCommand(
  cmd: string[],
  useBundled: boolean,
  useMamba: boolean = false
): Promise<Result> {
  const command = [condaExecutable(useBundled, useMamba), ...cmd];
  return await execute(command);
}

/**
 * Add Conda executable to PATH
 */
async function setVariables(useBundled: boolean): Promise<Result> {
  try {
    // Set environment variables
    const condaBin: string = path.join(minicondaPath(useBundled), "condabin");
    const conda: string = minicondaPath(useBundled);
    core.info(`Add "${condaBin}" to PATH`);
    core.addPath(condaBin);
    if (!useBundled) {
      core.info(`Set 'CONDA="${conda}"'`);
      core.exportVariable("CONDA", conda);
    }
  } catch (err) {
    return { ok: false, error: err };
  }
  return { ok: true, data: "ok" };
}

/**
 * Create test environment
 */
async function createTestEnvironment(
  activateEnvironment: string,
  useBundled: boolean,
  useMamba: boolean
): Promise<Result> {
  let result: Result;
  if (
    activateEnvironment !== "root" &&
    activateEnvironment !== "base" &&
    activateEnvironment !== ""
  ) {
    if (!environmentExists(activateEnvironment, useBundled)) {
      core.startGroup("Create test environment...");
      result = await condaCommand(
        ["create", "--name", activateEnvironment],
        useBundled,
        useMamba
      );
      if (!result.ok) return result;
      core.endGroup();
    }
  } else {
    return {
      ok: false,
      error: new Error(
        'To activate "base" environment use the "auto-activate-base" action input!'
      ),
    };
  }
  return { ok: true, data: "ok" };
}

/**
 * Initialize Conda
 */
async function condaInit(
  activateEnvironment: string,
  useBundled: boolean,
  condaConfig: TCondaConfig,
  removeProfiles: string
): Promise<Result> {
  let result: Result;
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
      result = await execute([
        "sudo",
        "chown",
        "-R",
        `${userName}:staff`,
        minicondaPath(useBundled),
      ]);
      core.endGroup();
      if (!result.ok) return result;
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
          result = await execute(["takeown", "/f", ownPath, "/r", "/d", "y"]);
          core.endGroup();
          if (!result.ok) return result;
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
  return { ok: true, data: "ok" };
}

/**
 * Setup python test environment
 */
async function setupPython(
  activateEnvironment: string,
  pythonVersion: string,
  useBundled: boolean,
  useMamba: boolean
): Promise<Result> {
  return await condaCommand(
    ["install", "--name", activateEnvironment, `python=${pythonVersion}`],
    useBundled,
    useMamba
  );
}

/**
 * Setup Conda configuration
 */
async function applyCondaConfiguration(
  condaConfig: TCondaConfig,
  useBundled: boolean
): Promise<Result> {
  let result: Result;
  try {
    for (const key of Object.keys(condaConfig)) {
      core.info(`"${key}": "${condaConfig[key]}"`);
      if (condaConfig[key].length !== 0) {
        if (key === "channels") {
          // Split by comma and reverse order to preserve higher priority
          // as listed in the option
          let channels: Array<string> = condaConfig[key].split(",").reverse();
          let channel: string;
          for (channel of channels) {
            result = await condaCommand(
              ["config", "--add", key, channel],
              useBundled,
              false
            );
            if (!result.ok) return result;
          }
        } else {
          result = await condaCommand(
            ["config", "--set", key, condaConfig[key]],
            useBundled,
            false
          );
          if (!result.ok) return result;
        }
      }
    }

    result = await condaCommand(
      ["config", "--show-sources"],
      useBundled,
      false
    );
    if (!result.ok) return result;

    result = await condaCommand(["config", "--show"], useBundled, false);
    if (!result.ok) return result;
  } catch (err) {
    return { ok: false, error: err };
  }
  return { ok: true, data: "ok" };
}

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
    core.exportVariable(utils.ENV_VAR_CONDA_PKGS, cacheFolder);

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
      let condaAction: string;
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
        condaAction = "install";
        activateEnvironmentToUse = activateEnvironment;
        group = `Creating conda environment from explicit specs file...`;
      } else if (
        activateEnvironment &&
        environmentYaml["name"] !== undefined &&
        environmentYaml["name"] !== activateEnvironment
      ) {
        condaAction = "env create";
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
        condaAction = "env update";
        activateEnvironmentToUse = activateEnvironment;
      } else if (activateEnvironment && environmentYaml["name"] === undefined) {
        core.warning(
          'The environment name on "environment-file" is not defined, using "enviroment-activate"!'
        );
        condaAction = "env update";
        activateEnvironmentToUse = activateEnvironment;
      } else {
        activateEnvironmentToUse = activateEnvironment;
        condaAction = "env create";
      }

      core.startGroup(group.length ? group : `Running ${condaAction}`);

      result = await condaCommand(
        [
          condaAction,
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

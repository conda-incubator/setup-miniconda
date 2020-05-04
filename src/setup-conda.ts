import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as io from "@actions/io";
import * as tc from "@actions/tool-cache";
import * as yaml from "js-yaml";
import getHrefs from "get-hrefs";

//-----------------------------------------------------------------------
// Interfaces
//-----------------------------------------------------------------------
interface SucceedResult {
  ok: boolean;
  data: string | undefined;
}
interface FailedResult {
  ok: boolean;
  error: Error;
}
type Result = SucceedResult | FailedResult;

//-----------------------------------------------------------------------
// Constants
//-----------------------------------------------------------------------
const MINICONDA_DIR_PATH: string = process.env["CONDA"] || "";
const IS_WINDOWS: boolean = process.platform === "win32";
const IS_MAC: boolean = process.platform === "darwin";
const IS_LINUX: boolean = process.platform === "linux";
const IS_UNIX: boolean = IS_MAC || IS_LINUX;
const MINICONDA_BASE_URL: string = "https://repo.anaconda.com/miniconda/";
const ARCHITECTURES = {
  x64: "x86_64",
  x86: "x86",
  ARM64: "aarch64", // To be supported by github runners
  ARM32: "armv7l" // To be supported by github runners
};
const OS_NAMES = {
  win32: "Windows",
  darwin: "MacOSX",
  linux: "Linux"
};

//-----------------------------------------------------------------------
// General use
//-----------------------------------------------------------------------
/**
 * Pretty print section messages
 *
 * @param args
 */
function consoleLog(...args: string[]): void {
  for (let arg of args) {
    core.info("\n# " + arg);
    core.info("#".repeat(arg.length + 2) + "\n");
  }
}

/**
 * Run exec.exec with error handling
 */
async function execute(command: string): Promise<Result> {
  let options = { listeners: {} };
  let stringData: string;
  options.listeners = {
    stdout: (data: Buffer) => {
      // core.info(data.toString());
    },
    stderr: (data: Buffer) => {
      stringData = data.toString();
      // These warnings are appearing on win install, we can swallow them
      if (
        !stringData.includes("menuinst_win32") &&
        !stringData.includes("Unable to register environment") &&
        !stringData.includes("0%|")
      ) {
        core.warning(stringData);
      }
    }
  };

  try {
    await exec.exec(command, [], options);
  } catch (err) {
    return { ok: false, error: err };
  }

  return { ok: true, data: undefined };
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
 * Provide cross platform location of conda executable
 */
function condaExecutable(useBundled: boolean): string {
  const dir: string = minicondaPath(useBundled);
  let condaExe: string;
  condaExe = IS_UNIX ? `${dir}/condabin/conda` : `${dir}\\condabin\\conda.bat`;
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
 */
async function minicondaVersions(): Promise<string[]> {
  try {
    let extension: string = IS_UNIX ? "sh" : "exe";
    const downloadPath: string = await tc.downloadTool(MINICONDA_BASE_URL);
    const content: string = fs.readFileSync(downloadPath, "utf8");
    let hrefs: string[] = getHrefs(content);
    hrefs = hrefs.filter((item: string) => item.startsWith("/Miniconda3"));
    hrefs = hrefs.filter((item: string) =>
      item.endsWith(`x86_64.${extension}`)
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
  let downloadPath: string;
  let url: string;

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
  let versions: string[] = await minicondaVersions();
  if (versions) {
    if (!versions.includes(minicondaInstallerName)) {
      return {
        ok: false,
        error: new Error(
          `Invalid miniconda version!\n\nMust be among ${versions.toString()}`
        )
      };
    }
  }

  // Look for cache to use
  const cachedMinicondaInstallerPath = tc.find(
    `Miniconda${pythonMajorVersion}`,
    minicondaVersion,
    arch
  );

  if (cachedMinicondaInstallerPath) {
    core.info(`Found cache at ${cachedMinicondaInstallerPath}`);
    downloadPath = cachedMinicondaInstallerPath;
  } else {
    url = MINICONDA_BASE_URL + minicondaInstallerName;
    try {
      downloadPath = await tc.downloadTool(url);
      const options = { recursive: true, force: false };

      // Add extension to dowload
      await io.mv(downloadPath, downloadPath + `.${extension}`, options);
      downloadPath = downloadPath + `.${extension}`;

      core.info(`Saving cache...`);
      await tc.cacheFile(
        downloadPath,
        minicondaInstallerName,
        `Miniconda${pythonMajorVersion}`,
        minicondaVersion,
        arch
      );
    } catch (err) {
      return { ok: false, error: err };
    }
  }
  return { ok: true, data: downloadPath };
}

/**
 * Install Miniconda
 *
 * @param installerPath
 */
async function installMiniconda(
  installerPath: string,
  useBundled: boolean
): Promise<Result> {
  const outputPath: string = minicondaPath(useBundled);
  let command: string;

  // See: https://docs.anaconda.com/anaconda/install/silent-mode/
  if (IS_WINDOWS) {
    command = `${installerPath} /InstallationType=JustMe /RegisterPython=0 /S /D=${outputPath}`;
  } else {
    command = `bash "${installerPath}" -b -p ${outputPath}`;
  }

  let result: Result;
  try {
    result = await execute(command);
  } catch (err) {
    core.error(err);
    return { ok: false, error: err };
  }

  return { ok: true, data: result["data"] };
}

/**
 * Run Conda command
 */
async function condaCommand(cmd: string, useBundled): Promise<Result> {
  const command = `${condaExecutable(useBundled)} ${cmd}`;
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
  return { ok: true, data: undefined };
}

/**
 * Create test environment
 */
async function createTestEnvironment(
  activateEnvironment: string,
  useBundled: boolean
): Promise<Result> {
  let result: Result;
  if (
    activateEnvironment !== "root" &&
    activateEnvironment !== "base" &&
    activateEnvironment !== ""
  ) {
    if (!environmentExists(activateEnvironment, useBundled)) {
      consoleLog("Create test environment...");
      result = await condaCommand(
        `create --name ${activateEnvironment}`,
        useBundled
      );
      if (!result["ok"]) return result;
    }
  } else {
    return {
      ok: false,
      error: new Error(
        'To activate "base" environment use the "auto-activate-base" action input!'
      )
    };
  }
  return { ok: true, data: undefined };
}

/**
 * Initialize Conda
 */
async function condaInit(
  activateEnvironment: string,
  useBundled: boolean,
  condaConfig: any,
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
      result = await execute(
        `sudo chown -R ${userName}:staff ${minicondaPath(useBundled)}`
      );
      core.endGroup();
      if (!result.ok) return result;
    } else if (IS_WINDOWS) {
      for (let folder of [
        "condabin",
        "Scripts",
        "shell",
        "/etc/profile.d/",
        "/Lib/site-packages/xonsh",
        "/etc/profile.d/"
      ]) {
        ownPath = path.join(
          minicondaPath(useBundled).replace("\\", "/"),
          folder
        );
        if (fs.existsSync(ownPath)) {
          core.startGroup(`Fixing ${folder} ownership`);
          result = await execute(`takeown /f ${ownPath} /r /d y`);
          core.endGroup();
          if (!result.ok) return result;
        }
      }
    }
  }

  // Remove profile files
  if (removeProfiles == "true") {
    for (let rc of [
      "~/.bashrc",
      "~/.bash_profile",
      "~/.config/fish/config.fish",
      "~/.profile",
      "~/.tcshrc",
      "~/.xonshrc",
      "~/.zshrc",
      "~/.config/powershell/profile.ps1",
      "~/Documents/PowerShell/profile.ps1",
      "~/Documents/WindowsPowerShell/profile.ps1"
    ]) {
      try {
        let file: string = rc.replace("~", os.homedir().replace("\\", "/"));
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
  core.info("\n");
  for (let cmd of ["--all"]) {
    const command = `${condaExecutable(useBundled)} init ${cmd}`;
    await execute(command);
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

  let extraShells: object;
  const shells = {
    "~/.bash_profile": bashExtraText,
    "~/.profile": bashExtraText,
    "~/.zshrc": bashExtraText,
    "~/.config/fish/config.fish": bashExtraText,
    "~/.tcshrc": bashExtraText,
    "~/.xonshrc": bashExtraText,
    "~/.config/powershell/profile.ps1": powerExtraText,
    "~/Documents/PowerShell/profile.ps1": powerExtraText,
    "~/Documents/WindowsPowerShell/profile.ps1": powerExtraText
  };
  if (useBundled) {
    extraShells = {
      "C:/Miniconda/etc/profile.d/conda.sh": bashExtraText,
      "C:/Miniconda/etc/fish/conf.d/conda.fish": bashExtraText,
      "C:/Miniconda/condabin/conda_hook.bat": batchExtraText
    };
  } else {
    extraShells = {
      "C:/Miniconda3/etc/profile.d/conda.sh": bashExtraText,
      "C:/Miniconda3/etc/fish/conf.d/conda.fish": bashExtraText,
      "C:/Miniconda3/condabin/conda_hook.bat": batchExtraText
    };
  }
  const allShells = { ...shells, ...extraShells };
  Object.keys(allShells).forEach(key => {
    let filePath: string = key.replace("~", os.homedir());
    const text = allShells[key];
    if (fs.existsSync(filePath)) {
      core.info(`Append to "${filePath}":\n ${text} \n`);
      fs.appendFileSync(filePath, text);
    }
  });
  return { ok: true, data: undefined };
}

/**
 * Setup python test environment
 */
async function setupPython(
  activateEnvironment: string,
  pythonVersion: string,
  useBundled: boolean
): Promise<Result> {
  return await condaCommand(
    `install --name ${activateEnvironment} python=${pythonVersion} --quiet`,
    useBundled
  );
}

/**
 * Setup Conda configuration
 */
async function applyCondaConfiguration(
  condaConfig: string,
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
              `config --add ${key} ${channel}`,
              useBundled
            );
            if (!result.ok) return result;
          }
        } else {
          result = await condaCommand(
            `config --set ${key} ${condaConfig[key]}`,
            useBundled
          );
          if (!result.ok) return result;
        }
      }
    }

    result = await condaCommand(`config --show-sources`, useBundled);
    if (!result.ok) return result;

    result = await condaCommand(`config --show`, useBundled);
    if (!result.ok) return result;
  } catch (err) {
    return { ok: true, error: err };
  }
  return { ok: true, data: undefined };
}

/**
 * Main conda setup method to handle all configuration options
 */
async function setupMiniconda(
  minicondaVersion: string,
  architecture: string,
  condaVersion: string,
  condaBuildVersion: string,
  pythonVersion: string,
  activateEnvironment: string,
  environmentFile: string,
  condaConfigFile: string,
  condaConfig: any,
  removeProfiles: string
): Promise<Result> {
  let result: Result;
  let useBundled: boolean = true;
  try {
    // Check for consistency
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
        )
      };
    }

    if (minicondaVersion !== "" || architecture !== "x64") {
      consoleLog("\n# Downloading Miniconda...\n");
      useBundled = false;
      result = await downloadMiniconda(3, minicondaVersion, architecture);
      if (!result["ok"]) return result;

      consoleLog("Installing Miniconda...");
      result = await installMiniconda(result["data"], useBundled);
      if (!result["ok"]) return result;
    } else {
      consoleLog("Locating Miniconda...");
      core.info(minicondaPath());
      if (!fs.existsSync(minicondaPath())) {
        return { ok: false, error: new Error("Bundled Miniconda not found!") };
      }
    }

    consoleLog("Setup environment variables...");
    result = await setVariables(useBundled);
    if (!result["ok"]) return result;

    if (condaConfigFile) {
      consoleLog("Copying condarc file...");
      const destinationPath: string = path.join(os.homedir(), ".condarc");
      const sourcePath: string = path.join(
        process.env["GITHUB_WORKSPACE"] || "",
        condaConfigFile
      );
      core.info(`"${sourcePath}" to "${destinationPath}"`);
      try {
        await io.cp(sourcePath, destinationPath);
      } catch (err) {
        return { ok: false, error: err };
      }
    }

    if (condaConfig) {
      consoleLog("Applying conda configuration...");
      result = await applyCondaConfiguration(condaConfig, useBundled);
      if (!result["ok"]) return result;
    }

    consoleLog("Setup Conda basic configuration...");
    result = await condaCommand(
      "config --set always_yes yes --set changeps1 no",
      useBundled
    );
    if (!result["ok"]) return result;

    consoleLog("Initialize Conda and fix ownership...");
    result = await condaInit(
      activateEnvironment,
      useBundled,
      condaConfig,
      removeProfiles
    );
    if (!result["ok"]) return result;

    if (condaVersion) {
      consoleLog("Installing Conda...");
      result = await condaCommand(
        `install --name base conda=${condaVersion} --quiet`,
        useBundled
      );
      if (!result["ok"]) return result;
    }

    if (condaConfig["auto_update_conda"] == "true") {
      consoleLog("Updating conda...");
      result = await condaCommand("update conda --quiet", useBundled);
      if (!result["ok"]) return result;
    }

    // Any conda commands run here after init and setup
    if (condaBuildVersion) {
      consoleLog("Installing Conda Build...");
      result = await condaCommand(
        `install --name base conda-build=${condaBuildVersion} --quiet`,
        useBundled
      );
      if (!result["ok"]) return result;
    }

    if (activateEnvironment) {
      result = await createTestEnvironment(activateEnvironment, useBundled);
      if (!result["ok"]) return result;
    }

    if (pythonVersion && activateEnvironment) {
      consoleLog(
        `Installing Python="${pythonVersion}" on "${activateEnvironment}" environment...`
      );
      result = await setupPython(
        activateEnvironment,
        pythonVersion,
        useBundled
      );
      if (!result["ok"]) return result;
    }

    if (environmentFile) {
      let environmentYaml: any;
      let condaAction: string;
      try {
        const sourceEnvironmentPath: string = path.join(
          process.env["GITHUB_WORKSPACE"] || "",
          environmentFile
        );
        environmentYaml = await yaml.safeLoad(
          fs.readFileSync(sourceEnvironmentPath, "utf8")
        );
      } catch (err) {
        return { ok: false, error: err };
      }
      if (
        activateEnvironment &&
        environmentYaml["name"] !== undefined &&
        environmentYaml["name"] !== activateEnvironment
      ) {
        condaAction = "create";
        consoleLog(`Creating conda environment from yaml file...`);
        core.warning(
          'The environment name on "environment-file" is not the same as "enviroment-activate"!'
        );
      } else if (
        activateEnvironment &&
        activateEnvironment === environmentYaml["name"]
      ) {
        consoleLog(`Updating conda environment from yaml file...`);
        condaAction = "update";
      } else {
        condaAction = "create";
      }
      result = await condaCommand(
        `env ${condaAction} -f ${environmentFile} --quiet`,
        useBundled
      );
      if (!result["ok"]) return result;
    }
  } catch (err) {
    return { ok: false, error: err };
  }
  return { ok: true, data: undefined };
}

export { setupMiniconda };

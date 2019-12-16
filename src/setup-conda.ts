import * as fs from "fs";
import * as os from "os";
import * as util from "util";

import axios from "axios";
import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";

const appendFile = util.promisify(fs.appendFile);
const writeFile = util.promisify(fs.writeFile);
const exec = util.promisify(require("child_process").exec);

const IS_WINDOWS = process.platform === "win32";
const IS_MAC = process.platform === "darwin";
const IS_LINUX = process.platform === "linux";
const IS_UNIX = IS_MAC || IS_LINUX;
let minicondaBaseUrl: string = "https://repo.continuum.io/miniconda/";

/**
 *
 */
function minicondaInstallerPath() {
  let osName: string;
  let extension: string;

  if (IS_LINUX) {
    osName = "Linux";
    extension = "sh";
  } else if (IS_MAC) {
    osName = "MacOSX";
    extension = "sh";
  } else {
    osName = "Windows";
    extension = "exe";
  }

  return `~/miniconda.${extension}`.replace("~", os.homedir);
}

/**
 *
 */
function condaExecutable() {
  let condaExe;
  if (IS_UNIX) {
    condaExe = "~/miniconda/condabin/conda";
  } else {
    condaExe = "C:\\Miniconda\\condabin\\conda.bat";
  }
  return condaExe.replace("~", os.homedir);
}

function condaDirPath() {
  let condaPath;
  if (IS_UNIX) {
    condaPath = "~/miniconda";
  } else {
    condaPath = "C:\\Miniconda";
  }
  return condaPath.replace("~", os.homedir);
}

/**
 *
 * @param url
 * @param dest
 */
async function download(url: string, dest: string) {
  let result: string = "";
  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    if (response.status === 200) {
      await writeFile(dest, response.data);
      result = dest;
      console.log(`Saving to "${dest}"`);
    }
  } catch (error) {
    console.error(`Error: ${error}`);
  }
  return result;
}

/**
 *
 * @param pythonMajorVersion
 * @param minicondaVersion
 * @param arch
 */
async function downloadMiniconda(
  pythonMajorVersion: number,
  minicondaVersion: string,
  arch: string
) {
  let result;
  let extension: string;
  let minicondaInstallerName: string;
  let url: string;
  let osName: string;

  // Check valid arch
  const archs = ["ppc64le", "x86_64", "x86"];

  if (IS_LINUX) {
    osName = "Linux";
    extension = "sh";
  } else if (IS_MAC) {
    osName = "MacOSX";
    extension = "sh";
  } else {
    osName = "Windows";
    extension = "exe";
  }
  minicondaInstallerName = `Miniconda${pythonMajorVersion}-${minicondaVersion}-${osName}-${arch}.${extension}`;

  // Look for cache to use
  const cachedMinicondaPath = tc.find(
    `Miniconda${pythonMajorVersion}`,
    minicondaVersion,
    arch
  );
  if (cachedMinicondaPath) {
    console.log(`Found cache at ${cachedMinicondaPath}`);
    result = cachedMinicondaPath;
  } else {
    const downloadPath = minicondaInstallerPath();

    url = minicondaBaseUrl + minicondaInstallerName;
    result = await download(url, downloadPath);
    console.log(`Saving cache...`);
    await tc.cacheFile(
      downloadPath,
      minicondaInstallerName,
      `Miniconda${pythonMajorVersion}`,
      minicondaVersion,
      arch
    );
  }
  return result;
}

/**
 * Install Miniconda
 *
 * @param file
 */
async function installMiniconda(installerPath: string) {
  if (IS_WINDOWS) {
    // Conda comes with the VM so we skip for now
    return "";
  } else {
    const outputPath: string = "~/miniconda".replace("~", os.homedir);
    const command: string = `bash "${installerPath}" -b -p ${outputPath}`;
    console.log(command);
    const { stdout, stderr } = await exec(command);
    console.log("\nstdout:\n", stdout);
    console.error("\nstderr:\n", stderr);
  }
}

/**
 *
 */
async function setVariables() {
  let condaBin: string;
  let minicondaBin: string;

  if (IS_UNIX) {
    minicondaBin = "~/miniconda/bin";
    condaBin = "~/miniconda/condabin";
  } else {
    minicondaBin = "C:\\Miniconda\\Scripts";
    condaBin = "C:\\Miniconda\\condabin";
  }

  // Set environment variables
  console.log(`Add "${condaBin}" to PATH`);
  core.addPath(condaBin);
  console.log(`Add "${minicondaBin}" to PATH`);
  core.addPath(minicondaBin);

  if (IS_WINDOWS) {
    const condaBat = condaExecutable();
    console.log(`Add CONDA_BAT="${condaBat}"`);
    core.exportVariable("CONDA_BAT", condaBat);
  }
}

/**
 *
 */
async function setConfiguration() {
  const command = `${condaExecutable()} config --set always_yes yes --set changeps1 no`;
  console.log(command);
  const { stdout, stderr } = await exec(command);
  console.log(stdout);
  // console.error("\nstderr:\n", stderr);
}

/**
 *
 */
async function condaInstall(ref) {
  const command = `${condaExecutable()} install -q ${ref}`;
  console.log(command);
  const { stdout, stderr } = await exec(command);
  console.log(stdout);
  // console.error("\nstderr:\n", stderr);
}

/**
 *
 */
async function condaInit() {
  // const command = 'eval "$(conda shell.bash hook)"';
  // const command = 'echo "$(conda shell.bash hook)" >> ~/.bashrc';

  if (IS_UNIX) {
    const shrc = "~/.bashrc".replace("~", os.homedir);
    const bashrc = "~/.profile".replace("~", os.homedir);
    const condaFolderPath = condaDirPath();
    const bashInitText = `
# >>> conda initialize >>>
# !! Contents within this block are managed by 'conda init' !!
__conda_setup="$('${condaExecutable()}' 'shell.bash' 'hook' 2> /dev/null)"
if [ $? -eq 0 ]; then
    eval "$__conda_setup"
else
    if [ -f "${condaFolderPath}/etc/profile.d/conda.sh" ]; then
        . "${condaFolderPath}/etc/profile.d/conda.sh"
    else
        export PATH="${condaFolderPath}/bin:$PATH"
    fi
fi
unset __conda_setup
# <<< conda initialize <<<
`;
    console.log(`Append to ${bashrc}:\n\n ${bashInitText} \n\n`);
    await appendFile(bashrc, bashInitText);
    console.log(`Append to ${shrc}:\n\n ${bashInitText} \n\n`);
    await appendFile(shrc, bashInitText);
  } else {
    for (let cmd of ["powershell", "cmd.exe"]) {
      const command = `${condaExecutable()} init ${cmd}`;
      console.log(command);
      const { stdout, stderr } = await exec(command);
      console.log(stdout);
    }
  }
}

/**
 *
 */
async function setupMiniconda(condaVersion, condaBuildVersion) {
  if (IS_UNIX) {
    console.log("\n# Downloading Miniconda...\n");
    let dest: string = await downloadMiniconda(3, "latest", "x86_64");

    console.log("\n# Installing Miniconda...\n");
    await installMiniconda(dest);
  }

  console.log("\n# Setup environment variables...\n");
  await setVariables();

  console.log("\n# Setup Conda configuration...\n");
  await setConfiguration();

  if (condaBuildVersion) {
    console.log("\n# Installing Conda...\n");
    await condaInstall(`conda=${condaVersion}`);
  }

  if (condaBuildVersion) {
    console.log("\n# Installing Conda Build...\n");
    await condaInstall(`conda-build=${condaBuildVersion}`);
  }

  console.log("\n# Initialize Conda...\n");
  await condaInit();
}

/* Miniconda Versions
Miniconda2-4.7.12.1-Linux-ppc64le.sh
Miniconda2-4.7.12.1-Linux-x86_64.sh
Miniconda2-4.7.12.1-MacOSX-x86_64.pkg
Miniconda2-4.7.12.1-MacOSX-x86_64.sh
Miniconda2-4.7.12.1-Windows-x86.exe
Miniconda2-4.7.12.1-Windows-x86_64.exe
Miniconda2-latest-Linux-ppc64le.sh
Miniconda2-latest-Linux-x86_64.sh
Miniconda2-latest-MacOSX-x86_64.pkg
Miniconda2-latest-MacOSX-x86_64.sh
Miniconda2-latest-Windows-x86.exe
Miniconda2-latest-Windows-x86_64.exe
Miniconda3-4.7.12.1-Linux-ppc64le.sh
Miniconda3-4.7.12.1-Linux-x86_64.sh
Miniconda3-4.7.12.1-MacOSX-x86_64.pkg
Miniconda3-4.7.12.1-MacOSX-x86_64.sh
Miniconda3-4.7.12.1-Windows-x86.exe
Miniconda3-4.7.12.1-Windows-x86_64.exe
Miniconda3-latest-Linux-ppc64le.sh
Miniconda3-latest-Linux-x86_64.sh
Miniconda3-latest-MacOSX-x86_64.pkg
Miniconda3-latest-MacOSX-x86_64.sh
Miniconda3-latest-Windows-x86.exe
Miniconda3-latest-Windows-x86_64.exe
Miniconda2-4.7.12-Linux-ppc64le.sh
Miniconda2-4.7.12-Linux-x86_64.sh
Miniconda2-4.7.12-MacOSX-x86_64.pkg
Miniconda2-4.7.12-MacOSX-x86_64.sh
Miniconda2-4.7.12-Windows-x86.exe
Miniconda2-4.7.12-Windows-x86_64.exe
Miniconda3-4.7.12-Linux-ppc64le.sh
Miniconda3-4.7.12-Linux-x86_64.sh
Miniconda3-4.7.12-MacOSX-x86_64.pkg
Miniconda3-4.7.12-MacOSX-x86_64.sh
Miniconda3-4.7.12-Windows-x86.exe
Miniconda3-4.7.12-Windows-x86_64.exe
Miniconda2-4.7.10-Linux-ppc64le.sh
Miniconda2-4.7.10-Linux-x86_64.sh
Miniconda2-4.7.10-MacOSX-x86_64.pkg
Miniconda2-4.7.10-MacOSX-x86_64.sh
Miniconda2-4.7.10-Windows-x86.exe
Miniconda2-4.7.10-Windows-x86_64.exe
Miniconda3-4.7.10-Linux-ppc64le.sh
Miniconda3-4.7.10-Linux-x86_64.sh
Miniconda3-4.7.10-MacOSX-x86_64.pkg
Miniconda3-4.7.10-MacOSX-x86_64.sh
Miniconda3-4.7.10-Windows-x86.exe
Miniconda3-4.7.10-Windows-x86_64.exe
Miniconda2-4.6.14-Linux-x86_64.sh
Miniconda2-4.6.14-MacOSX-x86_64.pkg
Miniconda2-4.6.14-MacOSX-x86_64.sh
Miniconda2-4.6.14-Windows-x86.exe
Miniconda2-4.6.14-Windows-x86_64.exe
Miniconda3-4.6.14-Linux-ppc64le.sh
Miniconda3-4.6.14-Linux-x86_64.sh
Miniconda3-4.6.14-MacOSX-x86_64.pkg
Miniconda3-4.6.14-MacOSX-x86_64.sh
Miniconda3-4.6.14-Windows-x86.exe
Miniconda3-4.6.14-Windows-x86_64.exe
Miniconda2-4.6.14-Linux-ppc64le.sh
Miniconda2-4.5.12-Linux-ppc64le.sh
Miniconda2-4.5.12-Linux-x86.sh
Miniconda2-4.5.12-Linux-x86_64.sh
Miniconda2-4.5.12-MacOSX-x86_64.pkg
Miniconda2-4.5.12-MacOSX-x86_64.sh
Miniconda2-4.5.12-Windows-x86.exe
Miniconda2-4.5.12-Windows-x86_64.exe
Miniconda2-latest-Linux-x86.sh
Miniconda3-4.5.12-Linux-x86.sh
Miniconda3-4.5.12-Linux-x86_64.sh
Miniconda3-4.5.12-MacOSX-x86_64.pkg
Miniconda3-4.5.12-MacOSX-x86_64.sh
Miniconda3-4.5.12-Windows-x86.exe
Miniconda3-4.5.12-Windows-x86_64.exe
Miniconda3-latest-Linux-x86.sh
Miniconda2-4.5.11-Linux-ppc64le.sh
Miniconda2-4.5.11-Linux-x86.sh
Miniconda2-4.5.11-Linux-x86_64.sh
Miniconda2-4.5.11-MacOSX-x86_64.pkg
Miniconda2-4.5.11-MacOSX-x86_64.sh
Miniconda2-4.5.11-Windows-x86.exe
Miniconda2-4.5.11-Windows-x86_64.exe
Miniconda3-4.5.11-Linux-ppc64le.sh
Miniconda3-4.5.11-Linux-x86.sh
Miniconda3-4.5.11-Linux-x86_64.sh
Miniconda3-4.5.11-MacOSX-x86_64.pkg
Miniconda3-4.5.11-MacOSX-x86_64.sh
Miniconda3-4.5.11-Windows-x86.exe
Miniconda3-4.5.11-Windows-x86_64.exe
Miniconda2-4.5.4-Linux-ppc64le.sh
Miniconda2-4.5.4-Linux-x86.sh
Miniconda2-4.5.4-Linux-x86_64.sh
Miniconda2-4.5.4-MacOSX-x86_64.pkg
Miniconda2-4.5.4-MacOSX-x86_64.sh
Miniconda2-4.5.4-Windows-x86.exe
Miniconda2-4.5.4-Windows-x86_64.exe
Miniconda3-4.5.4-Linux-ppc64le.sh
Miniconda3-4.5.4-Linux-x86.sh
Miniconda3-4.5.4-Linux-x86_64.sh
Miniconda3-4.5.4-MacOSX-x86_64.pkg
Miniconda3-4.5.4-MacOSX-x86_64.sh
Miniconda3-4.5.4-Windows-x86.exe
Miniconda3-4.5.4-Windows-x86_64.exe
Miniconda2-4.5.1-Linux-ppc64le.sh
Miniconda2-4.5.1-Linux-x86.sh
Miniconda2-4.5.1-Linux-x86_64.sh
Miniconda2-4.5.1-MacOSX-x86_64.pkg
Miniconda2-4.5.1-MacOSX-x86_64.sh
Miniconda2-4.5.1-Windows-x86.exe
Miniconda2-4.5.1-Windows-x86_64.exe
Miniconda3-4.5.1-Linux-ppc64le.sh
Miniconda3-4.5.1-Linux-x86.sh
Miniconda3-4.5.1-Linux-x86_64.sh
Miniconda3-4.5.1-MacOSX-x86_64.pkg
Miniconda3-4.5.1-MacOSX-x86_64.sh
Miniconda3-4.5.1-Windows-x86.exe
Miniconda3-4.5.1-Windows-x86_64.exe
Miniconda2-4.4.10-Linux-ppc64le.sh
Miniconda2-4.4.10-Linux-x86.sh
Miniconda2-4.4.10-Linux-x86_64.sh
Miniconda2-4.4.10-MacOSX-x86_64.pkg
Miniconda2-4.4.10-MacOSX-x86_64.sh
Miniconda2-4.4.10-Windows-x86.exe
Miniconda2-4.4.10-Windows-x86_64.exe
Miniconda3-4.4.10-Linux-ppc64le.sh
Miniconda3-4.4.10-Linux-x86.sh
Miniconda3-4.4.10-Linux-x86_64.sh
Miniconda3-4.4.10-MacOSX-x86_64.pkg
Miniconda3-4.4.10-MacOSX-x86_64.sh
Miniconda3-4.4.10-Windows-x86.exe
Miniconda3-4.4.10-Windows-x86_64.exe
Miniconda2-4.3.31-Linux-x86.sh
Miniconda2-4.3.31-Linux-x86_64.sh
Miniconda2-4.3.31-MacOSX-x86_64.pkg
Miniconda2-4.3.31-MacOSX-x86_64.sh
Miniconda2-4.3.31-Windows-x86.exe
Miniconda2-4.3.31-Windows-x86_64.exe
Miniconda3-4.3.31-Linux-x86.sh
Miniconda3-4.3.31-Linux-x86_64.sh
Miniconda3-4.3.31-MacOSX-x86_64.pkg
Miniconda3-4.3.31-MacOSX-x86_64.sh
Miniconda3-4.3.31-Windows-x86.exe
Miniconda3-4.3.31-Windows-x86_64.exe
Miniconda2-4.3.30.2-Windows-x86.exe
Miniconda2-4.3.30.2-Windows-x86_64.exe
Miniconda3-4.3.30.2-Windows-x86.exe
Miniconda3-4.3.30.2-Windows-x86_64.exe
Miniconda2-4.3.30.1-MacOSX-x86_64.pkg
Miniconda2-4.3.30.1-MacOSX-x86_64.sh
Miniconda3-4.3.30.1-MacOSX-x86_64.pkg
Miniconda3-4.3.30.1-MacOSX-x86_64.sh
Miniconda2-4.3.30-Linux-x86.sh
Miniconda2-4.3.30-Linux-x86_64.sh
Miniconda2-4.3.30-MacOSX-x86_64.pkg
Miniconda2-4.3.30-MacOSX-x86_64.sh
Miniconda2-4.3.30-Windows-x86.exe
Miniconda2-4.3.30-Windows-x86_64.exe
Miniconda3-4.3.30-Linux-x86.sh
Miniconda3-4.3.30-Linux-x86_64.sh
Miniconda3-4.3.30-MacOSX-x86_64.pkg
Miniconda3-4.3.30-MacOSX-x86_64.sh
Miniconda3-4.3.30-Windows-x86.exe
Miniconda3-4.3.30-Windows-x86_64.exe
Miniconda2-4.3.27.1-Linux-x86_64.sh
Miniconda3-4.3.27.1-Linux-x86_64.sh
Miniconda2-4.3.27.1-Linux-x86.sh
Miniconda3-4.3.27.1-Linux-x86.sh
Miniconda2-4.3.27-Linux-ppc64le.sh
Miniconda3-4.3.27-Linux-ppc64le.sh
Miniconda2-4.3.27-Linux-x86.sh
Miniconda2-4.3.27-Linux-x86_64.sh
Miniconda2-4.3.27-MacOSX-x86_64.pkg
Miniconda2-4.3.27-MacOSX-x86_64.sh
Miniconda2-4.3.27-Windows-x86.exe
Miniconda2-4.3.27-Windows-x86_64.exe
Miniconda3-4.3.27-Linux-x86.sh
Miniconda3-4.3.27-Linux-x86_64.sh
Miniconda3-4.3.27-MacOSX-x86_64.pkg
Miniconda3-4.3.27-MacOSX-x86_64.sh
Miniconda3-4.3.27-Windows-x86.exe
Miniconda3-4.3.27-Windows-x86_64.exe
Miniconda2-4.3.21-Linux-x86.sh
Miniconda2-4.3.21-Linux-x86_64.sh
Miniconda2-4.3.21-MacOSX-x86_64.sh
Miniconda2-4.3.21-Windows-x86.exe
Miniconda2-4.3.21-Windows-x86_64.exe
Miniconda3-4.3.21-Linux-x86.sh
Miniconda3-4.3.21-Linux-x86_64.sh
Miniconda3-4.3.21-MacOSX-x86_64.sh
Miniconda3-4.3.21-Windows-x86.exe
Miniconda3-4.3.21-Windows-x86_64.exe
Miniconda2-4.3.14-Linux-x86.sh
Miniconda2-4.3.14-Linux-x86_64.sh
Miniconda2-4.3.14-MacOSX-x86_64.sh
Miniconda2-4.3.14-Windows-x86.exe
Miniconda2-4.3.14-Windows-x86_64.exe
Miniconda3-4.3.14-Linux-x86.sh
Miniconda3-4.3.14-Linux-x86_64.sh
Miniconda3-4.3.14-MacOSX-x86_64.sh
Miniconda3-4.3.14-Windows-x86.exe
Miniconda3-4.3.14-Windows-x86_64.exe
Miniconda2-4.3.14-Linux-ppc64le.sh
Miniconda3-4.3.14-Linux-ppc64le.sh
Miniconda2-4.3.11-Linux-x86.sh
Miniconda2-4.3.11-Linux-x86_64.sh
Miniconda2-4.3.11-MacOSX-x86_64.sh
Miniconda2-4.3.11-Windows-x86.exe
Miniconda2-4.3.11-Windows-x86_64.exe
Miniconda3-4.3.11-Linux-x86.sh
Miniconda3-4.3.11-Linux-x86_64.sh
Miniconda3-4.3.11-MacOSX-x86_64.sh
Miniconda3-4.3.11-Windows-x86.exe
Miniconda3-4.3.11-Windows-x86_64.exe
Miniconda2-4.2.15-MacOSX-x86_64.sh
Miniconda2-4.2.12-Linux-ppc64le.sh
Miniconda3-4.2.12-Linux-ppc64le.sh
Miniconda2-4.2.12-Linux-x86.sh
Miniconda2-4.2.12-Linux-x86_64.sh
Miniconda2-4.2.12-MacOSX-x86_64.sh
Miniconda2-4.2.12-Windows-x86.exe
Miniconda2-4.2.12-Windows-x86_64.exe
Miniconda3-4.2.12-Linux-x86.sh
Miniconda3-4.2.12-Linux-x86_64.sh
Miniconda3-4.2.12-MacOSX-x86_64.sh
Miniconda3-4.2.12-Windows-x86.exe
Miniconda3-4.2.12-Windows-x86_64.exe
Miniconda2-4.2.11-Windows-x86.exe
Miniconda2-4.2.11-Windows-x86_64.exe
Miniconda3-4.2.11-Windows-x86.exe
Miniconda3-4.2.11-Windows-x86_64.exe
Miniconda2-4.2.11-Linux-x86.sh
Miniconda2-4.2.11-Linux-x86_64.sh
Miniconda2-4.2.11-MacOSX-x86_64.sh
Miniconda3-4.2.11-Linux-x86.sh
Miniconda3-4.2.11-Linux-x86_64.sh
Miniconda3-4.2.11-MacOSX-x86_64.sh
Miniconda2-4.1.11-Linux-x86.sh
Miniconda2-4.1.11-Linux-x86_64.sh
Miniconda2-4.1.11-MacOSX-x86_64.sh
Miniconda2-4.1.11-Windows-x86.exe
Miniconda2-4.1.11-Windows-x86_64.exe
Miniconda3-4.1.11-Linux-x86.sh
Miniconda3-4.1.11-Linux-x86_64.sh
Miniconda3-4.1.11-MacOSX-x86_64.sh
Miniconda3-4.1.11-Windows-x86.exe
Miniconda3-4.1.11-Windows-x86_64.exe
Miniconda2-4.0.5-Linux-x86.sh
Miniconda2-4.0.5-Linux-x86_64.sh
Miniconda2-4.0.5-MacOSX-x86_64.sh
Miniconda2-4.0.5-Windows-x86.exe
Miniconda2-4.0.5-Windows-x86_64.exe
Miniconda3-4.0.5-Linux-x86.sh
Miniconda3-4.0.5-Linux-x86_64.sh
Miniconda3-4.0.5-MacOSX-x86_64.sh
Miniconda3-4.0.5-Windows-x86.exe
Miniconda3-4.0.5-Windows-x86_64.exe
Miniconda2-3.19.0-Linux-x86.sh
Miniconda2-3.19.0-Linux-x86_64.sh
Miniconda2-3.19.0-MacOSX-x86_64.sh
Miniconda2-3.19.0-Windows-x86.exe
Miniconda2-3.19.0-Windows-x86_64.exe
Miniconda3-3.19.0-Linux-x86.sh
Miniconda3-3.19.0-Linux-x86_64.sh
Miniconda3-3.19.0-MacOSX-x86_64.sh
Miniconda3-3.19.0-Windows-x86.exe
Miniconda3-3.19.0-Windows-x86_64.exe
Miniconda2-3.18.8-MacOSX-x86_64.sh
Miniconda2-3.18.9-Linux-x86.sh
Miniconda2-3.18.9-Linux-x86_64.sh
Miniconda2-3.18.9-Windows-x86.exe
Miniconda2-3.18.9-Windows-x86_64.exe
Miniconda3-3.18.8-MacOSX-x86_64.sh
Miniconda3-3.18.9-Linux-x86.sh
Miniconda3-3.18.9-Linux-x86_64.sh
Miniconda3-3.18.9-Windows-x86.exe
Miniconda3-3.18.9-Windows-x86_64.exe
Miniconda2-3.18.3-Linux-x86.sh
Miniconda2-3.18.3-Linux-x86_64.sh
Miniconda2-3.18.3-MacOSX-x86_64.sh
Miniconda2-3.18.3-Windows-x86.exe
Miniconda2-3.18.3-Windows-x86_64.exe
Miniconda3-3.18.3-Linux-x86.sh
Miniconda3-3.18.3-Linux-x86_64.sh
Miniconda3-3.18.3-MacOSX-x86_64.sh
Miniconda3-3.18.3-Windows-x86.exe
Miniconda3-3.18.3-Windows-x86_64.exe
Miniconda-3.16.0-Linux-armv7l.sh
Miniconda-3.16.0-Linux-ppc64le.sh
Miniconda-3.16.0-Linux-x86.sh
Miniconda-3.16.0-Linux-x86_64.sh
Miniconda-3.16.0-MacOSX-x86.sh
Miniconda-3.16.0-MacOSX-x86_64.sh
Miniconda-3.16.0-Windows-x86.exe
Miniconda-3.16.0-Windows-x86_64.exe
Miniconda-latest-Linux-armv7l.sh
Miniconda3-3.16.0-Linux-armv7l.sh
Miniconda3-3.16.0-Linux-ppc64le.sh
Miniconda3-3.16.0-Linux-x86.sh
Miniconda3-3.16.0-Linux-x86_64.sh
Miniconda3-3.16.0-MacOSX-x86.sh
Miniconda3-3.16.0-MacOSX-x86_64.sh
Miniconda3-3.16.0-Windows-x86.exe
Miniconda3-3.16.0-Windows-x86_64.exe
Miniconda3-latest-Linux-armv7l.sh
Miniconda3-latest-MacOSX-x86.sh
Miniconda-3.10.1-Linux-x86.sh
Miniconda-3.10.1-Linux-x86_64.sh
Miniconda-3.10.1-MacOSX-x86_64.sh
Miniconda-3.10.1-Windows-x86.exe
Miniconda-3.10.1-Windows-x86_64.exe
Miniconda3-3.10.1-Linux-x86.sh
Miniconda3-3.10.1-Linux-x86_64.sh
Miniconda3-3.10.1-MacOSX-x86_64.sh
Miniconda3-3.10.1-Windows-x86.exe
Miniconda3-3.10.1-Windows-x86_64.exe
Miniconda-3.9.1-Linux-x86.sh
Miniconda-3.9.1-Linux-x86_64.sh
Miniconda-3.9.1-MacOSX-x86_64.sh
Miniconda-3.9.1-Windows-x86.exe
Miniconda-3.9.1-Windows-x86_64.exe
Miniconda3-3.9.1-Linux-x86.sh
Miniconda3-3.9.1-Linux-x86_64.sh
Miniconda3-3.9.1-MacOSX-x86_64.sh
Miniconda3-3.9.1-Windows-x86.exe
Miniconda3-3.9.1-Windows-x86_64.exe
Miniconda-3.8.3-Linux-x86.sh
Miniconda-3.8.3-Linux-x86_64.sh
Miniconda-3.8.3-MacOSX-x86_64.sh
Miniconda-3.8.3-Windows-x86.exe
Miniconda-3.8.3-Windows-x86_64.exe
Miniconda3-3.8.3-Linux-x86.sh
Miniconda3-3.8.3-Linux-x86_64.sh
Miniconda3-3.8.3-MacOSX-x86_64.sh
Miniconda3-3.8.3-Windows-x86.exe
Miniconda3-3.8.3-Windows-x86_64.exe
Miniconda-3.7.3-Linux-x86.sh
Miniconda-3.7.3-Linux-x86_64.sh
Miniconda-3.7.3-MacOSX-x86_64.sh
Miniconda-3.7.3-Windows-x86.exe
Miniconda-3.7.3-Windows-x86_64.exe
Miniconda3-3.7.3-Linux-x86.sh
Miniconda3-3.7.3-Linux-x86_64.sh
Miniconda3-3.7.3-MacOSX-x86_64.sh
Miniconda3-3.7.3-Windows-x86.exe
Miniconda3-3.7.3-Windows-x86_64.exe
Miniconda-3.7.0-Linux-x86.sh
Miniconda-3.7.0-Linux-x86_64.sh
Miniconda-3.7.0-MacOSX-x86_64.sh
Miniconda-3.7.0-Windows-x86.exe
Miniconda-3.7.0-Windows-x86_64.exe
Miniconda3-3.7.0-Linux-x86.sh
Miniconda3-3.7.0-Linux-x86_64.sh
Miniconda3-3.7.0-MacOSX-x86_64.sh
Miniconda3-3.7.0-Windows-x86.exe
Miniconda3-3.7.0-Windows-x86_64.exe
Miniconda-3.6.0-Linux-x86.sh
Miniconda-3.6.0-Linux-x86_64.sh
Miniconda-3.6.0-MacOSX-x86_64.sh
Miniconda-3.6.0-Windows-x86.exe
Miniconda-3.6.0-Windows-x86_64.exe
Miniconda3-3.6.0-Linux-x86.sh
Miniconda3-3.6.0-Linux-x86_64.sh
Miniconda3-3.6.0-MacOSX-x86_64.sh
Miniconda3-3.6.0-Windows-x86.exe
Miniconda3-3.6.0-Windows-x86_64.exe
Miniconda-3.5.5-Windows-x86.exe
Miniconda-3.5.5-Windows-x86_64.exe
Miniconda3-3.5.5-Windows-x86.exe
Miniconda3-3.5.5-Windows-x86_64.exe
Miniconda-3.5.5-Linux-armv6l.sh
Miniconda-3.5.5-Linux-x86.sh
Miniconda-3.5.5-Linux-x86_64.sh
Miniconda-3.5.5-MacOSX-x86_64.sh
Miniconda3-3.5.5-Linux-x86.sh
Miniconda3-3.5.5-Linux-x86_64.sh
Miniconda3-3.5.5-MacOSX-x86_64.sh
Miniconda-3.5.2-Linux-x86.sh
Miniconda-3.5.2-Linux-x86_64.sh
Miniconda-3.5.2-MacOSX-x86_64.sh
Miniconda-3.5.2-Windows-x86.exe
Miniconda-3.5.2-Windows-x86_64.exe
Miniconda3-3.5.2-Linux-x86.sh
Miniconda3-3.5.2-Linux-x86_64.sh
Miniconda3-3.5.2-MacOSX-x86_64.sh
Miniconda3-3.5.2-Windows-x86.exe
Miniconda3-3.5.2-Windows-x86_64.exe
Miniconda-3.4.2-Linux-x86.sh
Miniconda-3.4.2-Linux-x86_64.sh
Miniconda-3.4.2-MacOSX-x86_64.sh
Miniconda-3.4.2-Windows-x86.exe
Miniconda-3.4.2-Windows-x86_64.exe
Miniconda3-3.4.2-Linux-x86.sh
Miniconda3-3.4.2-Linux-x86_64.sh
Miniconda3-3.4.2-MacOSX-x86_64.sh
Miniconda3-3.4.2-Windows-x86.exe
Miniconda3-3.4.2-Windows-x86_64.exe
Miniconda-3.3.0-Linux-x86.sh
Miniconda-3.3.0-Linux-x86_64.sh
Miniconda-3.3.0-MacOSX-x86_64.sh
Miniconda-3.3.0-Windows-x86.exe
Miniconda-3.3.0-Windows-x86_64.exe
Miniconda3-3.3.0-Linux-x86.sh
Miniconda3-3.3.0-Linux-x86_64.sh
Miniconda3-3.3.0-MacOSX-x86_64.sh
Miniconda3-3.3.0-Windows-x86.exe
Miniconda3-3.3.0-Windows-x86_64.exe
Miniconda-3.0.5-Linux-x86.sh
Miniconda-3.0.5-Linux-x86_64.sh
Miniconda-3.0.5-MacOSX-x86_64.sh
Miniconda-3.0.5-Windows-x86.exe
Miniconda-3.0.5-Windows-x86_64.exe
Miniconda3-3.0.5-Linux-x86.sh
Miniconda3-3.0.5-Linux-x86_64.sh
Miniconda3-3.0.5-MacOSX-x86_64.sh
Miniconda3-3.0.5-Windows-x86.exe
Miniconda3-3.0.5-Windows-x86_64.exe
Miniconda-3.0.4-Linux-x86.sh
Miniconda-3.0.4-Linux-x86_64.sh
Miniconda-3.0.4-MacOSX-x86_64.sh
Miniconda-3.0.4-Windows-x86.exe
Miniconda-3.0.4-Windows-x86_64.exe
Miniconda3-3.0.4-Linux-x86.sh
Miniconda3-3.0.4-Linux-x86_64.sh
Miniconda3-3.0.4-MacOSX-x86_64.sh
Miniconda3-3.0.4-Windows-x86.exe
Miniconda3-3.0.4-Windows-x86_64.exe
Miniconda-3.0.0-Linux-x86.sh
Miniconda-3.0.0-Linux-x86_64.sh
Miniconda-3.0.0-MacOSX-x86_64.sh
Miniconda-3.0.0-Windows-x86.exe
Miniconda-3.0.0-Windows-x86_64.exe
Miniconda3-3.0.0-Linux-x86.sh
Miniconda3-3.0.0-Linux-x86_64.sh
Miniconda3-3.0.0-MacOSX-x86_64.sh
Miniconda3-3.0.0-Windows-x86.exe
Miniconda3-3.0.0-Windows-x86_64.exe
Miniconda-2.2.8-Windows-x86.exe
Miniconda-2.2.8-Windows-x86_64.exe
Miniconda3-2.2.8-Windows-x86.exe
Miniconda3-2.2.8-Windows-x86_64.exe
Miniconda-2.2.2-Linux-x86.sh
Miniconda-2.2.2-Linux-x86_64.sh
Miniconda-2.2.2-MacOSX-x86_64.sh
Miniconda3-2.2.2-Linux-x86.sh
Miniconda3-2.2.2-Linux-x86_64.sh
Miniconda3-2.2.2-MacOSX-x86_64.sh
Miniconda-2.0.3-MacOSX-x86.sh
Miniconda-2.0.0-Linux-x86_64.sh
Miniconda-1.6.2-Linux-x86_64.sh
Miniconda-1.9.1-Linux-x86_64.sh
Miniconda-1.6.0-Linux-x86_64.sh
*/

export { setupMiniconda };

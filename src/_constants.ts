import { join } from "path";
import { homedir } from "os";

import { IArchitectures, IOperatingSystems } from "./_types";

export const ARCHITECTURES: IArchitectures = {
  x64: "x86_64",
  x86: "x86",
  ARM64: "aarch64", // To be supported by github runners
  ARM32: "armv7l", // To be supported by github runners
};

export const OS_NAMES: IOperatingSystems = {
  win32: "Windows",
  darwin: "MacOSX",
  linux: "Linux",
};

export const KNOWN_EXTENSIONS = [".exe", ".sh"];

/**
 * errors that are always probably spurious
 */
export const IGNORED_WARNINGS = [
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
export const FORCED_ERRORS = [
  // conda env create will ignore invalid sections and move on
  `EnvironmentSectionNotValid`,
];

/**
 * avoid spurious conda warnings before we have a chance to update them
 */
export const BOOTSTRAP_CONDARC = "notify_outdated_conda: false";

/**
 * the conda config file
 */
export const CONDARC_PATH = join(homedir(), ".condarc");

export const MINICONDA_DIR_PATH: string = process.env["CONDA"] || "";
export const PLATFORM = process.platform;
export const IS_WINDOWS: boolean = PLATFORM === "win32";
export const IS_MAC: boolean = PLATFORM === "darwin";
export const IS_LINUX: boolean = PLATFORM === "linux";
export const IS_UNIX: boolean = IS_MAC || IS_LINUX;
export const MINICONDA_BASE_URL: string =
  "https://repo.anaconda.com/miniconda/";

/** Where to put files. Should eventually be configurable */
export const CONDA_CACHE_FOLDER = "conda_pkgs_dir";

/** the environment variable exported */
export const ENV_VAR_CONDA_PKGS = "CONDA_PKGS_DIR";

export const BASE_ENV_NAMES = ["root", "base", ""];

/** folders that need user ownership on windows */
export const WIN_PERMS_FOLDERS = [
  "condabin/",
  "Scripts/",
  "shell/",
  "etc/profile.d/",
  "/Lib/site-packages/xonsh/",
];

export const PROFILES = [
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
];

/**
 * A regular expression for detecting whether a spec is the python package, not
 * all of which are valid in all settings.
 *
 * Some examples:
 * - python
 * - python 3
 * - python>3
 * - python!=2
 * - conda-forge::python
 *
 * @see https://docs.conda.io/projects/conda-build/en/latest/resources/package-spec.html#package-match-specifications
 */
export const PYTHON_SPEC = /^(.*::)?python($|\s\=\<\>\!\|)/i;

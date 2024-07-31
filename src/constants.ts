import * as os from "os";
import * as path from "path";

import * as types from "./types";

//-----------------------------------------------------------------------
// Constants
//-----------------------------------------------------------------------
export const MINICONDA_DIR_PATH: string = process.env["CONDA"] || "";
export const IS_WINDOWS: boolean = process.platform === "win32";
export const IS_MAC: boolean = process.platform === "darwin";
export const IS_LINUX: boolean = process.platform === "linux";
export const IS_UNIX: boolean = IS_MAC || IS_LINUX;

export const MINICONDA_BASE_URL: string =
  "https://repo.anaconda.com/miniconda/";

/** Processor architectures supported by Miniconda */
export const MINICONDA_ARCHITECTURES: types.IArchitectures = {
  aarch64: "aarch64",
  arm64: "arm64",
  ppc64le: "ppc64le",
  s390x: "s390x",
  x64: "x86_64",
  x86_64: "x86_64",
  x86: "x86",
  arm32: "armv7l", // To be supported by github runners
};

/** Processor architectures supported by Miniforge */
export const MINIFORGE_ARCHITECTURES: types.IArchitectures = {
  x64: "x86_64",
  x86_64: "x86_64",
  aarch64: "aarch64", // To be supported by github runners
  ppc64le: "ppc64le", // To be supported by github runners
  arm64: "arm64", // To be supported by github runners
};

export const OS_NAMES: types.IOperatingSystems = {
  win32: "Windows",
  darwin: "MacOSX",
  linux: "Linux",
};

/** Common download prefix */
export const MINIFORGE_URL_PREFIX =
  "https://github.com/conda-forge/miniforge/releases";

/** Default miniforge if only miniforge-version is provided */
export const MINIFORGE_DEFAULT_VARIANT = "Miniforge3";

/** Default miniforge if only miniforge-variant is provided */
export const MINIFORGE_DEFAULT_VERSION = "latest";

/** Names for a conda `base` env */
export const BASE_ENV_NAMES = ["root", "base", ""];

/**
 * Known extensions for `constructor`-generated installers supported
 */
export const KNOWN_EXTENSIONS = [".exe", ".sh"];

/** As of mamba 0.7.6, only these top-level commands are supported */
export const MAMBA_SUBCOMMANDS = [
  "clean",
  "create",
  "env",
  "info",
  "install",
  "list",
  "run",
  "search",
];

/**
 * Errors that are always probably spurious
 */
export const IGNORED_WARNINGS = [
  // Appear on win install, we can swallow them
  `menuinst_win32`,
  `Unable to register environment`,
  `0%|`,
  // Appear on certain Linux/OSX installers
  `Please run using "bash"`,
  // Old condas don't know what to do with these
  `Key 'use_only_tar_bz2' is not a known primitive parameter.`,
  // Channel warnings are very boring and noisy
  `moving to the top`,
  // This warning has no consequence for the installation and is noisy
  `cygpath is not available, fallback to manual path conversion`,
];

/**
 * Warnings that should be errors
 */
export const FORCED_ERRORS = [
  // `conda env create` will ignore invalid sections and move on
  `EnvironmentSectionNotValid`,
];

/**
 * Avoid spurious conda warnings before we have a chance to update them
 */
export const BOOTSTRAP_CONDARC = "notify_outdated_conda: false";

/**
 * The conda config file
 */
export const CONDARC_PATH = path.join(os.homedir(), ".condarc");

/** Where to put files. Should eventually be configurable */
export const CONDA_CACHE_FOLDER = "conda_pkgs_dir";

/** The environment variable exported */
export const ENV_VAR_CONDA_PKGS = "CONDA_PKGS_DIR";

/** Shell profiles names to update so `conda` works for *login shells* */
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

/** Folders that need user ownership on windows */
export const WIN_PERMS_FOLDERS = [
  "condabin/",
  "Scripts/",
  "shell/",
  "etc/profile.d/",
  "/Lib/site-packages/xonsh/",
];

/**
 * A regular expression for detecting whether a spec is the python package, not
 * all of which are valid in all settings.
 *
 * ### Note
 * Some examples:
 * - python
 * - python 3
 * - python>3
 * - python!=2
 * - conda-forge::python
 *
 * TODO: this should be generalized, and, along with roundtrip parsing/generating
 *       probably be a sub-package in its own right.
 * @see https://docs.conda.io/projects/conda-build/en/latest/resources/package-spec.html#package-match-specifications
 */
export const PYTHON_SPEC = /^(.*::)?python($|\s\=\<\>\!\|)/i;

/**
 * Output name for the effective environment-file path used.
 */
export const OUTPUT_ENV_FILE_PATH = "environment-file";

/**
 * Output name for the effective environment-file file content used.
 */
export const OUTPUT_ENV_FILE_CONTENT = "environment-file-content";

/**
 * Output name for whether the effective environment-file file was patched.
 */
export const OUTPUT_ENV_FILE_WAS_PATCHED = "environment-file-was-patched";

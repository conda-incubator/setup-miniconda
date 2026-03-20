import * as os from "os";
import * as path from "path";

import * as types from "./types";

/** Path to an existing conda installation, from the CONDA env variable. */
export const MINICONDA_DIR_PATH: string = process.env["CONDA"] || "";
/** Whether the current platform is Windows. */
export const IS_WINDOWS: boolean = process.platform === "win32";
/** Whether the current platform is macOS. */
export const IS_MAC: boolean = process.platform === "darwin";
/** Whether the current platform is Linux. */
export const IS_LINUX: boolean = process.platform === "linux";
/** Whether the current platform is Unix-like (macOS or Linux). */
export const IS_UNIX: boolean = IS_MAC || IS_LINUX;

/** Base URL for downloading Miniconda installers. */
export const MINICONDA_BASE_URL: string =
  "https://repo.anaconda.com/miniconda/";

/** Processor architectures supported by Miniconda. */
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

/** Processor architectures supported by Miniforge. */
export const MINIFORGE_ARCHITECTURES: types.IArchitectures = {
  x64: "x86_64",
  x86_64: "x86_64",
  aarch64: "aarch64",
  ppc64le: "ppc64le", // To be supported by github runners
  arm64: "arm64",
};

/** Map from Node.js platform strings to OS names used in installer filenames. */
export const OS_NAMES: types.IOperatingSystems = {
  win32: "Windows",
  darwin: "MacOSX",
  linux: "Linux",
};

/** Base URL prefix for downloading Miniforge releases from GitHub. */
export const MINIFORGE_URL_PREFIX =
  "https://github.com/conda-forge/miniforge/releases";

/** Default Miniforge variant used when only miniforge-version is provided. */
export const MINIFORGE_DEFAULT_VARIANT = "Miniforge3";

/** Default Miniforge version used when only miniforge-variant is provided. */
export const MINIFORGE_DEFAULT_VERSION = "latest";

/** Names that identify a conda `base` environment. */
export const BASE_ENV_NAMES = ["root", "base", ""];

/**
 * Known extensions for `constructor`-generated installers supported.
 */
export const KNOWN_EXTENSIONS = [".exe", ".sh"];

/** As of mamba 0.7.6, only these top-level commands are supported. */
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
 * Warning substrings that are always safe to suppress in conda/mamba output.
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
  // Harmless warning for older Conda versions use auto_activate instead of auto_activate_base
  `'auto_activate': unknown parameter`,
];

/**
 * Warning substrings that should be promoted to hard errors.
 */
export const FORCED_ERRORS = [
  // `conda env create` will ignore invalid sections and move on
  `EnvironmentSectionNotValid`,
];

/**
 * Bootstrap `.condarc` content to suppress spurious conda warnings during setup.
 */
export const BOOTSTRAP_CONDARC = "notify_outdated_conda: false";

/**
 * Absolute path to the user-level `.condarc` configuration file.
 */
export const CONDARC_PATH = path.join(os.homedir(), ".condarc");

/** Default directory name for the conda package cache under the user home. */
export const DEFAULT_PKGS_DIR = "conda_pkgs_dir";

/** Shell profile names to update so `conda` works for login shells. */
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

/** Folders that need user ownership on Windows. */
export const WIN_PERMS_FOLDERS = [
  "condabin/",
  "Scripts/",
  "shell/",
  "etc/profile.d/",
  "/Lib/site-packages/xonsh/",
];

/**
 * A regular expression for detecting whether a spec refers to the python
 * package, not all forms of which are valid in all settings.
 *
 * ### Note
 * Some examples: `python`, `python 3`, `python>3`, `python!=2`,
 * `conda-forge::python`.
 *
 * @see https://docs.conda.io/projects/conda-build/en/latest/resources/package-spec.html#package-match-specifications
 */
export const PYTHON_SPEC = /^(.*::)?python($|[\s=<>!|])/i;

/**
 * Action output name for the effective environment-file path.
 */
export const OUTPUT_ENV_FILE_PATH = "environment-file";

/**
 * Action output name for the effective environment-file content.
 */
export const OUTPUT_ENV_FILE_CONTENT = "environment-file-content";

/**
 * Action output name for whether the environment-file was patched.
 */
export const OUTPUT_ENV_FILE_WAS_PATCHED = "environment-file-was-patched";

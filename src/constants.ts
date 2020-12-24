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

export const ARCHITECTURES: types.IArchitectures = {
  x64: "x86_64",
  x86: "x86",
  ARM64: "aarch64", // To be supported by github runners
  ARM32: "armv7l", // To be supported by github runners
};

export const OS_NAMES: types.IOperatingSystems = {
  win32: "Windows",
  darwin: "MacOSX",
  linux: "Linux",
};

/**
 * Known extensions for `constructor`-generated installers supported
 */
export const KNOWN_EXTENSIONS = [".exe", ".sh"];

/**
 * Errors that are always probably spurious
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
 * Warnings that should be errors
 */
export const FORCED_ERRORS = [
  // conda env create will ignore invalid sections and move on
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

import * as core from "@actions/core";

import * as types from "../types";
import * as constants from "../constants";

import * as base from "./base";

/**
 * Download specific version miniconda defined by version, arch and python major version.
 *
 * The download will fail with a clear HTTP error if the version is invalid,
 * avoiding the previous approach of downloading and parsing the full HTML
 * index page just for validation.
 */
export async function downloadMiniconda(
  pythonMajorVersion: number,
  inputs: types.IActionInputs,
): Promise<string> {
  const arch: string =
    constants.MINICONDA_ARCHITECTURES[inputs.architecture.toLowerCase()];
  if (!arch) {
    throw new Error(`Invalid arch "${inputs.architecture}"!`);
  }

  const extension: string = constants.IS_UNIX ? "sh" : "exe";
  const osName: string = constants.OS_NAMES[process.platform];
  const minicondaVersion = inputs.minicondaVersion || "latest";
  const minicondaInstallerName = `Miniconda${pythonMajorVersion}-${minicondaVersion}-${osName}-${arch}.${extension}`;
  const url = constants.MINICONDA_BASE_URL + minicondaInstallerName;
  core.info(minicondaInstallerName);

  try {
    return await base.ensureLocalInstaller({
      url,
      tool: `Miniconda${pythonMajorVersion}`,
      version: minicondaVersion,
      arch: arch,
    });
  } catch (err) {
    throw new Error(
      `Failed to download Miniconda installer from ${url}. ` +
        `Please verify that miniconda-version '${minicondaVersion}' is valid ` +
        `for ${osName}-${arch}. Browse available versions at ` +
        `${constants.MINICONDA_BASE_URL}\n` +
        `Original error: ${err}`,
    );
  }
}

/**
 * Provide a path to a Miniconda downloaded from repo.anaconda.com.
 *
 * ### Note
 * Uses the well-known structure of the repo.anaconda.com to resolve and download
 * a particular Miniconda installer.
 */
export const minicondaDownloader: types.IInstallerProvider = {
  label: "download Miniconda",
  provides: async (inputs, options) => {
    return inputs.installerUrl === "";
  },
  installerPath: async (inputs, options) => {
    return {
      localInstallerPath: await downloadMiniconda(3, inputs),
      options: {
        ...options,
        useBundled: false,
      },
    };
  },
};

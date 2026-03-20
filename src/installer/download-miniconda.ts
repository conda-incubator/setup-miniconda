/**
 * @module installer/download-miniconda
 * Download Miniconda installers from `repo.anaconda.com` using the
 * well-known directory listing to resolve available versions.
 *
 * @category Installers
 */

import * as fs from "fs";

import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";

import getHrefs from "get-hrefs";

import * as types from "../types";
import * as constants from "../constants";

import * as base from "./base";

/**
 * Fetch and return the list of available Miniconda installer URLs for a given architecture.
 *
 * @param arch - The target architecture suffix (e.g. `"x86_64"`, `"arm64"`).
 * @returns An array of installer path strings relative to the base URL.
 */
async function minicondaVersions(arch: string): Promise<string[]> {
  try {
    const extension: string = constants.IS_UNIX ? "sh" : "exe";
    const downloadPath: string = await tc.downloadTool(
      constants.MINICONDA_BASE_URL,
    );
    const content: string = fs.readFileSync(downloadPath, "utf8");
    let hrefs: string[] = getHrefs(content);
    hrefs = hrefs.filter((item: string) => item.startsWith("/Miniconda3"));
    hrefs = hrefs.filter((item: string) =>
      item.endsWith(`${arch}.${extension}`),
    );
    hrefs = hrefs.map((item: string) => item.substring(1));
    return hrefs;
  } catch (err) {
    core.warning(err as Error);
    return [];
  }
}

/**
 * Download a specific Miniconda installer determined by the Python major
 * version, architecture, and version from the action inputs.
 *
 * @param pythonMajorVersion - The Python major version for the installer (e.g. `3`).
 * @param inputs - The parsed action inputs containing version and architecture.
 * @returns The local path to the downloaded installer.
 * @throws {Error} If the architecture is not in {@link constants.MINICONDA_ARCHITECTURES}.
 * @throws {Error} If the requested version is not found in the available versions list.
 */
export async function downloadMiniconda(
  pythonMajorVersion: number,
  inputs: types.IActionInputs,
): Promise<string> {
  // Check valid arch
  const arch: string | undefined =
    constants.MINICONDA_ARCHITECTURES[inputs.architecture.toLowerCase()];
  if (!arch) {
    throw new Error(`Invalid arch "${inputs.architecture}"!`);
  }

  const extension: string = constants.IS_UNIX ? "sh" : "exe";
  const osName: string | undefined = constants.OS_NAMES[process.platform];
  if (!osName) {
    throw new Error(`Unsupported platform "${process.platform}"!`);
  }
  const minicondaVersion = inputs.minicondaVersion || "latest";
  const minicondaInstallerName = `Miniconda${pythonMajorVersion}-${minicondaVersion}-${osName}-${arch}.${extension}`;
  core.info(minicondaInstallerName);

  // Check version name
  const versions: string[] = await minicondaVersions(arch);
  if (versions) {
    if (!versions.includes(minicondaInstallerName)) {
      throw new Error(
        `Invalid miniconda version!\n\nMust be among ${versions.toString()}`,
      );
    }
  }

  return await base.ensureLocalInstaller({
    url: constants.MINICONDA_BASE_URL + minicondaInstallerName,
    tool: `Miniconda${pythonMajorVersion}`,
    version: minicondaVersion,
    arch: arch,
  });
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
  provides: async (inputs, _options) => {
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

import * as fs from "fs";

import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";

import getHrefs from "get-hrefs";

import * as types from "../types";
import * as constants from "../constants";

import * as base from "./base";

/**
 * List available Miniconda versions
 *
 * @param arch
 */
async function minicondaVersions(arch: string): Promise<string[]> {
  try {
    let extension: string = constants.IS_UNIX ? "sh" : "exe";
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
 * Download specific version miniconda defined by version, arch and python major version
 *
 * @param pythonMajorVersion
 * @param minicondaVersion
 * @param architecture
 */
export async function downloadMiniconda(
  pythonMajorVersion: number,
  inputs: types.IActionInputs,
): Promise<string> {
  // Check valid arch
  let arch: string =
    constants.MINICONDA_ARCHITECTURES[inputs.architecture.toLowerCase()];
  if (!arch) {
    throw new Error(`Invalid arch "${inputs.architecture}"!`);
  }
  // Backwards compatibility: ARM64 used to map to aarch64
  if (arch === "arm64" && constants.IS_LINUX) {
    arch = constants.MINICONDA_ARCHITECTURES["aarch64"];
  }

  let extension: string = constants.IS_UNIX ? "sh" : "exe";
  let osName: string = constants.OS_NAMES[process.platform];
  let minicondaVersion = inputs.minicondaVersion || "latest";
  const minicondaInstallerName: string = `Miniconda${pythonMajorVersion}-${minicondaVersion}-${osName}-${arch}.${extension}`;
  core.info(minicondaInstallerName);

  // Check version name
  let versions: string[] = await minicondaVersions(arch);
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
    version: inputs.minicondaVersion,
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

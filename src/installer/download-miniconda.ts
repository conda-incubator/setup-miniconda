import * as fs from "fs";

import getHrefs from "get-hrefs";

import * as tc from "@actions/tool-cache";
import * as core from "@actions/core";

import * as types from "../_types";
import * as constants from "../_constants";

import { ensureLocalInstaller } from "./_base";

/**
 * List available Miniconda versions
 *
 * @param arch
 */
async function minicondaVersions(arch: string): Promise<string[]> {
  try {
    let extension = constants.IS_UNIX ? "sh" : "exe";
    const downloadPath = await tc.downloadTool(constants.MINICONDA_BASE_URL);
    const content = fs.readFileSync(downloadPath, "utf8");
    return getHrefs(content)
      .filter((item) => item.startsWith("/Miniconda3"))
      .filter((item) => item.endsWith(`${arch}.${extension}`))
      .map((item: string) => item.substring(1));
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
async function downloadMiniconda(inputs: types.IActionInputs) {
  const pythonMajorVersion = 3;

  // Check valid arch
  const arch: string = constants.ARCHITECTURES[inputs.architecture];
  if (!arch) {
    throw Error(`Invalid arch "${inputs.architecture}"!`);
  }

  const extension = constants.IS_UNIX ? "sh" : "exe";
  const osName = constants.OS_NAMES[constants.PLATFORM];
  const minicondaInstallerName = `Miniconda${pythonMajorVersion}-${inputs.minicondaVersion}-${osName}-${arch}.${extension}`;

  core.info(minicondaInstallerName);

  // Check version name
  const versions = await minicondaVersions(arch);

  if (!versions.includes(minicondaInstallerName)) {
    throw Error(
      `Invalid miniconda version!\n\nMust be among ${versions.toString()}`
    );
  }

  return await ensureLocalInstaller({
    url: constants.MINICONDA_BASE_URL + minicondaInstallerName,
    tool: `Miniconda${pythonMajorVersion}`,
    version: inputs.minicondaVersion,
    arch,
  });
}

export const minicondaDownloader: types.IInstallerProvider = {
  label: "download Miniconda",
  provides: async (inputs, options) => {
    return inputs.minicondaVersion !== "" && inputs.installerUrl === "";
  },
  installerPath: async (inputs, options) => {
    return {
      localInstallerPath: await downloadMiniconda(inputs),
      options: {
        ...options,
        useBundled: false,
      },
    };
  },
};

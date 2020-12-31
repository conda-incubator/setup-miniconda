import * as core from "@actions/core";

import * as types from "../types";
import * as constants from "../constants";

import * as base from "./base";

/**
 * Download specific Miniforge defined by variant, version and architecture
 */
export async function downloadMiniforge(
  inputs: types.IActionInputs,
  options: types.IDynamicOptions
): Promise<string> {
  const version = inputs.miniforgeVersion.trim();
  const arch = constants.ARCHITECTURES[inputs.architecture];

  // Check valid arch
  if (!arch) {
    throw new Error(`Invalid 'architecture: ${inputs.architecture}'`);
  }

  const tool = inputs.miniforgeVariant.trim();
  const extension = constants.IS_UNIX ? "sh" : "exe";
  const osName = constants.OS_NAMES[process.platform];
  const fileName = [tool, version, osName, `${arch}.${extension}`].join("-");
  const url = [constants.MINIFORGE_URL_PREFIX, version, fileName].join("/");

  core.info(`Will fetch ${tool} ${version} from ${url}`);

  return await base.ensureLocalInstaller({ url, tool, version, arch });
}

/**
 * Provide a path to a Miniforge downloaded from github.com.
 *
 * ### Note
 * Uses the well-known structure of GitHub releases to resolve and download
 * a particular Miniforge installer.
 */
export const miniforgeDownloader: types.IInstallerProvider = {
  label: "download Miniforge",
  provides: async (inputs, options) => inputs.miniforgeVersion !== "",
  installerPath: async (inputs, options) => {
    return {
      localInstallerPath: await downloadMiniforge(inputs, options),
      options: {
        ...options,
        useBundled: false,
      },
    };
  },
};

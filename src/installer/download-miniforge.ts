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
  const tool =
    inputs.miniforgeVariant.trim() || constants.MINIFORGE_DEFAULT_VARIANT;
  const version =
    inputs.miniforgeVersion.trim() || constants.MINIFORGE_DEFAULT_VERSION;
  const arch =
    constants.MINIFORGE_ARCHITECTURES[inputs.architecture.toLowerCase()];

  // Check valid arch
  if (!arch) {
    throw new Error(`Invalid 'architecture: ${inputs.architecture}'`);
  }

  const extension = constants.IS_UNIX ? "sh" : "exe";
  const osName = constants.OS_NAMES[process.platform];

  let fileName: string;
  let url: string;
  if (version === "latest") {
    // e.g. https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-x86_64.sh
    fileName = [tool, osName, `${arch}.${extension}`].join("-");
    url = [constants.MINIFORGE_URL_PREFIX, version, "download", fileName].join(
      "/"
    );
  } else {
    // e.g. https://github.com/conda-forge/miniforge/releases/download/4.9.2-5/Miniforge3-4.9.2-5-Linux-x86_64.sh
    fileName = [tool, version, osName, `${arch}.${extension}`].join("-");
    url = [constants.MINIFORGE_URL_PREFIX, "download", version, fileName].join(
      "/"
    );
  }

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
  provides: async (inputs, options) =>
    inputs.miniforgeVersion !== "" || inputs.miniforgeVariant !== "",
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

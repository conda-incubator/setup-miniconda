import * as fs from "fs";

import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";

import * as types from "../types";
import * as constants from "../constants";

import * as base from "./base";

/**
 * List available Miniforge versions
 *
 * @param arch
 */
async function miniforgeVersions(
  variant: string,
  osName: string,
  arch: string
): Promise<types.IGithubAssetWithRelease[]> {
  const assets: types.IGithubAssetWithRelease[] = [];
  let extension: string = constants.IS_UNIX ? "sh" : "exe";
  const suffix = `${osName}-${arch}.${extension}`;

  core.info(`Downloading ${constants.MINIFORGE_INDEX_URL}`);
  const downloadPath: string = await tc.downloadTool(
    constants.MINIFORGE_INDEX_URL
  );

  const data: types.IGithubRelease[] = JSON.parse(
    fs.readFileSync(downloadPath, "utf8")
  );

  for (const release of data) {
    if (release.prerelease || release.draft) {
      continue;
    }
    for (const asset of release.assets) {
      if (asset.name.match(`${variant}-\\d`) && asset.name.endsWith(suffix)) {
        assets.push({ ...asset, tag_name: release.tag_name });
      }
    }
  }

  return assets;
}

/**
 * Download specific Miniforge defined by variant, version and architecture
 */
export async function downloadMiniforge(
  inputs: types.IActionInputs,
  options: types.IDynamicOptions
): Promise<string> {
  let tool = inputs.miniforgeVariant.trim();
  let version = inputs.miniforgeVersion.trim();
  const arch = constants.ARCHITECTURES[inputs.architecture];

  // Check valid arch
  if (!arch) {
    throw new Error(`Invalid 'architecture: ${inputs.architecture}'`);
  }

  let url: string;

  const extension: string = constants.IS_UNIX ? "sh" : "exe";
  const osName: string = constants.OS_NAMES[process.platform];

  if (version) {
    const fileName = [tool, version, osName, `${arch}.${extension}`].join("-");
    url = [constants.MINIFORGE_URL_PREFIX, version, fileName].join("/");
  } else {
    const assets = await miniforgeVersions(
      inputs.miniforgeVariant,
      osName,
      arch
    );
    if (!assets.length) {
      throw new Error(
        `Couldn't fetch Miniforge versions and 'miniforge-version' not provided`
      );
    }
    version = assets[0].tag_name;
    url = assets[0].browser_download_url;
  }

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
  label: "download Minforge",
  provides: async (inputs, options) => {
    return inputs.miniforgeVariant !== "" && inputs.installerUrl === "";
  },
  installerPath: async (inputs, options) => {
    return {
      localInstallerPath: await downloadMiniforge(inputs, options),
      options: {
        ...options,
        useBundled: false,
        mambaInInstaller: inputs.miniforgeVariant
          .toLowerCase()
          .includes("mamba"),
      },
    };
  },
};

import * as fs from "fs";

import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";

import getHrefs from "get-hrefs";

import { ensureLocalInstaller } from "./base";
import {
  ARCHITECTURES,
  IS_UNIX,
  MINICONDA_BASE_URL,
  OS_NAMES,
} from "../constants";

/**
 * List available Miniconda versions
 *
 * @param arch
 */
async function minicondaVersions(arch: string): Promise<string[]> {
  try {
    let extension: string = IS_UNIX ? "sh" : "exe";
    const downloadPath: string = await tc.downloadTool(MINICONDA_BASE_URL);
    const content: string = fs.readFileSync(downloadPath, "utf8");
    let hrefs: string[] = getHrefs(content);
    hrefs = hrefs.filter((item: string) => item.startsWith("/Miniconda3"));
    hrefs = hrefs.filter((item: string) =>
      item.endsWith(`${arch}.${extension}`)
    );
    hrefs = hrefs.map((item: string) => item.substring(1));
    return hrefs;
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
export async function downloadMiniconda(
  pythonMajorVersion: number,
  minicondaVersion: string,
  architecture: string
): Promise<string> {
  // Check valid arch
  const arch: string = ARCHITECTURES[architecture];
  if (!arch) {
    throw new Error(`Invalid arch "${architecture}"!`);
  }

  let extension: string = IS_UNIX ? "sh" : "exe";
  let osName: string = OS_NAMES[process.platform];
  const minicondaInstallerName: string = `Miniconda${pythonMajorVersion}-${minicondaVersion}-${osName}-${arch}.${extension}`;
  core.info(minicondaInstallerName);

  // Check version name
  let versions: string[] = await minicondaVersions(arch);
  if (versions) {
    if (!versions.includes(minicondaInstallerName)) {
      throw new Error(
        `Invalid miniconda version!\n\nMust be among ${versions.toString()}`
      );
    }
  }

  return await ensureLocalInstaller({
    url: MINICONDA_BASE_URL + minicondaInstallerName,
    tool: `Miniconda${pythonMajorVersion}`,
    version: minicondaVersion,
    arch: arch,
  });
}

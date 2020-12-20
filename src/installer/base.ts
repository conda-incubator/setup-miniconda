import * as crypto from "crypto";
import * as path from "path";
import { URL, fileURLToPath } from "url";

import * as core from "@actions/core";
import * as io from "@actions/io";
import * as tc from "@actions/tool-cache";

import { minicondaPath } from "../conda";
import { execute } from "../utils";
import * as types from "../types";

/** Get the path for a locally-executable installer from cache, or as downloaded
 *
 * @returns the local path to the installer (with the correct extension)
 *
 * ### Notes
 * Assume `url` at least ends with the correct executable extension
 * for this platform, but don't make any other assumptions about `url`'s format:
 * - might include GET params (?&) and hashes (#),
 * - was not built with `constructor` (but still has the same CLI),
 * - or has been renamed during a build process
 */
export async function ensureLocalInstaller(
  options: types.ILocalInstallerOpts
): Promise<string> {
  core.startGroup("Ensuring Installer...");

  const url = new URL(options.url);

  const installerName = path.basename(url.pathname);
  // as a URL, we assume posix paths
  const installerExtension = path.posix.extname(installerName);
  const tool = options.tool != null ? options.tool : installerName;
  // create a fake version if neccessary
  const version =
    options.version != null
      ? options.version
      : "0.0.0-" +
        crypto.createHash("sha256").update(options.url).digest("hex");

  let executablePath = "";

  if (url.protocol === "file:") {
    core.info(`Local file specified, using in-place...`);
    executablePath = fileURLToPath(options.url);
  }

  if (executablePath === "") {
    core.info(`Checking for cached ${tool}@${version}...`);
    executablePath = tc.find(installerName, version);
    if (executablePath !== "") {
      core.info(`Found ${installerName} cache at ${executablePath}!`);
    }
  }

  if (executablePath === "") {
    core.info(`Did not find ${installerName} in cache, downloading...`);
    const rawDownloadPath = await tc.downloadTool(options.url);
    core.info(`Downloaded ${installerName}, appending ${installerExtension}`);
    // always ensure the installer ends with a known path
    executablePath = rawDownloadPath + installerExtension;
    await io.mv(rawDownloadPath, executablePath);
    core.info(`Caching ${tool}@${version}...`);
    const cacheResult = await tc.cacheFile(
      executablePath,
      installerName,
      tool,
      version,
      ...(options.arch ? [options.arch] : [])
    );
    core.info(`Cached ${tool}@${version}: ${cacheResult}!`);
  }

  core.endGroup();

  if (executablePath === "") {
    throw Error("Could not determine an executable path from installer-url");
  }

  return executablePath;
}

/**
 * Install Miniconda
 *
 * @param installerPath must have an appropriate extension for this platform
 */
export async function runInstaller(
  installerPath: string,
  options: types.IDynamicOptions
): Promise<void> {
  const outputPath: string = minicondaPath(options);
  const installerExtension = path.extname(installerPath);
  let command: string[];

  switch (installerExtension) {
    case ".exe":
      /* From https://docs.anaconda.com/anaconda/install/silent-mode/
          /D=<installation path> - Destination installation path.
                                  - Must be the last argument.
                                  - Do not wrap in quotation marks.
                                  - Required if you use /S.
          For the above reasons, this is treated a monolithic arg
        */
      command = [
        `"${installerPath}" /InstallationType=JustMe /RegisterPython=0 /S /D=${outputPath}`,
      ];
      break;
    case ".sh":
      command = ["bash", installerPath, "-f", "-b", "-p", outputPath];
      break;
    default:
      throw new Error(`Unknown installer extension: ${installerExtension}`);
  }

  core.info(`Install Command:\n\t${command}`);

  return await execute(command);
}

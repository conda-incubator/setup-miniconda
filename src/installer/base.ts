/**
 * @module installer/base
 * Shared logic for downloading, caching, and locating `constructor`-compatible
 * installers via the `@actions/tool-cache`.
 *
 * @category Installers
 */

import * as crypto from "crypto";
import * as path from "path";
import { URL, fileURLToPath } from "url";

import * as core from "@actions/core";
import * as io from "@actions/io";
import * as tc from "@actions/tool-cache";

import * as types from "../types";

/**
 * Get the path for a locally-executable installer from cache, or as downloaded.
 *
 * ### Note
 * Assumes `url` at least ends with the correct executable extension
 * for this platform, but makes no other assumptions about the URL format:
 * it might include GET params, was not built with `constructor` (but still
 * has the same CLI), or has been renamed during a build process.
 *
 * @param options - Cache and download metadata for the installer.
 * @returns The local path to the installer (with the correct extension).
 * @throws {Error} If no executable path could be determined after all attempts.
 *
 * @example
 * ```ts
 * const localPath = await ensureLocalInstaller({
 *   url: "https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh",
 *   tool: "Miniconda3",
 *   version: "latest",
 *   arch: "x86_64",
 * });
 * ```
 */
export async function ensureLocalInstaller(
  options: types.ILocalInstallerOpts,
): Promise<string> {
  core.info("Ensuring Installer...");

  const url = new URL(options.url);

  const installerName = path.basename(url.pathname);
  // As a URL, we assume posix paths
  const installerExtension = path.posix.extname(installerName);
  const tool = options.tool != null ? options.tool : installerName;
  // Create a fake version if neccessary
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
    // tc.find returns the name of the directory in which
    // the cached file is located.
    const cacheDirectoryPath = tc.find(
      installerName,
      version,
      ...(options.arch ? [options.arch] : []),
    );
    if (cacheDirectoryPath !== "") {
      core.info(`Found ${installerName} cache at ${cacheDirectoryPath}!`);

      // Append the basename of the cached file to the directory
      // returned by tc.find
      executablePath = path.join(cacheDirectoryPath, installerName);
      core.info(`executablePath is ${executablePath}`);
    } else {
      core.info(`Did not find ${installerName} ${version} in cache`);
    }
  }

  if (executablePath === "") {
    const rawDownloadPath = await tc.downloadTool(options.url);
    core.info(
      `Downloaded ${installerName}, ensuring extension ${installerExtension}`,
    );
    // Always ensure the installer ends with a known path
    executablePath = rawDownloadPath + installerExtension;
    await io.mv(rawDownloadPath, executablePath);
    core.info(`Caching ${tool}@${version}...`);
    const cacheResult = await tc.cacheFile(
      executablePath,
      installerName,
      tool,
      version,
      ...(options.arch ? [options.arch] : []),
    );
    core.info(`Cached ${tool}@${version}: ${cacheResult}!`);
  }

  return executablePath;
}

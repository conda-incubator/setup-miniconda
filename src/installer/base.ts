/**
 * @module installer/base
 * Shared logic for downloading, caching, and locating `constructor`-compatible
 * installers via the `@actions/tool-cache`.
 *
 * @category Installers
 */

import * as crypto from "crypto";
import * as fs from "fs";
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

  if (url.protocol === "http:") {
    core.warning(
      `'installer-url' uses insecure 'http:'. This is deprecated and will be ` +
        `rejected in a future major version; use 'https:' and/or set ` +
        `'installer-sha256'. A network attacker could otherwise replace the installer.`,
    );
  }

  const installerName = path.basename(url.pathname);
  // As a URL, we assume posix paths
  const installerExtension = path.posix.extname(installerName);
  const tool = options.tool != null ? options.tool : installerName;
  // Create a fake version if neccessary
  let version =
    options.version != null
      ? options.version
      : "0.0.0-" +
        crypto.createHash("sha256").update(options.url).digest("hex");
  // Fold the expected checksum into the cache version so that changing
  // `installer-sha256` for the same URL misses any stale cache entry and
  // re-downloads, instead of verifying the old cached file and failing.
  if (options.sha256) {
    version = `${version}-sha256.${options.sha256.trim().toLowerCase()}`;
  }

  let executablePath = "";

  if (url.protocol === "file:") {
    core.info(`Local file specified, using in-place...`);
    executablePath = fileURLToPath(options.url);
    if (options.sha256) {
      await verifyChecksum(executablePath, options.sha256);
    }
  }

  if (executablePath === "") {
    core.info(`Checking for cached ${tool}@${version}...`);
    // tc.find returns the name of the directory in which
    // the cached file is located.
    // Look up the cache by the same key used to write it (`tool`, not the
    // installer filename); otherwise callers that set `options.tool` never get
    // a cache hit (re-downloading every run and skipping cache verification).
    const cacheDirectoryPath = tc.find(
      tool,
      version,
      ...(options.arch ? [options.arch] : []),
    );
    if (cacheDirectoryPath !== "") {
      core.info(`Found ${installerName} cache at ${cacheDirectoryPath}!`);

      // Append the basename of the cached file to the directory
      // returned by tc.find
      executablePath = path.join(cacheDirectoryPath, installerName);
      core.info(`executablePath is ${executablePath}`);
      if (options.sha256) {
        await verifyChecksum(executablePath, options.sha256);
      }
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
    // Verify before caching so a tampered installer is never written into the
    // tool cache (which persists across runs on self-hosted runners).
    if (options.sha256) {
      await verifyChecksum(executablePath, options.sha256);
    }
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

/**
 * Verify a file's SHA-256 against an expected hex digest, failing closed.
 *
 * @param filePath - Path to the file to hash.
 * @param expected - Expected SHA-256 as a hex string (case-insensitive).
 * @throws {Error} If the computed digest does not match `expected`.
 */
async function verifyChecksum(
  filePath: string,
  expected: string,
): Promise<void> {
  const hash = crypto.createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve());
  });
  const actual = hash.digest("hex");
  const normalizedExpected = expected.trim().toLowerCase();
  if (actual !== normalizedExpected) {
    throw new Error(
      `Installer checksum mismatch: expected sha256 '${normalizedExpected}' ` +
        `but the file hashed to '${actual}'. The installer may be corrupted ` +
        `or tampered with; aborting.`,
    );
  }
  core.info(`Verified installer sha256: ${actual}`);
}

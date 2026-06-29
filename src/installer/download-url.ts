/**
 * @module installer/download-url
 * Download a `constructor`-compatible installer from an arbitrary URL,
 * including `file://` URLs for locally-available installers.
 *
 * @category Installers
 */

import * as core from "@actions/core";

import * as types from "../types";

import * as base from "./base";

/**
 * Provide a path to a `constructor`-compatible installer downloaded from
 * any URL, including `file://` URLs.
 *
 * ### Note
 * The entire local URL is used as the cache key.
 */
export const urlDownloader: types.IInstallerProvider = {
  label: "download a custom installer by URL",
  provides: async (inputs, _options) => !!inputs.installerUrl,
  installerPath: async (inputs, options) => {
    if (!inputs.installerSha256) {
      core.warning(
        `'installer-url' was provided without 'installer-sha256'. The installer ` +
          `will be executed without integrity verification; set 'installer-sha256' ` +
          `to the expected SHA-256 to verify it.`,
      );
    }
    return {
      localInstallerPath: await base.ensureLocalInstaller({
        url: inputs.installerUrl,
        ...(inputs.installerSha256 ? { sha256: inputs.installerSha256 } : {}),
      }),
      options: {
        ...options,
        useBundled: false,
      },
    };
  },
};

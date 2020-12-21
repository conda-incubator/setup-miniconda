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
  provides: async (inputs, options) => !!inputs.installerUrl,
  installerPath: async (inputs, options) => {
    return {
      localInstallerPath: await base.ensureLocalInstaller({
        url: inputs.installerUrl,
      }),
      options: {
        ...options,
        useBundled: false,
      },
    };
  },
};

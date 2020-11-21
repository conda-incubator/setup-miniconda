import * as types from "../_types";

import { ensureLocalInstaller } from "./_base";

export const urlDownloader: types.IInstallerProvider = {
  label: "download a custom installer by URL",
  provides: async (inputs, options) => !!inputs.installerUrl,
  installerPath: async (inputs, options) => {
    return {
      localInstallerPath: await ensureLocalInstaller({
        url: inputs.installerUrl,
      }),
      options: {
        ...options,
        useBundled: false,
      },
    };
  },
};

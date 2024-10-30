import * as types from "../types";
import { MINICONDA_DIR_PATH } from "../constants";

/**
 * Provide a path to the pre-bundled (but probably old) Miniconda base installation
 *
 * ### Note
 * This is the "cheapest" provider: if miniconda is already on disk, it can be
 * fastest to avoid the download/install and use what's already on the image.
 */
export const bundledMinicondaUser: types.IInstallerProvider = {
  label: "use bundled Miniconda",
  provides: async (inputs, options) => {
    return (
      inputs.minicondaVersion === "" &&
      inputs.miniforgeVariant === "" &&
      inputs.miniforgeVersion === "" &&
      inputs.architecture === "x64" &&
      inputs.installerUrl === "" &&
      MINICONDA_DIR_PATH.length > 0
    );
  },
  installerPath: async (inputs, options) => {
    // No actions are performed. This is the only place `useBundled` will ever be true.
    return {
      localInstallerPath: "",
      options: {
        ...options,
        useBundled: true,
      },
    };
  },
};

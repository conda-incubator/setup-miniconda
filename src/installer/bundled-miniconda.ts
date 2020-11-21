import * as types from "../_types";

export const bundledMinicondaUser: types.IInstallerProvider = {
  label: "use bundled Miniconda",
  provides: async (inputs, options) => {
    return (
      inputs.minicondaVersion === "" &&
      inputs.architecture === "x64" &&
      inputs.installerUrl === ""
    );
  },
  installerPath: async (inputs, options) => {
    return {
      localInstallerPath: "",
      options: {
        ...options,
        useBundled: true,
      },
    };
  },
};

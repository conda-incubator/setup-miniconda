import * as path from "path";

import * as core from "@actions/core";

import * as types from "../types";
import * as utils from "../utils";

import * as conda from "../conda";

import { miniforgeDownloader } from "./download-miniforge";
import { minicondaDownloader } from "./download-miniconda";
import { urlDownloader } from "./download-url";
import { bundledMinicondaUser } from "./bundled-miniconda";

/**
 * Providers of `constructor`-compatible installers, ordered roughly by "cost".
 *
 * ### Note
 * To add a new installer,
 * - implement IInstallerProvider and add it here
 * - add to `../../action.yaml`
 * - add any new RULEs in ../input.ts, for example if the installer is not
 *   compatible with some architectures
 * - add a test!
 * - The order is important:
 *   - the first provider that provides according to the inputs/options is used.
 *   - the last provider has a fallback in case of no inputs given.
 */
const INSTALLER_PROVIDERS: types.IInstallerProvider[] = [
  bundledMinicondaUser,
  urlDownloader,
  miniforgeDownloader,
  minicondaDownloader,
];

/** See if any provider works with the given inputs and options */
export async function getLocalInstallerPath(
  inputs: types.IActionInputs,
  options: types.IDynamicOptions,
) {
  for (const provider of INSTALLER_PROVIDERS) {
    core.info(`Can we ${provider.label}?`);
    if (await provider.provides(inputs, options)) {
      core.info(`... will ${provider.label}.`);
      return provider.installerPath(inputs, options);
    }
  }
  throw Error(`No installer could be found for the given inputs`);
}

/**
 * Run a `constructor`-generated installer, like Miniconda.
 *
 * @param installerPath must have an appropriate extension for this platform
 */
export async function runInstaller(
  installerPath: string,
  outputPath: string,
  inputs: types.IActionInputs,
  options: types.IDynamicOptions,
): Promise<types.IDynamicOptions> {
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
      throw Error(`Unknown installer extension: ${installerExtension}`);
  }

  await utils.execute(command);

  // The installer may have provisioned `mamba` in `base`: use now if requested
  const mambaInInstaller = conda.isMambaInstalled(inputs, options);
  if (mambaInInstaller) {
    core.info("Mamba was found in the `base` env");
    options = {
      ...options,
      mambaInInstaller,
      useMamba: mambaInInstaller && inputs.useMamba === "true",
    };
  }

  return options;
}

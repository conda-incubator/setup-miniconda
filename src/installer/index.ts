import * as path from "path";

import * as core from "@actions/core";

import * as types from "../_types";
import * as utils from "../_utils";

import { minicondaDownloader } from "./download-miniconda";
import { urlDownloader } from "./download-url";
import { bundledMinicondaUser } from "./bundled-miniconda";

/**
 * Providers of installers.
 */
const providers: types.IInstallerProvider[] = [
  bundledMinicondaUser,
  urlDownloader,
  minicondaDownloader,
];

/** see if any provider */
export async function getLocalInstallerPath(
  inputs: types.IActionInputs,
  options: types.IDynamicOptions
) {
  for (const provider of providers) {
    core.info(`Can we ${provider.label}?`);
    if (await provider.provides(inputs, options)) {
      core.info(`... will ${provider.label}`);
      return provider.installerPath(inputs, options);
    }
  }
  throw Error(`No installer could be found for the given inputs`);
}

/**
 * Install Miniconda
 *
 * @param installerPath must have an appropriate extension for this platform
 */
export async function runInstaller(
  installerPath: string,
  outputPath: string
): Promise<void> {
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
}

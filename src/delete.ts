import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import * as core from "@actions/core";
import * as io from "@actions/io";

import * as input from "./input";
import * as utils from "./utils";

/**
 * Clean up the conda cache directory
 */
async function run(): Promise<void> {
  try {
    const inputs = await core.group("Gathering Inputs...", input.parseInputs);
    let pkgsDirs = utils.parsePkgsDirs(inputs.condaConfig.pkgs_dirs);
    if (!pkgsDirs.length) return;
    core.startGroup(
      "Removing uncompressed packages to trim down packages directory...",
    );
    for (const pkgsDir of pkgsDirs) {
      if (fs.existsSync(pkgsDir) && fs.lstatSync(pkgsDir).isDirectory()) {
        let fullPath: string;
        for (let folder_or_file of fs.readdirSync(pkgsDir)) {
          fullPath = path.join(pkgsDir, folder_or_file);
          if (
            fs.existsSync(fullPath) &&
            fs.lstatSync(fullPath).isDirectory() &&
            folder_or_file != "cache"
          ) {
            core.info(`Removing "${fullPath}"`);
            try {
              await io.rmRF(fullPath);
            } catch (err) {
              // If file could not be deleted, move to a temp folder
              core.info(`Remove failed, moving "${fullPath}" to temp folder`);
              await io.mv(fullPath, path.join(os.tmpdir(), folder_or_file));
            }
          }
        }
      }
    }
    core.endGroup();
  } catch (err) {
    core.setFailed((err as Error).message);
  }
}

void run();

export default run;

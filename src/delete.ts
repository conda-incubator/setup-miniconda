import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import * as core from "@actions/core";
import * as io from "@actions/io";

import * as utils from "./utils";

/**
 * Clean up the conda cache directory
 */
async function run(): Promise<void> {
  try {
    const cacheFolder = utils.cacheFolder();

    if (fs.existsSync(cacheFolder) && fs.lstatSync(cacheFolder).isDirectory()) {
      core.startGroup(
        "Removing uncompressed packages to trim down cache folder..."
      );
      let fullPath: string;
      for (let folder_or_file of fs.readdirSync(cacheFolder)) {
        fullPath = path.join(cacheFolder, folder_or_file);
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
      core.endGroup();
    }
  } catch (err) {
    core.setFailed(err.message);
  }
}

void run();

export default run;

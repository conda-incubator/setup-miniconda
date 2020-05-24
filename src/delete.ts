import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import * as core from "@actions/core";
import * as io from "@actions/io";

import * as utils from "./utils";

async function run(): Promise<void> {
  try {
    let cacheFolder: string = "~/conda_pkgs_dir";
    cacheFolder = cacheFolder.replace("~", os.homedir().replace("\\", "/"));

    if (fs.existsSync(cacheFolder) && fs.lstatSync(cacheFolder).isDirectory()) {
      utils.consoleLog(
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
          await io.rmRF(fullPath);
        }
      }
    }
  } catch (err) {
    core.setFailed(err.message);
  }
}

void run();

export default run;

import * as fs from "fs";
import * as path from "path";

import * as core from "@actions/core";

import * as input from "./input";
import * as utils from "./utils";

/**
 * Clean up extracted packages from the conda packages directory, keeping only
 * the compressed archive cache and loose archive files.
 *
 * Instead of recursively deleting each extracted folder (extremely slow on
 * Windows due to filesystem overhead), we rename them to a sibling directory
 * on the same filesystem. The renamed directory is left for the ephemeral
 * runner VM to discard.
 */
async function run(): Promise<void> {
  try {
    const inputs = await core.group("Gathering Inputs...", input.parseInputs);
    const pkgsDirs = utils.parsePkgsDirs(inputs.condaConfig.pkgs_dirs);
    if (!pkgsDirs.length) return;
    core.startGroup(
      "Removing uncompressed packages to trim down packages directory...",
    );
    for (const pkgsDir of pkgsDirs) {
      if (!fs.existsSync(pkgsDir) || !fs.lstatSync(pkgsDir).isDirectory()) {
        continue;
      }

      // Stash directory is a sibling to pkgsDir so rename stays on the
      // same filesystem and never fails with EXDEV
      const stashDir = `${pkgsDir}_stash_${Date.now()}`;
      fs.mkdirSync(stashDir, { recursive: true });

      for (const entry of fs.readdirSync(pkgsDir)) {
        if (entry === "cache") continue;

        const fullPath = path.join(pkgsDir, entry);
        if (!fs.existsSync(fullPath) || !fs.lstatSync(fullPath).isDirectory()) {
          continue;
        }

        const dest = path.join(stashDir, entry);
        core.info(`Stashing "${fullPath}"`);
        try {
          fs.renameSync(fullPath, dest);
        } catch (err) {
          core.warning(`Could not stash "${fullPath}": ${err}. Skipping.`);
        }
      }

      core.info(
        `Stashed extracted packages to "${stashDir}", ` +
          "will be discarded with the runner VM.",
      );
    }
    core.endGroup();
  } catch (err) {
    core.setFailed((err as Error).message);
  }
}

void run();

export default run;

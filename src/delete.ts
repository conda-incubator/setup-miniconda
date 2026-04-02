import * as fs from "fs";
import * as path from "path";

import * as core from "@actions/core";
import * as io from "@actions/io";

import * as input from "./input";
import * as utils from "./utils";

const STASH_SUFFIX = "_stash_";

/**
 * Clean up extracted packages from the conda packages directory, keeping only
 * the compressed archive cache and loose archive files.
 *
 * Instead of recursively deleting each extracted folder (extremely slow on
 * Windows due to filesystem overhead), we rename them to a sibling directory
 * on the same filesystem. On self-hosted (persistent) runners, stash
 * directories from previous runs are cleaned up before new ones are created.
 */
async function run(): Promise<void> {
  try {
    const inputs = await core.group("Gathering Inputs...", input.parseInputs);
    const pkgsDirs = utils.parsePkgsDirs(inputs.condaConfig.pkgs_dirs);
    if (!pkgsDirs.length) return;
    core.startGroup(
      "Removing uncompressed packages to trim down packages directory...",
    );
    for (const rawPkgsDir of pkgsDirs) {
      // Normalize to strip trailing separators so the sibling stash
      // directory is always created next to pkgsDir, not inside it
      const pkgsDir = path.resolve(rawPkgsDir);

      if (!fs.existsSync(pkgsDir) || !fs.lstatSync(pkgsDir).isDirectory()) {
        continue;
      }

      // Clean up stash directories left by previous runs (self-hosted runners)
      const parentDir = path.dirname(pkgsDir);
      const baseName = path.basename(pkgsDir);
      for (const sibling of fs.readdirSync(parentDir)) {
        if (sibling.startsWith(`${baseName}${STASH_SUFFIX}`)) {
          const oldStash = path.join(parentDir, sibling);
          core.info(`Cleaning up old stash directory "${oldStash}"`);
          try {
            await io.rmRF(oldStash);
          } catch (err) {
            core.warning(
              `Could not remove old stash "${oldStash}": ${
                (err as Error).message
              }`,
            );
          }
        }
      }

      // Stash directory is a sibling to pkgsDir so rename stays on the
      // same filesystem and never triggers EXDEV (the "cross-device link"
      // error that rename() throws when source and destination live on
      // different mount points / drives)
      const stashDir = path.join(
        parentDir,
        `${baseName}${STASH_SUFFIX}${Date.now()}`,
      );
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
          core.warning(
            `Could not stash "${fullPath}": ${
              (err as Error).message
            }. Skipping.`,
          );
        }
      }

      core.info(`Stashed extracted packages to "${stashDir}".`);
    }
    core.endGroup();
  } catch (err) {
    core.setFailed((err as Error).message);
  }
}

void run();

export default run;

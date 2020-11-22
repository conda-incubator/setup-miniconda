import * as os from "os";
import * as path from "path";
import * as stream from "stream";

import * as exec from "@actions/exec";
import * as core from "@actions/core";

import {
  CONDA_CACHE_FOLDER,
  FORCED_ERRORS,
  IGNORED_WARNINGS,
} from "./constants";
import { Result } from "./types";

export function cacheFolder() {
  return path.join(os.homedir(), CONDA_CACHE_FOLDER);
}

/**
 * Run exec.exec with error handling
 */
export async function execute(command: string[]): Promise<Result> {
  let options: exec.ExecOptions = {
    errStream: new stream.Writable(),
    listeners: {
      stdout: (data: Buffer) => {
        const stringData = data.toString();
        for (const forced_error of FORCED_ERRORS) {
          if (stringData.includes(forced_error)) {
            throw new Error(`"${command}" failed with "${forced_error}"`);
          }
        }
        return data;
      },
      stderr: (data: Buffer) => {
        const stringData = data.toString();
        for (const ignore of IGNORED_WARNINGS) {
          if (stringData.includes(ignore)) {
            return;
          }
        }
        core.warning(stringData);
      },
    },
  };

  try {
    await exec.exec(command[0], command.slice(1), options);
  } catch (err) {
    return { ok: false, error: err };
  }

  return { ok: true, data: "ok" };
}

import * as core from "@actions/core";
import * as conda from "./setup-conda";

async function run() {
  try {
    let condaVersion: string = core.getInput("conda-version") || "4.7";
    let condaBuildVersion: string = core.getInput("conda-build-version") || "";
    console.log(`conda-ver: "${condaVersion}"`);
    console.log(`conda-build-ver: "${condaBuildVersion}"`);
    conda.setupMiniconda(condaVersion, condaBuildVersion);
  } catch (err) {
    core.setFailed(err.message);
  }
}

run();

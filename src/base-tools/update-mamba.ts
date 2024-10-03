import * as fs from "fs";
import * as path from "path";

import * as core from "@actions/core";

import * as constants from "../constants";
import * as types from "../types";
import * as utils from "../utils";

import * as conda from "../conda";

/** Install `mamba` in the `base` env at a specified version */
export const updateMamba: types.IToolProvider = {
  label: "update mamba",
  provides: async (inputs, options) =>
    inputs.mambaVersion !== "" || options.mambaInInstaller,
  toolPackages: async (inputs, options) => {
    return {
      tools:
        inputs.mambaVersion !== ""
          ? [utils.makeSpec("mamba", inputs.mambaVersion)]
          : [],
      options: { ...options, useMamba: true },
    };
  },
  postInstall: async (inputs, options) => {
    const mambaExec = conda.condaExecutable(options);
    const condabinLocation = path.join(
      conda.condaBasePath(options),
      "condabin",
      path.basename(mambaExec),
    );
    if (constants.IS_UNIX) {
      if (!fs.existsSync(condabinLocation)) {
        // This is mamba 2.x with only $PREFIX/bin/mamba,
        // we just need a symlink in condabin
        core.info(`Symlinking ${mambaExec} to ${condabinLocation}...`);
        fs.symlinkSync(mambaExec, condabinLocation);
      }
    } else {
      core.info(`Creating bash wrapper for 'mamba'...`);
      const mambaBat = condabinLocation.slice(0, -4) + ".bat";
      // Add bat-less forwarder for bash users on Windows
      const forwarderContents = `cmd.exe /C CALL "${mambaBat}" $* || exit 1`;
      fs.writeFileSync(condabinLocation.slice(0, -4), forwarderContents);
      core.info(`... wrote ${mambaExec.slice(0, -4)}:\n${forwarderContents}`);
      if (!fs.existsSync(mambaBat)) {
        // This is Windows and mamba 2.x, we need a mamba.bat like 1.x used to have
        const contents = `
@REM Copyright (C) 2012 Anaconda, Inc
@REM SPDX-License-Identifier: BSD-3-Clause

@REM echo _CE_CONDA is %_CE_CONDA%
@REM echo _CE_M is %_CE_M%
@REM echo CONDA_EXE is %CONDA_EXE%

@IF NOT DEFINED _CE_CONDA (
  @SET _CE_M=
  @SET "CONDA_EXE=%~dp0..\\Scripts\\conda.exe"
)
@IF [%1]==[activate]   "%~dp0_conda_activate" %*
@IF [%1]==[deactivate] "%~dp0_conda_activate" %*

@SET MAMBA_EXES="%~dp0..\\Library\\bin\\mamba.exe"
@CALL %MAMBA_EXES% %*

@IF %errorlevel% NEQ 0 EXIT /B %errorlevel%

@IF [%1]==[install]   "%~dp0_conda_activate" reactivate
@IF [%1]==[update]    "%~dp0_conda_activate" reactivate
@IF [%1]==[upgrade]   "%~dp0_conda_activate" reactivate
@IF [%1]==[remove]    "%~dp0_conda_activate" reactivate
@IF [%1]==[uninstall] "%~dp0_conda_activate" reactivate

@EXIT /B %errorlevel%`;
        core.info(`Creating .bat wrapper for 'mamba 2.x'...`);
        fs.writeFileSync(mambaBat, contents);
        core.info(`... wrote ${mambaBat}`);
      }
    }
  },
};

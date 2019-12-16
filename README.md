# action-setup-conda

This action sets up a Conda installation and creates a test environment by installing Miniconda3 on unix systems and locating the bundled Miniconda on windows systems.

Miniconda `condabin/`, `bin/` and `scripts/` folders are added to PATH and conda is initialized across platforms.

# Usage

See [action.yml](action.yml)

## Basic for unix systems:

```yaml
steps:
- uses: actions/checkout@v1
- uses: goanpeca/action-setup-conda@master
  with:
    conda-version: '4.8'  # optional. Version of conda to use for setting up the base evironment. Default is 4.7.
    conda-build-version: '3.17'  # optional. If not provided conda build is not installed.
- run: conda create --name test python=3.6
- name: Using bash
  shell: bash -l {0}  # bash shells do not use ~/.profile or ~/.bash_profile so this needs to be added when using activate commands
  run: |
    conda activate test
    conda info
    conda list
    printenv | sort
- name: Using sh
  shell: sh -l {0}  # sh shells do not use ~/.profile or ~/.bashrc so this needs to be added when using activate commands
  run: |
    conda activate test
    conda info
    conda list
    printenv | sort
```

## Basic for windows systems:

```yaml
steps:
- uses: actions/checkout@v1
- uses: goanpeca/action-setup-conda@master
  with:
    conda-version: '4.7'  # optional. Version of conda to use for setting up the base evironment. Default is 4.7.
    conda-build-version: '3.17'  # optional. If not provided conda build is not installed.
- run: conda create --name test python=3.6
- name: Using PowerShell
  run: |
    conda activate test
    conda info
    conda list
    gci env:* | sort-object name
- name: Using PowerShell Core
  shell: pwsh
  run: |
    conda activate test
    conda info
    conda list
    gci env:* | sort-object name
- name: Using bash
  shell: bash -l {0}  # bash shells do not use ~/.profile or ~/.bash_profile so this needs to be added when using activate commands
  run: |
    conda activate test
    conda info
    conda list
    printenv | sort
- name: Using cmd.exe
  shell: cmd
  run: >-  # cmd shells need to use "%CONDA_BAT%" isntead of `conda` for environment activation
    "%CONDA_BAT%" activate test &&
    conda info &&
    conda list &&
    SET
```

# License

The scripts and documentation in this project are released under the [MIT License](LICENSE.txt)


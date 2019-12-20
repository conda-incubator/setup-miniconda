# Setup Conda Action

This action sets up a [Miniconda](https://docs.conda.io/en/latest/miniconda.html) installation to use the [Conda](https://docs.conda.io/projects/conda/en/latest/) package and environment manager by either locating the Miniconda installation bundled with the available runners or by installing a specific Miniconda3 version. By default this action will also create a test environment.

Miniconda `condabin/` folder is added to `PATH` and conda is correctly initialized across all platforms.

This action correctly handles activation of conda environments and offers the possibility of automatically activating the test environment on all shells. 

See the **[IMPORTANT](#IMPORTANT)** notes on additional information on environment activation.

# Usage examples

For a full list of available inputs for this action see [action.yml](action.yml).

## Example 1: Basic usage

This example shows how to set a basic python workflow with conda using the crossplatform available shells: `bash` and `pwsh`. On this example an environment named `test` will be created with the specific `python-version` installed for each opearating system, resulting on 6 build workers.

```yaml
on:
  push:
    branches:
    - master
  pull_request:
    branches:
    - master

jobs:
  example-1:
    name: Ex1 (${{ matrix.python-version }}, ${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: ['ubuntu-latest', 'macos-latest', 'windows-latest']
        python-version: ['3.7', '2.7']
    steps:
      - uses: goanpeca/setup-miniconda@v1
        with:
          auto-update-conda: true
          python-version: ${{ matrix.python-version }}
      - name: Conda info
        shell: bash -l {0}
        run: conda info
      - name: Conda list
        shell: pwsh
        run: conda list
```

## Example 2: Other shells

This example shows how to use all other available shells for specific operating systems. On this example we select to download the latest anaconda version available and create and activate by default an environment named `foo`

```yaml
on:
  push:
    branches:
    - master
  pull_request:
    branches:
    - master

jobs:
  example-2-linux:
    name: Ex2 Linux
    runs-on: 'ubuntu-latest'
    steps:
      - uses: goanpeca/setup-miniconda@v1
        with:
          miniconda-version: 'latest'
          activate-environment: foo
      - name: Sh
        shell: sh -l {0}
        run: |
          conda info
          conda list
      - name: Bash
        shell: bash -l {0}
        run: |
          conda info
          conda list
      - name: PowerShell Core
        shell: pwsh
        run: |
          conda info
          conda list

  example-2-mac:
    name: Ex2 Mac
    runs-on: 'macos-latest'
    steps:
      - uses: goanpeca/setup-miniconda@v1
        with:
          miniconda-version: 'latest'
          activate-environment: foo
      - name: Sh
        shell: sh -l {0}
        run: |
          conda info
          conda list
      - name: Bash
        shell: bash -l {0}
        run: |
          conda info
          conda list
      - name: PowerShell Core
        shell: pwsh
        run: |
          conda info
          conda list

  example-2-win:
    name: Ex2 Windows
    runs-on: 'windows-latest'
    steps:
      - uses: goanpeca/setup-miniconda@v1
        with:
          miniconda-version: 'latest'
          activate-environment: foo
      - name: Bash
        shell: bash -l {0}
        run: |
          conda info
          conda list
      - name: PowerShell
        shell: powershell
        run: |
          conda info
          conda list
      - name: PowerShell Core
        shell: pwsh
        run: |
          conda info
          conda list
      - name: Cmd.exe
        shell: cmd /C CALL {0}
        run: >-
          conda info &&
          conda list
```


## Example 3: Other options

This example shows how to use [environment.yml](etc/example-environment.yml) for easier creation of test/build environments and [.condarc](etc/example-condarc.yml) files for fine grained configuration management. On this example we use a custom configuration file, install an environment from a yaml file and disable autoactivating the base environment before activating the `anaconda-client-env`.

```yaml
on:
  push:
    branches:
    - master
  pull_request:
    branches:
    - master

jobs:
  example-3:
    name: Ex3 Linux
    runs-on: 'ubuntu-latest'
    steps:
      - uses: actions/checkout@v2
      - uses: goanpeca/setup-miniconda@v1
        with:
           activate-environment: anaconda-client-env
           environment-file: etc/example-environment.yml
           python-version: 3.5
           condarc-file: etc/example-condarc.yml
           auto-activate-base: false
      - shell: bash -l {0}
        run: |
          conda info
          conda list
```

## IMPORTANT

- Bash shells do not use `~/.profile` or `~/.bashrc` so these shells need to be explicitely declared as `shell: bash -l {0}` on steps that need to be properly activated. This is because bash shells are executed with `bash --noprofile --norc -eo pipefail {0}` thus ignoring updated on bash profile files made by `conda init bash`. See [Github Actions Documentation](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/workflow-syntax-for-github-actions#using-a-specific-shell) and [thread](https://github.community/t5/GitHub-Actions/How-to-share-shell-profile-between-steps-or-how-to-use-nvm-rvm/td-p/33185).
- Sh shells do not use `~/.profile` or `~/.bashrc` so these shells need to be explicitely declared as `shell: sh -l {0}` on steps that need to be properly activated. This is because sh shells are executed with `sh -e {0}` thus ignoring updated on bash profile files made by `conda init bash`. See [Github Actions Documentation](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/workflow-syntax-for-github-actions#using-a-specific-shell).
- Cmd shells do not run `Autorun` commands so these shells need to be explicitely declared as `shell: cmd /C call {0}` on steps that need to be properly activated. This is because cmd shells are executed with `%ComSpec% /D /E:ON /V:OFF /S /C "CALL "{0}""` and the `/D` flag disabled execution of `Command Processor/Autorun` windows registry keys, which is what `conda init cmd.exe` sets. See [Github Actions Documentation](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/workflow-syntax-for-github-actions#using-a-specific-shell).

# License

The scripts and documentation in this project are released under the [MIT License](LICENSE.txt)

# Setup Miniconda

![Example 1: Basic usage](https://github.com/goanpeca/setup-miniconda/workflows/Example%201:%20Basic%20usage/badge.svg?branch=1.x)
![Example 2: Other shells](https://github.com/goanpeca/setup-miniconda/workflows/Example%202:%20Other%20shells/badge.svg?branch=1.x)
![Example 3: Other options](https://github.com/goanpeca/setup-miniconda/workflows/Example%203:%20Other%20options/badge.svg?branch=1.x)
![Example 4: Channels](https://github.com/goanpeca/setup-miniconda/workflows/Example%204:%20Channels/badge.svg?branch=1.x)

This action sets up a [Miniconda](https://docs.conda.io/en/latest/miniconda.html) installation to use the [Conda](https://docs.conda.io/projects/conda/en/latest/) package and environment manager by either locating the Miniconda installation bundled with the available runners or by installing a specific Miniconda3 version. By default this action will also create a test environment.

Miniconda `condabin/` folder is added to `PATH` and conda is correctly initialized across all platforms.

This action correctly handles activation of conda environments and offers the possibility of automatically activating the test environment on all shells.

See the **[IMPORTANT](#IMPORTANT)** notes on additional information on environment activation.

## Usage examples

For a full list of available inputs for this action see [action.yml](action.yml).

### Example 1: Basic usage

This example shows how to set a basic python workflow with conda using the crossplatform available shells: `bash` and `pwsh`. On this example an environment named `test` will be created with the specific `python-version` installed for each opearating system, resulting on 6 build workers.

```yaml
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

### Example 2: Other shells

This example shows how to use all other available shells for specific operating systems. On this example we select to download the latest anaconda version available and create and activate by default an environment named `foo`.

```yaml
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

### Example 3: Other options

This example shows how to use [environment.yml](etc/example-environment.yml) for easier creation of test/build environments and [.condarc](etc/example-condarc.yml) files for fine grained configuration management. On this example we use a custom configuration file, install an environment from a yaml file and disable autoactivating the base environment before activating the `anaconda-client-env`.

```yaml
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

### Example 4: Conda options

This example shows how to use `channels` option and other extra options. The priority will be set by the order of the channels.
In this example it will result in:

- conda-forge
- spyder-ide
- defaults

```yaml
jobs:
  example-4:
    name: Ex4 Linux
    runs-on: 'ubuntu-latest'
    steps:
      - uses: actions/checkout@v2
      - uses: goanpeca/setup-miniconda@v1
        with:
          activate-environment: foo
          python-version: 3.6
          channels: conda-forge,spyder-ide
          allow-softlinks: true
          channel-priority: flexible
          show-channel-urls: true
          use-only-tar-bz2: true
      - shell: bash -l {0}
        run: |
          conda info
          conda list
          conda config --show-sources
          conda config --show
```

## Caching

If you want to enable package caching for conda you can use the [cache action](https://github.com/actions/cache) using `~/conda_pkgs_dir` as path for conda packages.

The cache will use a explicit key for restoring and saving the cache.

This can be based in the contents of files like:

- `setup.py`
- `requirements.txt`
- `environment.yml`

```yaml
jobs:
  caching-example:
    name: Caching
    runs-on: 'ubuntu-latest'
    steps:
      - uses: actions/checkout@v2
      - name: Cache conda
        uses: actions/cache@v1
        env:
          # Increase this value to reset cache if etc/example-environment.yml has not changed
          CACHE_NUMBER: 0
        with:
          path: ~/conda_pkgs_dir
          key: ${{ runner.os }}-conda-${{ env.CACHE_NUMBER }}-${{ hashFiles('etc/example-environment.yml') }}
      - uses: goanpeca/setup-miniconda@check-cache
        with:
          activate-environment: anaconda-client-env
          python-version: 3.8
          channel-priority: strict
          environment-file: etc/example-environment.yml
          use-only-tar-bz2: true  # IMPORTANT: This needs to be set for caching to work properly!
```

## IMPORTANT

- Bash shells do not use `~/.profile` or `~/.bashrc` so these shells need to be explicitely declared as `shell: bash -l {0}` on steps that need to be properly activated. This is because bash shells are executed with `bash --noprofile --norc -eo pipefail {0}` thus ignoring updated on bash profile files made by `conda init bash`. See [Github Actions Documentation](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/workflow-syntax-for-github-actions#using-a-specific-shell) and [thread](https://github.community/t5/GitHub-Actions/How-to-share-shell-profile-between-steps-or-how-to-use-nvm-rvm/td-p/33185).
- Sh shells do not use `~/.profile` or `~/.bashrc` so these shells need to be explicitely declared as `shell: sh -l {0}` on steps that need to be properly activated. This is because sh shells are executed with `sh -e {0}` thus ignoring updated on bash profile files made by `conda init bash`. See [Github Actions Documentation](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/workflow-syntax-for-github-actions#using-a-specific-shell).
- Cmd shells do not run `Autorun` commands so these shells need to be explicitely declared as `shell: cmd /C call {0}` on steps that need to be properly activated. This is because cmd shells are executed with `%ComSpec% /D /E:ON /V:OFF /S /C "CALL "{0}""` and the `/D` flag disabled execution of `Command Processor/Autorun` windows registry keys, which is what `conda init cmd.exe` sets. See [Github Actions Documentation](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/workflow-syntax-for-github-actions#using-a-specific-shell).
- For caching to work properly, you will need to set the `use-only-tar-bz2` option to `true`.

# License

The scripts and documentation in this project are released under the [MIT License](LICENSE.txt)

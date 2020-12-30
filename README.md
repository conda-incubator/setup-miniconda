# `conda-incubator/setup-miniconda`

![Example 1: Basic usage](https://github.com/conda-incubator/setup-miniconda/workflows/Example%201:%20Basic%20usage/badge.svg?branch=master)
![Example 2: Other shells](https://github.com/conda-incubator/setup-miniconda/workflows/Example%202:%20Other%20shells/badge.svg?branch=master)
![Example 3: Other options](https://github.com/conda-incubator/setup-miniconda/workflows/Example%203:%20Other%20options/badge.svg?branch=master)
![Example 4: Channels](https://github.com/conda-incubator/setup-miniconda/workflows/Example%204:%20Channels/badge.svg?branch=master)
![Example 5: Custom installer](https://github.com/conda-incubator/setup-miniconda/workflows/Example%205:%20Custom%20installer/badge.svg?branch=master)
![Example 6: Mamba](https://github.com/conda-incubator/setup-miniconda/workflows/Example%206:%20Mamba/badge.svg?branch=master)
![Caching Example](https://github.com/conda-incubator/setup-miniconda/workflows/Caching%20Example/badge.svg?branch=master)
![Linting](https://github.com/conda-incubator/setup-miniconda/workflows/Linting/badge.svg?branch=master)

This action sets up a
[Miniconda](https://docs.conda.io/en/latest/miniconda.html) installation to use
the [Conda](https://docs.conda.io/projects/conda/en/latest/) package and
environment manager by either locating the Miniconda installation [bundled with
the available runners](https://docs.github.com/en/free-pro-team@latest/actions/reference/specifications-for-github-hosted-runners#supported-software) or by installing a specific Miniconda3 version. By default
this action will also create a test environment.

Miniconda `condabin/` folder is added to `PATH` and conda is correctly
initialized across all platforms.

This action correctly handles activation of conda environments and offers the
possibility of automatically activating the test environment on all shells.

> See the **[IMPORTANT](#IMPORTANT)** notes on additional information on
environment activation.

## Environment activation

This action will by default will not activate the `base`environment and activate an environment called `test`.
This enforces the idea of not using the `base` environment to install packages used for the action and
leave the `base` environment untouched, with only `conda` (or `mamba`) in it.

### Use a different environment name or path

You can change the default `test` environment to have a different name or path by
setting the `activate-environment` input option.

```yaml
 - uses: conda-incubator/setup-miniconda@v2
   with:
     activate-environment: whatever
```

This will be create a _named_ env in `$CONDA/envs/whatever`, where `$CONDA` is the
path to the infrequently-updated, but **very fast** to start, "bundled" Miniconda
installation.

> - If `activate-environment` contains either POSIX or Windows slashes, it will be
>   interpreted as a path, or "prefix" in `conda` terminology. Use this to avoid
>   "path too long"-style errors, especially on windows.
> - Self-hosted runners can emulate the "bundled" Miniconda approach by pre-installing
>   _a_ Miniconda-like installer and ensuring `$CONDA` is set prior to starting
>   `setup-miniconda`

### Activate `base` environment

If your specific workflow still needs to activate and use `base` you will need to set the
`activate-environment` input option to an empty string and also the `auto-activate-base`
key to `true`.

```yaml
 - uses: conda-incubator/setup-miniconda@v2
   with:
     auto-activate-base: true
     activate-environment: ""
```

## Usage examples

For a full list of available inputs for this action see
[action.yml](action.yml).

### Example 1: Basic usage

This example shows how to set a basic python workflow with conda using the
crossplatform available shells: `bash` and `pwsh`. On this example an
environment named `test` will be created with the specific `python-version`
installed for each opearating system, resulting on 6 build workers.

```yaml
jobs:
  example-1:
    name: Ex1 (${{ matrix.python-version }}, ${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: ["ubuntu-latest", "macos-latest", "windows-latest"]
        python-version: ["3.7", "2.7"]
    steps:
      - uses: conda-incubator/setup-miniconda@v2
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

This example shows how to use all other available shells for specific operating
systems. On this example we select to download the latest anaconda version
available and create and activate by default an environment named `foo`.

```yaml
jobs:
  example-2-linux:
    name: Ex2 Linux
    runs-on: "ubuntu-latest"
    steps:
      - uses: conda-incubator/setup-miniconda@v2
        with:
          miniconda-version: "latest"
          activate-environment: foo
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
    runs-on: "macos-latest"
    steps:
      - uses: conda-incubator/setup-miniconda@v2
        with:
          miniconda-version: "latest"
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
    runs-on: "windows-latest"
    steps:
      - uses: conda-incubator/setup-miniconda@v2
        with:
          miniconda-version: "latest"
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
          conda info && conda list
```

### Example 3: Other options

This example shows how to use [environment.yml](etc/example-environment.yml) for
easier creation of test/build environments and
[.condarc](etc/example-condarc.yml) files for fine grained configuration
management. On this example we use a custom configuration file, install an
environment from a yaml file and disable autoactivating the base environment
before activating the `anaconda-client-env`.

```yaml
jobs:
  example-3:
    name: Ex3 Linux
    runs-on: "ubuntu-latest"
    defaults:
      run:
        shell: bash -l {0}
    steps:
      - uses: actions/checkout@v2
      - uses: conda-incubator/setup-miniconda@v2
        with:
          activate-environment: anaconda-client-env
          environment-file: etc/example-environment.yml
          python-version: 3.5
          condarc-file: etc/example-condarc.yml
          auto-activate-base: false
      - run: |
          conda info
          conda list
```

### Example 4: Conda options

This example shows how to use `channels` option and other extra options. The
priority will be set by the order of the channels. In this example it will
result in:

- conda-forge
- spyder-ide
- defaults

```yaml
jobs:
  example-4:
    name: Ex4 Linux
    runs-on: "ubuntu-latest"
    defaults:
      run:
        shell: bash -l {0}
    steps:
      - uses: actions/checkout@v2
      - uses: conda-incubator/setup-miniconda@v2
        with:
          activate-environment: foo
          python-version: 3.6
          channels: conda-forge,spyder-ide
          allow-softlinks: true
          channel-priority: flexible
          show-channel-urls: true
          use-only-tar-bz2: true
      - run: |
          conda info
          conda list
          conda config --show-sources
          conda config --show
```

### Example 5: Custom installer

Any installer created with [constructor](https://github.com/conda/constructor)
which includes `conda` can be used in place of Miniconda. For example,
[conda-forge](https://conda-forge.org/) maintains additional builds of
[miniforge](https://github.com/conda-forge/miniforge/releases) for platforms not
yet supported by Miniconda. For more, see [Example 10](#example-10-miniforge).

> Notes:
>  - Installer downloads are cached based on their full URL: adding some
>    non-functional salt to the URL will prevent this behavior, e.g.
>    `#${{ github.run_number }}`

```yaml
jobs:
  example-5:
    name: Ex5 Miniforge for PyPy
    runs-on: "ubuntu-latest"
    defaults:
      run:
        shell: bash -l {0}
    steps:
      - uses: actions/checkout@v2
      - uses: conda-incubator/setup-miniconda@v2
        with:
          installer-url: https://github.com/conda-forge/miniforge/releases/download/4.8.3-2/Miniforge-pypy3-4.8.3-2-Linux-x86_64.sh
          allow-softlinks: true
          show-channel-urls: true
          use-only-tar-bz2: true
      - run: |
          conda info
          conda list
          conda config --show-sources
          conda config --show
```

### Example 6: Mamba

Experimental! Use `mamba` to handle conda installs in a faster way.
`mamba-version` accepts a version string `x.y` (including `"*"`). It requires
you specify `conda-forge` as part of the channels, ideally with the highest
priority.

> Notes:
>  - If a [custom installer](#example-5-custom-installer) provides `mamba`, it
>    can be prioritized wherever possible (including installing `mamba-version`)
>    with `use-mamba: true`.

```yaml
jobs:
  example-6:
    name: Ex6 Mamba
    runs-on: "ubuntu-latest"
    steps:
      - uses: actions/checkout@v2
      - uses: conda-incubator/setup-miniconda@v2
        with:
          python-version: 3.6
          mamba-version: "*"
          channels: conda-forge,defaults
          channel-priority: true
          activate-environment: anaconda-client-env
          environment-file: etc/example-environment.yml
      - shell: bash -l {0}
        run: |
          conda info
          conda list
          conda config --show-sources
          conda config --show
          printenv | sort
      - shell: bash -l {0}
        run: mamba install jupyterlab
```

### Example 7: Explicit Specification

`conda list --explicit` and [conda-lock][] support generating [explicit
environment specifications][spec], which skip the environment solution step
altogether, as they contain the _ordered_ list of exact URLs needed to reproduce
the environment.

This means explicitly-defined environments...

- are _much faster_ to install, as several expensive steps are skipped:
  - channels are not queried for their repo data
  - no solver is run
- are not cross-platform, as the URLs almost always contain
  platform/architecture information
- can become broken if any file becomes unavailable

This approach can be useful as part of a larger system e.g. a separate workflow
that runs `conda-lock` for all the platforms needed in a separate job.

[conda-lock]: https://github.com/conda-incubator/conda-lock
[spec]:
  https://docs.conda.io/projects/conda/en/latest/user-guide/tasks/manage-environments.html#building-identical-conda-environments

```yaml
jobs:
  example-7:
    name: Ex7 Explicit
    runs-on: "ubuntu-latest"
    defaults:
      run:
        shell: bash -l {0}
    steps:
      - uses: actions/checkout@v2
      - uses: conda-incubator/setup-miniconda@v2
        with:
          auto-update-conda: false
          activate-environment: explicit-env
          environment-file: etc/example-explicit.conda.lock
      - run: |
          conda info
          conda list
          conda config --show-sources
          conda config --show
          printenv | sort
```

### Example 10: Miniforge

[Miniforge](https://github.com/conda-forge/miniforge) provides a number of
alternatives to Miniconda, built from the ground up with `conda-forge` packages
and with only `conda-forge` in its default channels.

```yaml
jobs:
  example-10-miniforge:
    name: Ex10 (${{ matrix.os }}, Miniforge)
    runs-on: ${{ matrix.os }}-latest
    strategy:
      matrix:
        os: ["ubuntu", "macos", "windows"]
        include:
        - os: windows
          miniforge-version: 4.9.2-4
    steps:
      - uses: actions/checkout@v2
      - uses: conda-incubator/setup-miniconda@v2
        id: setup-miniconda
        with:
          environment-file: etc/example-environment.yml
          miniforge-variant: Miniforge3
          miniforge-version: ${{ matrix.miniforge-version }}
```

In addition to `Miniforge3` with `conda` and `CPython` for each
of its many supported platforms and architectures, additional variants including
`Mambaforge` (which comes pre-installed `mamba` in addition to `conda` on all platforms)
and `Miniforge-pypy3`/`Mamabaforge-pypy3` (which replace `CPython` with `pypy3`
on Linux/MacOs) are available. The specific version can also be overridden.

```yaml
jobs:
  example-10-mambaforge:
    name: Ex10 (${{ matrix.os }}, Mambaforge)
    runs-on: ${{ matrix.os }}-latest
    strategy:
      fail-fast: false
      matrix:
        os: ["ubuntu", "macos", "windows"]
        include:
          - os: ubuntu
            environment-file: etc/example-environment-no-name.yml
            miniforge-variant: Mambaforge
            miniforge-version: 4.9.2-4
          - os: macos
            environment-file: etc/example-empty-channels-environment.yml
            miniforge-variant: Mambaforge-pypy3
          - os: windows
            environment-file: etc/example-explicit.Windows.conda.lock
            condarc-file: etc/example-condarc.yml
            miniforge-variant: Mambaforge
    steps:
      - uses: actions/checkout@v2
      - uses: conda-incubator/setup-miniconda@v2
        id: setup-miniconda
        with:
          condarc-file: ${{ matrix.condarc-file }}
          environment-file: ${{ matrix.environment-file }}
          miniforge-variant: ${{ matrix.miniforge-variant }}
          miniforge-version: ${{ matrix.miniforge-version }}
          use-mamba: true
```

## Caching

If you want to enable package caching for conda you can use the
[cache action](https://github.com/actions/cache) using `~/conda_pkgs_dir` as
path for conda packages.

The cache will use a explicit key for restoring and saving the cache.

This can be based in the contents of files like:

- `setup.py`
- `requirements.txt`
- `environment.yml`

```yaml
jobs:
  caching-example:
    name: Caching
    runs-on: "ubuntu-latest"
    steps:
      - uses: actions/checkout@v2
      - name: Cache conda
        uses: actions/cache@v1
        env:
          # Increase this value to reset cache if etc/example-environment.yml has not changed
          CACHE_NUMBER: 0
        with:
          path: ~/conda_pkgs_dir
          key:
            ${{ runner.os }}-conda-${{ env.CACHE_NUMBER }}-${{
            hashFiles('etc/example-environment.yml') }}
      - uses: conda-incubator/setup-miniconda@v2
        with:
          activate-environment: anaconda-client-env
          channel-priority: strict
          environment-file: etc/example-environment-caching.yml
          use-only-tar-bz2: true # IMPORTANT: This needs to be set for caching to work properly!
```

If you are using pip to resolve any dependencies in your conda environment then
you may want to
[cache those dependencies separately](https://docs.github.com/en/actions/language-and-framework-guides/using-python-with-github-actions#caching-dependencies),
as they are not included in the conda package cache.

## Use a default shell

Assuming you are using the bash shell, now adding to `shell: bash -l {0}` to every single step can
be avoided if your workflow uses the same shell for all the steps.

By adding a `defaults` section and specifying the `bash -l {0}`, all steps in the job will default
to that value.

For other shells, make sure to use the right `shell` parameter as the default value. Check the [section below](#important) for some examples.

More information the [Github help page](https://docs.github.com/en/free-pro-team@latest/actions/reference/workflow-syntax-for-github-actions#jobsjob_iddefaultsrun).

```yaml
jobs:
  default-shell:
    name: Default shell
    runs-on: "ubuntu-latest"
    defaults:
      run:
        shell: bash -l {0}
    steps:
      - uses: actions/checkout@v2
      - uses: conda-incubator/setup-miniconda@v2
        with:
          activate-environment: anaconda-client-env
          environment-file: etc/example-environment-caching.yml
      - run: conda info
      - run: conda list
      - run: conda config --show
```

## IMPORTANT

- Bash shells do not use `~/.profile` or `~/.bashrc` so these shells need to be
  explicitely declared as `shell: bash -l {0}` on steps that need to be properly
  activated (or use a default shell). This is because bash shells are executed with
  `bash --noprofile --norc -eo pipefail {0}` thus ignoring updated on bash
  profile files made by `conda init bash`. See
  [Github Actions Documentation](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/workflow-syntax-for-github-actions#using-a-specific-shell)
  and
  [thread](https://github.community/t5/GitHub-Actions/How-to-share-shell-profile-between-steps-or-how-to-use-nvm-rvm/td-p/33185).
- Sh shells do not use `~/.profile` or `~/.bashrc` so these shells need to be
  explicitely declared as `shell: sh -l {0}` on steps that need to be properly
  activated (or use a default shell). This is because sh shells are executed with `sh -e {0}` thus
  ignoring updated on bash profile files made by `conda init bash`. See
  [Github Actions Documentation](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/workflow-syntax-for-github-actions#using-a-specific-shell).
- Cmd shells do not run `Autorun` commands so these shells need to be
  explicitely declared as `shell: cmd /C call {0}` on steps that need to be
  properly activated (or use a default shell). This is because cmd shells are executed with
  `%ComSpec% /D /E:ON /V:OFF /S /C "CALL "{0}""` and the `/D` flag disabled
  execution of `Command Processor/Autorun` windows registry keys, which is what
  `conda init cmd.exe` sets. See
  [Github Actions Documentation](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/workflow-syntax-for-github-actions#using-a-specific-shell).
- For caching to work properly, you will need to set the `use-only-tar-bz2`
  option to `true`.
- Some options (e.g. `use-only-tar-bz2`) are not available on the default conda
  installed on Windows VMs, be sure to use `auto-update-conda` or provide a
  version of conda compatible with the option.
- If you plan to use a `environment.yaml` file to set up the environment, the
  action will read the `channels`listed in the key (if found). If you provide
  the `channels` input in the action they must not conflict with what was
  defined in `environment.yaml`, otherwise the conda solver might find conflicts
  and result in very long install times.
- Conda activation does not correctly work on `sh`. Please use `bash`.

## Project History and Contributing

See the [CHANGELOG](https://github.com/conda-incubator/setup-miniconda/blob/master/CHANGELOG.md) for project history, or [CONTRIBUTING](https://github.com/conda-incubator/setup-miniconda/blob/master/CONTRIBUTING.md) to get started adding
features you need.

## License

The scripts and documentation in this project are released under the
[MIT License](LICENSE.txt)

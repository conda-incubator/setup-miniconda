# `conda-incubator/setup-miniconda`

This action sets up a `base`
[conda](https://docs.conda.io/projects/conda/en/latest/) environment by one of:

- locating the `conda` installation [bundled] with the available runners and
  available in `$CONDA`
- installing a specific (or latest) version of
  - [Miniconda3][miniconda-repo]
  - [Miniforge][miniforge-releases] (or Mambaforge)
  - any [constructor]-based installer by or URL or filesystem path

A `conda-build-version` or `mamba-version` may be provided to install specific 
versions of `conda` or `mamba` into `base`

The base `condabin/` folder is added to `$PATH` and shell integration is
initialized across all platforms.

By default, this action will then create, and _activate_, an environment by one
of:

- creating a mostly-empty `test` environment, containing only the latest
  `python-version` and its dependencies
- creating a `test` environment described in a given `environment-file` including:
  - an `environment.yml`-like file (which can be patched with `python-version`). Note: the patched environment will be cleaned up unless
      `clean-patched-environment-file: false` is given
  - a [lockfile](#example-7-lockfiles)

This action correctly handles activation of environments and offers the
possibility of automatically activating the `test` environment on all shells.

> **Please** see the **[IMPORTANT](#important)** notes on additional information
> on environment activation.

[bundled]:
  https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners#supported-software
[miniconda-repo]: https://repo.anaconda.com/miniconda
[miniforge-releases]: https://github.com/conda-forge/miniforge/releases
[constructor]: https://github.com/conda/constructor

## Example Overview

> Each of the examples below is discussed in a dedicated section below.

| Documentation                                   | Workflow Status                                                 |
| ----------------------------------------------- | --------------------------------------------------------------- |
| [Basic usage](#example-1-basic-usage)           | [![Basic Usage Status][ex1-badge]][ex1]                         |
| [Other shells](#example-2-other-shells)         | [![Other Shells Status][ex2-badge]][ex2]                        |
| [Other options](#example-3-other-options)       | [![Other Options Status][ex3-badge]][ex3]                       |
| [Channels](#example-4-conda-options)            | [![Channels Status][ex4-badge]][ex4]                            |
| [Custom installer](#example-5-custom-installer) | [![Custom Installer Status][ex5-badge]][ex5]                    |
| [Mamba](#example-6-mamba)                       | [![Mamba Status][ex6-badge]][ex6]                               |
| [Lockfiles](#example-7-lockfiles)               | [![Lockfiles Status][ex7-badge]][ex7]                           |
| [Miniforge](#example-10-miniforge)              | [![Miniforge Status][ex10-badge]][ex10]                         |
| [Caching packages](#caching-packages)           | [![Caching Example Status][caching-badge]][caching]             |
| [Caching environments](#caching-environments)   | [![Caching Env Example Status][caching-env-badge]][caching-env] |

[ex1]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/example-1.yml
[ex1-badge]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/example-1.yml/badge.svg
[ex2]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/example-2.yml
[ex2-badge]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/example-2.yml/badge.svg
[ex3]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/example-3.yml
[ex3-badge]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/example-3.yml/badge.svg
[ex4]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/example-4.yml
[ex4-badge]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/example-4.yml/badge.svg
[ex5]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/example-5.yml
[ex5-badge]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/example-5.yml/badge.svg
[ex6]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/example-6.yml
[ex6-badge]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/example-6.yml/badge.svg
[caching]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/caching-example.yml
[caching-badge]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/caching-example.yml/badge.svg
[caching-env]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/caching-envs-example.yml
[caching-env-badge]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/caching-envs-example.yml/badge.svg
[ex7]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/example-7.yml
[ex7-badge]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/example-7.yml/badge.svg
[ex10]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/example-10.yml
[ex10-badge]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/example-10.yml/badge.svg

## Other Workflows

> These are quality control and test workflows, and are not described in depth.

| QA Workflow     | Linting                                     | Catch Invalid Enviroments                              | Handle Empty Channels                             |
| --------------- | ------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------- |
| Workflow Status | [![Linting Status][linting-badge]][linting] | [![Catch Invalid Environments Status][ex8-badge]][ex8] | [![Handle Empty Channels Status][ex9-badge]][ex9] |

[linting]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/lint.yml
[linting-badge]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/lint.yml/badge.svg
[ex8]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/example-8.yml
[ex8-badge]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/example-8.yml/badge.svg
[ex9]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/example-9.yml
[ex9-badge]:
  https://github.com/conda-incubator/setup-miniconda/actions/workflows/example-9.yml/badge.svg

## Environment activation

This action will, by default, activate an environment called `test` and _not_
activate the `base` environment. This encourages the recommended practice of not installing workflow packages into the
`base` environment and leaving it with only `conda` (and/or `mamba`).

## Inputs and outputs

For a full list of available _inputs_ and _outputs_ for this action see
[action.yml](action.yml).

### Use a different environment name or path

You can change the default `test` environment to have a different name or path
by setting the `activate-environment` input option.

```yaml
- uses: conda-incubator/setup-miniconda@v2
  with:
    activate-environment: whatever
```

This will create a _named_ env in `$CONDA/envs/whatever`, where `$CONDA` is
the path to the infrequently-updated, but **very fast** to start, "bundled"
Miniconda installation.

> - If `activate-environment` contains either POSIX or Windows slashes, it will
>   be interpreted as a path, or `prefix` in `conda` terminology. Use this to
>   avoid "path too long"-style errors, especially on Windows.
> - Self-hosted runners can emulate the "bundled" Miniconda approach by
>   pre-installing a [constructor]-based installer and ensuring `$CONDA` is set
>   prior to starting `setup-miniconda`

### Activate `base` environment

If your specific workflow still needs to activate and use `base` you will need
to do **both** of:

- set `activate-environment` to an empty string
- set `auto-activate-base` to `true`

```yaml
- uses: conda-incubator/setup-miniconda@v2
  with:
    auto-activate-base: true
    activate-environment: ""
```

## Usage examples

### Example 1: Basic usage

This example shows how to set a basic python workflow with conda using the
cross-platform available shells: `bash` and `pwsh`. In this example an
environment named `test` will be created with the specific `python-version`
installed for each operating system, resulting in 6 build workers.

```yaml
jobs:
  example-1:
    name: Ex1 (${{ matrix.python-version }}, ${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: ["ubuntu-latest", "macos-latest", "windows-latest"]
        python-version: ["3.7", "3.11"]
    steps:
      - uses: conda-incubator/setup-miniconda@v2
        with:
          auto-update-conda: true
          python-version: ${{ matrix.python-version }}
      - name: Conda info
        shell: bash -el {0}
        run: conda info
      - name: Conda list
        shell: pwsh
        run: conda list
```

### Example 2: Other shells

This example shows how to use all other available shells for specific operating
systems. In this example we download the latest anaconda version
then create and activate a default environment named `foo`.


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
        shell: bash -el {0}
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
        shell: bash -el {0}
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
        shell: bash -el {0}
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
management. In this example we use a custom configuration file, install an
environment from a yaml file, and disable autoactivating the base environment
before activating the `anaconda-client-env`.

```yaml
jobs:
  example-3:
    name: Ex3 Linux
    runs-on: "ubuntu-latest"
    defaults:
      run:
        shell: bash -el {0}
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

This example shows how to use the `channels` option and other extra options. The
priority will be set by the order of the channels. The following example will
result in these priorities (from highest to lowest):

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
        shell: bash -el {0}
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

Any installer created with the [constructor](https://github.com/conda/constructor) tool
(which includes `conda`) can be used in place of Miniconda. For example,
[conda-forge](https://conda-forge.org/) maintains additional builds of
[miniforge](https://github.com/conda-forge/miniforge/releases) for platforms not
yet supported by Miniconda. For more details, see [Example 10](#example-10-miniforge).

> Note:
>
> - Installer downloads are cached based on their full URL: adding some
>   non-functional salt to the URL will prevent this behavior, e.g.,
>   `#${{ github.run_number }}`

```yaml
jobs:
  example-5:
    name: Ex5 Miniforge for PyPy
    runs-on: "ubuntu-latest"
    defaults:
      run:
        shell: bash -el {0}
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

Experimental! Use `mamba` to enable much faster conda installs.
`mamba-version` accepts a version string `x.y` (including `"*"`). It requires
you specify `conda-forge` as part of the channels, ideally with the highest
priority.

> Notes:
>
> - If a [custom installer](#example-5-custom-installer) provides `mamba`, it
>   can be prioritized wherever possible (including installing `mamba-version`)
>   with `use-mamba: true`.

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
      - shell: bash -el {0}
        run: |
          conda info
          conda list
          conda config --show-sources
          conda config --show
          printenv | sort
      - shell: bash -el {0}
        run: mamba install jupyterlab
```

### Example 7: Lockfiles

`conda list --explicit` and [conda-lock][] support generating [explicit
environment specifications][explicit-spec], which skip the environment solution
step altogether, as they contain the _ordered_ list of exact URLs needed to
reproduce the environment.

This means explicitly-defined environments which:

- are _much faster_ to install, as several expensive steps are skipped:
  - channels are not queried for their repo data
  - no solver is run
- are not cross-platform, as the URLs almost always contain
  platform/architecture information
- can become broken if any file becomes unavailable

This approach can be useful as part of a larger system e.g., a separate workflow
that runs `conda-lock` for all the platforms needed in a separate job.

[conda-lock]: https://github.com/conda-incubator/conda-lock
[explicit-spec]:
  https://docs.conda.io/projects/conda/en/latest/user-guide/tasks/manage-environments.html#building-identical-conda-environments

```yaml
jobs:
  example-7:
    name: Ex7 Explicit
    runs-on: "ubuntu-latest"
    defaults:
      run:
        shell: bash -el {0}
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
and with only `conda-forge` in its default channel(s).

If only `miniforge-version` is provided then `Miniforge3` will be used.

```yaml
jobs:
  example-10-miniforge:
    name: Ex10 (${{ matrix.os }}, Miniforge)
    runs-on: ${{ matrix.os }}-latest
    strategy:
      matrix:
        os: ["ubuntu", "macos", "windows"]
    steps:
      - uses: actions/checkout@v2
      - uses: conda-incubator/setup-miniconda@v2
        with:
          environment-file: etc/example-environment.yml
          miniforge-version: latest
```

In addition to `Miniforge3` with `conda` and `CPython`, for each of its many
supported platforms and architectures, additional variants including
`Mambaforge` (which comes pre-installed `mamba` in addition to `conda` on all
platforms) and `Miniforge-pypy3`/`Mamabaforge-pypy3` (which replace `CPython`
with `pypy3` on Linux/MacOS) are available.

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
        with:
          condarc-file: ${{ matrix.condarc-file }}
          environment-file: ${{ matrix.environment-file }}
          miniforge-variant: ${{ matrix.miniforge-variant }}
          miniforge-version: ${{ matrix.miniforge-version }}
          use-mamba: true
```

### Example 11: Alternative Architectures

In addition to the default 64-bit builds of Miniconda, 32-bit versions are
available for Windows. Note that although some x86 builds are available for
Linux and MacOS, these are too old (<4.6) to be supported by this action.

```yaml
jobs:
  example-11:
    name:
      Ex11 (os=${{ matrix.os }} architecture=${{ matrix.architecture }}
      miniconda-version=${{ matrix.miniconda-version }})
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: ["windows-latest"]
        architecture: ["x86"]
        miniconda-version: ["latest"]
    steps:
      - uses: actions/checkout@v2
      - uses: ./
        with:
          architecture: ${{ matrix.architecture }}
          miniconda-version: $${{ matrix.miniconda-version }}
          auto-update-conda: true
          python-version: "3.8"
```

## Caching

### Caching packages

If you want to enable package caching for conda you can use the
[cache action](https://github.com/actions/cache) using `~/conda_pkgs_dir` as
path for conda packages.

The cache will use an explicit key for restoring and saving the cache.

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
        uses: actions/cache@v2
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
          environment-file: etc/example-environment.yml
          use-only-tar-bz2: true # IMPORTANT: This needs to be set for caching to work properly!
```

If you are using pip to resolve any dependencies in your conda environment then
you may want to
[cache those dependencies separately](https://docs.github.com/en/actions/language-and-framework-guides/using-python-with-github-actions#caching-dependencies),
as they are not included in the conda package cache.

### Caching environments

The first installation step should setup a Miniconda variant without specifying
a environment file.

```yaml
- name: Setup Mambaforge
  uses: conda-incubator/setup-miniconda@v2
  with:
    miniforge-variant: Mambaforge
    miniforge-version: latest
    activate-environment: anaconda-client-env
    use-mamba: true
```

It's a good idea to refresh the cache every 24 hours to avoid inconsistencies of
package versions between the CI pipeline and local installations. Here we ensure
that this happens by adding the current date to the cache key. You can remove
the "Get Date" step below if you use a resolved environment file product of
`conda env export` or `conda list --explicit`.

```yaml
- name: Get Date
  id: get-date
  run: echo "today=$(/bin/date -u '+%Y%m%d')" >> $GITHUB_OUTPUT
  shell: bash

- name: Cache Conda env
  uses: actions/cache@v2
  with:
    path: ${{ env.CONDA }}/envs
    key:
      conda-${{ runner.os }}--${{ runner.arch }}--${{
      steps.get-date.outputs.today }}-${{
      hashFiles('etc/example-environment-caching.yml') }}-${{ env.CACHE_NUMBER
      }}
  env:
    # Increase this value to reset cache if etc/example-environment.yml has not changed
    CACHE_NUMBER: 0
  id: cache
```

Keep in mind that hashing `etc/example-environment-caching.yml` is not the same
as hashing a resolved environment file. `conda` (and `mamba`) resolves the
dependencies declared in the YAML file according to the packages available on
the channels at installation time. Since packages are updated all the time, you
will not see these changes reflected in the cache until the key gets updated by
date.

**This means that the same environment file can make your tests pass locally but
fail on CI, or the other way around. In that case, reset the cache manually to
see if that leads to consistent results, or use a resolved environment file.**

Finally, update the environment based on the environment file if the cache does
not exist.

```yaml
- name: Update environment
  run:
    mamba env update -n anaconda-client-env -f
    etc/example-environment-caching.yml
  if: steps.cache.outputs.cache-hit != 'true'
```

### Use a default shell

If you use the same shell for every step in your workflow you don't have to add
a shell directive to every step (e.g., `shell: bash -el {0}` when using bash).

You can add a `defaults` section and specify the desired directive (e.g., `bash -el {0}` or equivalent).
All steps in the job will then default to using that value.

For other shells, make sure to use the correct `shell` parameter as the default
value. Check the [section below](#important) for some examples.

For more information see the [Github Actions help page](https://docs.github.com/en/free-pro-team@latest/actions/reference/workflow-syntax-for-github-actions#jobsjob_iddefaultsrun).

```yaml
jobs:
  default-shell:
    name: Default shell
    runs-on: "ubuntu-latest"
    defaults:
      run:
        shell: bash -el {0}
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

- Conda activation does not correctly work on `sh`. Please use `bash`.
- Bash shells do not use `~/.profile` or `~/.bashrc` so these shells need to be
  explicitly declared as `shell: bash -el {0}` on steps that need to be
  properly activated (or use a default shell). This is because bash shells are
  executed with `bash --noprofile --norc -eo pipefail {0}` thus ignoring updated
  on bash profile files made by `conda init bash`. See
[Github Actions Documentation](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/workflow-syntax-for-github-actions#using-a-specific-shell)
  and this 
  [community thread](https://github.community/t5/GitHub-Actions/How-to-share-shell-profile-between-steps-or-how-to-use-nvm-rvm/td-p/33185).
- Sh shells do not use `~/.profile` or `~/.bashrc` so these shells need to be
  explicitly declared as `shell: sh -l {0}` on steps that need to be properly
  activated (or use a default shell). This is because sh shells are executed
  with `sh -e {0}` thus ignoring updates on bash profile files made by
  `conda init bash`. See
  [Github Actions Documentation](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/workflow-syntax-for-github-actions#using-a-specific-shell).
- Cmd shells do not run `Autorun` commands so these shells need to be
  explicitly declared as `shell: cmd /C call {0}` on steps that need to be
  properly activated (or use a default shell). This is because cmd shells are
  executed with `%ComSpec% /D /E:ON /V:OFF /S /C "CALL "{0}""` and the `/D` flag
  disables execution of `Command Processor/Autorun` Windows registry keys, which
  is what `conda init cmd.exe` sets. See
  [Github Actions Documentation](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/workflow-syntax-for-github-actions#using-a-specific-shell).
- For caching to work properly, you will need to set the `use-only-tar-bz2`
  option to `true`.
- Some options (e.g. `use-only-tar-bz2`) are not available on the default conda
  installed on Windows VMs, be sure to use `auto-update-conda` or provide a
  version of conda compatible with the option.
- If you plan to use a `environment.yaml` file to set up the environment, the
  action will read the `channels` listed in the key (if found). If you provide
  the `channels` input in the action they must not conflict with what was
  defined in `environment.yaml`, otherwise the conda solver might find conflicts
  which cause very long install times or install failures.

## Project History and Contributing

See the
[CHANGELOG](https://github.com/conda-incubator/setup-miniconda/blob/main/CHANGELOG.md)
for project history, or
[CONTRIBUTING](https://github.com/conda-incubator/setup-miniconda/blob/main/CONTRIBUTING.md)
to get started adding features you need.

## Contributors

Thanks to all the contributors that make this awesome project possible!

[![Meet our contributors!](https://contrib.rocks/image?repo=conda-incubator/setup-miniconda)](https://github.com/conda-incubator/setup-miniconda/graphs/contributors)

_Made with [contributors-img](https://contrib.rocks)._

## License

The scripts and documentation in this project are released under the
[MIT License](LICENSE.txt)

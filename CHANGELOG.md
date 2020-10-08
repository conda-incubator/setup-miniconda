# CHANGELOG

## _Unreleased_

### Fixes

- [#79][] fixes GitHub deprecation warnings [#78][]

### Features

- [#61][], [#74][] add support for explicit environment specifications.

[#61]: https://github.com/conda-incubator/setup-miniconda/pull/61
[#74]: https://github.com/conda-incubator/setup-miniconda/pull/74
[#78]: https://github.com/conda-incubator/setup-miniconda/pull/78
[#79]: https://github.com/conda-incubator/setup-miniconda/pull/79

## [v1.7.0][] (2020-08-19)

### Fixes

- [#64][] fixes a bug on post section with removing conda files.

### Features

- [???](#) adds x32 support for some machines.

[v1.7.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.7.0
[#64]: https://github.com/conda-incubator/setup-miniconda/pull/64

## [v1.6.0][] (2020-07-11)

### Features

- [#47][] adds support for installing and using `mamba` instead of `conda`

[v1.6.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.6.0
[#47]: https://github.com/conda-incubator/setup-miniconda/pull/47

## [v1.5.0][] (2020-05-28)

### Features

- [???](#) fixes conflicting channels on `environment.yml` files and the action input channels

### Fixes

- [#43][] adds support for custom installers, e.g. `miniforge`

[v1.5.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.5.0
[#43]: https://github.com/conda-incubator/setup-miniconda/pull/43

## [v1.4.1][] (2020-05-22)

### Fixes

- [???](#) fixes a small regression on windows systems.

[v1.4.1]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.4.1

## [v1.4.0][] (2020-05-22)

### Features

- [???](#) adds a post step to remove any uncompressed packages found in the packages dir, so the cache can also save packages that were installed in different steps from the action step.

[v1.4.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.4.0

## [v1.3.1][] (2020-05-17)

### Fixes

- [???](#) fixes regression in systems where the cache folder has not been created.

[v1.3.1]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.3.1

## [v1.3.0][] (2020-05-14)

### Features

- [???](#) adds the possibility of using the cache action to cache downloaded conda packages and (hopefully) reduce build times.

[v1.3.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.3.0

## [v1.2.0][] (2020-05-11)

### Features

- adds additional configuration options to the action input, including:

```yaml
allow-softlinks
channel-priority
show-channel-urls
use-only-tar-bz2
```

[v1.2.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.2.0

## [v1.1.4][] (2020-05-06)

### Fixes

- [???](#) fixes regression

[v1.1.4]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.1.4

## [v1.1.3][] (2020-05-06)

### Fixes

- [???](#) Minor fixes

### Features

- [???](#) adds new URL for downloading packages

[v1.1.3]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.1.3

## [v1.1.2][] (2020-04-11)

### Fixes

- [???](#) fixes regression with file permissions

[v1.1.2]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.1.2

## [v1.1.1][] (2020-04-11)

### ???

- [???](#) ???

[v1.1.1]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.1.1

## [v1.1.0][] (2020-04-11)

### Fixes

- [???](#) fix issues

### Features

- [???](#) add `channels` support

[v1.1.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.1.0

## [v1.0.2][] (2019-12-23)

### Fixes

- [???](#) fixes windows environment activation

[v1.0.2]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.0.2

## [v1.0.1][] (2019-12-19)

### Features

- first official release!

[v1.0.1]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.0.1

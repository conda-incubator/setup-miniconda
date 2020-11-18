# CHANGELOG

## [v2.1.0][] (Unreleased)

## Fixes

- [#97][] fixes `installer-url` on Windows
- [#94][], [#95][] catches ignored errors when an environment file contains
  invalid section names [#93][]
- [#100][] fixes `mamba` not being available on Windows if using a `bash` shell
  [#59][]

[#59]: https://github.com/conda-incubator/setup-miniconda/pull/59
[#93]: https://github.com/conda-incubator/setup-miniconda/pull/93
[#94]: https://github.com/conda-incubator/setup-miniconda/pull/94
[#95]: https://github.com/conda-incubator/setup-miniconda/pull/95
[#97]: https://github.com/conda-incubator/setup-miniconda/pull/97
[#100]: https://github.com/conda-incubator/setup-miniconda/pull/100

## [v2.0.0][] (2020-11-08)

### Fixes

- [#79][] fixes GitHub deprecation warnings [#78][].

### Features

- [#61][], [#74][] adds support for explicit environment specifications.

[v2.0.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v2.0.0
[#61]: https://github.com/conda-incubator/setup-miniconda/pull/61
[#74]: https://github.com/conda-incubator/setup-miniconda/pull/74
[#78]: https://github.com/conda-incubator/setup-miniconda/pull/78
[#79]: https://github.com/conda-incubator/setup-miniconda/pull/79

## [v1.7.0][] (2020-08-19)

### Fixes

- [#64][] fixes a bug on post section with removing conda files.

### Features

- [#52][] adds x32 support for some machines.
- [#53][] allows environment files to omit the `name` field.

[v1.7.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.7.0
[#64]: https://github.com/conda-incubator/setup-miniconda/pull/64
[#53]: https://github.com/conda-incubator/setup-miniconda/pull/53
[#52]: https://github.com/conda-incubator/setup-miniconda/pull/52

## [v1.6.0][] (2020-07-11)

### Features

- [#47][] adds support for installing and using `mamba` instead of `conda`.

[v1.6.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.6.0
[#47]: https://github.com/conda-incubator/setup-miniconda/pull/47

## [v1.5.0][] (2020-05-28)

### Fixes

- [#46][] fixes conflicting channels on `environment.yml` files and the action
  input channels.

### Features

- [#43][] adds support for custom installers, e.g. `miniforge`

[v1.5.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.5.0
[#43]: https://github.com/conda-incubator/setup-miniconda/pull/43
[#47]: https://github.com/conda-incubator/setup-miniconda/pull/47

## [v1.4.1][] (2020-05-22)

### Fixes

- fixes a small regression on windows systems.

[v1.4.1]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.4.1

## [v1.4.0][] (2020-05-22)

### Features

- [#41][] adds a post step to remove any uncompressed packages found in the
  packages dir, so the cache can also save packages that were installed in
  different steps from the action step.

[v1.4.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.4.0
[#41]: https://github.com/conda-incubator/setup-miniconda/pull/41

## [v1.3.1][] (2020-05-17)

### Fixes

- [#47][] fixes regression in systems where the cache folder has not been
  created.

[v1.3.1]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.3.1
[#47]: https://github.com/conda-incubator/setup-miniconda/pull/47

## [v1.3.0][] (2020-05-14)

### Features

- [#35][] adds the possibility of using the cache action to cache downloaded
  conda packages and (hopefully) reduce build times.

[v1.3.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.3.0
[#35]: https://github.com/conda-incubator/setup-miniconda/pull/35

## [v1.2.0][] (2020-05-11)

### Features

- [#33][] adds additional configuration options to the action input, including:

```yaml
- allow-softlinks
- channel-priority
- show-channel-urls
- use-only-tar-bz2
```

[v1.2.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.2.0
[#33]: https://github.com/conda-incubator/setup-miniconda/pull/33

## [v1.1.4][] (2020-05-06)

### Fixes

- fixes regression on shell environment variable checking.

[v1.1.4]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.1.4

## [v1.1.3][] (2020-05-06)

### Fixes

- [#28][] fixes some small issues.

### Features

- [#22][] adds new URL for downloading packages.

[v1.1.3]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.1.3
[#22]: https://github.com/conda-incubator/setup-miniconda/pull/22
[#28]: https://github.com/conda-incubator/setup-miniconda/pull/28

## [v1.1.2][] (2020-04-11)

### Fixes

- fixes regression with file permissions.

[v1.1.2]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.1.2

## [v1.1.1][] (2020-04-11)

### Fixes

- fixes some channel issues.

[v1.1.1]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.1.1

## [v1.1.0][] (2020-04-11)

### Fixes

- [#11][] fix pipefail issues.

### Features

- [#17][] add `channels` support.

[v1.1.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.1.0
[#11]: https://github.com/conda-incubator/setup-miniconda/pull/11
[#17]: https://github.com/conda-incubator/setup-miniconda/pull/17

## [v1.0.2][] (2019-12-23)

### Fixes

- [#6][] fixes windows environment activation

[v1.0.2]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.0.2
[#6]: https://github.com/conda-incubator/setup-miniconda/pull/6

## [v1.0.1][] (2019-12-19)

### Features

- first official release!

[v1.0.1]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.0.1

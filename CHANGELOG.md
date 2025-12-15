# CHANGELOG

## [v3.2.0] (2025-06-04)

### Fixes

- [#398] Check all `.condarc` files when removing `defaults`
- [#397] Add version normalization for minicondaVersion in input validation
- [#402] Workaround for auto_activate_base deprecation

### Tasks and Maintenance

- [#391] Bump conda-incubator/setup-miniconda from 3.1.0 to 3.1.1
- [#390] Bump undici from 5.28.4 to 5.28.5
- [#399] Bump semver and @types/semver

[v3.2.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v3.2.0
[#390]: https://github.com/conda-incubator/setup-miniconda/pull/390
[#391]: https://github.com/conda-incubator/setup-miniconda/pull/391
[#397]: https://github.com/conda-incubator/setup-miniconda/pull/397
[#398]: https://github.com/conda-incubator/setup-miniconda/pull/398
[#399]: https://github.com/conda-incubator/setup-miniconda/pull/399
[#402]: https://github.com/conda-incubator/setup-miniconda/pull/402

## [v3.1.1] (2025-01-20)

### Fixes

- [#378]: Make `nodefaults` warning more explicit
- [#387]: Detect and support Linux ARM runners for both Miniconda and Miniforge

### Tasks and Maintenance

- [#374]: Bump conda-incubator/setup-miniconda from 3.0.4 to 3.1.0
- [#375]: Bump actions/cache from 3 to 4
- [#384]: Bump @actions/tool-cache from 2.0.1 to 2.0.2
- [#386]: Fix link to example 14
- [#388]: Fix mamba 1.x examples

[v3.1.1]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v3.1.1
[#374]: https://github.com/conda-incubator/setup-miniconda/pull/374
[#375]: https://github.com/conda-incubator/setup-miniconda/pull/375
[#378]: https://github.com/conda-incubator/setup-miniconda/pull/378
[#384]: https://github.com/conda-incubator/setup-miniconda/pull/384
[#386]: https://github.com/conda-incubator/setup-miniconda/pull/386
[#387]: https://github.com/conda-incubator/setup-miniconda/pull/387
[#388]: https://github.com/conda-incubator/setup-miniconda/pull/388

## [v3.1.0] (2024-10-31)

### Features

- [#367]: Add `conda-remove-defaults` setting to remove the `defaults` channel
  if added implicitly
- [#342]: Add `installation-dir` to customize where the installers are installed
  to
- [#328]: Make conda's cache configurable via `pkgs-dirs`

### Fixes

- [#360]: Start deprecation of `miniforge-variant: Mambaforge`
- [#362]: Ignore conda cygpath warning
- [#368]: Address mamba v2 incompatibilities
- [#350]: set `CONDA` environment variable regardless of useBundled option

### Tasks and Maintenance

- [#348]: Bump conda-incubator/setup-miniconda from 3.0.3 to 3.0.4
- [#353]: Bump semver and @types/semver
- [#356]: Bump braces from 3.0.2 to 3.0.3
- [#359]: Bump semver from 7.6.2 to 7.6.3
- [#370]: Bump @actions/core from 1.10.1 to 1.11.1

[v3.1.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v3.1.0
[#360]: https://github.com/conda-incubator/setup-miniconda/pull/360
[#362]: https://github.com/conda-incubator/setup-miniconda/pull/362
[#368]: https://github.com/conda-incubator/setup-miniconda/pull/368
[#367]: https://github.com/conda-incubator/setup-miniconda/pull/367
[#342]: https://github.com/conda-incubator/setup-miniconda/pull/342
[#328]: https://github.com/conda-incubator/setup-miniconda/pull/328
[#350]: https://github.com/conda-incubator/setup-miniconda/pull/350
[#348]: https://github.com/conda-incubator/setup-miniconda/pull/348
[#353]: https://github.com/conda-incubator/setup-miniconda/pull/353
[#356]: https://github.com/conda-incubator/setup-miniconda/pull/356
[#359]: https://github.com/conda-incubator/setup-miniconda/pull/359
[#370]: https://github.com/conda-incubator/setup-miniconda/pull/370

## [v3.0.4] (2024-04-25)

### Fixes

- [#345] Fix running on macOS 13 on Intel since the runners no longer provide
  miniconda by default.

### Tasks and Maintenance

- [#337] Bump conda-incubator/setup-miniconda from 3.0.2 to 3.0.3 (#337)
- [#338] Bump normalize-url from 8.0.0 to 8.0.1
- [#340] Bump undici from 5.27.4 to 5.28.5

[v3.0.4]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v3.0.4
[#337]: https://github.com/conda-incubator/setup-miniconda/pull/337
[#338]: https://github.com/conda-incubator/setup-miniconda/pull/338
[#340]: https://github.com/conda-incubator/setup-miniconda/pull/340
[#345]: https://github.com/conda-incubator/setup-miniconda/pull/345

## [v3.0.3] (2024-02-27)

### Fixes

- [#336] Fall back to miniconda3 latest when no bundled version + empty with
  params

### Tasks and Maintenance

- [#335] Bump conda-incubator/setup-miniconda from 3.0.1 to 3.0.2

[v3.0.3]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v3.0.3
[#335]: https://github.com/conda-incubator/setup-miniconda/pull/335
[#336]: https://github.com/conda-incubator/setup-miniconda/pull/336

## [v3.0.2] (2024-02-22)

### Fixes

- [#312] Enable ARM64 on macOS for Miniforge and Mambaforge including automatic
  architecture detection.

### Tasks and Maintenance

- [#327] Bump conda-incubator/setup-miniconda from 3.0.0 to 3.0.1
- [#330] Bump actions/cache from 3 to 4
- [#334] Bump undici from 5.27.2 to 5.28.3

[v3.0.2]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v3.0.2
[#312]: https://github.com/conda-incubator/setup-miniconda/pull/312
[#327]: https://github.com/conda-incubator/setup-miniconda/pull/327
[#330]: https://github.com/conda-incubator/setup-miniconda/pull/330
[#334]: https://github.com/conda-incubator/setup-miniconda/pull/334

## [v3.0.1] (2023-11-29)

### Fixes

- [#325] Fix environment activation on windows (a v3 regression) due to
  hard-coded install PATH

[v3.0.1]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v3.0.1
[#325]: https://github.com/conda-incubator/setup-miniconda/pull/325

## [v3.0.0] (2023-11-27)

### Features

- [#308] Update to node20
- [#291] Add conda-solver option (defaults to libmamba)

### Fixes

- [#299] Fix condaBasePath when useBundled is false, and there's no pre-existing
  conda

### Documentation

- [#309] Switch to main branch based development
- [#313] Specify team conda-incubator/setup-miniconda as codeowners
- [#318] README: update actions in examples, add security section, similar
  actions

### Tasks and Maintenance

- [#307] Run dependabot against main branch and also update node packages
- [#311] Bump actions/checkout from 2 to 4
- [#310] Bump actions/cache from 1 to 3
- [#314] Strip/update dependencies
- [#315] Split lint into check and build, switch from `npm install` to `npm ci`
- [#317] Bump normalize-url from 4.5.1 to 8.0.0
- [#316] Faster workflow response / saving resources via timeout/concurrency
  policy

[v3.0.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v3.0.0
[#308]: https://github.com/conda-incubator/setup-miniconda/pull/308
[#291]: https://github.com/conda-incubator/setup-miniconda/pull/291
[#299]: https://github.com/conda-incubator/setup-miniconda/pull/299
[#309]: https://github.com/conda-incubator/setup-miniconda/pull/309
[#313]: https://github.com/conda-incubator/setup-miniconda/pull/313
[#318]: https://github.com/conda-incubator/setup-miniconda/pull/318
[#307]: https://github.com/conda-incubator/setup-miniconda/pull/307
[#311]: https://github.com/conda-incubator/setup-miniconda/pull/311
[#310]: https://github.com/conda-incubator/setup-miniconda/pull/310
[#314]: https://github.com/conda-incubator/setup-miniconda/pull/314
[#315]: https://github.com/conda-incubator/setup-miniconda/pull/315
[#317]: https://github.com/conda-incubator/setup-miniconda/pull/317
[#316]: https://github.com/conda-incubator/setup-miniconda/pull/316

## [v2.3.0] (2023-11-22)

### Documentation

- [#263] Update links to GitHub shell docs
- [#289] Consider leading with conda activation does not work on sh, please use
  bash

### Features

- [#296] Update Miniconda architectures (enables M1 = osx-arm64 runners)

### Tasks and Maintenance

- [#273] Bump json5 from 1.0.1 to 1.0.2
- [#293] Remove Python 2.7 from test matrix (EOL since April 2020, >4 years)
- [#294] Update dependencies
- [#295] Add dependabot config to update action versions in workflows by
- [#300] Fix CI (lint + examples)
- [#304] Fix CI: Remove not working example-13, use Miniforge in example-6

[v2.3.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v2.3.0
[#263]: https://github.com/conda-incubator/setup-miniconda/pull/263
[#289]: https://github.com/conda-incubator/setup-miniconda/pull/289
[#296]: https://github.com/conda-incubator/setup-miniconda/pull/296
[#273]: https://github.com/conda-incubator/setup-miniconda/pull/273
[#293]: https://github.com/conda-incubator/setup-miniconda/pull/293
[#294]: https://github.com/conda-incubator/setup-miniconda/pull/294
[#295]: https://github.com/conda-incubator/setup-miniconda/pull/295
[#300]: https://github.com/conda-incubator/setup-miniconda/pull/300
[#304]: https://github.com/conda-incubator/setup-miniconda/pull/300

## [v2.2.0] (2021-11-11)

### Documentation

- [#187] Document missing bundled conda for self hosted runners
- [#200] Provided instructions on how to cache deployed environments for
  Miniforge variants.
- [#246] Fix broken link in README.
- [#251] Fix typo in README.
- [#256] Update bash commands to include error flag.

### Features

- [#234] Add input option (`run-post: false`) to skip post processing.

### Fixes

- [#189] Error on miniconda-version _not_ specified instead of when it _is_
  specified.
- [#190] Add regression checks for pinning python version in the created
  environment.
- [#209] Do not move non-existing files.
- [#212] Fix caching example. No need to hardcode paths. Write date to step
  output.
- [#230] Fix path handling inconsistency in installer caching.

### Tasks and Maintenance

- [#210] Use 'npm run ...' to run scripts.
- [#233] Add deprecation warning on `master` branch.
- [#252] use Node.js 16 instead of deprecated Node.js 12
- [#257] Update dependencies.

[v2.2.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v2.2.0
[#187]: https://github.com/conda-incubator/setup-miniconda/pull/187
[#189]: https://github.com/conda-incubator/setup-miniconda/pull/189
[#190]: https://github.com/conda-incubator/setup-miniconda/pull/190
[#200]: https://github.com/conda-incubator/setup-miniconda/pull/200
[#209]: https://github.com/conda-incubator/setup-miniconda/pull/209
[#210]: https://github.com/conda-incubator/setup-miniconda/pull/210
[#212]: https://github.com/conda-incubator/setup-miniconda/pull/212
[#230]: https://github.com/conda-incubator/setup-miniconda/pull/230
[#233]: https://github.com/conda-incubator/setup-miniconda/pull/233
[#234]: https://github.com/conda-incubator/setup-miniconda/pull/234
[#246]: https://github.com/conda-incubator/setup-miniconda/pull/246
[#251]: https://github.com/conda-incubator/setup-miniconda/pull/251
[#252]: https://github.com/conda-incubator/setup-miniconda/pull/252
[#256]: https://github.com/conda-incubator/setup-miniconda/pull/256
[#257]: https://github.com/conda-incubator/setup-miniconda/pull/257

## [v2.1.1] (2021-03-31)

### Features

- [#163] leaves the patched `setup-miniconda-patched-{environment.yml}` in-place
  if `clean-patched-environment-file: false` is given (otherwise cleans up after
  itself)
- [#163] adds action outputs `environment-file`, `environment-file-content` and
  `environment-file-was-patched`

### Fixes

- [#161] restores proper ordering of `channels` when `environment-file` is
  patched
- [#163] if necessary, writes `setup-miniconda-patched-environment.yml` to the
  same location to work with relative paths, e.g. `pip: ["-r requirements.txt"]`

[v2.1.1]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v2.1.0
[#161]: https://github.com/conda-incubator/setup-miniconda/pull/161
[#163]: https://github.com/conda-incubator/setup-miniconda/pull/163

## [v2.1.0] (2021-03-29)

### Features

- [#130] installs all extra tools (e.g. `conda-build`) in a single solve
- [#133], [#138], and [#140] add first-class support for [Miniforge] (and
  Mambaforge)
- [#137] allows `activate-environment` to be a path-like prefix

### Documentation

- [#115] adds extra information on default environment activation.

### Fixes

- [#120] allows `channels` to be null
- [#148] allows use of 32-bit installers on Linux

### Development

- [#123], [#124], [#125], [#126], and [#127] restructure code to be more modular

[v2.1.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v2.1.0
[#115]: https://github.com/conda-incubator/setup-miniconda/pull/115
[#120]: https://github.com/conda-incubator/setup-miniconda/pull/120
[#123]: https://github.com/conda-incubator/setup-miniconda/pull/123
[#124]: https://github.com/conda-incubator/setup-miniconda/pull/124
[#125]: https://github.com/conda-incubator/setup-miniconda/pull/125
[#126]: https://github.com/conda-incubator/setup-miniconda/pull/126
[#127]: https://github.com/conda-incubator/setup-miniconda/pull/127
[#130]: https://github.com/conda-incubator/setup-miniconda/pull/130
[#133]: https://github.com/conda-incubator/setup-miniconda/pull/133
[#137]: https://github.com/conda-incubator/setup-miniconda/pull/137
[#138]: https://github.com/conda-incubator/setup-miniconda/pull/138
[#140]: https://github.com/conda-incubator/setup-miniconda/pull/140
[#148]: https://github.com/conda-incubator/setup-miniconda/pull/148
[miniforge]: https://github.com/conda-forge/miniforge

## [v2.0.1] (2020-11-29)

### Fixes

- [#97] fixes `installer-url` on Windows.
- [#94], [#95] catches ignored errors when an environment file contains invalid
  section names [#93].
- [#100] fixes `mamba` not being available on Windows if using a `bash` shell
  [#59].

[v2.0.1]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v2.0.1
[#59]: https://github.com/conda-incubator/setup-miniconda/pull/59
[#93]: https://github.com/conda-incubator/setup-miniconda/pull/93
[#94]: https://github.com/conda-incubator/setup-miniconda/pull/94
[#95]: https://github.com/conda-incubator/setup-miniconda/pull/95
[#97]: https://github.com/conda-incubator/setup-miniconda/pull/97
[#100]: https://github.com/conda-incubator/setup-miniconda/pull/100

---

## [v2.0.0] (2020-11-08)

### Fixes

- [#79] fixes GitHub deprecation warnings [#78].

### Features

- [#61], [#74] adds support for explicit environment specifications.

[v2.0.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v2.0.0
[#61]: https://github.com/conda-incubator/setup-miniconda/pull/61
[#74]: https://github.com/conda-incubator/setup-miniconda/pull/74
[#78]: https://github.com/conda-incubator/setup-miniconda/pull/78
[#79]: https://github.com/conda-incubator/setup-miniconda/pull/79

---

## [v1.7.0] (2020-08-19)

### Fixes

- [#64] fixes a bug on post section with removing conda files.

### Features

- [#52] adds x32 support for some machines.
- [#53] allows environment files to omit the `name` field.

[v1.7.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.7.0
[#64]: https://github.com/conda-incubator/setup-miniconda/pull/64
[#53]: https://github.com/conda-incubator/setup-miniconda/pull/53
[#52]: https://github.com/conda-incubator/setup-miniconda/pull/52

---

## [v1.6.0] (2020-07-11)

### Features

- [#47] adds support for installing and using `mamba` instead of `conda`.

[v1.6.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.6.0
[#47]: https://github.com/conda-incubator/setup-miniconda/pull/47

---

## [v1.5.0] (2020-05-28)

### Fixes

- [#46] fixes conflicting channels on `environment.yml` files and the action
  input channels.

[#46]: https://github.com/conda-incubator/setup-miniconda/pull/46

### Features

- [#43] adds support for custom installers, e.g. `miniforge`

[v1.5.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.5.0
[#43]: https://github.com/conda-incubator/setup-miniconda/pull/43
[#47]: https://github.com/conda-incubator/setup-miniconda/pull/47

---

## [v1.4.1] (2020-05-22)

### Fixes

- fixes a small regression on windows systems.

[v1.4.1]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.4.1

---

## [v1.4.0] (2020-05-22)

### Features

- [#41] adds a post step to remove any uncompressed packages found in the
  packages dir, so the cache can also save packages that were installed in
  different steps from the action step.

[v1.4.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.4.0
[#41]: https://github.com/conda-incubator/setup-miniconda/pull/41

---

## [v1.3.1] (2020-05-17)

### Fixes

- [#47] fixes regression in systems where the cache folder has not been created.

[v1.3.1]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.3.1
[#47]: https://github.com/conda-incubator/setup-miniconda/pull/47

---

## [v1.3.0] (2020-05-14)

### Features

- [#35] adds the possibility of using the cache action to cache downloaded conda
  packages and (hopefully) reduce build times.

[v1.3.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.3.0
[#35]: https://github.com/conda-incubator/setup-miniconda/pull/35

---

## [v1.2.0] (2020-05-11)

### Features

- [#33] adds additional configuration options to the action input, including:

```yaml
- allow-softlinks
- channel-priority
- show-channel-urls
- use-only-tar-bz2
```

[v1.2.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.2.0
[#33]: https://github.com/conda-incubator/setup-miniconda/pull/33

---

## [v1.1.4] (2020-05-06)

### Fixes

- fixes regression on shell environment variable checking.

[v1.1.4]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.1.4

---

## [v1.1.3] (2020-05-06)

### Fixes

- [#28] fixes some small issues.

### Features

- [#22] adds new URL for downloading packages.

[v1.1.3]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.1.3
[#22]: https://github.com/conda-incubator/setup-miniconda/pull/22
[#28]: https://github.com/conda-incubator/setup-miniconda/pull/28

---

## [v1.1.2] (2020-04-11)

### Fixes

- fixes regression with file permissions.

[v1.1.2]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.1.2

---

## [v1.1.1] (2020-04-11)

### Fixes

- fixes some channel issues.

[v1.1.1]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.1.1

---

## [v1.1.0] (2020-04-11)

### Fixes

- [#11] fix pipefail issues.

### Features

- [#17] add `channels` support.

[v1.1.0]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.1.0
[#11]: https://github.com/conda-incubator/setup-miniconda/pull/11
[#17]: https://github.com/conda-incubator/setup-miniconda/pull/17

---

## [v1.0.2] (2019-12-23)

### Fixes

- [#6] fixes windows environment activation

[v1.0.2]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.0.2
[#6]: https://github.com/conda-incubator/setup-miniconda/pull/6

---

## [v1.0.1] (2019-12-19)

### Features

- first official release!

[v1.0.1]: https://github.com/conda-incubator/setup-miniconda/releases/tag/v1.0.1

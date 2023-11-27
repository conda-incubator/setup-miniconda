# Release

- Update dependencies and fix any outdated dependencies. (can be skipped as
  Dependabot keeps everything updated)

```bash
npm install -g npm-check-updates
npm-check-updates
```

- Ensure the [CHANGELOG](./CHANGELOG.md) is up-to-date.

- If this release is a major version, update all the example YAML in the
  [README](./README.md), e.g. `4.0.0` would need `@v3` -> `@v4`.

- Ensure that all
  [workflow runs](https://github.com/conda-incubator/setup-miniconda/actions?query=branch%3Amain)
  for the latest commit on main are green.

- Create a new release via "Draft a new release" button at the
  [Release page](https://github.com/conda-incubator/setup-miniconda/releases):

  - Choose a new tag like `vX.Y.Z` that targets the current main branch and that
    is created on publish of the release
  - Choose the title `Version X.Y.Z`
  - Paste the relevant [CHANGELOG](./CHANGELOG.md) section into the description
    field
  - Publish the release

Replace `X.Y.Z` by the appropriate version number.

- Point the old `vX` tag to latest `vX.Y.Z` tag:

```bash
git remote update
git tag -d vX
git push origin :refs/tags/vX
git checkout vX.Y.Z
git tag -a vX -m 'Release version vX.Y.Z'
git push origin --tags
```

Replace `X.Y.Z` by the appropriate version number.

- Update the old repository just in case with the main/master branch

https://github.com/goanpeca/setup-miniconda

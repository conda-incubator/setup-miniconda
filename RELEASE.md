# Release

- Update dependencies and fix any outdated dependencies. (can be skipped as
  Dependabot keeps everything updated)

```bash
npm install -g npm-check-updates
npm-check-updates
```

- Ensure the [CHANGELOG](./CHANGELOG.md) is up-to-date.

- Update the `version` in [package.json](./package.json).

  - If this release is a major version, update all the example YAML in the
    [README](./README.md), e.g. `3.0.0` would need `@v2` -> `@v3`.

- Run the [build](./CONTRIBUTING.md#build).

- We keep the `master` branch until `v3` is released with a warning so we also
  merge this with main.

```bash
git remote update
git checkout origin/master -b master
git merge origin/main
git push origin master
```

- Create a new named tag:

```bash
git tag -a vX.Y.Z -m 'Release version vX.Y.Z'
```

Replace `X.Y.Z` by the appropriate version number.

- Point the old `vX` tag to latest `vX.Y.Z` tag:

```bash
git checkout main
git tag -d vX
git push origin :refs/tags/vX
git tag -a vX -m 'Release version vX.Y.Z'
git push origin --tags
git push origin main
```

Replace `X.Y.Z` by the appropriate version number.

- Update the old repository just in case with the main/master branch

https://github.com/goanpeca/setup-miniconda

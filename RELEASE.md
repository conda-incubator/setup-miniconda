# Release

- Update dependencies and fix any outdated dependencies.

```bash
npm install -g npm-check-updates
npm-check-updates
```

- Ensure the [CHANGELOG](./CHANGELOG.md) is up-to-date.

- Update the `version` in [package.json](./package.json).

  - If this release is a major version, update all the example YAML in the
    [README](./README.md), e.g. `3.0.0` would need `@v2` -> `@v3`.

- Run the [build](./CONTRIBUTING.md#build).

- All contributions currently go to the `develop` branch. To make a new
  releasecheckout to the `main` branch and merge with `develop` and then proceed
  with the release process. We also keep the `master` branch until `v3` is
  released with a wrtning so we also merge this with develop.

```bash
git checkout develop
git pull origin develop
git checkout master
git pull origin master
git merge develop
git push origin master
git checkout main
git pull origin main
git merge develop
git push origin main
```

- Create a new named tag:

```bash
git tag -a vX.Y.Z -m 'Release version vX.Y.Z'
```

Replace `X.Y.Z` by the appropriate version number.

- Point the old `vX` tag to latest `vX.Y.Z` tag:

```bash
git tag -d vX
git push origin :refs/tags/vX
git tag -a vX -m 'Release version vX.Y.Z'
git push origin --tags
git push origin master
```

Replace `X.Y.Z` by the appropriate version number.

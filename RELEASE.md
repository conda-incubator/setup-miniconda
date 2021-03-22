# Release

- Update the `version` in [package.json](./package.json).

- Ensure the [CHANGELOG](./CHANGELOG.md) is up-to-date.

  - If this release is a major version, update all the example YAML in the
    [README](./README.md), e.g. `2.0.0` would need `@v1` -> `@v2`.

- Run the [build](./CONTRIBUTING.md#build).

- Create a new named tag:

```bash
git tag -a vX.Y.Z -m 'Release version vX.Y.Z'
```

- Point the old `vX` tag to latest `vX.Y.Z` tag:

```bash
git tag -d vX
git push origin :refs/tags/vX
git tag -a vX -m 'Release version vX.Y.Z'
git push origin --tags
git push origin master
```

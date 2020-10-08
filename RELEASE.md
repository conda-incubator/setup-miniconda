# Release

- Update the `version` in [package.json](./package.json).

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

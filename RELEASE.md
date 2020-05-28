# Release

## Build

The build steps transpiles the `src/main.ts` to `lib/main.js` and then packs to `dist/index.js`. It is handled by Typescript compiler.

- Conda env

```bash
conda create -n github-action nodejs -c conda-forge
```

- Install NodeJS

```bash
conda activate github-action
npm install
```

- Update version in package.json

- To update the code

```bash
npm run format
npm run check
npm run build
```

- Create new named tag

```bash
git tag -a vX.X.X -m 'Release version vX.X.X'
```

- Point old v1 tag to latest tag

```bash
git tag -d v1
git push origin :refs/tags/v1
git tag -a v1 -m 'Release version vX.X.X'
git push origin --tags
git push origin master
```

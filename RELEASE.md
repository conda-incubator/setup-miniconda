# Release

## Build

The build steps transpiles the `src/main.ts` to `lib/main.js` and then packs to `dist/index.js`. It is handled by Typescript compiler.


- Conda env

```bash
conda create -n github-action install nodejs=12 -c conda-forge
```

- Install NodeJS 12

```bash
npm install
npm i -g @zeit/ncc
```

- To update the code

```bash
npm run build
npm run format
npm run pack
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
```

# Contributing

## Build

The build step transpiles the `src/` to `dist/`, with `ncc`. These files, by
convention, are also checked in.

- Create Conda env

```bash
conda create -n github-action nodejs -c conda-forge
```

- Install NodeJS

```bash
conda activate github-action
npm install
```

- Ensure the files in `dist` has been rebuilt

```bash
npm run format
npm run check
npm run build
```

## Release

See the [release documentation](./RELEASE.md).

# Contributing

## Build

The build step transpiles the `src/` to `dist/`, with `ncc`. These files, by
convention, are also checked in.

- Create Conda env with `nodejs`:

```bash
conda create -n github-action nodejs -c conda-forge
```

- Install NodeJS dependencies:

```bash
npm install
```

- Ensure the files in `dist` have been rebuilt:

```bash
npm run format
npm run check
npm run build
```

## Release

See the [release documentation](./RELEASE.md).

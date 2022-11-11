# Contributing

## Pull requests

Make sure to make your pull requests against the `develop` branch.

## Build

The build step transpiles the `src/` to `dist/`, with `ncc`. These files, by
convention, are also checked in.

- Create Conda env with `nodejs`:

We use NodeJS version 16 for now.

```bash
conda create -n github-action nodejs=16 -c conda-forge
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

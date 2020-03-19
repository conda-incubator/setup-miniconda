# Contributing

## Build

The build steps transpiles the `src/main.ts` to `lib/main.js` and then packs to `dist/index.js`. It is handled by Typescript compiler.

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

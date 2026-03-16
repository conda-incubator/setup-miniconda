# CLAUDE.md

## Project Overview

GitHub Action for setting up Conda (Miniconda, Miniforge, or custom installers)
on GitHub Actions runners. Written in TypeScript, bundled with `@vercel/ncc`,
and runs on Node.js 24.

## Key Commands

```bash
npm install          # Install dependencies
npm run build        # Bundle src/ → dist/ (setup + delete entry points)
npm run check        # Run prettier:check + eslint:check
npm run format       # Run prettier:format + eslint:format
```

The pre-commit hook (husky) runs: `format → check → build`.

## Architecture

- **Entry points**: `src/setup.ts` (main action), `src/delete.ts` (post-action
  cleanup)
- **Bundled output**: `dist/setup/index.js`, `dist/delete/index.js` — checked
  into git
- **Installer providers** (`src/installer/`): bundled-miniconda,
  download-miniconda, download-miniforge, download-url
- **Environment creation** (`src/env/`): simple, yaml, explicit (lockfile)
- **Base tools** (`src/base-tools/`): update conda, mamba, conda-build, python
- Action metadata defined in `action.yml`

## Code Conventions

- TypeScript with strict mode (`noImplicitAny`, `strictNullChecks`)
- Interfaces must use `I` prefix in PascalCase (e.g., `IActionInputs`) —
  enforced by ESLint
- Floating promises must be handled (`@typescript-eslint/no-floating-promises`)
- Prettier config: `{ "proseWrap": "always" }`
- ESLint extends `eslint:recommended` with `@typescript-eslint` parser/plugin

## Testing

No unit test framework. Testing is done via integration workflows in
`.github/workflows/example-*.yml` and `regression-checks.yml`. These run the
compiled action against real conda installations on multiple OS/platform
combinations.

## Development Setup

```bash
conda create -n github-action nodejs=24 -c conda-forge
conda activate github-action
npm install
```

## PR Guidelines

- Target the `main` branch
- Run `npm run format && npm run check && npm run build` before committing
- Verify `dist/` has no uncommitted changes after build

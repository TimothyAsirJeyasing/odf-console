# AGENTS.md

## Cursor Cloud specific instructions

ODF Console is the UI plugin for the OpenShift Data Foundation operator. It is an
OpenShift Console **dynamic plugin**: a webpack dev server (default port `9001`)
serves a module-federation bundle (`plugin-entry.js`) and a `plugin-manifest.json`
that a running OpenShift Console bridge loads at runtime. It is a single Yarn
workspace repo (`packages/*`); there is no standalone backend service to run.

### Environment / package manager
- Package manager is **Yarn Berry v4** (pinned via `packageManager` in `package.json`,
  resolved through Corepack). The update script runs `corepack enable` + `yarn install`,
  so dependencies are already present at session start.
- Node comes from the VM's `/exec-daemon/node` (v22.x), which satisfies the
  `engines` requirement (`>=20.19.2`). `.nvmrc` pins `22.17` but the available
  22.x runtime works for install/build/lint/test.

### Standard commands (see `package.json` scripts, `README.md`)
- Lint: `yarn lint` (runs `lint-ts` eslint + `lint-css` stylelint).
- Unit tests: `yarn test` (jest). ~670 tests; some React Router deprecation
  warnings are logged during the run but tests pass.
- Dev server: `yarn dev` — compiles and serves the odf plugin on port `9001`.
  First compile takes ~25s. Verify readiness by fetching
  `http://localhost:9001/plugin-manifest.json` (HTTP 200) and
  `http://localhost:9001/plugin-entry.js`.
- `yarn dev-mco` / `yarn dev-client` serve the mco / client plugin variants instead.

### Non-obvious caveats
- Running the **full console UI** requires a live OpenShift cluster + the console
  bridge (`yarn dev:c` / `scripts/start-ocp-console.sh`, which need `oc`, a cluster,
  and podman/docker). That is not available in this VM, so end-to-end UI testing of
  plugin pages is not possible here. `yarn dev` alone (serving the manifest/bundle)
  is the runnable, verifiable target.
- The pre-commit hook (`.husky/pre-commit`) runs `lint-staged`, `yarn i18n -s`, and
  re-stages `locales/`. Commits may modify translation files.

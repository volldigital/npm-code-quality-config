# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@disphere/code-quality-config` is a shared ESLint (flat config) + Prettier configuration package, published publicly on npmjs (license 0BSD, repo `volldigital/npm-code-quality-config`). Consumers install it as a dev dependency together with the peers `eslint`, `prettier` and `typescript`. All plugins are regular `dependencies` of this package, so consumers never install them directly.

There is no build step: the package ships its source files as-is (see `files` in `package.json`). Node >= 24, ESM (`"type": "module"`).

Git operations (commit, push, branch, tag) are done by the user. Ask them to commit or push; don't do it yourself.

Docs and comments must stay project-neutral: describe consumers generically ("consuming project"), never specific applications that use this package.

## Development environment

The devcontainer (`.devcontainer/`) uses Node 26 and runs `npm ci` on creation. It sets `npm config set min-release-age=7`, so npm won't install package versions published in the last 7 days. Keep that in mind when bumping dependencies: the newest release may not be installable locally yet. CI has no such setting.

## Commands

```shell
npm run lint                 # eslint, using this repo's own shared config
npm run format               # prettier --write .
npm run format:check         # prettier --check .
npm test                     # smoke test of the packed artifact (needs network, ~1 min)
npm test -- --keep           # same, but leaves the installed consumer copy in $TMPDIR
npm pack --dry-run           # list what would be published
npm run lint:report          # eslint JSON piped into lint-report.mjs (grouped by rule)
npm run lint:which-modules   # eslint JSON piped into which-modules.mjs
```

`lint-report.mjs` accepts `--by=file` and `--max-warnings=N`, and reads from stdin or a file path. `which-modules.mjs` takes a rule id as its first argument (default `import-x/default`), e.g. `npx eslint -f json | node which-modules.mjs no-undef`.

## Architecture

Package exports (`package.json` `exports`/`bin`):

- `@disphere/code-quality-config/eslint` → `eslint.js`: a factory `appConfig({ env, modules, testRunner, jestVersion, tsconfigRootDir, ignores })` returning a flat config via `defineConfig`.
  - Defaults: `env: 'browser'`, `modules: 'esm'`, `testRunner: 'vitest'`, `jestVersion: 30`.
  - Blocks are named `shared/*` and layered by file glob:
    1. base JS
    2. `eslint-plugin-n`, only when `env` is `node`/`both`; picks the module or script variant from `modules` and the file extension
    3. TypeScript (type-checked, `projectService`)
    4. React (`.jsx`/`.tsx`)
    5. `import-x`
    6. Cypress e2e (always on, inert without matching files)
    7. one test-runner block (`jest`/`vitest`/`mocha`, or none)
    8. tooling files
    9. `eslint-config-prettier`, which must stay last so it disables conflicting formatting rules.
- `@disphere/code-quality-config/prettier` → `prettier.js`: the shared Prettier config.
  - Plugins are resolved to absolute paths with `import.meta.resolve`, so consuming projects don't need to install them.
  - SQL formatting of templates tagged `mysqlFormat`/`mssqlFormat` via `prettier-plugin-embed` + `prettier-plugin-sql`.
  - Import sorting via `@ianvs/prettier-plugin-sort-imports`.
- Bins `lint-report` and `which-modules`: standalone stdin/JSON analysis tools for ESLint output. They slice to the outer `[...]` before parsing, because `npm run` banners can pollute stdout. `lint-report` sets exit code 1 on errors so it can be the tail of a pipeline.

The SQL tag functions themselves are _not_ shipped. They are runtime code, and this package is a dev dependency. The README has a copy-paste snippet instead.

The repo dogfoods itself: `eslint.config.mjs` calls `appConfig({ env: 'node', testRunner: 'none', ignores: [...] })` and `.prettierrc.mjs` re-exports `prettier.js`.

Design decisions documented in comments that should be preserved:

- `import-x/order` is off because import ordering is owned by the Prettier sort-imports plugin.
- `import-x/default` and `import-x/no-named-as-default-member` are off due to false positives (`export =` typings, plugins exposing both default and named exports).
- Consumers must use `.prettierrc.mjs` (not `.js`) so it is ESM regardless of their `type`.
- Unused vars/args/caught errors prefixed with `_` are allowed (both JS and TS rules).

## Smoke test and example project

`test/consumer/` is a minimal TypeScript consumer project (Node, Vitest, both SQL tags). It doubles as the example referenced from the README. `scripts/smoke-test.mjs`:

1. copies it to a temp dir
2. runs `npm pack` and installs the tarball plus `eslint prettier typescript@6 @types/node vitest`
3. runs `prettier --check`, `tsc`, `eslint`, `vitest run`, and both bins.

This catches what linting the repo cannot: files missing from `files`, broken `exports`, plugins not resolving from a consumer's directory, and peer conflicts.

- The files in `test/consumer/` are committed already formatted by the shared config. If a change to `prettier.js` changes their formatting, regenerate them: run `npm test -- --keep`, run `npx prettier --write src` in the kept copy, and copy the result back.
- `test/consumer/` is excluded from the root ESLint config and from `.prettierignore`, because its configs import the package by name, which only resolves once it's installed.
- Its `tsconfig.json` needs `"types": ["node"]`, because TypeScript 6 defaults `types` to `[]`.

## Keep in sync

- **Peer ranges:** `peerDependencies` in `package.json` must match README "Requirements", the README install command (`typescript@6`), and the install list in `scripts/smoke-test.mjs`.
  - The `typescript` range (`>=5.1.6 <6.1.0`) mirrors what `typescript-eslint` supports, not the latest TypeScript (7.x). Widen it only when `typescript-eslint` does.
  - TypeScript stays a required peer, because `@typescript-eslint/parser` loads it when `eslint.js` is imported.
  - README and smoke test should suggest the newest major the range allows.
- **`appConfig` options or defaults:** update the JSDoc in `eslint.js` and the options table in `README.md`.
- **SQL tag snippet:** `test/consumer/src/sql.ts` must stay identical to the snippet in the README's Prettier section. SQL tag names in `prettier.js` (`embeddedSqlTags`, `embeddedOverrides`) must match both.
- **New exported or bin files:** add them to `files`, plus `exports` or `bin`, and use them in `test/consumer/` so the smoke test covers them.
- **Package name:** used in `package.json`, `README.md`, the usage comment in `prettier.js`, and both configs in `test/consumer/`.

Changing a default, enabling a rule or raising a peer minimum can break consuming projects' lint runs. Pick the version bump with that in mind.

## CI and release

Both workflows run `npm ci`, `npm run lint`, `npm run format:check`, `npm test` and `npm pack --dry-run`. There is intentionally no `build` script.

- `ci.yml`: runs on push to `main`/`feature/**` and on PRs, on a Node 24/26 matrix.
- `release.yml`: manual `workflow_dispatch` with a `version` input (`patch|minor|major` or explicit semver). On Node 26 with npm 11, after the checks it runs:
  - `npm version` (commit `chore(release): %s` plus tag, as `github-actions[bot]`)
  - `git push --follow-tags`
  - `npm publish --provenance`

  It uses npm trusted publishing (OIDC, `id-token: write`), so no npm token secret is involved. No GitHub Release is created. The version in `package.json` is only ever changed by this workflow.

One-time setup: trusted publishing is configured per package on npmjs.com, so the package needs a first manual publish (`npm publish --access public`, version `0.1.0`) before the workflow can publish. The trusted publisher entry must name repo `volldigital/npm-code-quality-config` and workflow `release.yml`. If `main` is branch-protected, `github-actions[bot]` must be allowed to push.

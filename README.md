# @disphere/code-quality-config

Opinionated, shared ESLint (flat config) and Prettier configuration. It bundles the plugins it uses, so a project only needs the peer dependencies.

What you get:

- **ESLint**: `@eslint/js` recommended, type-checked `typescript-eslint`, `eslint-plugin-n` for Node code, React (`@eslint-react` + hooks), `import-x` with cycle detection, Cypress, and Jest/Vitest/Mocha. Rules that would conflict with Prettier are turned off.
- **Prettier**: 120 columns, single quotes, trailing commas, import sorting, and SQL formatting inside tagged template literals.
- **CLI helpers**: `lint-report` and `which-modules`, which summarise ESLint output.

## Requirements

- Node.js >= 24
- `eslint` ^10.8, `prettier` ^3.9.6, `typescript` >=5.1.6 <6.1.0. TypeScript is needed even in JavaScript-only projects, because `typescript-eslint` loads it.

## Installation

```shell
npm install --save-dev @disphere/code-quality-config eslint prettier typescript@6
```

TypeScript 7 is not supported yet, because `typescript-eslint` does not support it.

Declare the Node version in your `package.json`. `eslint-plugin-n` reads it to decide which Node APIs are allowed:

```json
{
  "engines": {
    "node": ">=24.0.0"
  }
}
```

## ESLint

Create `eslint.config.mjs`:

```js
import appConfig from '@disphere/code-quality-config/eslint';

export default appConfig({
  env: 'node',
  tsconfigRootDir: import.meta.dirname, // TypeScript projects only
});
```

All options are optional:

| Option            | Values                                          | Default     | Description                                                                                          |
| ----------------- | ----------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| `env`             | `'browser'` \| `'node'` \| `'both'`             | `'browser'` | Where your code runs. Sets globals; `node`/`both` also enable `eslint-plugin-n`.                     |
| `modules`         | `'esm'` \| `'cjs'`                              | `'esm'`     | How bare `.js` files are parsed. Must match the `type` in your `package.json`.                       |
| `testRunner`      | `'jest'` \| `'vitest'` \| `'mocha'` \| `'none'` | `'vitest'`  | Picks the plugin and globals for test files. `'none'` skips the test block.                          |
| `jestVersion`     | number                                          | `30`        | Major Jest version; only read when `testRunner` is `'jest'`.                                         |
| `tsconfigRootDir` | string                                          | –           | Pass `import.meta.dirname` in TypeScript projects. Type-aware rules use the nearest `tsconfig.json`. |
| `ignores`         | string[]                                        | `[]`        | Extra ignore globs. `dist/`, `build/`, `coverage/` and `*.min.js` are always ignored.                |

These globs decide which rules apply to a file:

- **TypeScript**: `*.ts`, `*.mts`, `*.cts`, `*.tsx`
- **React**: `*.jsx`, `*.tsx`
- **Tests**: `*.test.*`, `*.spec.*`, and files under `__tests__/`, `test/` or `tests/`
- **Cypress**: `*.cy.*` and files under `cypress/`
- **Tooling**: `*.config.*` and `scripts/**`. These are treated as Node code even in browser projects.

Variables, arguments and caught errors prefixed with `_` are exempt from the unused-variable rules.

With TypeScript 6, `compilerOptions.types` defaults to `[]`, so `@types/*` packages are no longer included automatically. If you see type-aware errors such as `no-unsafe-call` on Node APIs, list the packages explicitly in your `tsconfig.json`, e.g. `"types": ["node"]`.

## Prettier

Create `.prettierrc.mjs`:

```js
import base from '@disphere/code-quality-config/prettier';

export default base;
```

Use `.mjs`, not `.js`, so the file is ESM whether or not your `package.json` sets `"type": "module"`. Add a `.prettierignore` as needed.

To extend the config, spread it: `export default { ...base, printWidth: 100 };`.

Imports are sorted in this order: Node built-ins, third-party packages, `@/` aliases, then relative imports.

### SQL in template literals

SQL inside template literals tagged `mysqlFormat` (MySQL dialect) or `mssqlFormat` (T-SQL) is formatted:

```ts
const query = mysqlFormat`
  SELECT
    id
  FROM
    users
  WHERE
    name = :name
`;
```

The tags are only markers for Prettier. This package doesn't ship them: it is a dev dependency, and the tags are runtime code. Copy them into your project, e.g. as `src/sql.ts`:

```ts
/*
 * Markers for prettier-plugin-embed: templates tagged with these are formatted as SQL. At runtime they only join the
 * template back together; `null`/`undefined` values become empty strings.
 */
type SqlValue = string | number | bigint | boolean | null | undefined;

const joinTemplate = (strings: TemplateStringsArray, ...values: SqlValue[]): string =>
  strings.reduce((sql, str, i) => sql + str + String(values[i] ?? ''), '');

export const mysqlFormat = joinTemplate;
export const mssqlFormat = joinTemplate;
```

In JavaScript, drop the type annotations and the `SqlValue` type. Values are interpolated as-is and are not escaped, so pass user input as query parameters (`:name`), not via `${}`.

## Suggested npm scripts

```json
{
  "scripts": {
    "lint": "eslint",
    "lint:report": "eslint --format json | lint-report",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

### `lint-report`

Reads ESLint JSON output from stdin (or from a file path argument) and prints a summary instead of every message.

- **Default:** grouped by rule, with error, warning and file counts, and how many are autofixable.
- **`--by=file`:** ranks the files with the most problems.
- **`--max-warnings=N`:** fails when there are more than N warnings.

It exits with code 1 when there are errors, so it can end a pipeline.

### `which-modules`

Groups the messages of one rule by the module or identifier they name. This shows whether a large count has one cause or many:

```shell
npx eslint --format json | npx which-modules no-undef
```

## Example

[`test/consumer/`](test/consumer) is a minimal TypeScript project set up as described above. The package's smoke test installs the packed artifact into a copy of it and runs Prettier, `tsc`, ESLint and Vitest there. It also contains the SQL tag snippet from above, in `src/sql.ts`.

## License

[0BSD](LICENSE)

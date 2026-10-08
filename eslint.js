import eslintReact from '@eslint-react/eslint-plugin';
import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import prettier from 'eslint-config-prettier/flat';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import cypress from 'eslint-plugin-cypress';
import { importX } from 'eslint-plugin-import-x';
import jest from 'eslint-plugin-jest';
import mocha from 'eslint-plugin-mocha';
import n from 'eslint-plugin-n';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const ALL = '**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}';
const TS = '**/*.{ts,mts,cts,tsx}';
const E2E = ['**/*.cy.{js,jsx,ts,tsx}', '**/cypress/**/*.{js,jsx,ts,tsx}'];
const TESTS = [
  '**/*.{test,spec}.{js,jsx,ts,tsx}',
  '**/__tests__/**/*.{js,jsx,ts,tsx}',
  '**/tests/**/*.{js,jsx,ts,tsx}',
  '**/test/**/*.{js,jsx,ts,tsx}',
];

const TOOLING = ['*.config.{js,mjs,ts,mts}', 'scripts/**/*.{js,mjs,ts,mts}'];

const TEST_RUNNERS = {
  jest: { extends: jest.configs['flat/recommended'], globals: globals.jest },
  vitest: { extends: vitest.configs.recommended, globals: globals.vitest },
  mocha: { extends: mocha.configs.recommended, globals: globals.mocha },
};

const ENV_GLOBALS = {
  browser: globals.browser,
  node: globals.node,
  both: { ...globals.browser, ...globals.node },
};

/**
 * @param {object} [options]
 * @param {'browser'|'node'|'both'} [options.env] Where the project's own code runs.
 *   Default: `browser`
 * @param {'jest'|'vitest'|'mocha'|'none'} [options.testRunner] Which runner the project's tests use. Picks the
 *   matching plugin and globals. 'none' skips the test block entirely.
 *   Default: `vitest`
 * @param {number} [options.jestVersion] Major version of Jest in use. Only read when testRunner is 'jest'.
 *   eslint-plugin-jest cannot see the project's jest version.
 *   Default: `30`
 * @param {'esm'|'cjs'} [options.modules] How bare `.js` files are parsed. Must match the project's package.json
 *   `type`.
 *   Default: `esm`
 * @param {string} [options.tsconfigRootDir] Pass `import.meta.dirname`. TS projects only.
 * @param {string[]} [options.ignores] Extra ignore globs for the project.
 */
export default function appConfig({
  env = 'browser',
  modules = 'esm',
  testRunner = 'vitest',
  jestVersion = 30,
  tsconfigRootDir,
  ignores = [],
} = {}) {
  const usesNode = env === 'node' || env === 'both';
  const jsIsEsm = modules === 'esm';

  return defineConfig([
    globalIgnores(['dist/**', 'build/**', 'coverage/**', '**/*.min.js', ...ignores]),

    // base
    {
      name: 'shared/base',
      files: [ALL],
      extends: [js.configs.recommended],
      languageOptions: {
        sourceType: jsIsEsm ? 'module' : 'commonjs',
        globals: { ...ENV_GLOBALS[env] },
        parserOptions: {
          ecmaFeatures: { jsx: true },
          ...(tsconfigRootDir ? { tsconfigRootDir } : {}),
        },
      },
      linterOptions: { reportUnusedDisableDirectives: 'error' },
      rules: {
        'no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
          },
        ],
      },
    },

    // node-specific
    ...(usesNode
      ? [
          {
            name: 'shared/node-js',
            files: ['**/*.js'],
            extends: [jsIsEsm ? n.configs['flat/recommended-module'] : n.configs['flat/recommended-script']],
          },
          {
            name: 'shared/node-esm',
            files: ['**/*.{mjs,mts,ts,tsx}'],
            extends: [n.configs['flat/recommended-module']],
          },
          {
            name: 'shared/node-cjs',
            files: ['**/*.{cjs,cts}'],
            extends: [n.configs['flat/recommended-script']],
          },
        ]
      : []),

    {
      name: 'shared/esm-files',
      files: ['**/*.{mjs,mts}'],
      languageOptions: { sourceType: 'module' },
    },
    {
      name: 'shared/cjs-files',
      files: ['**/*.{cjs,cts}'],
      languageOptions: { sourceType: 'commonjs' },
    },

    // typescript
    {
      name: 'shared/typescript',
      files: [TS],
      extends: [tseslint.configs.recommendedTypeChecked, tseslint.configs.stylisticTypeChecked],
      languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir, jsxPragma: null },
      },
      rules: {
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
          },
        ],
        '@typescript-eslint/consistent-type-imports': 'error',
      },
    },

    // react
    {
      name: 'shared/react-js',
      files: ['**/*.jsx'],
      extends: [
        eslintReact.configs.recommended,
        reactHooks.configs.flat.recommended,
        eslintReact.configs['disable-conflict-eslint-plugin-react-hooks'],
      ],
    },
    {
      name: 'shared/react-ts',
      files: ['**/*.tsx'],
      extends: [
        eslintReact.configs['recommended-typescript'],
        reactHooks.configs.flat.recommended,
        eslintReact.configs['disable-conflict-eslint-plugin-react-hooks'],
      ],
    },

    // imports
    {
      name: 'shared/imports',
      files: [ALL],
      extends: [importX.flatConfigs.recommended, importX.flatConfigs.typescript],
      settings: {
        'import-x/resolver-next': [createTypeScriptImportResolver({ alwaysTryTypes: true })],
      },
      rules: {
        /*
         * Resolves to @types/*.d.ts, which use `export =` and so have no ESM default export. Bundlers and tsc
         * synthesise one via interop; this rule can't model that and reports every react/prop-types import.
         */
        'import-x/default': 'off',
        /*
         * Plugins expose `configs`/`rules` as both default-properties and named exports; this rule can't tell that's
         * benign.
         */
        'import-x/no-named-as-default-member': 'off',
        'import-x/no-cycle': 'error',
        /*
         * Import ordering is handled by @ianvs/prettier-plugin-sort-imports.
         * Keeping this rule on would fight the formatter: it cannot reorder
         * across side-effect imports (CSS) and warns about output Prettier
         * considers correct.
         */
        'import-x/order': 'off',
      },
    },

    // tests

    /*
     * Cypress e2e specs. Always present but inert without matching files, like the TypeScript and React blocks.
     * Separate from `testRunner` because an app can run Cypress alongside Jest/Vitest/Mocha for unit tests.
     */
    {
      name: 'shared/e2e-cypress',
      files: E2E,
      extends: [cypress.configs.recommended],
    },
    ...(testRunner === 'none'
      ? []
      : [
          {
            name: `shared/tests-${testRunner}`,
            files: TESTS,
            extends: [TEST_RUNNERS[testRunner].extends],
            ...(testRunner === 'jest' ? { settings: { jest: { version: jestVersion } } } : {}),
            languageOptions: { globals: { ...TEST_RUNNERS[testRunner].globals } },
            rules: {
              '@typescript-eslint/unbound-method': 'off',
            },
          },
        ]),

    //tooling
    {
      name: 'shared/tooling',
      files: TOOLING,
      languageOptions: { globals: { ...globals.node } },
      rules: { 'n/no-unpublished-import': 'off' },
    },

    // prettier
    prettier,
  ]);
}

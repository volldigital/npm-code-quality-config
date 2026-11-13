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
import vue from 'eslint-plugin-vue';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';

const ALL = '**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}';
const TS = '**/*.{ts,mts,cts,tsx}';
// Vue single-file components. Their <script> is linted as TypeScript, with the type-checked rules.
const VUE = '**/*.vue';
const E2E = ['**/*.cy.{js,jsx,ts,tsx}', '**/cypress/**/*.{js,jsx,ts,tsx}'];
const TESTS = [
  '**/*.{test,spec}.{js,jsx,ts,tsx}',
  '**/__tests__/**/*.{js,jsx,ts,tsx}',
  '**/tests/**/*.{js,jsx,ts,tsx}',
  '**/test/**/*.{js,jsx,ts,tsx}',
];

const TOOLING = ['*.config.{js,mjs,ts,mts}', 'scripts/**/*.{js,mjs,ts,mts}'];

const TEST_RUNNERS = {
  jest: { extends: [jest.configs['flat/recommended']], globals: globals.jest },
  vitest: { extends: [vitest.configs.recommended], globals: globals.vitest },
  mocha: { extends: [mocha.configs.recommended], globals: globals.mocha },
  // Node's built-in `node:test`: no plugin, and its API is imported rather than global.
  node: { extends: [], globals: globals.node },
};

/*
 * Calls whose returned promise the test runner awaits itself, for @typescript-eslint/no-floating-promises. Only
 * node:test needs entries: Jest, Vitest and Mocha return void (or a non-thenable) from test()/describe()/it().
 * `skip`/`todo`/`only` cover the member forms (`test.skip()`, `describe.only()`); the package scope keeps them from
 * matching anything outside node:test.
 */
const RUNNER_SAFE_CALLS = {
  node: [
    {
      from: 'package',
      package: 'node:test',
      name: ['test', 'describe', 'it', 'suite', 'skip', 'todo', 'only'],
    },
  ],
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
 * @param {'jest'|'vitest'|'mocha'|'node'|'none'} [options.testRunner] Which runner the project's tests use. Picks the
 *   matching plugin and globals. 'node' is Node's built-in `node:test`: Node globals, and its test()/describe()/it()/
 *   suite() promises are exempt from no-floating-promises. 'none' skips the test block entirely.
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
      files: [ALL, VUE],
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
      files: [TS, VUE],
      extends: [tseslint.configs.recommendedTypeChecked, tseslint.configs.stylisticTypeChecked],
      languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir, jsxPragma: null, extraFileExtensions: ['.vue'] },
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

    // vue
    {
      name: 'shared/vue',
      files: [VUE],
      extends: [vue.configs['flat/recommended']],
      languageOptions: {
        /*
         * Must come after the typescript block, whose parser would otherwise win. vue-eslint-parser handles the
         * template and hands <script> to the typescript-eslint parser, so the type-checked rules above also run here.
         */
        parser: vueParser,
        sourceType: 'module',
        parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] },
      },
      rules: {
        /*
         * typescript-eslint's eslint-recommended block (no-undef etc. off, because TypeScript checks them) only
         * matches TS extensions, so it is applied here explicitly.
         */
        ...tseslint.configs.eslintRecommended.rules,
      },
    },

    // imports
    {
      name: 'shared/imports',
      files: [ALL, VUE],
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
            extends: TEST_RUNNERS[testRunner].extends,
            ...(testRunner === 'jest' ? { settings: { jest: { version: jestVersion } } } : {}),
            languageOptions: { globals: { ...TEST_RUNNERS[testRunner].globals } },
            rules: {
              '@typescript-eslint/unbound-method': 'off',
            },
          },
        ]),
    ...(RUNNER_SAFE_CALLS[testRunner]
      ? [
          {
            name: `shared/tests-${testRunner}-typescript`,
            // Test files that are also TypeScript: the typescript-eslint plugin only exists there.
            files: TESTS.map((glob) => [glob, TS]),
            rules: {
              '@typescript-eslint/no-floating-promises': [
                'error',
                { allowForKnownSafeCalls: RUNNER_SAFE_CALLS[testRunner] },
              ],
            },
          },
        ]
      : []),

    //tooling
    {
      name: 'shared/tooling',
      files: TOOLING,
      languageOptions: { globals: { ...globals.node } },
      rules: { 'n/no-unpublished-import': 'off' },
    },

    // prettier
    prettier,

    /*
     * Must stay AFTER `prettier`. eslint-config-prettier turns `curly` off because its `multi*` options can conflict
     * with Prettier; the default `all` option does not, so it is re-enabled here. Moved above the prettier block, it
     * would silently be switched off again.
     */
    {
      name: 'shared/curly',
      files: [ALL, VUE],
      rules: { curly: 'error' },
    },
  ]);
}

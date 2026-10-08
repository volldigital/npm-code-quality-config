import { fileURLToPath } from 'node:url';

/**
 * Prettier resolves plugin NAMES relative to the consuming project, not to this file. Resolving to absolute paths here
 * lets the plugins stay dependencies of this package instead of having to be installed in every consuming project.
 */
const resolve = (spec) => fileURLToPath(import.meta.resolve(spec));

/**
 * Shared Prettier config.
 *
 * Consumed as:
 *
 *   // .prettierrc.mjs
 *   import base from '@disphere/code-quality-config/prettier'
 *   export default base
 *
 * Always `.mjs`, never `.js`: the file is then ESM regardless of whether the consuming project sets
 * `"type": "module"`, so the same two lines work everywhere instead of `module.exports` in CommonJS projects.
 *
 * @type {import('prettier').Config}
 */
export default {
  printWidth: 120,
  singleQuote: true,
  trailingComma: 'all',

  plugins: [
    resolve('prettier-plugin-embed'),
    resolve('prettier-plugin-sql'),
    resolve('@ianvs/prettier-plugin-sort-imports'),
  ],

  // tells prettier-plugin-embed which tagged template literals are SQL
  embeddedSqlTags: ['mysqlFormat', 'mssqlFormat'],

  // global fallback options
  keywordCase: 'upper',
  dataTypeCase: 'upper',
  functionCase: 'upper',
  identifierCase: 'lower',
  formatter: 'sql-formatter',
  paramTypes: "{named: [':']}",

  // per-tag dialect overrides
  embeddedOverrides: JSON.stringify([
    {
      tags: ['mysqlFormat'],
      options: {
        language: 'mysql',
      },
    },
    {
      tags: ['mssqlFormat'],
      options: {
        language: 'tsql',
      },
    },
  ]),
  overrides: [
    {
      files: '*.md',
      options: {
        proseWrap: 'preserve',
      },
    },
  ],

  importOrder: ['<BUILTIN_MODULES>', '<THIRD_PARTY_MODULES>', '', '^@/(.*)$', '', '^[./]'],
};

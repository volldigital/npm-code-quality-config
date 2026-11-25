import { fileURLToPath } from 'node:url';
import * as sentencesPerLine from 'prettier-plugin-sentences-per-line';

/**
 * Prettier resolves plugin NAMES relative to the consuming project, not to this file. Resolving to absolute paths here
 * lets the plugins stay dependencies of this package instead of having to be installed in every consuming project.
 */
const resolve = (spec) => fileURLToPath(import.meta.resolve(spec));

const plugins = [
  resolve('prettier-plugin-embed'),
  resolve('prettier-plugin-sql'),
  resolve('@ianvs/prettier-plugin-sort-imports'),
];

/**
 * Replaces the sentence breaks prettier-plugin-sentences-per-line inserts below `node` with plain spaces.
 */
const unbreakSentences = (node) => {
  node.children?.forEach((child, i) => {
    if (child.type === 'sentenceBreak') {
      node.children[i] = { type: 'whitespace', value: ' ' };
    } else {
      unbreakSentences(child);
    }
  });
};

/**
 * prettier-plugin-sentences-per-line, except that headings are never split: a Markdown heading ends at the line break,
 * so splitting `# First. Second.` would turn its second sentence into a paragraph.
 *
 * @type {import('prettier').Plugin}
 */
const sentencesPerLineOutsideHeadings = {
  ...sentencesPerLine,
  printers: {
    mdast: {
      ...sentencesPerLine.printers.mdast,
      preprocess: async (ast, options) => {
        const tree = await sentencesPerLine.printers.mdast.preprocess(ast, options);
        const visit = (node) => (node.type === 'heading' ? unbreakSentences(node) : node.children?.forEach(visit));
        visit(tree);
        return tree;
      },
    },
  },
};

/**
 * Words ending in a period that don't end a sentence, in addition to the plugin's built-in `e.g.`, `i.e.`, `etc.`,
 * `vs.` and a few more. Matching is case-insensitive. Single letters cover initials (`John F. Kennedy`) and multi-part
 * German abbreviations (`z. B.`, `d. h.`, `u. a.`, `i. d. R.`). German abbreviations matter more than English ones,
 * because the next word is often a capitalized noun (`bzw. Kunden`).
 */
const sentencesPerLineAbbreviations = [
  ...[...'abcdefghijklmnopqrstuvwxyz'].map((letter) => `${letter}.`),
  // English
  'mr.',
  'mrs.',
  'ms.',
  'dr.',
  'prof.',
  'st.',
  'cf.',
  'approx.',
  'fig.',
  'no.',
  // German
  'abs.',
  'bzw.',
  'ca.',
  'evtl.',
  'ggf.',
  'inkl.',
  'nr.',
  'sog.',
  'usw.',
  'vgl.',
  'zzgl.',
];

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

  plugins,

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
        // Never reflows paragraphs; the plugin below only adds line breaks, so each sentence starts on its own line.
        proseWrap: 'preserve',
        // `plugins` in an override replaces the top-level list instead of extending it, so repeat it: code blocks in
        // Markdown still need import sorting and SQL formatting.
        plugins: [...plugins, sentencesPerLineOutsideHeadings],
        sentencesPerLineAdditionalAbbreviations: sentencesPerLineAbbreviations,
      },
    },
  ],

  importOrder: ['<BUILTIN_MODULES>', '<THIRD_PARTY_MODULES>', '', '^@/(.*)$', '', '^[./]'],
};

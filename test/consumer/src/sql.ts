/*
 * Markers for prettier-plugin-embed: templates tagged with these are formatted as SQL. At runtime they only join the
 * template back together; `null`/`undefined` values become empty strings.
 */
type SqlValue = string | number | bigint | boolean | null | undefined;

const joinTemplate = (strings: TemplateStringsArray, ...values: SqlValue[]): string =>
  strings.reduce((sql, str, i) => sql + str + String(values[i] ?? ''), '');

export const mysqlFormat = joinTemplate;
export const mssqlFormat = joinTemplate;

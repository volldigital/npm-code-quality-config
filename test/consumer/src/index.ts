import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { mssqlFormat, mysqlFormat } from './sql.js';

export const usersByName = mysqlFormat`
  SELECT
    id,
    name
  FROM
    users
  WHERE
    name = :name
`;

export const topOrders = (limit: number) => mssqlFormat`
  SELECT
    TOP ${limit} id,
    total
  FROM
    orders
  ORDER BY
    total DESC
`;

export const read = (dir: string, file: string) => readFile(join(dir, file), 'utf8');

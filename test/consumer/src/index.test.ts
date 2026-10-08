import { expect, test } from 'vitest';

import { topOrders, usersByName } from './index.js';

test('mysqlFormat keeps the query text', () => {
  expect(usersByName).toMatch(/FROM\s+users/);
});

test('mssqlFormat interpolates values', () => {
  expect(topOrders(5)).toMatch(/TOP\s+5\s/);
});

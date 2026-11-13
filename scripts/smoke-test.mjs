// Packs this package, installs the tarball into a copy of test/consumer and runs
// prettier, tsc, eslint, vitest and both bins there, the way a consuming app would. Catches
// what linting this repo cannot: files missing from `files`, broken `exports`,
// plugins that fail to resolve from outside this package, peer conflicts.
//
//   npm test
//   npm test -- --keep   # leave the installed copy on disk for inspection
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keep = process.argv.includes('--keep');
const root = join(import.meta.dirname, '..');
const dir = await mkdtemp(join(tmpdir(), 'code-quality-config-smoke-'));

const run = (cmd, args, opts = {}) => {
  console.log(`> ${cmd} ${args.join(' ')}`);
  return execFileSync(cmd, args, { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'], ...opts });
};

// Lints one file and fails unless its messages are exactly `expected` (`'rule:line'` entries, any order). ESLint exits
// 1 when it finds errors, which is the expected outcome here, so the JSON is read either way.
const expectMessages = (file, expected, eslintArgs = []) => {
  let out;
  try {
    out = run('npx', ['eslint', '--format', 'json', ...eslintArgs, file]);
  } catch (err) {
    if (err.status !== 1) {
      throw err;
    }
    out = err.stdout;
  }
  const found = JSON.parse(out)
    .flatMap((result) => result.messages.map((m) => `${m.ruleId}:${m.line}`))
    .sort();
  if (found.join() !== [...expected].sort().join()) {
    throw new Error(`${file}: expected [${expected.join(', ')}]; got [${found.join(', ')}]`);
  }
};

// Line of the first occurrence of `marker` in `source`, so expectations don't hard-code line numbers.
const lineOf = (source, marker) => source.slice(0, source.indexOf(marker)).split('\n').length;

// Bad code is written by this script, not committed to test/consumer, so the clean checks above stay clean.
const CURLY_BAD = `export const sign = (n: number) => {
  if (n < 0) return -1;
  return 1;
};
`;
const CURLY_FIXED = `export const sign = (n: number) => {
  if (n < 0) {
    return -1;
  }
  return 1;
};
`;

// node:test returns promises from test()/describe()/it()/suite() that the runner awaits itself.
const NODE_TEST_CONFIG = `import appConfig from '@disphere/code-quality-config/eslint';

export default appConfig({ env: 'node', testRunner: 'node', tsconfigRootDir: import.meta.dirname });
`;
const NODE_TEST = `import assert from 'node:assert/strict';
import { describe, it, suite, test } from 'node:test';

test('test', () => {
  assert.equal(1, 1);
});

describe('describe', () => {
  it('it', async () => {
    assert.equal(await Promise.resolve(1), 1);
  });
});

suite('suite', () => {
  test.skip('skip', () => {
    assert.ok(true);
  });
  test.todo('todo');
});

describe.only('only', () => {
  it('floating promise', () => {
    fetch('https://example.com');
  });
});
`;

try {
  await cp(join(root, 'test/consumer'), dir, { recursive: true });

  const [{ filename }] = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', dir], { cwd: root }));

  // typescript pinned to the newest major the peer range allows; `latest` can be ahead of typescript-eslint.
  run('npm', [
    'install',
    '--no-audit',
    '--no-fund',
    '--save-dev',
    `./${filename}`,
    'eslint',
    'prettier',
    'typescript@6',
    '@types/node',
    'vitest',
  ]);

  // The fixture is committed formatted, so this passes only if every prettier plugin loaded.
  run('npx', ['prettier', '--check', '.']);
  run('npx', ['tsc', '--project', '.']);
  run('npx', ['eslint']);
  // Exercises the SQL tag snippet that the README tells consumers to copy.
  console.log(run('npx', ['vitest', 'run']));

  const json = run('npx', ['eslint', '--format', 'json']);
  console.log(run('npx', ['lint-report'], { input: json }));
  console.log(run('npx', ['which-modules', 'no-undef'], { input: json }));

  // `curly` sits after eslint-config-prettier, which would otherwise turn it off. Its fix plus Prettier must be stable.
  const curlyFile = 'src/curly.ts';
  await writeFile(join(dir, curlyFile), CURLY_BAD);
  expectMessages(curlyFile, [`curly:${lineOf(CURLY_BAD, 'if')}`]);
  run('npx', ['eslint', '--fix', curlyFile]);
  run('npx', ['prettier', '--write', curlyFile]);
  if ((await readFile(join(dir, curlyFile), 'utf8')) !== CURLY_FIXED) {
    throw new Error(`${curlyFile}: eslint --fix + prettier did not produce the expected output`);
  }
  run('npx', ['eslint', curlyFile]);
  await rm(join(dir, curlyFile));

  // testRunner 'node': the runner's own calls pass, a real floating promise is still reported.
  const nodeTestFile = 'src/node.test.ts';
  await writeFile(join(dir, 'eslint.node-test.config.mjs'), NODE_TEST_CONFIG);
  await writeFile(join(dir, nodeTestFile), NODE_TEST);
  expectMessages(
    nodeTestFile,
    [`@typescript-eslint/no-floating-promises:${lineOf(NODE_TEST, 'fetch(')}`],
    ['--config', 'eslint.node-test.config.mjs'],
  );
  await rm(join(dir, nodeTestFile));

  console.log('Smoke test passed.');
} catch (err) {
  if (err.stdout) {
    console.error(err.stdout);
  }
  console.error(`Smoke test failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  if (keep) {
    console.log(`Consumer project kept at ${dir}`);
  } else {
    await rm(dir, { recursive: true, force: true });
  }
}

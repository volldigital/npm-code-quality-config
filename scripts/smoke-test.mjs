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

// Lints one file and fails unless every rule in `ruleIds` reported it. ESLint exits 1 when it finds errors, which is
// the expected outcome here, so the JSON is read either way.
const expectRules = (file, ruleIds) => {
  let out;
  try {
    out = run('npx', ['eslint', '--format', 'json', file]);
  } catch (err) {
    if (err.status !== 1) {
      throw err;
    }
    out = err.stdout;
  }
  const found = new Set(JSON.parse(out).flatMap((result) => result.messages.map((m) => m.ruleId)));
  const missing = ruleIds.filter((id) => !found.has(id));
  if (missing.length) {
    throw new Error(`${file}: expected ${missing.join(', ')}; got ${[...found].join(', ') || 'nothing'}`);
  }
};

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
  expectRules(curlyFile, ['curly']);
  run('npx', ['eslint', '--fix', curlyFile]);
  run('npx', ['prettier', '--write', curlyFile]);
  if ((await readFile(join(dir, curlyFile), 'utf8')) !== CURLY_FIXED) {
    throw new Error(`${curlyFile}: eslint --fix + prettier did not produce the expected output`);
  }
  run('npx', ['eslint', curlyFile]);
  await rm(join(dir, curlyFile));

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

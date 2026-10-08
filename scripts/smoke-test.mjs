// Packs this package, installs the tarball into a copy of test/consumer and runs
// prettier, tsc, eslint, vitest and both bins there, the way a consuming app would. Catches
// what linting this repo cannot: files missing from `files`, broken `exports`,
// plugins that fail to resolve from outside this package, peer conflicts.
//
//   npm test
//   npm test -- --keep   # leave the installed copy on disk for inspection
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keep = process.argv.includes('--keep');
const root = join(import.meta.dirname, '..');
const dir = await mkdtemp(join(tmpdir(), 'code-quality-config-smoke-'));

const run = (cmd, args, opts = {}) => {
  console.log(`> ${cmd} ${args.join(' ')}`);
  return execFileSync(cmd, args, { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'], ...opts });
};

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

  console.log('Smoke test passed.');
} catch (err) {
  if (err.stdout) console.error(err.stdout);
  console.error(`Smoke test failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  if (keep) console.log(`Consumer project kept at ${dir}`);
  else await rm(dir, { recursive: true, force: true });
}

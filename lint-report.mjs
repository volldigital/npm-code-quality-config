#!/usr/bin/env node
// Installed as the `lint-report` bin of this package. In an npm script:
//
//   "lint:report": "eslint . -f json | lint-report"
//
// Add --by=file to rank the worst files instead of the worst rules, and
// --max-warnings=N to fail on warning count as well as errors.
//
// Exits 1 when there are errors, so it is safe as the tail of a pipeline:
// the pipeline's status is this script's status, not eslint's.
//
// Groups ESLint's JSON output so you can see hotspots instead of a flat wall
// of messages. Default view is by rule; --by=file ranks the worst files.
import { readFile } from 'node:fs/promises';

async function main() {
  const args = process.argv.slice(2);
  const by = args.find((a) => a.startsWith('--by='))?.slice(5) ?? 'rule';
  const path = args.find((a) => !a.startsWith('--'));

  const raw = path
    ? await readFile(path, 'utf8')
    : await new Promise((resolve) => {
        let buf = '';
        process.stdin.on('data', (c) => {
          buf += c;
        });
        process.stdin.on('end', () => {
          resolve(buf);
        });
      });

  // `npm run` prints a banner to stdout, and Node prints warnings if stderr was
  // merged in. Neither is JSON, so cut to the array before parsing.
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');

  if (start === -1 || end === -1) {
    console.error('No JSON array found in the input. Did you pass -f json to eslint?');
    console.error('Received: ' + JSON.stringify(raw.slice(0, 120)) + (raw.length > 120 ? '...' : ''));
    process.exitCode = 1;
    return;
  }

  let results;
  try {
    results = JSON.parse(raw.slice(start, end + 1));
  } catch (err) {
    console.error('Could not parse ESLint JSON output: ' + err.message);
    process.exitCode = 1;
    return;
  }

  const rules = new Map();
  const files = new Map();

  for (const file of results) {
    for (const m of file.messages) {
      const id = m.ruleId ?? '(parse error)';
      const r = rules.get(id) ?? { errors: 0, warnings: 0, fixable: 0, files: new Set() };
      if (m.severity === 2) r.errors++;
      else r.warnings++;
      if (m.fix) r.fixable++;
      r.files.add(file.filePath);
      rules.set(id, r);

      const f = files.get(file.filePath) ?? { errors: 0, warnings: 0, rules: new Set() };
      if (m.severity === 2) f.errors++;
      else f.warnings++;
      f.rules.add(id);
      files.set(file.filePath, f);
    }
  }

  const pad = (s, n) => String(s).padEnd(n);
  const cwd = process.cwd();

  if (by === 'file') {
    const rows = [...files].sort((a, b) => b[1].errors + b[1].warnings - (a[1].errors + a[1].warnings));
    console.log(`\n${pad('FILE', 50)}${pad('ERR', 6)}${pad('WARN', 6)}RULES`);
    console.log('-'.repeat(74));
    for (const [path, f] of rows) {
      console.log(pad(path.replace(cwd + '/', ''), 50) + pad(f.errors, 6) + pad(f.warnings, 6) + f.rules.size);
    }
  } else {
    const rows = [...rules].sort((a, b) => b[1].errors + b[1].warnings - (a[1].errors + a[1].warnings));
    console.log(`\n${pad('RULE', 46)}${pad('ERR', 6)}${pad('WARN', 6)}${pad('FILES', 7)}AUTOFIX`);
    console.log('-'.repeat(78));
    for (const [id, r] of rows) {
      const total = r.errors + r.warnings;
      const fix = r.fixable === total ? 'all' : r.fixable === 0 ? '-' : `${r.fixable}/${total}`;
      console.log(pad(id, 46) + pad(r.errors, 6) + pad(r.warnings, 6) + pad(r.files.size, 7) + fix);
    }
  }

  const totalE = [...rules.values()].reduce((a, r) => a + r.errors, 0);
  const totalW = [...rules.values()].reduce((a, r) => a + r.warnings, 0);
  console.log(`\n${totalE} errors, ${totalW} warnings across ${files.size} files, ${rules.size} distinct rules\n`);

  // Carry ESLint's verdict through the pipe.
  const maxWarnings = Number(args.find((a) => a.startsWith('--max-warnings='))?.slice(15) ?? -1);
  if (totalE > 0 || (maxWarnings >= 0 && totalW > maxWarnings)) {
    process.exitCode = 1;
  }
}

await main();

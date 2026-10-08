#!/usr/bin/env node
// Groups messages for one rule by the module they name, so you can see whether
// a big count is one systemic cause or many separate ones.
//
//   npx eslint . -f json | node which-modules.mjs import-x/default
//   npx eslint . -f json | node which-modules.mjs no-undef
//   npx eslint . -f json | node which-modules.mjs no-unused-vars
//
// Groups by the first quoted token in each message: a module name for
// import rules, an identifier for no-undef / no-unused-vars.

async function main() {
  const rule = process.argv[2] ?? 'import-x/default';
  const raw = await new Promise((r) => {
    let b = '';
    process.stdin.on('data', (c) => {
      b += c;
    });
    process.stdin.on('end', () => {
      r(b);
    });
  });
  const results = JSON.parse(raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1));

  const byModule = new Map();
  for (const file of results) {
    for (const m of file.messages) {
      if (m.ruleId !== rule) continue;
      const mod = /["'`]([^"'`]+)["'`]/.exec(m.message)?.[1] ?? m.message.slice(0, 60);
      const e = byModule.get(mod) ?? { count: 0, files: new Set() };
      e.count++;
      e.files.add(file.filePath);
      byModule.set(mod, e);
    }
  }

  const rows = [...byModule].sort((a, b) => b[1].count - a[1].count);
  console.log(`\n${'NAME'.padEnd(44)}${'HITS'.padEnd(7)}FILES`);
  console.log('-'.repeat(62));
  for (const [mod, e] of rows) {
    console.log(mod.padEnd(44) + String(e.count).padEnd(7) + e.files.size);
  }
  console.log(`\n${rows.length} distinct names reported by ${rule}\n`);
}

await main();

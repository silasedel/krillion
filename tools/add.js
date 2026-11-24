#!/usr/bin/env node
// Append answers to a question in place: node tools/add.js <question-id> "Name|score|alias" ...
const fs = require('fs'), path = require('path');
const [id, ...entries] = process.argv.slice(2);
const dir = path.join(__dirname, '..', 'data', 'questions');
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
  const p = path.join(dir, f); let s = fs.readFileSync(p, 'utf8');
  const i = s.search(new RegExp(`id:\\s*"${id}"`)); if (i < 0) continue;
  const j = s.indexOf('a:[', i); if (j < 0) { console.error('no answer array'); process.exit(1); }
  const ins = entries.map(e => JSON.stringify(e) + ',').join('');
  s = s.slice(0, j + 3) + ins + s.slice(j + 3); fs.writeFileSync(p, s);
  console.log(`added ${entries.length} to ${id} in ${f}`); process.exit(0);
}
console.error('question not found'); process.exit(1);

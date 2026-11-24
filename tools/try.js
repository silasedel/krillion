#!/usr/bin/env node
// Try answers against a question exactly as the game judges them.
// Usage: node tools/try.js <question-id> "answer one" "answer two" ...
//    or: node tools/try.js <question-id> --file answers.txt   (one answer per line)
const fs = require('fs'), path = require('path'), vm = require('vm');
const M = require('../js/match.js');
const [id, ...rest] = process.argv.slice(2);
if (!id) { console.error('usage: node tools/try.js <question-id> answers...'); process.exit(1); }
const ctx = { window: {} }; ctx.window.KRILLION = { questions: [], add(l) { this.questions.push(...l); } }; ctx.KRILLION = ctx.window.KRILLION;
vm.createContext(ctx);
const dir = path.join(__dirname, '..', 'data', 'questions');
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) { try { vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx); } catch (e) {} }
const q = ctx.KRILLION.questions.find(x => x.id === id);
if (!q) { console.error('no question ' + id); process.exit(1); }
let answers = rest;
if (rest[0] === '--file') answers = fs.readFileSync(rest[1], 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
console.log(`${q.id}: ${q.q}  (${q.a.length} answers)`);
let rejected = 0;
for (const a of answers) {
  const r = M.matchExact(q, a) || M.matchContained(q, a);
  const s = !r && M.suggest(q, a);
  if (r) console.log(`  ok   ${a}  ->  ${r.answer.name} (${r.contained ? M.containedScore(r.answer.score) + ' via contained ' + r.answer.score : r.answer.score})`);
  else if (s) console.log(`  ~    ${a}  ->  would suggest "${s.answer.name}"`);
  else { rejected++; console.log(`  MISS ${a}`); }
}
console.log(`${rejected} rejected of ${answers.length}`);

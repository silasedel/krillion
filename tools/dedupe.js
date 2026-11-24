#!/usr/bin/env node
// Merge answers in the same question that share a normalised canonical name (keeps the first entry's
// score unless a duplicate is the question's 100; unions aliases). Rewrites only affected a-arrays.
const fs = require('fs'), path = require('path'), vm = require('vm');
const M = require('../js/match.js');
const dir = path.join(__dirname, '..', 'data', 'questions');
let total = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
  const p = path.join(dir, f); let src = fs.readFileSync(p, 'utf8');
  const ctx = { window: {} }; ctx.window.KRILLION = { questions: [], add(l) { this.questions.push(...l); } }; ctx.KRILLION = ctx.window.KRILLION;
  vm.createContext(ctx); vm.runInContext(src, ctx);
  for (const q of ctx.KRILLION.questions) {
    const seen = new Map(); const out = []; let changed = false;
    for (const raw of q.a) {
      const parts = raw.split('|'); const key = M.norm(parts[0].replace(/^!/, ''));
      if (!seen.has(key)) { seen.set(key, out.length); out.push(parts); continue; }
      const keep = out[seen.get(key)]; changed = true; total++;
      if (parts[1] === '100') keep[1] = '100';
      for (const al of parts.slice(2)) if (!keep.slice(2).some(x => M.norm(x) === M.norm(al))) keep.push(al);
    }
    if (!changed) continue;
    const i = src.search(new RegExp(`id:\\s*"${q.id}"`)); const j = src.indexOf('a:[', i);
    let depth = 0, k = j + 2; for (; k < src.length; k++) { if (src[k] === '[') depth++; else if (src[k] === ']') { depth--; if (!depth) break; } }
    src = src.slice(0, j + 2) + JSON.stringify(out.map(x => x.join('|'))) + src.slice(k + 1);
  }
  fs.writeFileSync(p, src);
}
console.log('merged duplicates:', total);

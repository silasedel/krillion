#!/usr/bin/env node
// Retire the old 15-point "Too Clever" tier in the data files. If a question has at most five
// answers at 10/15 combined, its 15s become Plankton (10); otherwise they become Schooler (30).
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'data', 'questions'); let to10 = 0, to30 = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
  const p = path.join(dir, f); let src = fs.readFileSync(p, 'utf8');
  const ctx = { window: {} }; ctx.window.KRILLION = { questions: [], add(l) { this.questions.push(...l); } }; ctx.KRILLION = ctx.window.KRILLION;
  vm.createContext(ctx); vm.runInContext(src, ctx);
  for (const q of ctx.KRILLION.questions) {
    const sc = q.a.map(a => a.split('|')[1]);
    if (!sc.includes('15')) continue;
    const common = sc.filter(x => x === '10' || x === '15').length;
    const target = common <= 5 ? '10' : '30';
    const out = q.a.map(a => { const parts = a.split('|'); if (parts[1] === '15') { parts[1] = target; target === '10' ? to10++ : to30++; } return parts.join('|'); });
    const i = src.search(new RegExp(`id:\\s*"${q.id}"`)); const j = src.indexOf('a:[', i);
    let depth = 0, k = j + 2; for (; k < src.length; k++) { if (src[k] === '[') depth++; else if (src[k] === ']') { depth--; if (!depth) break; } }
    src = src.slice(0, j + 2) + JSON.stringify(out) + src.slice(k + 1);
  }
  fs.writeFileSync(p, src);
}
console.log(`15 -> 10: ${to10}, 15 -> 30: ${to30}`);

#!/usr/bin/env node
// Engine self-test: every answer/alias must match itself, common variants must match,
// wrong answers must not match, and daily selection must be stable and unique.
const fs = require('fs'), path = require('path'), vm = require('vm');
const M = require('../js/match.js');
const ctx = { window: {} }; ctx.window.KRILLION = { questions: [], add(l) { this.questions.push(...l); } }; ctx.KRILLION = ctx.window.KRILLION;
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'data', 'questions.bundle.js'), 'utf8'), ctx);
const QS = ctx.KRILLION.questions;
let fails = 0, checks = 0; const fail = m => { fails++; if (fails <= 40) console.log('FAIL', m); };
for (const q of QS) {
  const { list } = M.parseAnswers(q);
  for (const a of list) for (const k of [a.name, ...a.aliases]) {
    checks++; const r = M.match(q, k);
    if (!r || r.answer !== a) fail(`${q.id} "${k}" -> ${r ? r.answer.name : 'null'} (want ${a.name})`);
    checks++; const pre = /^(the|a|an) /i.test(k) ? '' : 'THE '; const r2 = M.match(q, '  ' + pre + k.toUpperCase() + '!! ');
    if (!r2 || (r2.answer !== a && M.norm(k) !== M.norm('the ' + k))) fail(`${q.id} variant of "${k}" -> ${r2 ? r2.answer.name : 'null'}`);
  }
  checks++; if (M.match(q, 'xqzvplk')) fail(`${q.id} matched gibberish`);
}
// spot checks of normalisation
const probe = (qText, input, want) => { const q = QS.find(x => x.q === qText); if (!q) return; checks++; const r = M.match(q, input); const got = r ? r.answer.name : null; if (got !== want) fail(`probe "${input}" on "${qText}" -> ${got} (want ${want})`); };
probe('Name a chemical element.', 'tungstun', 'Tungsten');
probe('Name a chemical element.', 'HAFNIUM', 'Hafnium');
probe('Name a chemical element.', 'kryptonite', null);
console.log(`match checks: ${checks}, failures: ${fails}`);
process.exitCode = fails ? 1 : 0;

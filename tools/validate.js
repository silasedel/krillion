#!/usr/bin/env node
// Usage: node tools/validate.js [files...]   (defaults to all data/questions/*.js)
const fs = require('fs'), path = require('path'), vm = require('vm');
const SCORES = new Set([10, 30, 60, 85, 100]); // the 15 "Too Clever" tier is retired
const DIFFS = new Set(['easy', 'medium', 'hard']);
const PACKS = new Set(['geography', 'movies', 'sports', 'gaming', 'science', 'music', 'language', 'general', 'pop', 'fun']);
const norm = require('../js/match.js').norm; // same normalisation the game uses
let files = process.argv.slice(2);
const dir = path.join(__dirname, '..', 'data', 'questions');
if (!files.length) files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort().map(f => path.join(dir, f));
const ctx = { window: {} }; ctx.window.KRILLION = { questions: [], add(l) { for (const q of l) { q.__file = cur; this.questions.push(q); } } };
ctx.KRILLION = ctx.window.KRILLION; let cur = '';
vm.createContext(ctx);
for (const f of files) { cur = path.basename(f); try { vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }); } catch (e) { console.error('PARSE ERROR', f, e.message); process.exitCode = 1; } }
const qs = ctx.KRILLION.questions; const errors = [], warns = [];
const ids = new Map(), texts = new Map();
const stats = { byFile: {}, byPack: {}, byCat: {}, byDiff: {}, answers: 0 };
for (const q of qs) {
  const where = `${q.__file}:${q.id}`;
  if (!q.id || typeof q.id !== 'string') errors.push(`${where} missing id`);
  if (ids.has(q.id)) errors.push(`${where} duplicate id (also ${ids.get(q.id)})`); ids.set(q.id, q.__file);
  if (!q.q || q.q.length < 8) errors.push(`${where} bad question text`);
  const tk = norm(q.q || '');
  if (texts.has(tk)) errors.push(`${where} duplicate question "${q.q}" (also ${texts.get(tk)})`); texts.set(tk, where);
  if (!q.cat) errors.push(`${where} missing cat`);
  if (!DIFFS.has(q.diff)) errors.push(`${where} bad diff ${q.diff}`);
  if (!PACKS.has(q.pack)) errors.push(`${where} bad pack ${q.pack}`);
  if (!Array.isArray(q.a) || q.a.length < 6) errors.push(`${where} needs >= 6 answers (has ${q.a && q.a.length})`);
  const seen = new Map(); const tiers = new Set(); const names = new Set();
  for (const raw of q.a || []) {
    const parts = String(raw).split('|').map(s => s.trim());
    const [name, sc, ...aliases] = parts; const score = Number(sc);
    if (!name) errors.push(`${where} empty answer "${raw}"`);
    if (!SCORES.has(score)) errors.push(`${where} invalid score in "${raw}"`);
    tiers.add(score);
    const nn = norm((name || '').replace(/^!/, '')); if (names.has(nn)) errors.push(`${where} answer listed twice: "${name}" (run node tools/dedupe.js)`); names.add(nn);
    for (const k of [name, ...aliases]) {
      const n = norm(k || ''); if (!n) { errors.push(`${where} empty alias in "${raw}"`); continue; }
      if (seen.has(n) && seen.get(n) !== name) errors.push(`${where} duplicate answer key "${k}" (${seen.get(n)} vs ${name})`);
      else if (seen.has(n) && k !== name) warns.push(`${where} redundant alias "${k}"`);
      seen.set(n, name);
    }
    stats.answers++;
  }
  const n100 = (q.a || []).filter(r => Number(String(r).split('|')[1]) === 100).length;
  if (n100 !== 1) errors.push(`${where} must have exactly one 100-point answer (has ${n100})`);
  if (tiers.has(15)) tiers.add(10); // retired 'Too Clever' tier counts as Plankton
  const missing = [10, 30, 60, 85, 100].filter(sc => !tiers.has(sc));
  if (missing.length) errors.push(`${where} missing rarity tiers: ${missing.join(', ')}`);
  stats.byFile[q.__file] = (stats.byFile[q.__file] || 0) + 1;
  stats.byPack[q.pack] = (stats.byPack[q.pack] || 0) + 1;
  stats.byCat[q.cat] = (stats.byCat[q.cat] || 0) + 1;
  stats.byDiff[q.diff] = (stats.byDiff[q.diff] || 0) + 1;
}
const verbose = process.env.VERBOSE;
if (warns.length) console.log(`${warns.length} warnings` + (verbose ? ':\n  ' + warns.join('\n  ') : ' (VERBOSE=1 to list)'));
if (errors.length) { console.log(`${errors.length} ERRORS:\n  ` + errors.slice(0, 200).join('\n  ')); process.exitCode = 1; }
console.log(JSON.stringify(stats, null, 1));
console.log(`TOTAL QUESTIONS: ${qs.length}   TOTAL ANSWERS: ${stats.answers}   ${errors.length ? 'FAILED' : 'OK'}`);

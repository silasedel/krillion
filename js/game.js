// Krillion — game logic, modes, persistence and UI.
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const { TIERS, tierOf, match, parseAnswers } = window.Match;

  // tier icons in their natural colors (Too Clever borrows the fish, tinted green)
  const ICON_SPR = { plankton: ['bubbles'], clever: ['fish2', '~#88bfe0'], schooler: ['fish2'], rare: ['squidIcon'], deep: ['angler'], million: ['shrimpGold'] };
  ICON_SPR.none = ['silhouette', '#4a5b72'];
  const READ_MS = 3000, ANSWER_MS = 25000, PER_GAME = 7, MAX_SCORE = 700;
  const EPOCH = '2026-09-01'; // Daily Dive #1
  const PACKS = [
    { key: 'geography', name: 'Geography', blurb: 'Countries, capitals, rivers, peaks and every corner of the map.' },
    { key: 'movies', name: 'Movies & TV', blurb: 'Directors, franchises, characters and the small screen.' },
    { key: 'sports', name: 'Sports', blurb: 'Teams, tournaments, legends and the rules of the game.' },
    { key: 'gaming', name: 'Gaming', blurb: 'Pokémon, Minecraft, Nintendo, consoles and classics.' },
    { key: 'science', name: 'Science & Nature', blurb: 'Elements, planets, the human body and the animal kingdom.' },
    { key: 'music', name: 'Music', blurb: 'Instruments, bands, albums, composers and musicals.' },
    { key: 'language', name: 'Language & Lit', blurb: 'Words, alphabets, languages and literature.' },
    { key: 'pop', name: 'Pop Culture', blurb: 'Celebrities, internet, apps, snacks and everything trending.' },
    { key: 'fun', name: 'Fun & Random', blurb: 'Things that use suction, junk-drawer finds, Minecraft blocks and more.' },
  ];
  const ALL_PACKS = [...PACKS.map(p => p.key), 'general'];
  const FUN_PACKS = ['pop', 'fun'];                              // every dive gets one of each
  const CORE_PACKS = ALL_PACKS.filter(p => !FUN_PACKS.includes(p) && p !== 'science');
  const DIFF_RANK = { easy: 0, medium: 1, hard: 2 };

  // ---------- question pool ----------
  const QS = (window.KRILLION.questions || []).slice().sort((a, b) => a.id < b.id ? -1 : 1);
  // difficulty re-rated for a casual teen / young-adult audience (data/difficulty.js)
  const DIFF_OVERRIDE = window.KRILLION.difficulty || {};
  QS.forEach(q => { if (DIFF_OVERRIDE[q.id]) q.diff = DIFF_OVERRIDE[q.id]; });
  // plain-language rewrites of confusing prompts (data/wording.js)
  const WORDING = window.KRILLION.wording || {};
  QS.forEach(q => { if (WORDING[q.id]) q.q = WORDING[q.id]; });
  // Daily & Unlimited: easy only. Themed packs: 3 easy, 3 medium, 1 hard.
  const MIX = ['easy', 'easy', 'easy', 'easy', 'easy', 'easy', 'easy']; // Daily & Unlimited: only questions ~90% of players can answer
  const PACK_MIX = ['easy', 'easy', 'easy', 'medium', 'medium', 'medium', 'hard'];
  // abstract "Name something that…" prompts: fun in small doses, at most one per dive
  const isVague = q => /^(name|give) (something|anything|a thing|an object|an item)\b/i.test(q.q);
  const FALLBACK = { easy: ['easy', 'medium', 'hard'], medium: ['medium', 'easy', 'hard'], hard: ['hard', 'medium', 'easy'] };
  const BY_ID = new Map(QS.map(q => [q.id, q]));

  // ---------- RNG ----------
  function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(arr, r = Math.random) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------- dates ----------
  const pad = n => String(n).padStart(2, '0');
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const todayKey = () => dateKey(new Date());
  const dayIndex = k => Math.round((parseKey(k) - parseKey(EPOCH)) / 86400000);
  const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d); };
  const prettyDate = k => parseKey(k).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  function msToMidnight() { const n = new Date(); const m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); return m - n; }
  function hms(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; }

  // ---------- daily selection (deterministic, same for everyone) ----------
  const packOrderCache = {};
  function packOrder(p) {
    if (!packOrderCache[p]) packOrderCache[p] = shuffle(QS.filter(q => q.pack === p), rng(strHash('krillion-pack-v1-' + p)));
    return packOrderCache[p];
  }
  function dailyIds(key) {
    const d = Math.max(0, dayIndex(key));
    const r = rng(strHash('krillion-daily-v1-' + key));
    // one pop-culture + one fun/random prompt every day, plus five from the rotating core packs
    // ...plus one science/school-subject prompt every day, and four from the rotating core packs
    const core = shuffle(CORE_PACKS, rng(strHash('krillion-core-v3-' + Math.floor(d / 7))));
    const start = (d % 7) * 4;
    const chosen = shuffle([...FUN_PACKS, 'science', ...Array.from({ length: 4 }, (_, i) => core[(start + i) % core.length])], r);
    const picks = [], used = new Map();
    chosen.forEach((p, slot) => {
      const ord = packOrder(p); if (!ord.length) return;
      const n = used.get(p) || 0; used.set(p, n + 1);
      const start = (d * 2 + n) % ord.length;
      for (const want of FALLBACK[MIX[slot]]) {
        let q = null;
        const vagueUsed = picks.some(isVague);
        for (let k = 0; k < ord.length; k++) { const c = ord[(start + k) % ord.length]; if (c.diff === want && !picks.includes(c) && !(vagueUsed && isVague(c))) { q = c; break; } }
        if (q) { picks.push(q); return; }
      }
    });
    // top up if a pack is empty
    let k = 0; while (picks.length < PER_GAME && k < QS.length) { const q = QS[(d * 7 + k++) % QS.length]; if (!picks.includes(q)) picks.push(q); }
    return picks.slice(0, PER_GAME).sort((a, b) => DIFF_RANK[a.diff] - DIFF_RANK[b.diff]).map(q => q.id);
  }
  function randomIds(pack) {
    const recent = new Set(store.recent);
    let pool = QS.filter(q => !pack || q.pack === pack);
    let fresh = pool.filter(q => !recent.has(q.id));
    if (fresh.length < PER_GAME) { // everything seen: prefer the least recently played
      const pos = new Map(store.recent.map((id, i) => [id, i]));
      fresh = pool.slice().sort((a, b) => (pos.get(a.id) ?? -1) - (pos.get(b.id) ?? -1)).slice(0, Math.max(PER_GAME * 3, 20));
    }
    const sh0 = shuffle(fresh); const picks = [];
    // hold to the difficulty mix: drop questions harder than the dive allows
    const mix = pack ? PACK_MIX : MIX;
    const allowHard = !!pack;
    let vagueSeen = false;
    const sh = sh0.filter(q => allowHard || q.diff !== 'hard').filter(q => { if (pack || !isVague(q)) return true; if (vagueSeen) return false; vagueSeen = true; return true; });
    if (!pack) { // variety: two fun/pop prompts, then different packs
      const used = new Set();
      for (const fp of [...FUN_PACKS, 'science']) { const q = sh.find(x => x.pack === fp && !picks.includes(x)); if (q) picks.push(q); }
      const q3 = sh.find(x => FUN_PACKS.includes(x.pack) && !picks.includes(x)); if (q3 && Math.random() < 0.6) picks.push(q3);
      picks.forEach(q => used.add(q.pack));
      for (const q of sh) { if (picks.length >= PER_GAME) break; if (!used.has(q.pack)) { used.add(q.pack); picks.push(q); } }
    }
    if (pack) {
      for (const want of mix) { for (const w of FALLBACK[want]) { const q = sh.find(x => x.diff === w && !picks.includes(x)); if (q) { picks.push(q); break; } } }
    } else {
      // Unlimited: easy questions only
      for (let i = picks.length - 1; i >= 0; i--) if (picks[i].diff !== 'easy') picks.splice(i, 1);
      for (const q of sh) { if (picks.length >= PER_GAME) break; if (!picks.includes(q) && q.diff === 'easy') picks.push(q); }
    }
    for (const q of sh0) { if (picks.length >= PER_GAME) break; if (!picks.includes(q)) picks.push(q); }
    return picks.sort((a, b) => DIFF_RANK[a.diff] - DIFF_RANK[b.diff]).map(q => q.id);
  }

  // ---------- persistence ----------
  const SKEY = 'krillion.v1';
  const DEFAULTS = () => ({ v: 1, settings: { sound: true, volume: 0.5, ambience: true, motion: 'full', showMeta: true }, daily: {}, archive: {}, history: [], recent: [], active: null, tiers: {}, seenHelp: false });
  let store = DEFAULTS();
  function load() {
    try { const raw = localStorage.getItem(SKEY); if (raw) { const s = JSON.parse(raw); store = Object.assign(DEFAULTS(), s); store.settings = Object.assign(DEFAULTS().settings, s.settings || {}); } } catch (e) { /* private mode */ }
  }
  function save() { try { localStorage.setItem(SKEY, JSON.stringify(store)); } catch (e) {} }

  // ---------- game state ----------
  let G = null; // active game
  let tickTimer = null, lastTickSec = -1;

  function newGame(mode, key) {
    const ids = mode === 'daily' || mode === 'archive' ? dailyIds(key) : randomIds(mode === 'pack' ? key : null);
    return { mode, key, ids, idx: 0, results: [], score: 0, depth: 0, phase: 'answering', phaseEnd: Date.now() + ANSWER_MS, input: '', tries: [], startedAt: Date.now() };
  }
  const curQ = () => BY_ID.get(G.ids[G.idx]);

  function startGame(mode, key) {
    Sound.unlock();
    if (G) { if (G.mode === mode && G.key === key && mode !== 'unlimited') return showGame(); return leaveThen(() => startGame(mode, key)); }
    if (mode === 'daily') {
      key = todayKey();
      if (store.daily[key]) { return showResults(store.daily[key]); }
    }
    G = newGame(mode, key);
    store.active = G; save();
    Sound.start();
    Ocean.setDepth(0, { instant: true });
    showGame(true);
    beginQuestion(0, true);
  }

  const INTRO_MS = 2200;
  function beginQuestion(i, fresh) {
    G.idx = i; G.input = ''; G.tries = [];
    if (fresh) { // first prompt: the shrimp dives off the boat before the clock starts
      G.phase = 'intro'; G.phaseEnd = Date.now() + INTRO_MS;
      Ocean.setView('intro', true); Ocean.setShrimpX(0.8);
      Ocean.setDepth(-250, { instant: true }); Ocean.setDepth(-180, { duration: INTRO_MS - 200 });
    } else { G.phase = 'answering'; G.phaseEnd = Date.now() + ANSWER_MS; Sound.go(); }
    save(); renderQuestion();
  }

  function setPhase(p, ms) { G.phase = p; G.phaseEnd = ms ? Date.now() + ms : 0; save(); }

  function tick() {
    if (!G || G.pausedLeft !== undefined) return;
    const now = Date.now();
    if (G.phase === 'reading') { setPhase('answering', ANSWER_MS); renderPhase(); // legacy saved state
    } else if (G.phase === 'intro') {
      const left = G.phaseEnd - now; $('#intro-n').textContent = Math.max(1, Math.ceil(left / 1000));
      if (left <= 0) { setPhase('answering', ANSWER_MS); Sound.go(); Ocean.setView('game'); Ocean.setShrimpX(null); Ocean.setDepth(0, { duration: 900 }); renderPhase(); }
    } else if (G.phase === 'answering') {
      const left = Math.max(0, G.phaseEnd - now);
      const frac = left / ANSWER_MS; const sec = Math.ceil(left / 1000);
      $('#timer-num').textContent = sec;
      $('#timer-ring').style.strokeDashoffset = String(157.08 * (1 - frac));
      $('#timer-hand').setAttribute('transform', `rotate(${(-360 * (1 - frac)).toFixed(1)} 32 32)`);
      $('#time-fill').style.width = `${frac * 100}%`;
      const urgent = left <= 5000;
      $('#timer').classList.toggle('urgent', urgent); $('#time-fill').classList.toggle('urgent', urgent);
      if (sec !== lastTickSec && urgent && sec > 0) { lastTickSec = sec; Sound.tick(true); }
      if (left <= 0) timeUp();
    }
  }

  function submit() {
    if (!G || G.phase !== 'answering') return;
    const inp = $('#answer'); const val = inp.value.trim();
    if (!val) { shake(); return; }
    const n = window.Match.norm(val);
    // second Enter on a suggestion accepts it
    if (pendingSuggest && pendingSuggest.n === n) { const a = pendingSuggest.answer, typed = pendingSuggest.typed, lb = pendingSuggest.label; clearSuggest(); return accept(a, typed, lb !== a.name ? lb : undefined); }
    const m = window.Match.matchExact(curQ(), val);
    if (m) return accept(m.answer, val, m.label && m.label !== m.answer.name ? m.label : undefined); // show the name they used
    const mc = window.Match.matchContained(curQ(), val);
    if (mc) return accept(mc.answer, val, titleCase(val), window.Match.containedScore(mc.answer.score));
    const sg = window.Match.suggest(curQ(), val);
    if (sg) {
      // fill the correction into the box; submitting again confirms it, editing cancels it
      // show the closest name the player was aiming at ("quen" -> "Qwen"), not necessarily the official one
      const fix = sg.label || sg.answer.name;
      pendingSuggest = { n: window.Match.norm(fix), answer: sg.answer, typed: val, label: fix };
      $('#sg-typed').textContent = `“${val}”`; $('#sg-fix').textContent = `“${fix}”`;
      $('#suggest-box').hidden = false; $('#feedback').textContent = '';
      inp.value = fix; G.input = inp.value; save();
      inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); Sound.dup();
      return;
    }
    if (G.tries.some(t => window.Match.norm(t) === n)) { feedback(`Already tried "${val}".`, 'warn'); Sound.dup(); }
    else { G.tries.push(val); feedback(`"${val}" isn't on our list. Try again!`, 'bad'); Sound.wrong(); renderTries(); }
    shake(); inp.select(); G.input = inp.value; save(); // keep the wrong answer in the box (selected, so typing replaces it)
  }

  let pendingSuggest = null;
  function clearSuggest() { pendingSuggest = null; $('#suggest-box').hidden = true; }
  const titleCase = s => s.trim().replace(/\s+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  function accept(ans, input, display, scoreOverride) {
    clearSuggest();
    if (scoreOverride) ans = Object.assign({}, ans, { score: scoreOverride });
    const t = tierOf(ans.score);
    // display: what the player typed when it was a longer phrase containing a valid answer
    G.results[G.idx] = { id: G.ids[G.idx], answer: display || ans.name, matched: ans.name, input, score: ans.score, tries: G.tries.slice() };
    G.sinkFrom = G.depth; G.score += ans.score; G.depth += t.depth;
    store.tiers[ans.score] = (store.tiers[ans.score] || 0) + 1;
    Sound.correct(ans.score);
    sink();
  }

  function miss(reason) {
    G.results[G.idx] = { id: G.ids[G.idx], answer: null, input: G.tries[G.tries.length - 1] || '', score: 0, tries: G.tries.slice(), reason };
    setPhase('reveal'); save();
    Sound.miss();
    renderReveal(true);
  }

  function timeUp() {
    if (!G || G.phase !== 'answering') return;
    const val = ($('#answer').value || G.input || '').trim();
    if (pendingSuggest && val && window.Match.norm(val) === pendingSuggest.n) { const sa = pendingSuggest.answer; clearSuggest(); return accept(sa, val); }
    if (val) { const m = match(curQ(), val); if (m) return accept(m.answer, val); const mc = window.Match.matchContained(curQ(), val); if (mc) return accept(mc.answer, val, titleCase(val), window.Match.containedScore(mc.answer.score)); if (!G.tries.includes(val)) G.tries.push(val); }
    miss('time');
  }
  function skip() { if (G && G.phase === 'answering') miss('skip'); else if (G && G.phase === 'reading') { setPhase('answering', ANSWER_MS); renderPhase(); } }

  function next() {
    if (!G || G.phase !== 'reveal') return;
    Sound.click();
    if (G.idx < PER_GAME - 1) beginQuestion(G.idx + 1); else finish();
  }

  function finish(silent) {
    const entry = { mode: G.mode, key: G.key, ids: G.ids, results: G.ids.map((id, i) => G.results[i] || { id, answer: null, input: '', score: 0, tries: [], reason: 'surfaced' }), score: G.score, depth: G.depth, at: Date.now() };
    if (G.mode === 'daily') { entry.dayNo = dayIndex(G.key) + 1; store.daily[G.key] = entry; }
    if (G.mode === 'archive') { const a = store.archive[G.key] || { best: 0, plays: 0 }; a.plays++; a.best = Math.max(a.best, entry.score); store.archive[G.key] = a; entry.dayNo = dayIndex(G.key) + 1; }
    store.history.push(entry); if (store.history.length > 400) store.history.splice(0, store.history.length - 400);
    store.recent = [...store.recent.filter(id => !G.ids.includes(id)), ...G.ids].slice(-600);
    store.active = null; G = null; save();
    if (silent) return;
    Sound.finish();
    showResults(entry, true);
  }

  function abandon(silent) {
    if (!G) return;
    if (G.phase !== 'reveal') { G.results[G.idx] = G.results[G.idx] || { id: G.ids[G.idx], answer: null, input: '', score: 0, tries: G.tries.slice(), reason: 'surfaced' }; }
    finish(silent);
  }
  // Throw away a practice dive (Unlimited / Pack / Archive) without recording it.
  function discardDive() { store.active = null; G = null; save(); Ocean.setDepth(0, { instant: true }); }
  const DAILY_LEAVE = "Leave today's Daily Dive? You only get one attempt a day, so it ends now and scores what you have so far.";
  // Leave the current dive (confirming when needed), then run fn.
  function leaveThen(fn) {
    if (!G) return fn();
    if (G.mode === 'daily') return confirmBox(DAILY_LEAVE, () => { abandon(true); fn(); });
    const answered = G.results.filter(Boolean).length;
    if (!answered) { discardDive(); return fn(); }
    confirmBox('Quit this dive? Its progress will be thrown away.', () => { discardDive(); fn(); });
  }
  function quitDive() { Sound.click(); leaveThen(showTitle); }
  function restartDive() {
    if (!G) return;
    Sound.click();
    if (G.mode === 'daily') return toast("The Daily Dive can't be restarted. It's one attempt per day.");
    const { mode, key } = G;
    const go = () => { discardDive(); startGame(mode, key); };
    if (!G.results.filter(Boolean).length) return go();
    confirmBox('Restart with 7 fresh prompts? This dive will be thrown away.', go);
  }

  // ---------- rendering: screens ----------
  function show(id) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + id));
    document.body.dataset.screen = id;
    $('#gauge').classList.toggle('active', id === 'game');
  }

  function showTitle() {
    if (G) return showGame();
    show('title'); Ocean.setView('title'); updateTitle();
    setTimeout(() => $('#btn-begin').focus({ preventScroll: true }), 50);
  }
  function updateTitle() {
    const k = todayKey(); const done = store.daily[k];
    $('#begin-label').textContent = G ? 'RESUME DESCENT' : done ? "TODAY'S DIVE LOG" : 'BEGIN DESCENT';
    const streak = streaks().current;
    $('#daily-note').innerHTML = done
      ? `DIVE #${dayIndex(k) + 1} · <b>${done.score}</b> PTS · NEXT <b class="cd">${hms(msToMidnight())}</b>`
      : `DIVE #${dayIndex(k) + 1}${streak ? ` · STREAK <b>${streak}</b>` : ''}`;
  }

  function showGame(fromTitle) {
    show('game'); Ocean.setView('game');
    Ocean.setDepth(G.depth, { instant: true });
    buildGauge(); renderHud(); renderQuestion(true);
  }

  function renderHud(depthOverride) {
    if (!G) return;
    const d = depthOverride ?? G.depth;
    $('#depth-val').textContent = fmt(Math.max(0, d));
    $('#score-val').textContent = G.score;
    const pips = $('#pips'); pips.innerHTML = ''; pips.dataset.label = `PROMPT ${G.idx + 1} OF ${PER_GAME}`;
    for (let i = 0; i < PER_GAME; i++) {
      const r = G.results[i]; const el = document.createElement('span'); el.className = 'pip';
      if (r) { if (r.score) { el.classList.add('done'); el.style.setProperty('--c', tierOf(r.score).color); } else el.classList.add('miss'); }
      else if (i === G.idx) el.classList.add('cur');
      pips.appendChild(el);
    }
  }

  function renderQuestion(restoring) {
    const q = curQ(); if (!q) return;
    $('#prompt-no').textContent = `PROMPT ${G.idx + 1} OF ${PER_GAME}`;
    $('#q-meta').textContent = store.settings.showMeta ? `${q.cat} · ${q.diff}`.toUpperCase() : '';
    $('#q-text').textContent = q.q;
    $('#answer').value = G.phase === 'answering' ? (G.input || '') : '';
    clearSuggest(); $('#feedback').textContent = ''; $('#feedback').className = 'feedback';
    renderTries(); renderHud(); lastTickSec = -1;
    if (G.phase === 'sinking') { Ocean.setDepth(G.depth, { instant: true }); setPhase('reveal'); }
    if (G.phase === 'reveal') renderReveal(false); else renderPhase();
  }
  function renderTries() {
    const ul = $('#tried'); ul.innerHTML = '';
    (G?.tries || []).slice(-6).forEach(t => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
  }

  function renderPhase() {
    const ask = $('#phase-ask'), rev = $('#phase-reveal');
    ask.hidden = false; rev.hidden = true;
    const reading = G.phase === 'reading' || G.phase === 'intro';
    document.body.classList.toggle('intro', G.phase === 'intro');
    $('#answer').disabled = reading; $('#btn-dive').disabled = reading;
    $('#btn-skip').textContent = 'SKIP ▸▸';
    if (!reading) { const inp = $('#answer'); setTimeout(() => inp.focus({ preventScroll: true }), 30); }
    tick();
  }

  function renderReveal(animate) {
    const q = curQ(); const r = G.results[G.idx];
    $('#phase-ask').hidden = true; const rev = $('#phase-reveal'); rev.hidden = false;
    rev.classList.remove('pop'); void rev.offsetWidth; rev.classList.add('pop');
    const { list } = parseAnswers(q);
    const t = r.score ? tierOf(r.score) : null;
    if (t) {
      rev.style.setProperty('--tc', t.color);
      $('#tier-name').textContent = t.name.toUpperCase();
      $('#reveal-answer').textContent = `“${r.answer}”`;
      $('#reveal-pts').innerHTML = `<span class="pts">+${r.score} PTS</span> <span class="dot">·</span> sink ${fmt(t.depth)}m`;
      $('#reveal-blurb').textContent = t.blurb;
    } else {
      rev.style.setProperty('--tc', '#8aa0b8');
      $('#tier-name').textContent = r.reason === 'skip' ? 'SKIPPED' : r.reason === 'surfaced' ? 'SURFACED' : "TIME'S UP";
      $('#reveal-answer').textContent = r.input ? `“${r.input}”` : '—';
      $('#reveal-pts').innerHTML = `<span class="pts">+0 PTS</span> <span class="dot">·</span> no descent`;
      $('#reveal-blurb').textContent = r.reason === 'skip' ? 'Skipped. Every answer is in the dive log at the end.' : 'No catch this time.';
    }
    $('#btn-descend').innerHTML = G.idx < PER_GAME - 1 ? 'DESCEND <span class="tri">▼</span>' : 'SURFACE <span class="tri">▲</span>';
    drawTierIcon(t ? t.key : null);
    document.body.classList.remove('intro');
    renderHud(); if (G.idx === PER_GAME - 1) $('#pips').dataset.label = 'DIVE COMPLETE';
    $('#btn-descend').disabled = false;
    setTimeout(() => $('#btn-descend').focus({ preventScroll: true }), 30);
  }

  // DESCEND: the answer, in its rarity color, is dragged down with the shrimp.
  let sinkTimer = null;
  function sink() {
    const r = G.results[G.idx]; const t = tierOf(r.score);
    setPhase('sinking');
    $('#phase-reveal').hidden = true; $('#phase-ask').hidden = false;
    $('#answer').disabled = true;
    const box = $('#sink'); box.style.setProperty('--tc', t.color);
    $('#sink-text').textContent = `“${r.answer}”`;
    $('#sink-tag').innerHTML = `${iconImg(t.key, 'pix tag-ico')}<span>${t.name.toUpperCase()} · ${r.score}</span>`;
    box.hidden = false; box.classList.remove('go'); void box.offsetWidth; box.classList.add('go');
    document.body.classList.add('sinking');
    Ocean.setShrimpX(0.5);
    const reduced = store.settings.motion === 'reduced';
    const dur = reduced ? 0 : 1500 + t.depth * 1.9;
    setTimeout(() => {
      Ocean.setDepth(G.depth, { duration: dur });
      Sound.descend(dur || 300);
    }, reduced ? 0 : 450);
    clearTimeout(sinkTimer);
    sinkTimer = setTimeout(afterSink, (reduced ? 300 : 450 + dur + 450));
  }
  function afterSink() {
    clearTimeout(sinkTimer);
    $('#sink').hidden = true; document.body.classList.remove('sinking');
    Ocean.setShrimpX(null);
    if (!G || G.phase !== 'sinking') return;
    setPhase('reveal'); renderReveal(true);
  }

  // Depth labels drifting past on either side (zone names left, sea-life notes right).
  const DEPTH_LABELS = [
    [0, 'l', 'the sunlight zone'], [200, 'l', 'the twilight zone'], [1000, 'l', 'the midnight zone'], [4000, 'l', 'the abyssal zone'], [6000, 'l', 'the hadal trench'],
    [70, 'l', 'light begins to fade'], [150, 'r', 'plankton bloom'], [210, 'r', 'most sunlight stops here'], [332, 'r', 'deepest scuba dive ever · 332m'],
    [420, 'l', 'thermocline'], [530, 'r', 'emperor penguins dive this deep'], [700, 'l', 'lanternfish layer'], [850, 'r', 'siphonophore drift zone'],
    [1150, 'r', 'sperm whales hunt below here'], [1500, 'l', 'vampire squid range'], [2200, 'r', 'hydrothermal vents'], [2900, 'l', 'dumbo octopus range'],
    [3700, 'r', 'average ocean depth'], [3800, 'l', 'Titanic wreck · 3,800m'], [4600, 'r', 'abyssal plain'], [5300, 'l', 'tripod fish on stilts'], [6500, 'r', 'snailfish territory'], [6900, 'l', 'trench floor ahead'],
  ];
  function buildDepthLabels() {
    $('#tier-lines').innerHTML = TIERS.slice().reverse().map(t => `<div class="tl" data-d="${t.depth}" style="--tc:${t.color}"><span>${iconImg(t.key, 'pix tag-ico')} ${t.name.toUpperCase()} · ${t.score}</span></div>`).join('');
    const box = $('#depth-labels'); if (box.childElementCount) return;
    box.innerHTML = DEPTH_LABELS.map(([m, side, text]) => `<span class="dl dl-${side}${side === 'l' && /zone|trench/.test(text) ? ' zone' : ''}" data-m="${m}">${side === 'l' ? '—— ' : ''}${esc(text)}${side === 'r' ? ' ——' : ''}</span>`).join('');
  }
  function labelLoop() {
    if (document.body.dataset.screen === 'game') {
      const H = window.innerHeight;
      for (const el of document.querySelectorAll('#depth-labels .dl')) {
        const y = Ocean.depthToScreenY(Number(el.dataset.m));
        if (y < -30 || y > H + 30) { el.style.display = 'none'; continue; }
        el.style.display = ''; el.style.transform = `translateY(${Math.round(y)}px)`;
      }
      // rarity threshold lines below where this answer started sinking
      if (G && document.body.classList.contains('sinking')) {
        for (const el of document.querySelectorAll('#tier-lines .tl')) {
          const y = Ocean.depthToScreenY((G.sinkFrom || 0) + Number(el.dataset.d));
          el.style.display = y < -20 || y > H + 20 ? 'none' : ''; el.style.transform = `translateY(${Math.round(y)}px)`;
        }
      }
      // local depth ruler: a tick every 25m, labels every 100m
      const top = Ocean.screenYToDepth(0), bot = Ocean.screenYToDepth(H);
      const ticks = []; for (let d = Math.ceil(Math.max(0, top) / 25) * 25; d <= bot; d += 25) ticks.push(d);
      const ruler = $('#ruler');
      while (ruler.childElementCount < ticks.length) ruler.appendChild(document.createElement('span'));
      [...ruler.children].forEach((el, i) => {
        const d = ticks[i]; if (d === undefined) { el.style.display = 'none'; return; }
        el.style.display = ''; el.className = d % 100 === 0 ? 'rt major' : 'rt';
        el.textContent = d % 100 === 0 ? (d ? `-${fmt(d)}m` : '0m') : '';
        el.style.transform = `translateY(${Math.round(Ocean.depthToScreenY(d))}px)`;
      });
      $('#gauge-you').style.transform = `translateY(${Math.round(Ocean.shrimpScreen().y)}px)`;
      const sk = $('#sink'); if (!sk.hidden) { const p = Ocean.shrimpScreen(); sk.style.top = `${Math.round(p.y - 46)}px`; /* the shrimp hangs just below, dragging it down */ }
    }
    requestAnimationFrame(labelLoop);
  }

  function drawTierIcon(key) {
    const c = $('#tier-icon'); const ctx = c.getContext('2d');
    const [name, tint, flip] = ICON_SPR[key || 'none'];
    const s = Ocean.sprite(name, tint || undefined); c.width = s.w; c.height = s.h; ctx.clearRect(0, 0, s.w, s.h); ctx.drawImage(flip ? s.f : s.c, 0, 0);
    $('#phase-reveal').dataset.tier = key || 'none';
    const k = Math.max(3, Math.round(46 / s.w)); c.style.width = `${s.w * k}px`; c.style.height = `${s.h * k}px`;
  }

  // depth -> zone banner + gauge during animation
  let lastZone = -1;
  Ocean.onDepth = (d) => {
    if (!G || document.body.dataset.screen !== 'game') return;
    $('#depth-val').textContent = fmt(Math.max(0, d));
    const z = Ocean.zoneIndex(d);
    lastZone = z;
  };
  function zoneBanner(z) {
    const b = $('#zone-banner'); b.innerHTML = `ENTERING<br><b>${z.name.toUpperCase()}</b><span>${fmt(z.from)}m${z.to < 9999 ? '–' + fmt(z.to) + 'm' : '+'}</span>`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }

  function buildGauge() {
    const t = $('#gauge-ticks'); if (!t || t.childElementCount) return;
    for (let m = 0; m <= 7000; m += 1000) { const s = document.createElement('span'); s.style.top = `${(m / 7000) * 100}%`; s.textContent = m === 0 ? '0m' : `${fmt(m)}m`; t.appendChild(s); }
  }

  function feedback(msg, cls) { const f = $('#feedback'); f.textContent = msg; f.className = 'feedback ' + (cls || ''); }
  function shake() { const r = $('#answer-form'); r.classList.remove('shake'); void r.offsetWidth; r.classList.add('shake'); }

  // ---------- results ----------
  let resultsEntry = null;
  const iconCache = {};
  function iconURL(key) {
    if (!iconCache[key]) { const [n, tint, flip] = ICON_SPR[key]; const sp = Ocean.sprite(n, tint || undefined); iconCache[key] = (flip ? sp.f : sp.c).toDataURL(); }
    return iconCache[key];
  }
  const iconImg = (key, cls = 'pix') => `<img class="${cls}" src="${iconURL(key)}" alt="">`;
  // Score bands for a whole dive (out of 700).
  const BEARING = [
    { min: 0, max: 150, tier: 'plankton', label: '0–150', text: 'Plankton. Plenty of ocean left down there.' },
    { min: 151, max: 250, tier: 'schooler', label: '151–250', text: 'Schooler. Swimming with the school.' },
    { min: 251, max: 350, tier: 'rare', label: '251–350', text: 'Rare. Below the thermocline. Nice.' },
    { min: 351, max: 449, tier: 'deep', label: '351–449', text: 'Deep cut. Seriously deep dive.' },
    { min: 450, max: 700, tier: 'million', label: '450+', text: 'One in a krillion. Trench dweller. Absurd.' },
  ];
  const TIER_COLOR = Object.fromEntries(TIERS.map(t => [t.key, t.color]));

  function showResults(entry, fresh) {
    resultsEntry = entry;
    show('results'); Ocean.setView('results');
    $('#screen-results').scrollTop = 0;
    const modeLabel = entry.mode === 'daily' ? `DIVE #${entry.dayNo} COMPLETE`
      : entry.mode === 'archive' ? `ARCHIVE DIVE #${entry.dayNo} COMPLETE`
      : entry.mode === 'pack' ? `${(PACKS.find(p => p.key === entry.key) || {}).name || entry.key} PACK COMPLETE`.toUpperCase() : 'UNLIMITED DIVE COMPLETE';
    $('#res-mode').textContent = modeLabel;
    countUp($('#res-score'), entry.score, fresh ? 900 : 0);
    $('#res-depth').textContent = `-${fmt(entry.depth)}m`;
    $('#res-zone').textContent = entry.depth ? `Reached the ${Ocean.ZONES[Ocean.zoneIndex(entry.depth)].name}` : 'Never left the surface';
    drawDiveChart(entry);
    // bearing
    $('#bearing').innerHTML = BEARING.map(b => {
      const on = entry.score >= b.min && entry.score <= b.max;
      return `<li class="${on ? 'on' : ''}">${iconImg(b.tier)}<span class="b-range" style="color:${TIER_COLOR[b.tier]}">${b.label}</span><span class="b-text">${b.text}</span></li>`;
    }).join('');
    // logbook
    const st = streaks(); const all = store.history;
    $('#st-streak').textContent = st.current; $('#st-played').textContent = all.length;
    $('#st-avg').textContent = all.length ? Math.round(all.reduce((n, h) => n + h.score, 0) / all.length) : 0;
    $('#st-best').textContent = Math.max(0, ...all.map(h => h.score));
    // the catch
    const list = $('#log-list'); list.innerHTML = '';
    entry.results.forEach((r, i) => {
      const q = BY_ID.get(r.id); if (!q) return;
      const t = r.score ? tierOf(r.score) : null;
      const col = t ? t.color : '#4f6079';
      const ans = r.answer ? esc(r.answer) : r.input ? `"${esc(r.input)}"` : (r.reason === 'skip' ? 'skipped' : '—');
      const sub = t ? `<span style="color:${t.color}">${t.name}</span> · sank ${fmt(t.depth)}m` : (r.reason === 'skip' ? 'Skipped' : r.reason === 'surfaced' ? 'Surfaced early' : "Time's up") + ' · no catch';
      const li = document.createElement('li'); li.className = 'catch-row';
      li.innerHTML = `<button class="catch-head" aria-expanded="false"><span class="c-n">${i + 1}</span><span class="c-icon">${iconImg(t ? t.key : 'none')}</span><span class="c-body"><span class="c-q">${esc(q.q.replace(/\.$/, ''))}</span><span class="c-a${r.answer ? '' : ' miss'}">${ans}</span><span class="c-sub">${sub}</span></span><span class="c-p" style="color:${col}">${r.score}</span><span class="c-plus">+</span></button><div class="log-more" hidden></div>`;
      li.querySelector('.catch-head').addEventListener('click', () => toggleLog(li, q, r));
      list.appendChild(li);
    });
    $('#btn-again').textContent = entry.mode === 'pack' ? 'PLAY PACK AGAIN' : entry.mode === 'daily' ? 'PLAY UNLIMITED' : 'PLAY AGAIN';
    updateCountdown();
    setTimeout(() => $('#btn-share').focus({ preventScroll: true }), 60);
  }
  function drawDiveChart(entry) {
    const W = 480, H = 270, L = 34, R = 14, T = 14, B = 30;
    const x = i => L + (i + 0.5) * ((W - L - R) / PER_GAME);
    const y = p => T + (p / 100) * (H - T - B);
    let svg = '';
    for (const p of [0, 25, 50, 75, 100]) {
      svg += `<line x1="${L}" x2="${W - R}" y1="${y(p)}" y2="${y(p)}" class="grid${p === 0 ? ' g0' : ''}"/><text x="${L - 6}" y="${y(p) + 3}" class="ax" text-anchor="end">${p ? '-' + p : '0m'}</text>`;
    }
    entry.results.forEach((r, i) => {
      const t = r.score ? tierOf(r.score) : null; const cx = x(i);
      svg += `<text x="${cx}" y="${H - 8}" class="ax" text-anchor="middle">${i + 1}</text>`;
      if (!t) { svg += `<circle cx="${cx}" cy="${y(0)}" r="4" class="nocatch"/>`; return; }
      const cy = y(r.score);
      svg += `<line x1="${cx}" x2="${cx}" y1="${y(0)}" y2="${cy}" stroke="${t.color}" class="drop" style="--len:${cy - y(0)}"/>`;
      const s = Ocean.sprite(ICON_SPR[t.key][0], ICON_SPR[t.key][1] || undefined); const k = 2;
      svg += `<image href="${iconURL(t.key)}" x="${cx - s.w * k / 2}" y="${cy - s.h * k / 2}" width="${s.w * k}" height="${s.h * k}" class="pix-svg"/>`;
    });
    $('#dive-chart').innerHTML = svg;
  }
  // Expanded round: every accepted answer, filterable by rarity, searchable, scrolls in pages of 100.
  function toggleLog(li, q, r) {
    const more = li.querySelector('.log-more'); const head = li.querySelector('button');
    const open = more.hidden; more.hidden = !open; head.setAttribute('aria-expanded', open); li.classList.toggle('open', open);
    if (!open || more.childElementCount) return;
    const mine = r.matched || r.answer;
    const all = parseAnswers(q).list.filter(a => !a.hidden || a.name === mine)
      .slice().sort((x, y) => (y.score - x.score) || x.name.localeCompare(y.name));
    const SHORT = { million: 'Krillion', deep: 'Deep Cut', rare: 'Rare', schooler: 'Schooler', plankton: 'Plankton' };
    const chips = [`<button class="ab-chip on" data-t="all">All <b>${fmt(all.length)}</b></button>`]
      .concat(TIERS.map(t => `<button class="ab-chip" data-t="${t.score}" style="--c:${t.color}">${SHORT[t.key]} <b>${fmt(all.filter(a => a.score === t.score).length)}</b></button>`));
    more.innerHTML = `${r.tries && r.tries.length ? `<p class="more-tries">Your misses: ${r.tries.map(t => `<s>${esc(t)}</s>`).join(', ')}</p>` : ''}
      <div class="ab-chips">${chips.join('')}</div>
      <input class="ab-search" type="search" placeholder="Search all answers…" aria-label="Search all answers" autocomplete="off" spellcheck="false">
      <div class="ab-list" tabindex="0"></div>
      <div class="ab-foot"><span class="ab-count"></span><span class="ab-more">Scroll for more</span></div>`;
    const list = more.querySelector('.ab-list'); let tier = 'all', query = '', shown = 0, rows = all;
    const row = a => { const t = tierOf(a.score); return `<div class="ab-row${a.name === mine ? ' mine' : ''}">${iconImg(t.key, 'pix ab-ico')}<span class="ab-name">${esc(a.name)}</span><span class="ab-pts" style="color:${t.color}">+${a.score}</span></div>`; };
    const page = () => { const next = rows.slice(shown, shown + 100); list.insertAdjacentHTML('beforeend', next.map(row).join('')); shown += next.length; foot(); };
    const foot = () => { more.querySelector('.ab-count').textContent = `${fmt(shown)} of ${fmt(rows.length)} answers`; more.querySelector('.ab-more').hidden = shown >= rows.length; };
    const apply = () => {
      const n = query ? window.Match.norm(query) : '';
      rows = all.filter(a => (tier === 'all' || a.score === Number(tier)) && (!n || window.Match.norm(a.name).includes(n) || a.aliases.some(al => window.Match.norm(al).includes(n))));
      list.innerHTML = rows.length ? '' : '<p class="ab-empty">No answers match.</p>'; shown = 0; list.scrollTop = 0; page();
    };
    more.querySelectorAll('.ab-chip').forEach(c => c.addEventListener('click', () => { more.querySelectorAll('.ab-chip').forEach(x => x.classList.toggle('on', x === c)); tier = c.dataset.t; apply(); }));
    more.querySelector('.ab-search').addEventListener('input', e => { query = e.target.value.trim(); apply(); });
    list.addEventListener('scroll', () => { if (list.scrollTop + list.clientHeight > list.scrollHeight - 120 && shown < rows.length) page(); });
    apply();
  }
  function countUp(el, to, ms) {
    if (!ms || store.settings.motion === 'reduced') { el.textContent = to; return; }
    const t0 = performance.now();
    const step = now => { const p = Math.min(1, (now - t0) / ms); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  function shareText(e) {
    const sq = { 0: '⬛', 10: '🟦', 15: '🟩', 30: '🟨', 60: '🟧', 85: '🟥', 100: '🟪' };
    const head = e.mode === 'daily' || e.mode === 'archive' ? `KRILLION #${e.dayNo}${e.mode === 'archive' ? ' (archive)' : ''}` : e.mode === 'pack' ? `KRILLION · ${(PACKS.find(p => p.key === e.key) || {}).name} pack` : 'KRILLION · Unlimited';
    return `${head} 🦐\n${e.score}/700 · -${fmt(e.depth)}m\n${e.results.map(r => sq[r.score] || '⬛').join('')}`;
  }
  async function copyShare() {
    if (!resultsEntry) return;
    const txt = shareText(resultsEntry);
    try { await navigator.clipboard.writeText(txt); toast('Result copied to clipboard'); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Result copied to clipboard'); } catch (x) { toast('Copy failed'); } ta.remove(); }
    Sound.click();
  }

  // ---------- stats ----------
  function streaks() {
    const days = Object.keys(store.daily).sort();
    let max = 0, run = 0, prev = null;
    for (const d of days) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; max = Math.max(max, run); prev = d; }
    const t = todayKey(); let cur = 0; let k = store.daily[t] ? t : addDays(t, -1);
    while (store.daily[k]) { cur++; k = addDays(k, -1); }
    return { current: cur, max };
  }
  function statsHtml() {
    const dailies = Object.values(store.daily); const all = store.history;
    const st = streaks();
    const avg = dailies.length ? Math.round(dailies.reduce((s, e) => s + e.score, 0) / dailies.length) : 0;
    const bestDaily = Math.max(0, ...dailies.map(e => e.score));
    const best = Math.max(0, ...all.map(e => e.score));
    const deepest = Math.max(0, ...all.map(e => e.depth));
    const answered = all.reduce((s, e) => s + e.results.filter(r => r.score).length, 0);
    const total = all.reduce((s, e) => s + e.results.length, 0);
    const bins = new Array(7).fill(0); dailies.forEach(e => bins[Math.min(6, Math.floor(e.score / 100))]++);
    const bmax = Math.max(1, ...bins);
    const tmax = Math.max(1, ...TIERS.map(t => store.tiers[t.score] || 0));
    return `
      <div class="stat-grid">
        <div><b>${dailies.length}</b><span>DAILY DIVES</span></div>
        <div><b>${st.current}</b><span>STREAK</span></div>
        <div><b>${st.max}</b><span>MAX STREAK</span></div>
        <div><b>${bestDaily}</b><span>BEST DAILY</span></div>
        <div><b>${avg}</b><span>AVG DAILY</span></div>
        <div><b>${all.length}</b><span>ALL DIVES</span></div>
        <div><b>${best}</b><span>PERSONAL BEST</span></div>
        <div><b>${fmt(deepest)}m</b><span>DEEPEST</span></div>
        <div><b>${total ? Math.round(answered / total * 100) : 0}%</b><span>ANSWERED</span></div>
      </div>
      <h3 class="mh">DAILY SCORE SPREAD</h3>
      <div class="bars">${bins.map((b, i) => `<div class="bar-row"><span>${i * 100}${i === 6 ? '+' : '–' + (i * 100 + 99)}</span><i style="width:${(b / bmax) * 100}%"></i><em>${b}</em></div>`).join('')}</div>
      <h3 class="mh">RARITIES FOUND</h3>
      <div class="bars">${TIERS.map(t => `<div class="bar-row"><span style="color:${t.color}">${t.name}</span><i style="width:${((store.tiers[t.score] || 0) / tmax) * 100}%;background:${t.color}"></i><em>${store.tiers[t.score] || 0}</em></div>`).join('')}</div>
      <p class="fine">Next Daily Dive in <b class="cd">${hms(msToMidnight())}</b></p>
      <button class="btn btn-ghost small" id="btn-reset-stats">RESET STATISTICS</button>`;
  }
  function openStats() {
    openModal('STATISTICS', statsHtml());
    $('#btn-reset-stats').addEventListener('click', () => {
      confirmBox('Reset all statistics, history and streaks? Settings are kept. This cannot be undone.', () => {
        const keep = store.settings; store = DEFAULTS(); store.settings = keep; store.seenHelp = true; if (G) store.active = G; save(); openStats(); toast('Statistics reset');
      });
    });
  }

  // ---------- settings / help ----------
  function openSettings() {
    const s = store.settings;
    openModal('SETTINGS', `
      <label class="set-row"><span>Sound effects</span><input type="checkbox" id="set-sound" ${s.sound ? 'checked' : ''}><i class="tog"></i></label>
      <label class="set-row"><span>Volume</span><input type="range" id="set-vol" min="0" max="1" step="0.05" value="${s.volume}"></label>
      <label class="set-row"><span>Ambient deep-sea hum</span><input type="checkbox" id="set-amb" ${s.ambience ? 'checked' : ''}><i class="tog"></i></label>
      <label class="set-row"><span>Reduced motion</span><input type="checkbox" id="set-motion" ${s.motion === 'reduced' ? 'checked' : ''}><i class="tog"></i></label>
      <label class="set-row"><span>Show category &amp; difficulty</span><input type="checkbox" id="set-meta" ${s.showMeta ? 'checked' : ''}><i class="tog"></i></label>
      <h3 class="mh">KEYBOARD</h3>
      <ul class="keys"><li><kbd>Enter</kbd> begin · dive · descend</li><li><kbd>M</kbd> menu · <kbd>Esc</kbd> close</li><li><kbd>S</kbd> toggle sound (outside the answer box)</li></ul>
      <p class="fine">Question database: <b>${fmt(QS.length)}</b> prompts · <b>${fmt(QS.reduce((n, q) => n + q.a.length, 0))}</b> accepted answers</p>
      <button class="btn btn-ghost small danger" id="btn-wipe">ERASE ALL DATA</button>`);
    $('#set-sound').onchange = e => { s.sound = e.target.checked; applySettings(); save(); };
    $('#set-vol').oninput = e => { s.volume = Number(e.target.value); applySettings(); save(); };
    $('#set-vol').onchange = () => Sound.click();
    $('#set-amb').onchange = e => { s.ambience = e.target.checked; applySettings(); save(); };
    $('#set-motion').onchange = e => { s.motion = e.target.checked ? 'reduced' : 'full'; applySettings(); save(); };
    $('#set-meta').onchange = e => { s.showMeta = e.target.checked; save(); if (G) $('#q-meta').textContent = s.showMeta ? `${curQ().cat} · ${curQ().diff}`.toUpperCase() : ''; };
    $('#btn-wipe').onclick = () => confirmBox('Erase every dive, streak, statistic and setting on this device? This cannot be undone.', () => { try { localStorage.removeItem(SKEY); } catch (e) {} location.reload(); });
  }
  function applySettings() {
    const s = store.settings;
    Sound.setVolume(s.volume); Sound.settings.ambience = s.ambience; Sound.setEnabled(s.sound);
    Ocean.setReduced(s.motion === 'reduced'); document.body.classList.toggle('reduced', s.motion === 'reduced');
    $('#btn-sound use').setAttribute('href', s.sound ? '#i-sound' : '#i-mute');
  }
  function openHelp() {
    openModal('HOW TO PLAY', `
      <p>Every prompt has dozens of right answers. Everyone can name the obvious ones — the goal is to name the <b>rarest</b> answer you can.</p>
      <ul class="rules"><li><b>7 prompts</b> per dive. Each starts with a <b>3-second</b> read, then you have <b>25 seconds</b>.</li>
      <li>Wrong answers cost nothing — keep guessing until the timer runs out. Whatever is in the box when time expires is submitted.</li>
      <li>Rarer answers score more and sink your shrimp deeper. A perfect dive reaches <b>7,000m</b>.</li></ul>
      <table class="tier-table">${TIERS.slice().reverse().map(t => `<tr><td style="color:${t.color}">${t.name}</td><td>+${t.score}</td><td>${fmt(t.depth)}m</td></tr>`).join('')}</table>
      <p class="fine">Rarity tiers are our curated estimate of how likely a typical person is to think of each answer — not live player data.</p>
      <p class="fine"><b>Daily Dive</b>: the same 7 prompts for everyone, one scored attempt a day. <b>Unlimited</b> and <b>Themed Packs</b>: play as much as you like. <b>Archive</b>: replay past dailies.</p>
      <button class="btn btn-wide" data-close>GOT IT</button>`);
  }

  // ---------- archive ----------
  let calMonth = null;
  function showArchive() {
    if (G) return showGame();
    show('archive'); Ocean.setView('menu');
    const t = parseKey(todayKey()); if (!calMonth) calMonth = new Date(t.getFullYear(), t.getMonth(), 1);
    renderCal();
  }
  function renderCal() {
    const first = parseKey(EPOCH); const t = parseKey(todayKey());
    const minM = new Date(first.getFullYear(), first.getMonth(), 1), maxM = new Date(t.getFullYear(), t.getMonth(), 1);
    if (calMonth < minM) calMonth = minM; if (calMonth > maxM) calMonth = maxM;
    $('#cal-prev').disabled = calMonth <= minM; $('#cal-next').disabled = calMonth >= maxM;
    $('#cal-title').textContent = calMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
    const cal = $('#cal'); cal.innerHTML = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => `<span class="dow">${d}</span>`).join('');
    const y = calMonth.getFullYear(), m = calMonth.getMonth(); const days = new Date(y, m + 1, 0).getDate();
    for (let i = 0; i < new Date(y, m, 1).getDay(); i++) cal.insertAdjacentHTML('beforeend', '<span></span>');
    const tk = todayKey();
    for (let d = 1; d <= days; d++) {
      const k = `${y}-${pad(m + 1)}-${pad(d)}`; const before = k < EPOCH, future = k > tk;
      const b = document.createElement('button'); b.className = 'day';
      const daily = store.daily[k], arc = store.archive[k];
      const sc = daily ? daily.score : arc ? arc.best : null;
      b.innerHTML = `<span class="dn">${d}</span>${!before && !future ? `<span class="dno">#${dayIndex(k) + 1}</span>` : ''}${sc !== null ? `<b>${sc}</b>` : ''}`;
      if (k === tk) b.classList.add('today'); if (daily) b.classList.add('played'); else if (arc) b.classList.add('arc');
      if (before || future) b.disabled = true;
      else b.addEventListener('click', () => { if (k === tk) startGame('daily'); else archivePrompt(k); });
      b.setAttribute('aria-label', `${prettyDate(k)}${sc !== null ? `, best ${sc}` : ''}`);
      cal.appendChild(b);
    }
  }
  function archivePrompt(k) {
    const d = store.daily[k], a = store.archive[k];
    const ids = dailyIds(k);
    openModal(`DIVE #${dayIndex(k) + 1}`, `
      <p class="fine">${prettyDate(k)}</p>
      ${d ? `<p>Your daily score: <b>${d.score}</b> (-${fmt(d.depth)}m)</p>` : ''}
      ${a ? `<p>Archive best: <b>${a.best}</b> · ${a.plays} play${a.plays > 1 ? 's' : ''}</p>` : ''}
      <p class="fine">Categories: ${ids.map(id => BY_ID.get(id).cat).join(' · ')}</p>
      <div class="modal-actions">${d ? '<button class="btn btn-ghost" id="arc-view">VIEW LOG</button>' : ''}<button class="btn btn-wide" id="arc-play">DIVE ▸</button></div>`);
    $('#arc-play').onclick = () => { closeModal(); startGame('archive', k); };
    if (d) $('#arc-view').onclick = () => { closeModal(); showResults(d); };
    $('#arc-play').focus();
  }

  // ---------- packs ----------
  function showPacks() {
    if (G) return showGame();
    show('packs'); Ocean.setView('menu');
    const box = $('#packs'); box.innerHTML = '';
    PACKS.forEach((p, i) => {
      const n = QS.filter(q => q.pack === p.key).length;
      const played = store.history.filter(h => h.mode === 'pack' && h.key === p.key);
      const best = played.length ? Math.max(...played.map(h => h.score)) : null;
      const b = document.createElement('button'); b.className = 'pack';
      b.innerHTML = `<span class="pk-n">0${i + 1}</span><span class="pk-name">${p.name.toUpperCase()}</span><span class="pk-blurb">${p.blurb}</span><span class="pk-meta">${n} PROMPTS${best !== null ? ` · BEST ${best}` : ''}</span>`;
      if (n < PER_GAME) b.disabled = true;
      b.addEventListener('click', () => startGame('pack', p.key));
      box.appendChild(b);
    });
    setTimeout(() => box.querySelector('.pack')?.focus({ preventScroll: true }), 50);
  }

  // ---------- overlays ----------
  let lastFocus = null;
  function openModal(title, html) {
    lastFocus = lastFocus || document.activeElement;
    $('#modal-title').textContent = title; $('#modal-body').innerHTML = html; $('#modal').hidden = false; $('#menu').hidden = true;
    $$('#modal [data-close]').forEach(b => b.onclick = closeModal);
    setTimeout(() => ($('#modal-body button, #modal-body input') || $('#modal [data-close]')).focus({ preventScroll: true }), 30);
  }
  function closeModal() { $('#modal').hidden = true; restoreFocus(); }
  function restoreFocus() {
    if (G && G.phase === 'answering' && document.body.dataset.screen === 'game') $('#answer').focus({ preventScroll: true });
    else if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    lastFocus = null;
  }
  function confirmBox(msg, ok) {
    openModal('ARE YOU SURE?', `<p>${esc(msg)}</p><div class="modal-actions"><button class="btn btn-ghost" data-close>CANCEL</button><button class="btn btn-pink" id="confirm-ok">CONFIRM</button></div>`);
    $('#confirm-ok').onclick = () => { closeModal(); ok(); };
  }
  function openMenu() {
    lastFocus = document.activeElement;
    $('#menu').hidden = false; $('#menu-quit').hidden = !G; $('#menu-restart').hidden = !G || G.mode === 'daily';
    $('#menu-foot').textContent = `${fmt(QS.length)} prompts in the deep · Daily #${dayIndex(todayKey()) + 1}`;
    setTimeout(() => $('#menu .menu-item').focus(), 30);
  }
  function closeMenu() { $('#menu').hidden = true; restoreFocus(); }
  let toastT = null;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }

  function menuAction(act) {
    closeMenu();
    if (act === 'home') return leaveThen(showTitle);
    if (act === 'daily') return G && G.mode === 'daily' ? showGame() : leaveThen(() => startGame('daily'));
    if (act === 'unlimited') return leaveThen(() => startGame('unlimited'));
    if (act === 'packs') return leaveThen(showPacks);
    if (act === 'archive') return leaveThen(showArchive);
    if (act === 'quit') return quitDive();
    if (act === 'restart') return restartDive();
    if (act === 'stats') return openStats();
    if (act === 'settings') return openSettings();
    if (act === 'help') return openHelp();
  }

  function updateCountdown() {
    const s = hms(msToMidnight());
    $$('.cd').forEach(e => e.textContent = s); $('#st-next').textContent = s;
    // roll over at midnight
    if (document.body.dataset.screen === 'title') { const k = todayKey(); if (k !== updateCountdown.k) { updateCountdown.k = k; updateTitle(); } }
  }

  // ---------- wiring ----------
  function wire() {
    $('#howto-tiers').innerHTML = TIERS.slice().reverse().map(t => `<span style="color:${t.color}">${t.name} +${t.score}</span>`).join('');
    $('#howto-toggle').addEventListener('click', e => { const box = $('#howto'); box.hidden = !box.hidden; e.currentTarget.setAttribute('aria-expanded', String(!box.hidden)); Sound.click(); });
    $('#btn-begin').addEventListener('click', () => { Sound.click(); if (G) showGame(); else startGame('daily'); });
    $$('[data-go]').forEach(b => b.addEventListener('click', () => {
      Sound.click(); const g = b.dataset.go;
      if (g === 'archive') showArchive(); else if (g === 'packs') showPacks(); else if (g === 'unlimited') startGame('unlimited'); else showTitle();
    }));
    $('#answer-form').addEventListener('submit', e => { e.preventDefault(); submit(); });
    $('#answer').addEventListener('input', e => { if (pendingSuggest && window.Match.norm(e.target.value) !== pendingSuggest.n) clearSuggest(); if (G) { G.input = e.target.value; save(); } if (store.settings.sound) Sound.key(); });

    $('#btn-skip').addEventListener('click', skip);
    $('#btn-descend').addEventListener('click', next);
    $('#btn-again').addEventListener('click', () => { const e = resultsEntry; if (e && e.mode === 'pack') startGame('pack', e.key); else startGame('unlimited'); });
    $('#btn-res-archive').addEventListener('click', () => { Sound.click(); showArchive(); });
    $('#btn-stats2').addEventListener('click', openStats);
    $('#btn-share').addEventListener('click', copyShare);
    $('#btn-share2').addEventListener('click', async () => { if (navigator.share && resultsEntry) { try { await navigator.share({ text: shareText(resultsEntry) }); return; } catch (e) { if (e.name === 'AbortError') return; } } copyShare(); });
    $('#btn-quit').addEventListener('click', quitDive);
    $('#btn-restart').addEventListener('click', restartDive);
    $('#btn-res-home').addEventListener('click', () => { Sound.click(); showTitle(); });
    $('#btn-settings').addEventListener('click', () => { Sound.click(); openSettings(); });
    $('#btn-menu').addEventListener('click', () => { Sound.click(); openMenu(); });
    $('#btn-sound').addEventListener('click', () => { store.settings.sound = !store.settings.sound; applySettings(); save(); Sound.click(); toast(store.settings.sound ? 'Sound on' : 'Sound off'); });
    $$('#menu [data-act]').forEach(b => b.addEventListener('click', () => menuAction(b.dataset.act)));
    $('#menu').addEventListener('click', e => { if (e.target.id === 'menu' || e.target.closest('[data-close]')) closeMenu(); });
    $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
    $('#cal-prev').addEventListener('click', () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderCal(); });
    $('#cal-next').addEventListener('click', () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderCal(); });

    document.addEventListener('keydown', e => {
      const typing = e.target.matches('input[type=text], textarea');
      if (e.key === 'Escape') {
        if (!$('#modal').hidden) return closeModal();
        if (!$('#menu').hidden) return closeMenu();
        if (['archive', 'packs'].includes(document.body.dataset.screen)) return showTitle();
        return;
      }
      if (!$('#modal').hidden || !$('#menu').hidden) {
        if (e.key === 'Tab') trapFocus(e, !$('#modal').hidden ? $('#modal .modal') : $('#menu .drawer'));
        return;
      }
      if (typing) return;
      if (e.key === 'm' || e.key === 'M') { e.preventDefault(); return openMenu(); }
      if (e.key === 's' || e.key === 'S') { return $('#btn-sound').click(); }
      if (e.key === 'Enter' && !e.target.matches('button, a, input')) {
        const sc = document.body.dataset.screen;
        if (sc === 'title') { e.preventDefault(); $('#btn-begin').click(); }
        else if (sc === 'game' && G && G.phase === 'reveal' && !$('#btn-descend').disabled) { e.preventDefault(); next(); }
        else if (sc === 'game' && G && G.phase === 'reading' && e.shiftKey) skip();
      }
      if (document.body.dataset.screen === 'game' && G && G.phase === 'answering' && e.key.length === 1 && !e.metaKey && !e.ctrlKey) $('#answer').focus();
    });
    document.addEventListener('pointerdown', () => { Sound.unlock(); if (store.settings.sound && store.settings.ambience) Sound.startAmbience(); }, { once: true });
    document.addEventListener('keydown', () => { Sound.unlock(); if (store.settings.sound && store.settings.ambience) Sound.startAmbience(); }, { once: true });
    window.addEventListener('storage', e => { if (e.key === SKEY && !G) { load(); if (document.body.dataset.screen === 'title') updateTitle(); } });
  }
  function trapFocus(e, root) {
    const f = [...root.querySelectorAll('button:not([disabled]):not([hidden]), input, [tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null);
    if (!f.length) return; const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // ---------- boot ----------
  function boot() {
    load();
    Ocean.init($('#ocean'));
    applySettings(); wire(); buildGauge();
    if (!QS.length) { document.body.insertAdjacentHTML('beforeend', '<p style="position:fixed;bottom:8px;left:8px;color:#f66">Question database failed to load.</p>'); }
    // resume an in-progress dive (refresh never resets the timer: phase deadlines are absolute timestamps)
    const A = store.active;
    const fresh = A && (A.mode === 'daily' || (Date.now() - (A.phaseEnd || 0) < 60000 && Date.now() - (A.startedAt || 0) < 3600000) || A.pausedLeft);
    if (A && fresh && A.ids && A.ids.every(id => BY_ID.has(id))) {
      if (A.pausedLeft && A.phase === 'answering') { A.phaseEnd = Date.now() + A.pausedLeft; delete A.pausedLeft; }
      G = store.active; Ocean.setView('game', true); showGame();
    } else {
      store.active = null; Ocean.setView('title', true); showTitle();
    }
    buildDepthLabels(); requestAnimationFrame(labelLoop);
    tickTimer = setInterval(tick, 100);
    setInterval(updateCountdown, 1000);
    document.addEventListener('visibilitychange', () => {
      // Practice dives pause while the tab is hidden; the Daily Dive keeps running so it can't be paused to look things up.
      if (G && G.mode !== 'daily' && G.phase === 'answering') {
        if (document.hidden) { G.pausedLeft = Math.max(0, G.phaseEnd - Date.now()); save(); }
        else if (G.pausedLeft !== undefined) { G.phaseEnd = Date.now() + G.pausedLeft; delete G.pausedLeft; save(); }
      }
      if (!document.hidden) tick();
    });
  }

  // test hooks (used by automated checks; harmless in play)
  window.__krillion = { get G() { return G; }, get store() { return store; }, dailyIds, randomIds, match, QS, BY_ID, submit, next, skip, finish };
  boot();
})();

// Krillion — answer normalisation and matching. Works in browser and Node.
(function (root) {
  'use strict';
  const TIERS = [
    { score: 100, key: 'million', name: 'One in a Krillion', depth: 1000, color: '#f3cd66', blurb: 'One in a krillion. Nobody else went this deep.' },
    { score: 85, key: 'deep', name: 'Deep Cut', depth: 750, color: '#946ff9', blurb: 'True obscurity. Few go this deep.' },
    { score: 60, key: 'rare', name: 'Rare', depth: 450, color: '#e6554e', blurb: 'Genuinely uncommon. Nice pull.' },
    { score: 30, key: 'schooler', name: 'Schooler', depth: 200, color: '#76dbfc', blurb: 'Solid. Swims with the school.' },
    { score: 10, key: 'plankton', name: 'Plankton', depth: 30, color: '#9aaac6', blurb: 'The answer everyone blurts out.' },
  ];
  const tierOf = s => TIERS.find(t => t.score === s) || TIERS[TIERS.length - 1];

  const WORD_SUBS = { st: 'saint', ste: 'sainte', mt: 'mount', ft: 'fort', dr: 'doctor', no: 'number', '&': 'and', vs: 'versus' };
  function norm(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().trim().replace(/^(?:(?:the|a|an)\s+(?=\S)){1,2}/, '').replace(/\+\+/g, ' plus plus ').replace(/([a-z])#/g, '$1 sharp').replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/œ/g, 'oe').replace(/ł/g, 'l').replace(/ı/g, 'i').replace(/[µμ]/g, 'u')
      .replace(/&/g, ' and ').replace(/['’‘`´".,!?:;()\[\]{}\-\/\\_*#@+~|]/g, ' ')
      .replace(/\s+/g, ' ').trim()
      .split(' ').map(w => WORD_SUBS[w] || w).join(' ');
  }
  const IRREG = { mice: 'mouse', geese: 'goose', teeth: 'tooth', feet: 'foot', men: 'man', women: 'woman', children: 'child', people: 'person', oxen: 'ox', lice: 'louse', dice: 'die', cacti: 'cactus', fungi: 'fungus', octopi: 'octopus', wolves: 'wolf', knives: 'knife', wives: 'wife', lives: 'life', leaves: 'leaf', loaves: 'loaf', halves: 'half', shelves: 'shelf', calves: 'calf', elves: 'elf', thieves: 'thief', hooves: 'hoof', scarves: 'scarf', slushies: 'slushie', smoothies: 'smoothie', cookies: 'cookie', movies: 'movie', zombies: 'zombie', brownies: 'brownie', selfies: 'selfie', hippies: 'hippie', rookies: 'rookie', goalies: 'goalie', aunties: 'auntie', oreos: 'oreo', tacos: 'taco', photos: 'photo', pianos: 'piano', radios: 'radio', videos: 'video', kangaroos: 'kangaroo', tattoos: 'tattoo' };
  function singular(w) {
    if (IRREG[w]) return IRREG[w];
    if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
    if (w.length > 4 && /(ches|shes|xes|sses|zes|oes)$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) return w.slice(0, -1);
    return w;
  }
  function variants(n) {
    const out = new Set([n]);
    const sing = n.split(' ').map(singular).join(' '); out.add(sing);
    const noAnd = n.replace(/\band\b/g, ' ').replace(/\s+/g, ' ').trim(); if (noAnd) out.add(noAnd);
    const FILL = /\b(the|their|your|my|his|her|our|its|a|an|of|some)\b/g;
    for (const v of [...out]) { const f = v.replace(FILL, ' ').replace(/\s+/g, ' ').trim(); if (f && f.includes(' ') && f !== v) out.add(f); }
    for (const v of [...out]) { const sv = v.split(' ').map(singular).join(' '); out.add(sv); }
    for (const v of [...out]) out.add(v.replace(/ /g, ''));
    return [...out].filter(Boolean);
  }
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    // optimal string alignment distance (adjacent transpositions count as 1)
    let pp = null, prev = new Array(b.length + 1); for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let best = i;
      for (let j = 1; j <= b.length; j++) {
        const c = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
        if (pp && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], pp[j - 2] + 1);
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      pp = prev; prev = cur;
    }
    return prev[b.length];
  }

  function parseAnswers(q) {
    if (q._parsed) return q._parsed;
    const list = q.a.map((raw, i) => {
      let [name, sc, ...aliases] = String(raw).split('|').map(s => s.trim());
      const hidden = name.startsWith('!'); if (hidden) name = name.slice(1); // '!' = accepted but not shown in answer lists
      const score = Number(sc) === 15 ? 10 : Number(sc); // 'Too Clever' tier was retired: old 15s are Plankton
      return { i, name, score, aliases: aliases.filter(Boolean), hidden };
    });
    const index = new Map(); const keys = []; const label = new Map(); // label: normalised key -> the name/alias as written
    // exact normalised names/aliases win over derived variants (e.g. "Chao" vs singular of "Chaos")
    for (const ans of list) for (const k of [ans.name, ...ans.aliases]) {
      const n = norm(k); if (n && !index.has(n)) { index.set(n, ans); label.set(n, k); keys.push([n, ans]); }
    }
    for (const ans of list) for (const k of [ans.name, ...ans.aliases]) {
      const n = norm(k); if (!n) continue;
      for (const v of variants(n)) { if (!index.has(v)) { index.set(v, ans); label.set(v, k); keys.push([v, ans]); } }
    }
    q._parsed = { list, index, keys, label };
    return q._parsed;
  }

  // Returns {answer} on success, or null.
  function match(q, input) {
    const n = norm(input); if (!n) return null;
    const { index, keys } = parseAnswers(q);
    for (const v of variants(n)) { const a = index.get(v); if (a) return { answer: a, exact: true, label: q._parsed.label.get(v) }; }
    // fuzzy: allow small typos on longer inputs; reject if ambiguous between different answers
    const flat = n.replace(/ /g, '');
    if (flat.length < 5) return null;
    const maxD = flat.length >= 10 ? 2 : 1;
    let best = null, bestD = maxD + 1, tie = false;
    for (const [k, ans] of keys) {
      if (k.includes(' ')) continue; // compare against the space-less variants only
      if (k.length < 5 || k[0] !== flat[0]) continue;
      const d = lev(flat, k, maxD);
      if (d < bestD) { best = ans; bestD = d; tie = false; }
      else if (d === bestD && best && ans !== best) tie = true;
    }
    if (best && !tie && bestD <= maxD) return { answer: best, exact: false };
    return null;
  }

  function matchExact(q, input) {
    const n = norm(input); if (!n) return null;
    const { index } = parseAnswers(q);
    for (const v of variants(n)) { const a = index.get(v); if (a) return { answer: a, exact: true, label: q._parsed.label.get(v) }; }
    return null;
  }

  // Looser "did you mean" lookup for near-misses: typos, missing words, partial names.
  // Returns {answer, label} or null when nothing is clearly closest.
  function suggest(q, input) {
    const n = norm(input); if (!n || n.length < 3) return null;
    const { keys } = parseAnswers(q);
    const flat = n.replace(/ /g, '');
    const maxD = flat.length >= 12 ? 3 : flat.length >= 6 ? 2 : flat.length >= 4 ? 1 : 0;
    const scored = new Map(); // answer -> [cost, key]
    const consider = (ans, cost, label) => { const cur = scored.get(ans); if (!cur || cost < cur[0]) scored.set(ans, [cost, label]); };
    for (const [k, ans] of keys) {
      const kf = k.replace(/ /g, '');
      // typo distance on the whole name
      if (maxD && Math.abs(kf.length - flat.length) <= maxD) {
        const d = lev(flat, kf, maxD); if (d <= maxD) consider(ans, d + (kf[0] === flat[0] ? 0 : 0.6), k);
      }
      // the start of a longer name ("tyrann" -> Tyrannosaurus)
      if (flat.length >= 4 && kf.length > flat.length && kf.startsWith(flat)) consider(ans, 1.2 + (kf.length - flat.length) / 20, k);
      // one distinctive word of a multi-word name ("corvette" -> Chevrolet Corvette), allowing a typo
      if (k.includes(' ') && n.length >= 4) {
        for (const w of k.split(' ')) {
          if (w.length < 4) continue;
          const d = w === n ? 0 : (n.length >= 5 ? lev(n, w, 1) : 9);
          if (d <= 1) consider(ans, 1.4 + d, k);
        }
      }
    }
    if (!scored.size) return null;
    const ranked = [...scored.entries()].sort((a, b) => a[1][0] - b[1][0]);
    if (ranked.length > 1 && ranked[1][1][0] - ranked[0][1][0] < 0.35) return null; // ambiguous
    return { answer: ranked[0][0], label: parseAnswers(q).label.get(ranked[0][1][1]) || ranked[0][0].name };
  }

  // An answer phrase that CONTAINS one valid answer counts as that answer ("lemon gatorade" -> Lemon).
  // Guardrails: the contained answer is >= 4 letters, sits on word boundaries, the extra words are few,
  // and only one distinct answer is contained (so typing several answers at once doesn't work).
  const NAMING_WORDS = new Set(['state', 'city', 'county', 'island', 'islands', 'river', 'lake', 'mountain', 'mountains', 'street', 'avenue', 'park', 'records', 'studios', 'games', 'entertainment', 'inc', 'corp', 'company', 'co', 'fc', 'united', 'jr', 'sr', 'ii', 'iii', 'iv', 'tech', 'district', 'province', 'territory', 'bay', 'beach', 'airport', 'station', 'stadium', 'arena', 'museum', 'hospital', 'church', 'cathedral', 'bridge', 'tower', 'mall']);
  function matchContained(q, input) {
    // place names are proper nouns: 'New Mexico' must not count as Mexico, so geography never uses phrase matching
    if (q.pack === 'geography') return null;
    const n0 = norm(input); if (!n0 || !n0.includes(' ')) return null;
    const words = n0.split(' ');
    const forms = [n0, words.map(singular).join(' ')];
    const { keys } = parseAnswers(q);
    const hits = new Map();
    for (const [k, ans] of keys) {
      if (k.length < 3) continue;
      if (k === n0) continue;
      const re = new RegExp('(^| )' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '( |$)');
      if (!forms.some(f => re.test(f))) continue;
      const extra = words.length - k.split(' ').length;
      // "Penn State", "Kansas City", "Georgia Tech": a naming word after the answer makes it a different thing
      const after = forms[0].split(new RegExp('(?:^| )' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?: |$)'))[1] || '';
      if (after && after.split(' ').some(w => NAMING_WORDS.has(w))) continue;
      if (extra < 1 || extra > 4 || (k.length < 4 && extra > 2)) continue;
      const cur = hits.get(ans); if (!cur || k.length > cur.length) hits.set(ans, k);
    }
    if (!hits.size) return null;
    // several answers inside one phrase: the head noun usually comes last ("lemon gatorade" -> Gatorade),
    // otherwise take the longest match
    const ends = (k) => forms.some(f => f.endsWith(' ' + k) || f === k);
    const ranked = [...hits.entries()].sort((a, b) => (ends(b[1]) - ends(a[1])) || (b[1].length - a[1].length));
    return { answer: ranked[0][0], contained: true };
  }

  // A more specific phrase than any listed answer ("bike shock pump" ⊃ "bike") is, by definition, something
  // few people say: score it at least Rare, one tier above the answer it contains, never One in a Krillion.
  const LADDER = [10, 30, 60, 85];
  function containedScore(score) {
    const i = LADDER.indexOf(score); const bumped = i < 0 ? 85 : LADDER[Math.min(LADDER.length - 1, i + 1)];
    return Math.min(85, Math.max(60, bumped));
  }

  const api = { TIERS, tierOf, norm, match, matchExact, matchContained, containedScore, suggest, parseAnswers, variants };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Match = api;
})(typeof window !== 'undefined' ? window : globalThis);

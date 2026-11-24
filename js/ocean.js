// Krillion — pixel-art ocean renderer.
// Everything is drawn into a low-resolution canvas and scaled up with nearest-neighbour.
// World coordinates are in meters below the surface (negative = sky).
(function () {
  'use strict';

  // ---------- helpers ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  function hash(n) { // deterministic 0..1
    n = (n | 0) * 374761393 + 668265263; n = (n ^ (n >>> 13)) * 1274126177; n = n ^ (n >>> 16);
    return ((n >>> 0) % 100000) / 100000;
  }
  function hex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  const rgb = (c, a) => a === undefined ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  // ---------- zones ----------
  const WATER = [
    [0, '#2a6f96'], [120, '#215a80'], [200, '#1b4568'], [500, '#152f4c'], [1000, '#101f36'],
    [2500, '#0c182b'], [4000, '#091322'], [5000, '#071427'], [6000, '#040b18'], [7200, '#020610'],
  ].map(([m, h]) => [m, hex(h)]);
  function waterColor(m) {
    if (m <= WATER[0][0]) return WATER[0][1];
    for (let i = 1; i < WATER.length; i++) {
      if (m <= WATER[i][0]) { const [m0, c0] = WATER[i - 1], [m1, c1] = WATER[i]; return mix(c0, c1, (m - m0) / (m1 - m0)); }
    }
    return WATER[WATER.length - 1][1];
  }
  const ZONES = [
    { name: 'Sunlight Zone', from: 0, to: 200 },
    { name: 'Twilight Zone', from: 200, to: 1000 },
    { name: 'Midnight Zone', from: 1000, to: 4000 },
    { name: 'Abyssal Zone', from: 4000, to: 6000 },
    { name: 'Trench Zone', from: 6000, to: 99999 },
  ];
  const zoneIndex = m => m < 200 ? 0 : m < 1000 ? 1 : m < 4000 ? 2 : m < 6000 ? 3 : 4;
  // The shrimp's 0 m sits OFF meters below the drawn surface so the dive screen starts underwater.
  let OFF = 275; const dz = m => m - OFF;

  // ---------- sprites ----------
  // Each sprite: rows of chars, palette maps char -> color. '.' is transparent.
  const SPR = {
    shrimp0: { p: { R: '#e8463c', H: '#ff8f73', D: '#a3262a', K: '#1a0b0b', A: '#ffb29c', L: '#c9372f', T: '#ff6a55' }, r: [
      '...........A..A.',
      '..........A..A..',
      '.....RRRRRRA.A..',
      '...RRHHHHHRRA...',
      '..RHRRRRRRRRRR..',
      'TRRDRRDRRDRRKRR.',
      'TTRRRRRRRRRRRRRR',
      'T..DRRDRRDRRRR..',
      '....L.L.L.L.L...',
      '...L.L.L.L.L....',
    ] },
    shrimp1: { p: { R: '#e8463c', H: '#ff8f73', D: '#a3262a', K: '#1a0b0b', A: '#ffb29c', L: '#c9372f', T: '#ff6a55' }, r: [
      '...........A...A',
      '..........A..A..',
      '.....RRRRRRA.A..',
      '...RRHHHHHRRA...',
      '..RHRRRRRRRRRR..',
      'TRRDRRDRRDRRKRR.',
      'TTRRRRRRRRRRRRRR',
      'T..DRRDRRDRRRR..',
      '...L.L.L.L.L....',
      '....L.L.L.L.L...',
    ] },
    boat: { p: { F: '#f0607a', N: '#121a2c', W: '#8fbfd0' }, r: [
      '...........FN...............',
      '.........FFFN...............',
      '.......FFFFFN...............',
      '........FFFFN...............',
      '............N...............',
      '............N...............',
      '............N...............',
      '............N...............',
      '............N...............',
      '.........NNNNNNNNN..........',
      '..........NWNNNNNN..........',
      '..........NWNNNNNN....NNNN..',
      '.NN.......NNNNNNNNNNNNNN....',
      'NNNNNNNNNNNNNNNNNNNNNNNN....',
      'NNNNNNNNNNNNNNNNNNNNNNN.....',
      '.NNNNNNNNNNNNNNNNNNNNN......',
    ] },
    fish: { p: { a: '#8a4b14', b: '#ffc94a', c: '#fff1b8', d: '#f08a24', k: '#1a1206' }, r: [
      '.....aaa.....',
      '...aabbbaa..a',
      '..abkbbbbbaaa',
      '.abbbbbbdbbda',
      '.accccbbdbbda',
      '..acccbbbaaaa',
      '...aaaaaa...a',
    ] },
    fish2: { p: { a: '#7eeaf5', b: '#3cc8dc', c: '#bdf6fb', d: '#1d7d92', k: '#08202a' }, r: [
      '......dd.........',
      '.....dbbd........',
      '...dddbbbdd...dd.',
      '..dbbbbbbbbd.dbbd',
      '.dbaaaaabbbbdbbd.',
      'dbakaaaaabbbbbd..',
      'dbaaaaaaabbbbbd..',
      '.dccccaabbbbdbbd.',
      '..dcccbbbbbd.dbbd',
      '...dddbbbdd...dd.',
      '.....dbbd........',
      '......dd.........',
    ] },
    silhouette: { p: { s: 'S' }, r: [
      '....ss.....',
      's..ssssss..',
      'ssssssssss.',
      'sssssssssss',
      'ssssssssss.',
      's..ssssss..',
      '....ss.....',
    ] },
    minifish: { p: { s: 'S' }, r: [
      '.sss..s',
      'sssssss',
      '.sss..s',
    ] },
    whale: { p: { s: 'S' }, r: [
      '.........ssssssss.........',
      '......ssssssssssssss......',
      '...ssssssssssssssssssss...',
      'ss.sssssssssssssssssssss..',
      'sssssssssssssssssssssssss.',
      'ss..ssssssssssssssssssssss',
      '......ssssssssssssssss....',
      '...........ss.....s.......',
    ] },
    hatchet: { p: { a: '#b8c7d9', b: '#7f93ab', g: '#7ff3ff' }, r: [
      '.aaa..',
      'baaaa.',
      'bagaa.',
      '.aaab.',
      '..ab..',
    ] },
    squid: { p: { r: '#e6554e', R: '#ff8a78', d: '#8f2a2a', k: '#2a0a0c' }, r: [
      '....r....',
      '...rRr...',
      '..rRRrr..',
      '..rRRrr..',
      '..rRrrd..',
      '..rrrrd..',
      '..rkrkd..',
      '...rrd...',
      '..r.r.r..',
      '.r..r..r.',
      '.r.r.r.r.',
      'r..r.r..r',
      'r.r...r.r',
    ] },
    jelly: { p: { a: '#ff8fd1', b: '#ffd6f0', c: '#c05aa0', d: '#e070b8', w: '#ffffff' }, r: [
      '..bbbb..',
      '.bwaaab.',
      'bwaaaadb',
      'baaaaadb',
      'dddddddd',
      'c.c.c.c.',
      '.c.c.c.c',
      'c.c.c.c.',
      '.c...c..',
    ] },
    jelly2: { p: { a: '#7ff3ff', b: '#d7fbff', c: '#3bb6c9' }, r: [
      '.bbbb.',
      'baaaab',
      'aaaaaa',
      'c.cc.c',
      'c.c..c',
      '.c.c..',
    ] },
    angler: { p: { b: '#3a4a66', B: '#4e6286', d: '#222c40', e: '#9fb6d6', M: '#0a0d18', T: '#e8eef5', s: '#6a7f9e', W: '#ffffff' }, r: [
      '.....sssss............',
      '....s.....s...........',
      '...s.......s....d.....',
      '..s.........s..dd.....',
      '.WW......BBBBBbbbd..dd',
      'WWWW...BBBBBebbbbbddd.',
      'WWWW..BBbbbbbbbbbbbdd.',
      '.WW..bMMMMMbbbbbbbbbd.',
      '.....bTMTMTMbbbbbbbbdd',
      '.....bMMMMMMbbbbbbbbbd',
      '.....bTMTMTMbbbbbbbbdd',
      '......bMMMMbbbbbbbd.d.',
      '.......bbbbbbbbbdd....',
      '.........ddddd........',
    ] },
    eel: { p: { a: '#3c2f4f', b: '#5a4775', g: '#ff6ad5' }, r: [
      'aaaa..........',
      'abbaa.........',
      'aaaabbaaa.....',
      '..aaaaabbaaaag',
    ] },
    vamp: { p: { a: '#6b1f2f', b: '#952b42', e: '#7ff3ff' }, r: [
      '..aaaa..',
      '.abbbba.',
      '.abeeba.',
      'aabbbbaa',
      'a.a..a.a',
      'a..aa..a',
    ] },
    worm: { p: { w: '#e9e2d0', r: '#e8463c' }, r: [
      'rr',
      'rr',
      'w.',
      'w.',
      '.w',
      '.w',
      'w.',
      'w.',
    ] },
    bubbles: { p: { o: '#9fc4dc', h: '#e6f4fc', i: '#33597a' }, r: [
      '...oooo.........',
      '.oo.iii.oo......',
      '.ohhiiiii.o.....',
      'ohhiiiiiiiio....',
      'ohiiiiiiiiio....',
      'oiiiiiiiiiio....',
      'oiiiiiiiiiio....',
      '.oiiiiiiiio.ooo.',
      '.ooiiiiiioo.o..o',
      '...oooo..ohhio..',
      '......ooo.oiio..',
      '.....ohho.ooo...',
      '.....oiio.......',
      '......ooo.......',
    ] },
    coral: { p: { r: '#e6554e', R: '#ff8a78', d: '#a3302f' }, r: [
      'R...R...r',
      'R..r.R..r',
      '.R.r.R.r.',
      '.R..r..r.',
      '..R.r.r..',
      '..Rrrrd..',
      '...Rrd...',
      '....r....',
      '....d....',
      '..Rrrrd..',
    ] },
    squidIcon: { p: { a: '#d6384a', R: '#e8454f', H: '#ff7a80', r: '#a52a35', k: '#3a0a10' }, r: [
      '.a...a.....a.',
      '.a....a...a..',
      'a.a...a..a..a',
      'a..a..a..a.a.',
      '.a.a.a...a.a.',
      '.a..aa..a..a.',
      '..a.a.a.a.a..',
      '..a..aaa.aa..',
      '...a.aaaaa...',
      '....aaaaa....',
      '....HRRRR....',
      '....HkRkR....',
      '....HRRRR....',
      '....HRRRR....',
      '...rHRRRRr...',
      '..rrHRRRRrr..',
      '...rHRRRRr...',
      '....HRRRR....',
      '....rRRRr....',
      '.....RRR.....',
      '......R......',
    ] },
    curl0: { p: { R: '#ec4b55', H: '#ff8a8a', r: '#b8323f', d: '#7a1e2a', k: '#1a0b0b', a: '#ef6a78', l: '#c43c4a' }, r: [
      '......aaaaa.....',
      '....aa.....aa...',
      '...a..aaaaa..a..',
      '..a..a.....a....',
      '.a..a...........',
      '.a.a..rrrrr.....',
      '..a.rRHRHRHr....',
      '...rRRHRHRHRr...',
      '..rkkRRHRHRHRr..',
      '.rRkkRRRRRRRRRr.',
      'rRRRRRRRRRRRRRr.',
      '.rr.lrRRRRRRRRRr',
      '....l.lrRRRRRRRr',
      '..rr.l.lrRRRRRr.',
      '.rRRr..rRRRRRr..',
      'rRRRRrrRRRRRr...',
      '.rRRRRRRRRrr....',
      '..rrrrrrrr......',
    ] },
    curl1: { p: { R: '#ec4b55', H: '#ff8a8a', r: '#b8323f', d: '#7a1e2a', k: '#1a0b0b', a: '#ef6a78', l: '#c43c4a' }, r: [
      '.....aaaaa......',
      '...aa.....aa....',
      '...a..aaaaa..a..',
      '..a..a.....a....',
      '.a..a...........',
      '.a.a..rrrrr.....',
      '..a.rRHRHRHr....',
      '...rRRHRHRHRr...',
      '..rkkRRHRHRHRr..',
      '.rRkkRRRRRRRRRr.',
      'rRRRRRRRRRRRRRr.',
      '.rr.lrRRRRRRRRRr',
      '....l.lrRRRRRRRr',
      '..rr.l.lrRRRRRr.',
      '.rRRr..rRRRRRr..',
      'rRRRRrrRRRRRr...',
      '.rRRRRRRRRrr....',
      '..rrrrrrrr......',
    ] },
    shrimpGold: { p: { R: '#f3cd66', H: '#fff0a8', r: '#c99a35', d: '#8a6418', k: '#3a2a08', a: '#ffe08a', l: '#d8a845' }, r: [
      '......aaaaa.....',
      '....aa.....aa...',
      '...a..aaaaa..a..',
      '..a..a.....a....',
      '.a..a...........',
      '.a.a..rrrrr.....',
      '..a.rRHRHRHr....',
      '...rRRHRHRHRr...',
      '..rkkRRHRHRHRr..',
      '.rRkkRRRRRRRRRr.',
      'rRRRRRRRRRRRRRr.',
      '.rr.lrRRRRRRRRRr',
      '....l.lrRRRRRRRr',
      '..rr.l.lrRRRRRr.',
      '.rRRr..rRRRRRr..',
      'rRRRRrrRRRRRr...',
      '.rRRRRRRRRrr....',
      '..rrrrrrrr......',
    ] },
    octo: { p: { p: '#ff7f9e', P: '#ffb3c6', w: '#ffffff', k: '#2a0a14', d: '#c2506e' }, r: [
      '..pppp..',
      '.pPPppp.',
      'pPpppppp',
      'pwkppwkp',
      'pppppppd',
      '.p.pp.d.',
      'p.p..p.d',
      '.p....p.',
    ] },
    shrimpIcon: { p: { r: '#e6554e', R: '#ff8a78', d: '#a3302f', k: '#1a0b0b', a: '#ffb29c' }, r: [
      '..a.a.....',
      '.a...a....',
      'a....Rrrr.',
      '....Rrrrrr',
      '...Rrrkrrd',
      '..Rrr.....',
      '..Rrd.....',
      '..rrd.....',
      '...rrrrd..',
      '....drrrd.',
      '......rd..',
    ] },
    plankton: { p: { a: '#7fe9ff', b: '#3bb6c9' }, r: [
      '...aa...',
      '..a..a..',
      '...aa...',
      '.aa..aa.',
      'a..aa..a',
      '.aa..aa.',
    ] },
    turtle: { p: { a: '#6aa84f', b: '#3d7a32', c: '#a7d18a', k: '#111' }, r: [
      '..c........c..',
      '.cc.aaaaa..cc.',
      '...abababa.ckc',
      '..ababababacccc',
      '...abababa....',
      '.cc.aaaaa..cc.',
      '..c........c..',
    ] },
  };
  // Pre-render sprites into offscreen canvases (and silhouettes on demand by color).
  const cache = {};
  function sprite(name, tint) {
    const key = name + (tint || '');
    if (cache[key]) return cache[key];
    const s = SPR[name]; const h = s.r.length, w = Math.max(...s.r.map(r => r.length));
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    for (let j = 0; j < h; j++) for (let i = 0; i < s.r[j].length; i++) {
      const ch = s.r[j][i]; if (ch === '.') continue;
      let col = tint || s.p[ch];
      if (tint && tint[0] === '~') { // shade-preserving tint: recolor by the original pixel's brightness
        const t = hex(tint.slice(1)); const o = /^#/.test(s.p[ch]) ? hex(s.p[ch]) : [180, 180, 180];
        const lum = (0.3 * o[0] + 0.59 * o[1] + 0.11 * o[2]) / 255;
        col = lum < 0.16 ? '#0a1222' : rgb(t.map(v => Math.min(255, v * (0.5 + 0.7 * lum))));
      }
      x.fillStyle = col; x.fillRect(i, j, 1, 1);
    }
    // flipped copy
    const f = document.createElement('canvas'); f.width = w; f.height = h; const fx = f.getContext('2d');
    fx.translate(w, 0); fx.scale(-1, 1); fx.drawImage(c, 0, 0);
    return (cache[key] = { c, f, w, h });
  }
  function drawSprite(ctx, name, x, y, flip, tint) {
    const s = sprite(name, tint); ctx.drawImage(flip ? s.f : s.c, Math.round(x), Math.round(y));
    return s;
  }

  // Pixel cloud generator
  function makeCloud(seed) {
    const w = 26 + Math.floor(hash(seed) * 26), h = 10 + Math.floor(hash(seed + 7) * 6);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    const blobs = [];
    const n = 3 + Math.floor(hash(seed + 3) * 3);
    for (let i = 0; i < n; i++) {
      const bx = 5 + (w - 10) * (i / (n - 1 || 1)), r = 3 + hash(seed + i * 11) * (h * 0.45);
      blobs.push([bx, h - r - 1, r]);
    }
    blobs.push([w / 2, h - 3, w * 0.42]);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let inside = false;
      for (const [bx, by, r] of blobs) {
        if (j > h - 2) break;
        const dx = (i - bx) / (r === w * 0.42 ? r : r), dy = (j - by) / (r === w * 0.42 ? 3 : r);
        if (dx * dx + dy * dy <= 1) { inside = true; break; }
      }
      if (inside) { x.fillStyle = j > h * 0.66 ? '#d6e6f2' : '#ffffff'; x.fillRect(i, j, 1, 1); }
    }
    return c;
  }

  // ---------- state ----------
  const O = {
    canvas: null, ctx: null, W: 0, H: 0, scale: 3,
    view: 'title', reduced: false, tmix: 1,
    shrimpM: 0, shrimpFrom: 0, shrimpTo: 0, tweenT0: 0, tweenDur: 0,
    topM: -9999, ppm: 0,
    t: 0, last: 0, bubbles: [], clouds: [], dims: 0,
    onDepth: null, showShrimp: false, sinking: false,
  };

  function resize() {
    const dpr = 1; const cw = window.innerWidth, ch = window.innerHeight;
    O.scale = cw < 700 ? 2 : (cw > 1900 ? 4 : 3);
    O.W = Math.ceil(cw / O.scale); O.H = Math.ceil(ch / O.scale);
    O.canvas.width = O.W * dpr; O.canvas.height = O.H * dpr;
    O.ppm = O.H / 420; // ~420 m visible
    OFF = Math.ceil(gameAnchor() * 420) + 15; // keep the surface just above the screen during a dive
    O.ctx.imageSmoothingEnabled = false;
  }

  function viewTop() {
    const H = O.H, ppm = O.ppm;
    if (O.view === 'title') return -(H * (window.innerWidth < 700 ? 0.5 : 0.61)) / ppm;
    if (O.view === 'results') return -(H * (window.innerWidth < 700 ? 0.45 : 0.58)) / ppm;
    if (O.view === 'menu') return -(H * 0.3) / ppm;
    if (O.view === 'intro') return -(H * 0.42) / ppm;
    return shrimpWorld() - (H * gameAnchor()) / ppm;
  }
  const gameAnchor = () => window.innerWidth < 700 ? 0.74 : 0.62;
  const shrimpWorld = () => O.shrimpM + OFF; // shrimp floats a little below the surface at 0 m
  const shrimpX = () => Math.round(O.W * (O.sxf !== undefined ? O.sxf : (window.innerWidth < 700 ? 0.08 : 0.1)));

  // ---------- drawing ----------
  function disc(ctx, cx, cy, r) { for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y)); ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1); } }
  function drawSky(ctx, yTop, ySurf) {
    if (ySurf <= 0) return;
    const bands = ['#bfe0f0', '#c9e6f3', '#d3ebf5', '#dceff7', '#e4f3f9', '#ebf6fa'];
    const hh = ySurf; const step = Math.max(2, Math.ceil(hh / bands.length));
    for (let i = 0; i < bands.length; i++) { ctx.fillStyle = bands[i]; ctx.fillRect(0, Math.floor(ySurf - hh + i * step), O.W, step + 1); }
    // pixel sun, top right
    if (ySurf > 60) {
      const r = Math.max(10, Math.round(O.H * 0.06)), cx = Math.round(O.W * 0.9), cy = Math.round(-r * 0.25);
      for (let k = 3; k >= 1; k--) { ctx.fillStyle = `rgba(255, 236, 170, ${0.1 * (4 - k) / 3})`; disc(ctx, cx, cy, r + k * 5); }
      ctx.fillStyle = '#ffe9a0'; disc(ctx, cx, cy, r); ctx.fillStyle = '#fff6cf'; disc(ctx, cx - Math.round(r * 0.3), cy - Math.round(r * 0.3), Math.round(r * 0.45));
    }
    // clouds, slow drift
    for (let i = 0; i < O.clouds.length; i++) {
      const cl = O.clouds[i];
      const speed = 0.6 + hash(i * 31) * 1.2;
      const x = ((hash(i * 17) * (O.W + 80) + O.t * speed) % (O.W + 80)) - 60;
      // clouds hug the top of the sky (and a few low on the horizon) so they don't cross the logo
      const y = i % 3 === 2 ? ySurf - 6 - cl.height - hash(i * 13) * 6 : hash(i * 13) * Math.max(6, ySurf * 0.14) - cl.height * 0.4;
      if (y + cl.height < 0) continue;
      ctx.drawImage(cl, Math.round(x), Math.round(y));
    }
  }

  function drawWater(ctx, ySurf) {
    const ppm = O.ppm; const start = Math.max(0, Math.floor(ySurf));
    const band = 3;
    for (let y = start; y < O.H; y += band) {
      const m = O.topM + y / ppm;
      const c = waterColor(lerp(dz(m), Math.max(0, m) * 6, O.tmix));
      // retro banding: quantise
      ctx.fillStyle = rgb([Math.round(c[0] / 4) * 4, Math.round(c[1] / 4) * 4, Math.round(c[2] / 4) * 4]);
      ctx.fillRect(0, y, O.W, band);
    }
  }

  function drawRays(ctx, ySurf) {
    // Diagonal light shafts that fade through the sunlight & twilight zones.
    const ppm = O.ppm;
    const yEnd = Math.min(O.H, ySurf + 900 * ppm);
    if (yEnd <= 0) return;
    for (let r = 0; r < 5; r++) {
      const base = (hash(r * 91) * O.W * 1.3) - O.W * 0.15 + Math.sin(O.t * 0.15 + r) * 8;
      const width = 6 + hash(r * 7) * 14;
      for (let y = Math.max(0, Math.floor(ySurf)); y < yEnd; y += 2) {
        const m = O.topM + y / ppm;
        const a = 0.09 * (1 - O.tmix) * (1 - clamp(m / 900, 0, 1)) * (0.7 + 0.3 * Math.sin(O.t * 0.5 + r * 2));
        if (a <= 0.005) continue;
        ctx.fillStyle = `rgba(210,245,255,${a.toFixed(3)})`;
        ctx.fillRect(Math.round(base - (y - ySurf) * 0.35), y, Math.round(width), 2);
      }
    }
  }

  function drawSurface(ctx, ySurf) {
    if (ySurf < -40 || ySurf > O.H + 10) return;
    const y = Math.round(ySurf);
    const skyCol = '#ebf6fa';
    for (let x = 0; x < O.W; x++) {
      const w = Math.round(1.6 + Math.sin(x * 0.035 + O.t * 0.9) * 1.3 + Math.sin(x * 0.011 - O.t * 0.5) * 0.9);
      if (w > 0) { ctx.fillStyle = skyCol; ctx.fillRect(x, y, 1, w); }
      ctx.fillStyle = '#a9e3ec'; ctx.fillRect(x, y + w, 1, 1);
      ctx.fillStyle = '#3f7fa6'; ctx.fillRect(x, y + w + 1, 1, 1);
    }
    // boat: a chunky dark silhouette resting on the swell
    const k = 2;
    const bs = sprite('boat');
    const bx = Math.round(O.view === 'results' ? O.W * 0.27 - bs.w * k / 2 : O.W * 0.17 - bs.w);
    const bob = Math.round(Math.sin(O.t * 1.4) * 0.8);
    const surfAt = Math.round(1.6 + Math.sin((bx + bs.w * k / 2) * 0.035 + O.t * 0.9) * 1.3);
    ctx.drawImage(bs.c, bx, y + surfAt - (bs.h - 3) * k + bob, bs.w * k, bs.h * k);
  }

  function zoneCreatures(z, rnd) {
    // returns a creature type for zone z
    const pick = arr => arr[Math.floor(rnd * arr.length) % arr.length];
    if (z === 0) return pick(['fish', 'fish', 'bubbles', 'school', 'fish', 'fish', 'fish', 'bubbles']);
    if (z === 1) return pick(['fish', 'hatchet', 'squidIcon', 'bubbles', 'fish', 'school', 'jelly2', 'fish']);
    if (z === 2) return pick(['jelly', 'squidIcon', 'octo', 'lantern', 'angler', 'jelly2']);
    if (z === 3) return pick(['angler', 'eel', 'lantern', 'vamp', 'jelly2', 'angler']);
    return pick(['angler', 'eel', 'vamp', 'lantern', 'jelly2']);
  }

  function glow(ctx, x, y, r, col, a) {
    // stepped octagonal glow so it reads as a soft pixel halo rather than a square
    for (let i = r; i > 0; i -= 2) {
      ctx.fillStyle = rgb(col, (a * 0.6 * (1 - i / (r + 1))).toFixed(3));
      const k = Math.round(i * 0.55);
      ctx.fillRect(Math.round(x - i), Math.round(y - k), i * 2, k * 2);
      ctx.fillRect(Math.round(x - k), Math.round(y - i), k * 2, i * 2);
    }
  }

  function drawFar(ctx) {
    // Far parallax silhouettes (darker shapes moving slowly)
    const ppm = O.ppm * 0.55; const top = O.topM * 0.55; const CH = 70;
    const c0 = Math.floor(top / CH) - 1, c1 = Math.floor((top + O.H / ppm) / CH) + 1;
    for (let c = c0; c <= c1; c++) {
      if (c < 1) continue;
      const n = 1 + Math.floor(hash(c * 5 + 1) * 2);
      for (let k = 0; k < n; k++) {
        const s = c * 13 + k * 101;
        const m = c * CH + hash(s) * CH; const y = (m - top) * ppm;
        if (y < -20 || y > O.H + 20) continue;
        const realM = O.topM + y / O.ppm; if (realM < 25) continue;
        const wc = waterColor(lerp(dz(realM), Math.max(0, realM) * 22, O.tmix));
        const tint = rgb(mix(wc, [4, 10, 22], 0.35));
        const dir = hash(s + 3) > 0.5 ? 1 : -1; const sp = (2 + hash(s + 4) * 4) * dir;
        const big = hash(s + 9) > 0.93 && dz(realM) > 250 && dz(realM) < 2500;
        const name = big ? 'whale' : 'silhouette';
        const w = big ? 26 : 11; const span = O.W + w * 2;
        let x = ((hash(s + 2) * span + O.t * sp) % span + span) % span - w;
        drawSprite(ctx, name, x, y, dir < 0, tint);
      }
    }
  }

  function drawCreatures(ctx) {
    const ppm = O.ppm; const CH = 55;
    const c0 = Math.floor(O.topM / CH) - 1, c1 = Math.floor((O.topM + O.H / ppm) / CH) + 1;
    for (let c = c0; c <= c1; c++) {
      if (c < 0) continue;
      const midM = c * CH + CH / 2; const z = zoneIndex(dz(midM));
      const n = hash(c * 7) > 0.45 ? 1 : (hash(c * 11) > 0.75 ? 2 : 0);
      for (let k = 0; k < n; k++) {
        const s = c * 97 + k * 31 + 5;
        const type = zoneCreatures(z, hash(s));
        const m = c * CH + 6 + hash(s + 1) * (CH - 12);
        let y = (m - O.topM) * ppm;
        if (y < -30 || y > O.H + 30) continue;
        const dir = hash(s + 2) > 0.5 ? 1 : -1;
        const sp = (type === 'jelly' || type === 'jelly2' || type === 'vamp' || type === 'bubbles' || type === 'squidIcon') ? 1.2 : (type === 'turtle' ? 4 : 5 + hash(s + 3) * 9);
        const span = O.W + 40;
        const x = ((hash(s + 4) * span + O.t * sp * dir) % span + span) % span - 20;
        const ph = hash(s + 5) * 6.28;
        const sil = rgb(mix(waterColor(Math.max(0, dz(c * CH))), [3, 8, 18], 0.55));
        if (type === 'school') {
          for (let f = 0; f < 6; f++) {
            const fx = x + (f % 3) * 15 + Math.sin(O.t * 2 + f) * 1.5, fy = y + Math.floor(f / 3) * 9 + (f % 2) * 4;
            drawSprite(ctx, 'fish2', fx, fy, dir < 0);
          }
        } else if (type === 'fish' || type === 'hatchet' || type === 'turtle') {
          drawSprite(ctx, 'minifish', x, y + Math.round(Math.sin(O.t * 2 + ph)), dir < 0, sil);
        } else if (type === 'lantern') {
          // little bioluminescent fish: dot pattern + glow
          const tw = 0.5 + 0.5 * Math.sin(O.t * 3 + ph);
          glow(ctx, x + 3, y + 1, 4, [127, 243, 255], 0.18 * tw);
          ctx.fillStyle = '#1b2a3a'; ctx.fillRect(Math.round(x), Math.round(y), 6, 3);
          ctx.fillStyle = `rgba(127,243,255,${0.5 + 0.5 * tw})`; ctx.fillRect(Math.round(x + 1), Math.round(y + 1), 1, 1); ctx.fillRect(Math.round(x + 3), Math.round(y + 2), 1, 1);
        } else if (type === 'jelly' || type === 'jelly2' || type === 'vamp' || type === 'squidIcon' || type === 'bubbles') {
          const bob = Math.sin(O.t * 1.5 + ph) * 3; y += bob;
          const g = type === 'jelly' ? [255, 143, 209] : type === 'squidIcon' ? [236, 75, 75] : [127, 243, 255];
          if (z >= 2) glow(ctx, x + 4, y + 3, 7, g, 0.14 + 0.06 * Math.sin(O.t * 2 + ph));
          drawSprite(ctx, type, x, y, false);
        } else if (type === 'angler') {
          drawSprite(ctx, 'angler', x, y, dir > 0);
          const lx = dir > 0 ? x + 19 : x + 2; const flick = 0.6 + 0.4 * Math.sin(O.t * 4 + ph);
          glow(ctx, lx, y + 5, 6, [255, 255, 255], 0.3 * flick);
        } else if (type === 'eel') {
          const wig = Math.round(Math.sin(O.t * 3 + ph) * 1);
          drawSprite(ctx, 'eel', x, y + wig, dir < 0);
          glow(ctx, dir < 0 ? x : x + 13, y + 3 + wig, 3, [255, 106, 213], 0.25);
        } else {
          const bob = Math.round(Math.sin(O.t * 2 + ph) * 1);
          drawSprite(ctx, type, x, y + bob, dir < 0);
        }
      }
    }
  }

  function drawSnow(ctx) {
    // marine snow / particles drifting; slightly faster parallax than camera
    const n = O.reduced ? 25 : 70;
    const camPx = O.topM * O.ppm * 1.15;
    for (let i = 0; i < n; i++) {
      const x = (hash(i * 3 + 1) * O.W + Math.sin(O.t * 0.3 + i) * 3) % O.W;
      const sp = 3 + hash(i * 5) * 5;
      const y = ((hash(i * 7) * O.H - camPx + O.t * sp) % O.H + O.H) % O.H;
      const m = O.topM + y / O.ppm; if (m < 4) continue;
      const deep = dz(m) > 1000;
      ctx.fillStyle = deep ? (i % 9 === 0 ? 'rgba(127,243,255,0.55)' : 'rgba(170,200,230,0.28)') : 'rgba(230,250,255,0.35)';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }

  function drawKelp(ctx) {
    // swaying kelp silhouettes on both edges through the sunlit and twilight water
    const mid = dz(O.topM + O.H / O.ppm / 2);
    const a = clamp((mid - 40) / 120, 0, 1) * (1 - clamp((mid - 1400) / 500, 0, 1));
    if (a <= 0.02 || O.tmix > 0.9) return;
    const wc = waterColor(Math.max(0, mid)); ctx.fillStyle = rgb(mix(wc, [2, 8, 18], 0.45), (a * (1 - O.tmix)).toFixed(3));
    const strands = [[0.02, 0.75], [0.06, 0.55], [0.1, 0.4], [0.9, 0.5], [0.95, 0.7], [0.985, 0.45]];
    strands.forEach(([fx, fh], i) => {
      const baseX = O.W * fx, top = O.H * (1 - fh);
      for (let y = O.H; y > top; y -= 2) {
        const k = (O.H - y) / (O.H - top);
        const x = baseX + Math.sin(O.t * 0.8 + i + y * 0.04) * 4 * k;
        ctx.fillRect(Math.round(x), y, 2, 2);
        if ((Math.floor(y / 2) + i) % 7 === 0) ctx.fillRect(Math.round(x) + (i % 2 ? -5 : 2), y, 5, 3); // leaves
      }
    });
  }
  function drawTrench(ctx) {
    const ppm = O.ppm; const startM = 2000 + OFF;
    const yStart = (startM - O.topM) * ppm; if (yStart > O.H) return;
    const floorM = 7120 + OFF; const yFloor = (floorM - O.topM) * ppm;
    for (let y = Math.max(0, Math.floor(yStart)); y < O.H; y += 2) {
      const m = O.topM + y / ppm;
      const t = clamp((m - startM) / 300, 0, 1) * (0.25 + 0.75 * clamp((m - startM) / 4800, 0, 1));
      const nL = Math.sin(m * 0.031) * 6 + Math.sin(m * 0.11) * 3 + hash(Math.floor(m / 6)) * 4;
      const nR = Math.sin(m * 0.027 + 2) * 6 + Math.sin(m * 0.09) * 3 + hash(Math.floor(m / 6) + 999) * 4;
      const wl = Math.max(0, t * O.W * 0.27 + nL), wr = Math.max(0, t * O.W * 0.27 + nR);
      ctx.fillStyle = '#0c1220'; ctx.fillRect(0, y, Math.round(wl), 2); ctx.fillRect(Math.round(O.W - wr), y, Math.round(wr) + 1, 2);
      ctx.fillStyle = '#1a2436'; if (wl > 2) ctx.fillRect(Math.round(wl) - 2, y, 2, 2); if (wr > 2) ctx.fillRect(Math.round(O.W - wr), y, 2, 2);
      if (hash(Math.floor(m)) > 0.97 && wl > 8) { ctx.fillStyle = '#26334a'; ctx.fillRect(Math.round(wl * 0.5), y, 3, 1); }
      if (hash(Math.floor(m) + 77) > 0.985 && wr > 10) { const gx = O.W - wr * (0.3 + hash(Math.floor(m)) * 0.5); glow(ctx, gx, y, 4, [127, 243, 255], 0.3 + 0.2 * Math.sin(O.t * 2 + m)); ctx.fillStyle = '#9ff3f7'; ctx.fillRect(Math.round(gx), y, 1, 1); }
      if (hash(Math.floor(m) + 41) > 0.985 && wl > 10) { const gx = wl * (0.3 + hash(Math.floor(m) + 3) * 0.5); glow(ctx, gx, y, 4, [255, 143, 209], 0.3 + 0.2 * Math.sin(O.t * 2.3 + m)); ctx.fillStyle = '#ffc4ea'; ctx.fillRect(Math.round(gx), y, 1, 1); }
    }
    // boulders: stacked rounded rocks with a lit top-left edge and glowing specks (mockup style)
    const BH = 15, BW = 20;
    const r0 = Math.floor((O.topM * ppm) / BH) - 1, r1 = Math.ceil(((O.topM * ppm) + O.H) / BH) + 1;
    for (let r = r0; r <= r1; r++) {
      const yb = Math.round(r * BH - O.topM * ppm); const m = O.topM + (yb + BH / 2) / ppm;
      if (m < startM + 40) continue;
      const t = clamp((m - startM) / 300, 0, 1) * (0.25 + 0.75 * clamp((m - startM) / 4800, 0, 1));
      for (const side of [0, 1]) {
        const wall = t * O.W * 0.27 + Math.sin(m * (side ? 0.027 : 0.031) + side * 2) * 6;
        const off = (r % 2) * (BW / 2);
        for (let c = 0; c * BW - off < wall - 4; c++) {
          const s = r * 131 + c * 17 + side * 7919;
          const w = BW - 2 - Math.floor(hash(s) * 4), h = BH - 2 - Math.floor(hash(s + 1) * 3);
          let x = c * BW - off + Math.floor(hash(s + 2) * 2);
          if (side) x = O.W - x - w;
          const y = yb + Math.floor(hash(s + 3) * 2);
          ctx.fillStyle = '#1a2334'; ctx.fillRect(x + 1, y, w - 2, h); ctx.fillRect(x, y + 1, w, h - 2);
          ctx.fillStyle = '#29354b'; ctx.fillRect(x + 1, y + 1, w - 3, 2); ctx.fillRect(x + 1, y + 1, 2, h - 3);
          ctx.fillStyle = '#0a0f19'; ctx.fillRect(x + 2, y + h - 2, w - 3, 2); ctx.fillRect(x + w - 1, y + 2, 1, h - 3);
          if (hash(s + 4) > 0.8) { ctx.fillStyle = hash(s + 5) > 0.5 ? 'rgba(255,110,150,0.8)' : 'rgba(110,230,220,0.75)'; ctx.fillRect(x + 3 + Math.floor(hash(s + 6) * (w - 6)), y + 3 + Math.floor(hash(s + 7) * (h - 5)), 1, 1); }
        }
      }
    }
    // dramatic spires rising from the floor and vents
    if (yFloor < O.H + 60) {
      for (let i = 0; i < 9; i++) {
        const cx = Math.round(hash(i * 41) * O.W); const hgt = 25 + hash(i * 43) * 70; const wd = 6 + hash(i * 47) * 14;
        for (let k = 0; k < hgt; k += 2) {
          const ww = Math.max(1, Math.round(wd * (1 - k / hgt)) + (k % 6 === 0 ? 1 : 0));
          ctx.fillStyle = k % 8 < 2 ? '#1a2436' : '#0e1626';
          ctx.fillRect(cx - ww, Math.round(yFloor - k), ww * 2, 2);
        }
      }
      ctx.fillStyle = '#0a0f1a'; ctx.fillRect(0, Math.round(yFloor), O.W, O.H);
      for (let x = 0; x < O.W; x += 2) { ctx.fillStyle = hash(x) > 0.7 ? '#1a2436' : '#111a2a'; ctx.fillRect(x, Math.round(yFloor + (hash(x * 3) * 3)), 2, 2); }
      // hydrothermal vents with glow & tube worms
      for (let i = 0; i < 4; i++) {
        const vx = Math.round(O.W * (0.2 + i * 0.2) + hash(i * 5) * 20);
        glow(ctx, vx, yFloor - 6, 12, [255, 120, 60], 0.12 + 0.05 * Math.sin(O.t * 2 + i));
        for (let w = 0; w < 4; w++) drawSprite(ctx, 'worm', vx - 8 + w * 4, yFloor - 8 - (w % 2) * 2);
        // rising shimmer
        for (let b = 0; b < 5; b++) {
          const by = yFloor - 10 - ((O.t * 10 + b * 9 + i * 7) % 40);
          ctx.fillStyle = 'rgba(255,200,150,0.25)'; ctx.fillRect(vx + Math.round(Math.sin(O.t * 3 + b) * 2), Math.round(by), 1, 1);
        }
      }
    }
  }

  function drawLurker(ctx, ySurf) {
    // the title screen's faint shrimp, lurking in the dark at the right
    if (O.tmix < 0.05 || O.view !== 'title') return;
    const x = Math.round(O.W * 0.75), y = Math.round(ySurf + O.H * 0.075 + Math.sin(O.t * 1.3) * 2);
    if (y > O.H) return;
    glow(ctx, x + 10, y + 10, 14, [255, 60, 80], 0.22 * O.tmix);
    ctx.globalAlpha = 0.95 * O.tmix;
    const ls = sprite('curl' + (Math.floor(O.t * 3) % 2)); ctx.drawImage(ls.c, x, y);
    ctx.globalAlpha = 1;
    if (Math.random() < 0.03 && !O.reduced) O.bubbles.push({ x: x + 2, y, vy: -6, life: 3 });
  }
  function drawShrimp(ctx) {
    if (!O.showShrimp) return;
    const sx = shrimpX(); const sy = (shrimpWorld() - O.topM) * O.ppm;
    if (sy < -20 || sy > O.H + 20) return;
    const frame = Math.floor(O.t * (O.sinking ? 10 : 4)) % 2;
    const bob = O.sinking ? 0 : Math.round(Math.sin(O.t * 2.2) * 1.5);
    const m = O.shrimpM;
    if (m > 800) glow(ctx, sx + 8, sy + 5, 18, [140, 220, 255], clamp((m - 800) / 3000, 0, 1) * 0.08);
    const cs = sprite('curl' + frame); const k2 = 1;
    glow(ctx, sx + cs.w / 2, Math.round(sy) + bob + cs.h / 2, 12, [255, 70, 80], 0.2);
    ctx.drawImage(cs.c, sx, Math.round(sy) + bob, cs.w * k2, cs.h * k2);
    // idle bubbles
    if (!O.reduced && Math.random() < (O.sinking ? 0.5 : 0.04)) O.bubbles.push({ x: sx + 12 + Math.random() * 4, y: sy, vy: -(8 + Math.random() * 10), life: 3 });
  }

  function drawBubbles(ctx, dt) {
    const camV = O.camV || 0; // m/s camera velocity, bubbles stream upward relative to screen
    for (let i = O.bubbles.length - 1; i >= 0; i--) {
      const b = O.bubbles[i];
      b.y += (b.vy - camV * O.ppm) * dt; b.x += Math.sin(O.t * 4 + i) * 0.15; b.life -= dt;
      if (b.life <= 0 || b.y < -5) { O.bubbles.splice(i, 1); continue; }
      ctx.fillStyle = 'rgba(200,240,255,0.7)';
      const big = b.big ? 2 : 1;
      ctx.fillRect(Math.round(b.x), Math.round(b.y), big, big);
      if (b.big) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(Math.round(b.x), Math.round(b.y), 1, 1); }
    }
  }

  function vignette(ctx) {
    const m = O.topM + O.H / O.ppm / 2;
    const a = clamp((dz(m) - 1500) / 5000, 0, 0.55);
    if (a <= 0) return;
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const pad = Math.round((i + 1) * Math.min(O.W, O.H) * 0.035);
      ctx.fillStyle = `rgba(0,0,6,${(a / steps).toFixed(3)})`;
      ctx.fillRect(0, 0, O.W, pad); ctx.fillRect(0, O.H - pad, O.W, pad);
      ctx.fillRect(0, 0, pad, O.H); ctx.fillRect(O.W - pad, 0, pad, O.H);
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - (O.last || now)) / 1000); O.last = now; O.t += dt;
    // shrimp tween
    if (O.tweenDur > 0) {
      const p = clamp((now - O.tweenT0) / O.tweenDur, 0, 1);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      O.shrimpM = lerp(O.shrimpFrom, O.shrimpTo, e); O.sinking = p < 1;
      if (O.onDepth) O.onDepth(O.shrimpM, p >= 1);
      if (p >= 1) { O.tweenDur = 0; O.sinking = false; }
    }
    // shrimp glides between its idle spot and center stage during a descent
    const sxTarget = O.sxTarget !== null && O.sxTarget !== undefined ? O.sxTarget : (window.innerWidth < 700 ? 0.08 : 0.1);
    O.sxf = O.sxf === undefined ? sxTarget : O.sxf + (sxTarget - O.sxf) * (O.reduced ? 1 : 1 - Math.exp(-dt * 3));
    const target = viewTop();
    const prev = O.topM;
    if (O.topM < -5000 || O.reduced) O.topM = target;
    else O.topM += (target - O.topM) * (1 - Math.exp(-dt * (O.sinking ? 9 : 2.6)));
    O.camV = dt > 0 ? (O.topM - prev) / dt : 0;

    const tm = O.view === 'game' || O.view === 'intro' ? 0 : 1;
    O.tmix = O.reduced ? tm : O.tmix + (tm - O.tmix) * (1 - Math.exp(-dt * 2.2));
    const ctx = O.ctx; const ySurf = (0 - O.topM) * O.ppm;
    ctx.clearRect(0, 0, O.W, O.H);
    drawSky(ctx, 0, ySurf);
    // dusk over the sky on the results screen
    O.dusk = (O.dusk || 0) + ((O.view === 'results' ? 1 : 0) - (O.dusk || 0)) * (O.reduced ? 1 : 1 - Math.exp(-dt * 2));
    if (O.dusk > 0.01 && ySurf > 0) { ctx.fillStyle = `rgba(22,30,46,${(0.78 * O.dusk).toFixed(3)})`; ctx.fillRect(0, 0, O.W, Math.ceil(ySurf) + 3); }
    drawWater(ctx, ySurf);
    drawRays(ctx, ySurf);
    drawFar(ctx);
    drawKelp(ctx);
    drawTrench(ctx);
    if (O.tmix < 0.98) { ctx.globalAlpha = 1 - O.tmix; drawCreatures(ctx); ctx.globalAlpha = 1; }
    drawLurker(ctx, ySurf);
    drawSnow(ctx);
    drawSurface(ctx, ySurf);
    drawShrimp(ctx);
    drawBubbles(ctx, dt);
    vignette(ctx);
    requestAnimationFrame(frame);
  }

  // ---------- public API ----------
  const Ocean = {
    ZONES, zoneIndex, waterColor, drawSprite, sprite,
    init(canvas) {
      O.canvas = canvas; O.ctx = canvas.getContext('2d');
      for (let i = 0; i < 9; i++) O.clouds.push(makeCloud(i * 19 + 3));
      resize(); window.addEventListener('resize', resize);
      requestAnimationFrame(frame);
    },
    setView(v, instant) { O.view = v; O.showShrimp = v === 'game' || v === 'intro'; if (instant) O.topM = viewTop(); },
    setReduced(r) { O.reduced = !!r; },
    setDepth(m, opts = {}) {
      if (opts.instant || O.reduced) { O.shrimpM = m; O.tweenDur = 0; O.sinking = false; if (O.onDepth) O.onDepth(m, true); return 0; }
      O.shrimpFrom = O.shrimpM; O.shrimpTo = m; O.tweenT0 = performance.now();
      O.tweenDur = opts.duration || clamp(900 + Math.abs(m - O.shrimpM) * 1.6, 900, 2800);
      for (let i = 0; i < 14; i++) O.bubbles.push({ x: shrimpX() + 6 + Math.random() * 10, y: (shrimpWorld() - O.topM) * O.ppm, vy: -(10 + Math.random() * 25), life: 2.5, big: Math.random() < 0.4 });
      return O.tweenDur;
    },
    get depth() { return O.shrimpM; },
    burst(n = 10) { for (let i = 0; i < n; i++) O.bubbles.push({ x: shrimpX() + Math.random() * 16, y: (shrimpWorld() - O.topM) * O.ppm, vy: -(12 + Math.random() * 20), life: 2, big: Math.random() < 0.5 }); },
    set onDepth(fn) { O.onDepth = fn; },
    setShrimpX(f) { O.sxTarget = f; },
    // CSS-pixel screen position helpers for DOM overlays
    depthToScreenY(d) { return ((OFF + d) - O.topM) * O.ppm * O.scale; },
    screenYToDepth(y) { return y / (O.ppm * O.scale) + O.topM - OFF; },
    shrimpScreen() { return { x: (shrimpX() + 8) * O.scale, y: ((shrimpWorld() - O.topM) * O.ppm + 5) * O.scale }; },
  };
  window.Ocean = Ocean;
})();

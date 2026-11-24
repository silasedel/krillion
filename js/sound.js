// Krillion — tiny synthesized retro sound effects (WebAudio, no files).
(function () {
  'use strict';
  let ac = null, master = null, amb = null;
  const S = { enabled: true, volume: 0.5, ambience: true };

  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ac = new AC(); master = ac.createGain(); master.gain.value = S.volume * 0.5; master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, dur, { type = 'square', vol = 0.25, at = 0, slide = 0, attack = 0.005 } = {}) {
    const a = ctx(); if (!a || !S.enabled) return;
    const t = a.currentTime + at;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, { vol = 0.15, at = 0, freq = 800, q = 1, sweep = 0 } = {}) {
    const a = ctx(); if (!a || !S.enabled) return;
    const t = a.currentTime + at;
    const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t + dur);
    const g = a.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }

  const NOTES = { 10: [523], 15: [523, 659], 30: [523, 659, 784], 60: [523, 659, 784, 1047], 85: [587, 740, 880, 1175, 1480], 100: [523, 659, 784, 1047, 1319, 1568, 2093] };
  const Sound = {
    settings: S,
    unlock() { ctx(); },
    setEnabled(v) { S.enabled = !!v; if (!v) this.stopAmbience(); else if (S.ambience) this.startAmbience(); },
    setVolume(v) { S.volume = v; if (master) master.gain.value = v * 0.5; },
    key() { tone(1200 + Math.random() * 300, 0.025, { vol: 0.04, type: 'square' }); },
    click() { tone(880, 0.05, { vol: 0.12 }); tone(1320, 0.05, { vol: 0.08, at: 0.04 }); },
    start() { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.12, { at: i * 0.07, vol: 0.14 })); noise(0.6, { at: 0.25, vol: 0.12, freq: 600, sweep: -450 }); },
    tick(urgent) { tone(urgent ? 990 : 660, 0.04, { vol: urgent ? 0.12 : 0.06, type: 'triangle' }); },
    read() { tone(440, 0.07, { vol: 0.08, type: 'triangle' }); },
    go() { tone(880, 0.12, { vol: 0.14, type: 'triangle' }); },
    wrong() { tone(196, 0.16, { vol: 0.16, type: 'sawtooth', slide: -60 }); tone(147, 0.18, { at: 0.09, vol: 0.14, type: 'sawtooth', slide: -40 }); },
    dup() { tone(330, 0.07, { vol: 0.1 }); tone(330, 0.07, { at: 0.1, vol: 0.1 }); },
    correct(score) { (NOTES[score] || NOTES[10]).forEach((f, i) => tone(f, 0.14, { at: i * 0.075, vol: 0.15, type: i % 2 ? 'square' : 'triangle' })); },
    miss() { [392, 330, 262].forEach((f, i) => tone(f, 0.16, { at: i * 0.1, vol: 0.12, type: 'triangle' })); },
    descend(ms) { noise(Math.max(0.5, ms / 1000), { vol: 0.08, freq: 900, sweep: -800, q: 0.7 }); for (let i = 0; i < 6; i++) tone(700 + Math.random() * 900, 0.04, { at: Math.random() * (ms / 1000), vol: 0.05, type: 'sine', slide: 300 }); },
    finish() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.18, { at: i * 0.11, vol: 0.14 })); },
    startAmbience() {
      const a = ctx(); if (!a || amb || !S.enabled || !S.ambience) return;
      const o1 = a.createOscillator(), o2 = a.createOscillator(), g = a.createGain(), f = a.createBiquadFilter(), lfo = a.createOscillator(), lg = a.createGain();
      o1.type = 'sine'; o2.type = 'sine'; o1.frequency.value = 55; o2.frequency.value = 82.4;
      f.type = 'lowpass'; f.frequency.value = 300; g.gain.value = 0.0001;
      lfo.frequency.value = 0.08; lg.gain.value = 0.02; lfo.connect(lg); lg.connect(g.gain);
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(master);
      g.gain.setTargetAtTime(0.035, a.currentTime, 2);
      o1.start(); o2.start(); lfo.start();
      amb = { o1, o2, lfo, g };
    },
    stopAmbience() { if (!amb) return; const a = ctx(); amb.g.gain.setTargetAtTime(0.0001, a.currentTime, 0.3); const x = amb; setTimeout(() => { try { x.o1.stop(); x.o2.stop(); x.lfo.stop(); } catch (e) {} }, 1200); amb = null; },
    setAmbience(v) { S.ambience = !!v; if (v) this.startAmbience(); else this.stopAmbience(); },
  };
  window.Sound = Sound;
})();

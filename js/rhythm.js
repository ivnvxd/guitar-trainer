/* Rhythm: note values, strumming patterns, metronome plans and tap scoring, as data and pure functions.
   Plain script: it defines window.GT.rhythm, and module.exports under Node for the tests.
   Time inside a bar is counted in ticks: 12 ticks to a quarter note. Eighths (6), sixteenths (3) and the eighths
   of a triplet (4) are then whole numbers. */
(function (root) {
  'use strict';

  const VALUES = { w: 48, h: 24, q: 12, e: 6, s: 3, t: 4 };
  const VALUE_NAMES = { w: 'whole', h: 'half', q: 'quarter', e: 'eighth', s: 'sixteenth', t: 'triplet eighth' };

  // A bar written as tokens: a value letter (w h q e s, t for a triplet eighth), a dot for a dotted note,
  // r for a rest, and ~ to tie the note to the next one. "q. e q q" is a dotted quarter, an eighth and two quarters.
  function parse(text) {
    return text.trim().split(/\s+/).map(tok => {
      const m = tok.match(/^([whqest])(\.?)(r?)(~?)$/);
      if (!m) throw new Error(`Not a rhythm token: ${tok}`);
      const base = VALUES[m[1]];
      return { value: m[1], dot: !!m[2], rest: !!m[3], tie: !!m[4], d: m[2] ? base * 1.5 : base };
    });
  }
  const barTicks = sig => sig[0] * (48 / sig[1]);
  // 6/8 and 12/8 count in dotted quarters. Their beat is three eighths.
  const compound = sig => sig[1] === 8 && sig[0] % 3 === 0;
  const beatTicks = sig => compound(sig) ? 18 : 48 / sig[1];
  const beatsIn = sig => barTicks(sig) / beatTicks(sig);
  const length = events => events.reduce((n, e) => n + e.d, 0);

  // Where each sound starts, in ticks from the start of the bar. A rest makes no sound, and a tied note rings on.
  function onsets(events) {
    const out = [];
    let at = 0, tied = false;
    for (const e of events) {
      if (!e.rest && !tied) out.push(at);
      tied = e.tie && !e.rest;
      at += e.d;
    }
    return out;
  }

  // Ticks to seconds at a tempo in beats per minute. Swing moves each off-beat eighth later:
  // 0.5 is straight, 2/3 is a triplet shuffle. Only eighths in 2/4, 3/4 and 4/4 swing.
  function seconds(tick, bpm, sig, swing = 0.5) {
    const beat = beatTicks(sig), n = Math.floor(tick / beat), p = tick - n * beat;
    let frac = p / beat;
    if (swing !== 0.5 && beat === 12) frac = p <= 6 ? (p / 6) * swing : swing + ((p - 6) / 6) * (1 - swing);
    return (n + frac) * 60 / bpm;
  }
  const barSeconds = (bpm, sig) => beatsIn(sig) * 60 / bpm;
  // A bar as sounds for the player: a held tone for each note (a tie makes it longer), nothing for a rest.
  // step is the place of the event in the bar, so a page can light the note that sounds.
  function toneEvents(events, bpm, sig, swing = false, midi = 72) {
    const out = [], ratio = swing ? 2 / 3 : 0.5;
    let at = 0, tied = false;
    events.forEach((e, i) => {
      let len = e.d;
      for (let k = i; events[k] && events[k].tie && events[k + 1]; k++) len += events[k + 1].d;
      const t = seconds(at, bpm, sig, ratio), end = seconds(at + len, bpm, sig, ratio);
      out.push({ t, step: i, sound: e.rest || tied ? 'none' : 'tone', midis: [midi], dur: Math.max(0.08, (end - t) * 0.9), accent: at % beatTicks(sig) === 0 });
      tied = e.tie && !e.rest;
      at += e.d;
    });
    return out;
  }

  // The counting syllable at a place in the bar: 1 e & a, 1 trip let, and 1 2 3 4 5 6 in 6/8.
  function count(tick, sig) {
    if (compound(sig)) return tick % 6 === 0 ? String(tick / 6 + 1) : '';
    const beat = Math.floor(tick / 12) + 1, p = tick % 12;
    return { 0: String(beat), 3: 'e', 6: '&', 9: 'a', 4: 'trip', 8: 'let' }[p] || '';
  }

  // ---------- strumming patterns ----------
  // One bar of slots. sub is the number of slots in a beat: 2 for eighths, 4 for sixteenths, 3 for the eighths of
  // a 6/8 beat. A slot is
  //   x  a strum          X  an accented strum
  //   m  a muted strum, a "chuck"     M  an accented chuck
  //   b  the bass note of the chord
  //   .  a ghost stroke: the hand moves, but misses the strings
  // The hand goes down on the beat and up between: down on even slots, up on odd ones. A pattern that breaks this,
  // such as the 6/8 one, gives its strokes. The names say the strokes, so they need no source.
  const PATTERNS = [
    { id: 'quarters', name: 'Quarter downs', sig: [4, 4], sub: 2, slots: 'x.x.x.x.', line: 'One down stroke on each beat. The hand still moves up between them, without a sound.' },
    { id: 'eighths', name: 'Eighths', sig: [4, 4], sub: 2, slots: 'xxxxxxxx', line: 'Down on each number, up on each &. The hand never stops.' },
    { id: 'd-du-udu', name: 'D – D U – U D U', sig: [4, 4], sub: 2, slots: 'x.xx.xxx', line: 'The pattern most pop and folk songs use. The hand keeps moving in eighths and misses the strings on the gaps.' },
    { id: 'shuffle', name: 'D – D U – U D U, swung', sig: [4, 4], sub: 2, slots: 'x.xx.xxx', swing: true, line: 'The same strokes with a swing: each up stroke comes late, as in a shuffle or a blues.' },
    { id: 'push', name: 'D – D U – U – U', sig: [4, 4], sub: 2, slots: 'x.xx.x.x', line: 'The up strokes at the end push into the next bar.' },
    { id: 'backbeat', name: 'Eighths, accents on 2 and 4', sig: [4, 4], sub: 2, slots: 'xxXxxxXx', line: 'Strum every eighth, and hit beats 2 and 4 harder, as a rock drummer hits the snare.' },
    { id: 'chucks', name: 'D – × U D – × U', sig: [4, 4], sub: 2, slots: 'x.Mxx.Mx', line: 'A muted strum (×) on 2 and 4 sounds like a snare drum. Ease the fretting hand off the strings, or lay the strumming hand on them.' },
    { id: 'offbeats', name: 'Up strokes on the &s', sig: [4, 4], sub: 2, slots: '.x.x.x.x', short: true, line: 'Short chords between the beats, as in reggae and ska. Stop each chord right after you play it.' },
    { id: 'boom-chick', name: 'Bass, strum, bass, strum', sig: [4, 4], sub: 2, slots: 'b.x.b.x.', line: 'The bass note on 1 and 3, a strum on 2 and 4, as in country music.' },
    { id: 'waltz', name: 'Bass, strum, strum (3/4)', sig: [3, 4], sub: 2, slots: 'b.x.x.', line: 'A waltz: the bass note on 1, strums on 2 and 3.' },
    { id: 'six-eight', name: 'D D U D D U (6/8)', sig: [6, 8], sub: 3, slots: 'xxxxxx', strokes: 'DDUDDU', line: 'Two groups of three eighths. Each group starts with a down stroke, for ballads in 6/8.' },
    { id: 'triplets', name: 'Triplets: D U D on each beat', sig: [4, 4], sub: 3, slots: 'xxxxxxxxxxxx', strokes: 'DUDDUDDUDDUD', line: 'Three strokes in each beat: count 1 trip let. Each beat starts with a down stroke.' },
    { id: 'sixteenths', name: 'Sixteenths', sig: [4, 4], sub: 4, slots: 'xxxxxxxxxxxxxxxx', line: 'Four strokes on each beat: 1 e & a. Down on 1 and &, up on e and a.' },
    { id: 'gallop', name: 'D – D U on each beat', sig: [4, 4], sub: 4, slots: 'x.xxx.xxx.xxx.xx', line: 'A galloping 16th pattern from rock. The hand moves in sixteenths and misses the second one of each beat.' },
    { id: 'funk', name: 'Sixteenths with chucks on 2 and 4', sig: [4, 4], sub: 4, slots: 'x.xxM.x.x.xxM.xx', line: 'Keep the hand moving in sixteenths and hit only the marked strokes. The chucks fall on 2 and 4.' }
  ];
  const patternById = id => PATTERNS.find(p => p.id === id);
  // The grids of a pattern you write yourself. Triplets and 6/8 start each beat with a down stroke.
  const GRIDS = [
    { id: '4-8', name: '4/4 eighths', sig: [4, 4], sub: 2 },
    { id: '4-16', name: '4/4 sixteenths', sig: [4, 4], sub: 4 },
    { id: '4-3', name: '4/4 triplets', sig: [4, 4], sub: 3, beat: 'DUD' },
    { id: '3-8', name: '3/4', sig: [3, 4], sub: 2 },
    { id: '6-8', name: '6/8', sig: [6, 8], sub: 3, beat: 'DDU' }
  ];
  const gridOf = p => GRIDS.find(g => g.sig[0] === p.sig[0] && g.sig[1] === p.sig[1] && g.sub === p.sub) || GRIDS[0];
  // Your pattern: a grid and its slots. Slots that do not fit the grid are cut, or filled with ghost strokes.
  // swing: the eighths long-short, for a grid of eighths in 2/4, 3/4 or 4/4.
  function customPattern(gridId, slots, swing = false) {
    const g = GRIDS.find(x => x.id === gridId) || GRIDS[0], n = beatsIn(g.sig) * g.sub;
    const fixed = [...(slots || '')].filter(c => 'xXmMb.'.includes(c)).slice(0, n).join('').padEnd(n, '.');
    return { id: 'custom', name: 'Your pattern', grid: g.id, sig: g.sig, sub: g.sub, slots: fixed, swing: !!swing && g.sub === 2 && !compound(g.sig),
      strokes: g.beat ? g.beat.repeat(beatsIn(g.sig)) : undefined, line: 'Your own pattern. The page keeps it in this browser.' };
  }
  // A slot after a tap with a stroke picked: the stroke goes in, or comes out when it is there already.
  const STROKE_SLOT = { strum: 'x', accent: 'X', chuck: 'm', bass: 'b', miss: '.' };
  const paint = (slot, stroke) => STROKE_SLOT[stroke] === slot ? '.' : STROKE_SLOT[stroke];
  // The strokes of a pattern, slot by slot: what the hand does, which way it goes, and where it is in ticks.
  function strokes(p) {
    const step = beatTicks(p.sig) / p.sub;
    return [...p.slots].map((ch, i) => ({
      kind: { x: 'hit', X: 'hit', m: 'chuck', M: 'chuck', b: 'bass', '.': 'ghost' }[ch],
      accent: ch === 'X' || ch === 'M',
      dir: p.strokes ? p.strokes[i] : i % 2 ? 'U' : 'D',
      tick: i * step,
      label: count(i * step, p.sig)
    }));
  }

  // A pattern as one bar of rhythm notation: "q e e~ e e e e" for D – D U – U D U. A strum rings until the next one
  // that sounds, and a ghost stroke before the first one is a rest. A note that crosses a beat is tied over it.
  // A short pattern (offbeats) stops each chord at once: the rest of its slot time is a rest.
  // at: for each slot that sounds, the index of its note in the bar, to light it as it plays.
  function patternBar(p) {
    const n = p.slots.length, perBeat = p.sub, comp = compound(p.sig);
    const sounds = [...p.slots].map((c, i) => c !== '.' ? i : -1).filter(i => i >= 0);
    const parts = [];
    if (!sounds.length) parts.push({ from: 0, len: n, rest: true });
    else if (sounds[0] > 0) parts.push({ from: 0, len: sounds[0], rest: true });
    sounds.forEach((i, k) => {
      const end = k + 1 < sounds.length ? sounds[k + 1] : n;
      if (p.short) { parts.push({ from: i, len: 1, slot: i }); if (end > i + 1) parts.push({ from: i + 1, len: end - i - 1, rest: true }); }
      else parts.push({ from: i, len: end - i, slot: i });
    });
    // The value of a piece inside one beat, by its length in slots.
    const value = len => perBeat === 4 ? ['s', 'e', 'e.', 'q'][len - 1] : perBeat === 2 ? ['e', 'q'][len - 1]
      : comp ? ['e', 'q', 'q.'][len - 1] : null;
    const toks = [], at = {};
    for (const part of parts) {
      const pieces = [];
      for (let a = part.from; a < part.from + part.len;) {
        const b = Math.min(part.from + part.len, (Math.floor(a / perBeat) + 1) * perBeat);
        const v = value(b - a);
        // Triplets in a simple meter: a whole beat is a quarter, else each triplet eighth is its own note, tied.
        if (v) pieces.push(v);
        else if (b - a === perBeat) pieces.push('q');
        else for (let k = a; k < b; k++) pieces.push('t');
        a = b;
      }
      if (part.slot !== undefined) at[part.slot] = toks.length;
      pieces.forEach((v, k) => toks.push(v + (part.rest ? 'r' : k < pieces.length - 1 ? '~' : '')));
    }
    return { bar: toks.join(' '), at };
  }

  // A simple drum beat for a bar: the kick on the strong beats, the snare on the others, a hi-hat on every eighth
  // (on the first and last eighth of each beat for triplets, for a shuffle). In 3/4 the kick takes beat 1 only.
  function drumBeat(sig, sub) {
    const beats = beatsIn(sig), beat = beatTicks(sig), out = [];
    for (let b = 0; b < beats; b++) {
      out.push({ tick: b * beat, kind: beats === 3 ? (b ? 'snare' : 'kick') : b % 2 ? 'snare' : 'kick' });
      const hats = compound(sig) ? [0, 6, 12] : sub === 3 ? [0, 8] : [0, 6];
      for (const t of hats) out.push({ tick: b * beat + t, kind: 'hat' });
    }
    return out;
  }

  // ---------- metronome ----------
  // The clicks of one bar. sub: clicks in a beat. accent: beat 1 is higher. backbeat: only beats 2 and 4 click.
  // gap [on, off]: bars with the click, then bars without it. mute: the chance that a beat is silent, from rand
  // (a seeded function in the tests). The first bar always clicks, so you hear the tempo.
  function clickPlan(bar, o, rand = Math.random) {
    const silentBar = !!o.gap && bar % (o.gap[0] + o.gap[1]) >= o.gap[0];
    const out = [];
    for (let b = 0; b < o.beats; b++) {
      const muted = silentBar || (o.backbeat && b % 2 === 0) || (bar > 0 && o.mute > 0 && rand() < o.mute);
      for (let s = 0; s < (o.sub || 1); s++) out.push({ beat: b, sub: s, accent: o.accent !== false && b === 0 && s === 0, sound: !muted });
    }
    return out;
  }
  // A tempo that rises: step beats per minute after every `every` bars, up to max.
  const rampBpm = (bpm, bar, ramp) => ramp ? Math.min(ramp.max, bpm + ramp.step * Math.floor(bar / ramp.every)) : bpm;

  // ---------- tapping ----------
  // Taps against the times you should tap (both in seconds, the taps already corrected by the calibration).
  // Each expected time takes the nearest free tap inside the window. The rest are missed times and extra taps.
  // each: one entry for each expected time, in order, with its offset in seconds or null for a miss.
  function scoreTaps(expected, taps, windowSec = 0.12) {
    const free = taps.slice().sort((a, b) => a - b), hits = [], missed = [], each = [];
    for (const t of expected) {
      let best = -1;
      free.forEach((tap, i) => { if (Math.abs(tap - t) <= windowSec && (best < 0 || Math.abs(tap - t) < Math.abs(free[best] - t))) best = i; });
      if (best < 0) { missed.push(t); each.push({ at: t, offset: null }); continue; }
      hits.push({ at: t, offset: free[best] - t });
      each.push(hits[hits.length - 1]);
      free.splice(best, 1);
    }
    return { hits, missed, extra: free, each, ok: !missed.length && !free.length };
  }
  // The delay of your device, from taps on clicks: the offsets in milliseconds. The lowest and the highest drop out.
  function calibrate(offsets) {
    const s = offsets.slice().sort((a, b) => a - b);
    const mid = s.length >= 5 ? s.slice(1, -1) : s;
    return mid.length ? Math.round(mid.reduce((a, b) => a + b, 0) / mid.length) : 0;
  }
  // Taps that keep a pulse: how much faster or slower than the click they got (in percent, plus is faster),
  // and how even they are (the spread of the gaps between taps, in milliseconds). A fixed delay changes neither.
  function pulse(taps, period) {
    const gaps = [];
    for (let i = 1; i < taps.length; i++) gaps.push(taps[i] - taps[i - 1]);
    if (gaps.length < 2) return null;
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((a, g) => a + (g - mean) * (g - mean), 0) / gaps.length);
    return { drift: Math.round((period - mean) / period * 1000) / 10, spread: Math.round(sd * 1000) };
  }

  // ---------- one-bar rhythms for the drills, in the order you learn them ----------
  const STAGES = [
    { id: 'quarters', name: 'Whole, half and quarter notes', bars: ['q q q q', 'h h', 'w', 'h q q', 'q q h', 'q h q', 'h. q', 'q h.'] },
    { id: 'rests', name: 'Quarter rests', bars: ['q qr q q', 'q q qr q', 'qr q q q', 'h qr q', 'q q q qr', 'qr q qr q'] },
    { id: 'eighths', name: 'Eighth notes', bars: ['e e q q q', 'q e e q q', 'q q e e q', 'q q q e e', 'e e e e q q', 'q q e e e e', 'e e q e e q', 'e e e e e e e e'] },
    { id: 'offbeats', name: 'Eighth rests and off-beats', bars: ['er e q q q', 'q er e q q', 'e q e q q', 'q e q e q', 'er e er e q q', 'q q er e q'] },
    { id: 'dotted', name: 'Dotted quarters and ties', bars: ['q. e q q', 'q q q. e', 'q. e q. e', 'h q. e', 'q. e h', 'h~ e e q'] },
    { id: 'sixteenths', name: 'Sixteenth notes', bars: ['s s s s q q q', 'q s s s s q q', 'e s s q q q', 's s e q q q', 's s s s s s s s q q', 'e. s q q q'] },
    { id: 'triplets', name: 'Triplets', bars: ['t t t q q q', 'q t t t q q', 't t t t t t q q', 'q q t t t q', 't t t q t t t q'] }
  ];
  const ALL_BARS = STAGES.flatMap(s => s.bars);

  // ---------- the counting lessons of the Library ----------
  // Each example is one bar with a signature. The page draws it, counts it and plays it.
  const LESSONS = [
    { id: 'beats', name: 'Beats and bars', text: [
      'A beat is the pulse you tap your foot to. Beats come in groups called bars. In 4/4 a bar has four beats: count 1 2 3 4.',
      'A quarter note lasts one beat, a half note two beats and a whole note four beats.'],
      examples: [['Quarter notes', [4, 4], 'q q q q'], ['Half notes', [4, 4], 'h h'], ['A whole note', [4, 4], 'w'], ['Mixed', [4, 4], 'h q q']] },
    { id: 'eighths', name: 'Eighth notes', text: [
      'An eighth note lasts half a beat. Count the second half of each beat as "and", written &: 1 & 2 & 3 & 4 &.',
      'On the guitar the hand goes down on the numbers and up on the &s. It keeps that motion even when it does not strum.'],
      examples: [['Eighth notes', [4, 4], 'e e e e e e e e'], ['Quarters and eighths', [4, 4], 'q e e q e e'], ['Eighths on 3 and 4', [4, 4], 'q q e e e e']] },
    { id: 'rests', name: 'Rests', text: [
      'A rest is a silence of a set length. A quarter rest lasts one beat, an eighth rest half a beat. Keep counting through it.'],
      examples: [['Quarter rests', [4, 4], 'q qr q qr'], ['A rest on the beat', [4, 4], 'qr q q q'], ['Off-beat eighths', [4, 4], 'er e er e er e er e']] },
    { id: 'dots', name: 'Dots and ties', text: [
      'A dot adds half the value: a dotted half note lasts three beats, a dotted quarter one and a half.',
      'A tie joins two notes into one longer sound. Play the first and hold it through the second.'],
      examples: [['A dotted half', [4, 4], 'h. q'], ['Dotted quarter and eighth', [4, 4], 'q. e q q'], ['A tie over the beat', [4, 4], 'q e e~ e e q']] },
    { id: 'sixteenths', name: 'Sixteenth notes', text: [
      'A sixteenth note lasts a quarter of a beat. Count 1 e & a, 2 e & a.',
      'In a 16th strum the hand goes down on 1 and &, and up on e and a.'],
      examples: [['Sixteenths', [4, 4], 's s s s s s s s s s s s s s s s'], ['Eighth and two sixteenths', [4, 4], 'e s s e s s e s s e s s'], ['Two sixteenths and an eighth', [4, 4], 's s e s s e q q']] },
    { id: 'triplets', name: 'Triplets', text: [
      'A triplet puts three notes in the time of two. Eighth-note triplets fit three notes in one beat: count 1 trip let, 2 trip let.'],
      examples: [['Triplets on each beat', [4, 4], 't t t t t t t t t t t t'], ['Triplets and quarters', [4, 4], 't t t q t t t q']] },
    { id: 'signatures', name: 'Time signatures', text: [
      'The top number says how many beats are in a bar, the bottom number which note gets one beat: 4 for a quarter note, 8 for an eighth.',
      '3/4 has three beats: a waltz. 6/8 has six eighths in two groups of three, so it feels like two slow beats that each split in three.'],
      examples: [['3/4', [3, 4], 'q q q'], ['2/4', [2, 4], 'q q'], ['6/8', [6, 8], 'e e e e e e'], ['12/8', [12, 8], 'e e e e e e e e e e e e']] },
    { id: 'swing', name: 'Swing', text: [
      'Written eighths can be played straight (even) or swung. Swung eighths are long-short: the & comes late, about two thirds through the beat.',
      'Blues, jazz and shuffle songs swing. Most pop and rock is straight.'],
      examples: [['Straight eighths', [4, 4], 'e e e e e e e e'], ['Swung eighths', [4, 4], 'e e e e e e e e', true]] }
  ];

  // ---------- drawing (browser only) ----------
  // A bar of rhythm on one line, as drum and rhythm parts are written. The notes sit where they fall in the bar,
  // so a longer note takes more room. Noteheads, stems, beams, flags, dots, ties and rests are all drawn as shapes,
  // not as music font glyphs, which some phones lack.
  // opts: { sig (draws the time signature), count (the counting syllable under each note and rest), label }
  const NS = 'http://www.w3.org/2000/svg';
  function notation(events, sig, opts = {}) {
    const svg = document.createElementNS(NS, 'svg');
    const el = (name, attrs, parent = svg) => { const n = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); parent.appendChild(n); return n; };
    const W = 320, Y = opts.small ? 40 : 46, H = opts.count || opts.marks ? 92 : opts.small ? 54 : 70, left = opts.sig ? 40 : 18, right = 14;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'rhythm' + (opts.small ? ' rhythm-small' : ''));
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', opts.label || 'A bar of rhythm');
    el('line', { x1: 4, x2: W - 4, y1: Y, y2: Y, class: 'rh-line' });
    el('line', { x1: W - 4, x2: W - 4, y1: Y - 12, y2: Y + 12, class: 'rh-bar' });
    if (opts.sig) {
      el('text', { x: 18, y: Y - 3, class: 'rh-sig' }).textContent = String(sig[0]);
      el('text', { x: 18, y: Y + 17, class: 'rh-sig' }).textContent = String(sig[1]);
    }
    const total = barTicks(sig), span = W - left - right;
    const xOf = tick => left + tick / total * span;
    // Where each event sits, and the beam group it belongs to: one beat, or three eighths in 6/8.
    const group = beatTicks(sig);
    let at = 0;
    const items = events.map((e, i) => { const it = Object.assign({}, e, { i, tick: at, x: xOf(at), group: Math.floor(at / group) }); at += e.d; return it; });
    const stemTop = Y - 30, beamable = it => !it.rest && it.d < 12 && it.value !== 'q';
    const heads = [];
    for (const it of items) {
      const g = el('g', { class: 'rh-ev', 'data-i': it.i });
      // marks: a result under a note, in place of its count, for example "+40" after a tap.
      const mark = opts.marks && opts.marks[it.i];
      if (mark) el('text', { x: it.x, y: H - 6, class: `rh-count rh-mark is-${mark.kind}` }, g).textContent = mark.text;
      else if (opts.count) el('text', { x: it.x, y: H - 6, class: 'rh-count' }, g).textContent = count(it.tick, sig);
      if (it.rest) { rest(el, g, it.value, it.x, Y); if (it.dot) el('circle', { cx: it.x + 9, cy: Y - 5, r: 1.8, class: 'rh-ink' }, g); continue; }
      const hollow = it.value === 'w' || it.value === 'h';
      el('ellipse', { cx: it.x, cy: Y, rx: 6, ry: 4.3, transform: `rotate(-20 ${it.x} ${Y})`, class: hollow ? 'rh-head is-hollow' : 'rh-head' }, g);
      if (it.dot) el('circle', { cx: it.x + 11, cy: Y - 4, r: 1.9, class: 'rh-ink' }, g);
      if (it.value !== 'w') el('line', { x1: it.x + 5.4, x2: it.x + 5.4, y1: Y - 2, y2: stemTop, class: 'rh-stem' }, g);
      heads.push(Object.assign(it, { g }));
    }
    // Beams join the eighths, sixteenths and triplets of one group. A note alone in its group gets flags.
    const groups = new Map();
    for (const it of items) if (beamable(it)) { const key = `${it.group}`; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(it); }
    for (const list of groups.values()) {
      // A rest between two notes of a group breaks the beam.
      const runs = [];
      let run = [];
      for (const it of list) { if (run.length && items[it.i - 1] !== run[run.length - 1]) { runs.push(run); run = []; } run.push(it); }
      if (run.length) runs.push(run);
      for (const r of runs) {
        if (r.length === 1) { flags(el, r[0], stemTop); continue; }
        const x1 = r[0].x + 5.4, x2 = r[r.length - 1].x + 5.4;
        el('rect', { x: x1 - 0.8, y: stemTop, width: x2 - x1 + 1.6, height: 4.2, class: 'rh-ink' });
        // The second beam of sixteenths: between two sixteenths, or a short stub toward the neighbor.
        r.forEach((it, k) => {
          if (it.d > 3 || it.value === 't') return;
          const next = r[k + 1], prev = r[k - 1];
          if (next && next.d <= 3) el('rect', { x: it.x + 4.6, y: stemTop + 7, width: next.x - it.x + 1.6, height: 4.2, class: 'rh-ink' });
          else if (!(prev && prev.d <= 3)) { const dir = next ? 1 : -1; el('rect', { x: dir > 0 ? it.x + 4.6 : it.x - 2.6, y: stemTop + 7, width: 8, height: 4.2, class: 'rh-ink' }); }
        });
        if (r[0].value === 't') el('text', { x: (x1 + x2) / 2, y: stemTop - 5, class: 'rh-tuplet' }).textContent = '3';
      }
    }
    // Ties: an arc under the noteheads, from a tied note to the next one.
    items.forEach((it, k) => { const n = items[k + 1]; if (it.tie && !it.rest && n) el('path', { d: `M ${it.x + 3} ${Y + 7} Q ${(it.x + n.x) / 2} ${Y + 17} ${n.x - 3} ${Y + 7}`, class: 'rh-tie' }); });
    svg.light = i => svg.querySelectorAll('.rh-ev').forEach(g => g.classList.toggle('is-on', Number(g.dataset.i) === i));
    return svg;
  }
  function flags(el, it, top) {
    const n = it.d <= 3 ? 2 : 1, x = it.x + 5.4;
    for (let k = 0; k < n; k++) el('path', { d: `M ${x} ${top + k * 7} q 2 7 9 11 q -4 -1 -9 -5 z`, class: 'rh-ink' });
  }
  // Rests, drawn around the line at y. Whole and half rests are blocks; the others are simple strokes.
  function rest(el, g, value, x, y) {
    if (value === 'w') { el('rect', { x: x - 6, y, width: 12, height: 5.5, class: 'rh-ink' }, g); return; }
    if (value === 'h') { el('rect', { x: x - 6, y: y - 5.5, width: 12, height: 5.5, class: 'rh-ink' }, g); return; }
    if (value === 'q') { el('path', { d: `M ${x - 2} ${y - 16} l 5 6 l -4 5 l 5 6 q -6 -2 -4 5 q -6 -6 2 -7 l -5 -6 l 4 -5 z`, class: 'rh-ink' }, g); return; }
    // Eighth and sixteenth rests: a slanted stem with one or two hooks.
    el('path', { d: `M ${x + 3} ${y - 12} L ${x - 1} ${y + 6}`, class: 'rh-rest-stem' }, g);
    const hooks = value === 's' ? 2 : 1;
    for (let k = 0; k < hooks; k++) {
      const hy = y - 10 + k * 6, hx = x + 3 - k * 1.3;
      el('circle', { cx: hx - 5, cy: hy, r: 2.2, class: 'rh-ink' }, g);
      el('path', { d: `M ${hx - 5} ${hy + 1.5} q 3 1.5 ${5} -1.5`, class: 'rh-rest-stem' }, g);
    }
  }

  // A strumming pattern as a grid: the count above, the stroke below. Down and up arrows for strums, a cross for
  // a chuck, B for the bass note, a faint arrow for a ghost stroke, and > over an accent.
  // With onTap, each cell is a button that calls onTap(slot index).
  const STROKE_WORD = { hit: 'strum', chuck: 'chuck', bass: 'bass note', ghost: 'miss' };
  function grid(p, h, onTap) {
    const st = strokes(p);
    const arrow = dir => dir === 'U' ? '↑' : '↓';
    const cells = st.map((s, i) => h(onTap ? 'button' : 'div', { class: `strum-cell is-${s.kind}${s.accent ? ' is-accent' : ''}${i % p.sub === 0 ? ' is-beat' : ''}`, dataset: { i },
      type: onTap ? 'button' : null, onclick: onTap ? () => onTap(i) : null,
      'aria-label': onTap ? `${s.label || 'between'}: ${s.accent ? 'accented ' : ''}${s.kind === 'hit' ? (s.dir === 'U' ? 'up ' : 'down ') : ''}${STROKE_WORD[s.kind]}` : null },
      h('span', { class: 'strum-acc', 'aria-hidden': 'true' }, s.accent ? '>' : ''),
      h('b', { class: 'strum-stroke' }, s.kind === 'bass' ? 'B' : s.kind === 'chuck' ? '×' : arrow(s.dir)),
      h('span', { class: 'strum-count' }, s.label)));
    const box = h('div', { class: 'strum-grid', style: `--n:${st.length}`, role: onTap ? 'group' : 'img', 'aria-label': `${p.name}: ${st.map(s => s.kind === 'ghost' ? 'miss' : s.kind === 'bass' ? 'bass' : s.kind === 'chuck' ? 'chuck' : s.dir === 'U' ? 'up' : 'down').join(', ')}` }, cells);
    box.light = i => cells.forEach((c, k) => c.classList.toggle('is-on', k === i));
    return box;
  }

  const rhythm = {
    VALUES, VALUE_NAMES, PATTERNS, STAGES, ALL_BARS, LESSONS,
    parse, barTicks, compound, beatTicks, beatsIn, length, onsets, seconds, barSeconds, toneEvents, count,
    patternById, GRIDS, gridOf, customPattern, paint, patternBar, drumBeat, strokes, clickPlan, rampBpm, scoreTaps, calibrate, pulse, notation, grid
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = rhythm;
  else { root.GT = root.GT || {}; root.GT.rhythm = rhythm; }
})(typeof window !== 'undefined' ? window : globalThis);

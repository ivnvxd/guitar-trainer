// Run with: node tests/rhythm.test.js
'use strict';
const assert = require('assert');
const R = require('../js/rhythm.js');
let checks = 0;
const eq = (a, b, msg) => { assert.deepStrictEqual(a, b, msg); checks++; };
const ok = (v, msg) => { assert.ok(v, msg); checks++; };
const near = (a, b, msg) => ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} is not ${b}`);

// Every bar of the drills and of the lessons fills its time signature exactly.
for (const stage of R.STAGES) for (const bar of stage.bars) eq(R.length(R.parse(bar)), 48, `${stage.id}: ${bar}`);
for (const lesson of R.LESSONS) for (const [label, sig, bar] of lesson.examples) eq(R.length(R.parse(bar)), R.barTicks(sig), `${lesson.id}: ${label}`);
eq(new Set(R.ALL_BARS).size, R.ALL_BARS.length, 'no bar repeats across stages');
// No two bars sound the same: where each sound starts and how long it rings (a tie joins two notes into one).
const soundOf = bar => { const ev = R.parse(bar), out = []; let at = 0, tied = false; for (const e of ev) { if (e.rest) tied = false; else if (tied) out[out.length - 1][1] += e.d; else out.push([at, e.d]); if (!e.rest) tied = e.tie; at += e.d; } return JSON.stringify(out); };
eq(new Set(R.ALL_BARS.map(soundOf)).size, R.ALL_BARS.length, 'every drill bar has its own sound');

// Tokens, onsets and ties.
eq(R.parse('q. e').map(e => e.d), [18, 6], 'a dotted quarter is 18 ticks');
eq(R.onsets(R.parse('q qr q q')), [0, 24, 36], 'a rest makes no sound');
eq(R.onsets(R.parse('q e e~ e e q')), [0, 12, 18, 30, 36], 'a tied note does not sound again');
assert.throws(() => R.parse('q x'), /Not a rhythm token/); checks++;

// Seconds, swing and counting.
near(R.seconds(6, 60, [4, 4]), 0.5, 'a straight & at 60 bpm');
near(R.seconds(6, 60, [4, 4], 2 / 3), 2 / 3, 'a swung & comes two thirds into the beat');
near(R.seconds(12, 60, [4, 4], 2 / 3), 1, 'swing does not move the beat');
near(R.seconds(18, 60, [6, 8]), 1, 'in 6/8 a beat is a dotted quarter');
near(R.barSeconds(120, [4, 4]), 2, 'a 4/4 bar at 120 bpm');
eq([0, 3, 6, 9].map(t => R.count(t, [4, 4])), ['1', 'e', '&', 'a'], '1 e & a');
eq([12, 16, 20].map(t => R.count(t, [4, 4])), ['2', 'trip', 'let'], '2 trip let');
eq([0, 6, 12, 18, 24, 30].map(t => R.count(t, [6, 8])), ['1', '2', '3', '4', '5', '6'], 'six eighths in 6/8');

// Strumming patterns: the slots fill the bar, the hand goes down on each beat, and up on the & of an eighth pattern.
for (const p of R.PATTERNS) {
  eq(p.slots.length, R.beatsIn(p.sig) * p.sub, `${p.id}: slots fill the bar`);
  ok(/^[xXmMb.]+$/.test(p.slots), `${p.id}: slot letters`);
  if (p.strokes) eq(p.strokes.length, p.slots.length, `${p.id}: one stroke for each slot`);
  const st = R.strokes(p);
  st.forEach((s, i) => { if (i % p.sub === 0) eq(s.dir, 'D', `${p.id}: down on beat ${i / p.sub + 1}`); });
  if (p.sub === 2 || p.sub === 4) st.forEach((s, i) => eq(s.dir, i % 2 ? 'U' : 'D', `${p.id}: slot ${i}`));
  eq(st[st.length - 1].tick + R.beatTicks(p.sig) / p.sub, R.barTicks(p.sig), `${p.id}: the last slot ends the bar`);
}
eq(R.strokes(R.patternById('d-du-udu')).map(s => s.kind === 'ghost' ? '-' : s.dir).join(''), 'D-DU-UDU', 'D – D U – U D U');
eq(R.strokes(R.patternById('chucks')).filter(s => s.kind === 'chuck').map(s => s.label), ['2', '4'], 'chucks on 2 and 4');

// Metronome plans: gaps, the backbeat and random muted beats from a seeded random function.
const sounding = (bar, o, rand) => R.clickPlan(bar, o, rand).filter(c => c.sub === 0).map(c => c.sound ? 1 : 0).join('');
eq([0, 1, 2, 3, 4].map(b => sounding(b, { beats: 4, gap: [3, 1] })), ['1111', '1111', '1111', '0000', '1111'], 'three bars on, one off');
eq(sounding(0, { beats: 4, backbeat: true }), '0101', 'only 2 and 4');
eq(sounding(0, { beats: 4, mute: 1 }, () => 0), '1111', 'the first bar always clicks');
eq(sounding(1, { beats: 4, mute: 1 }, () => 0), '0000', 'every beat muted');
eq(sounding(1, { beats: 4, mute: 0.5 }, (() => { const r = [0.1, 0.9, 0.4, 0.6]; let i = 0; return () => r[i++]; })()), '0101', 'seeded mutes');
eq(R.clickPlan(0, { beats: 3, sub: 2 }).length, 6, 'eighths: two clicks a beat');
eq(R.clickPlan(0, { beats: 4 }).filter(c => c.accent).length, 1, 'one accent');
eq([0, 3, 4, 8, 100].map(b => R.rampBpm(80, b, { step: 5, every: 4, max: 100 })), [80, 80, 85, 90, 100], 'tempo ramp');

// Tap scoring, calibration and the pulse.
const exact = R.scoreTaps([0, 0.5, 1], [0, 0.5, 1]);
ok(exact.ok && exact.hits.length === 3, 'exact taps');
const early = R.scoreTaps([0, 0.5, 1], [0, 0.45, 1]);
ok(early.ok, 'a tap 50 ms early is inside the window');
near(early.hits[1].offset, -0.05, 'its offset');
const off = R.scoreTaps([0, 0.5, 1], [0, 0.75, 1, 1.4]);
eq([off.missed, off.extra, off.ok], [[0.5], [0.75, 1.4], false], 'a missed time and two extra taps');
eq(off.each.map(x => x.offset), [0, null, 0], 'one result for each expected time, in order');
eq(R.calibrate([10, 20, 30, 40, 500]), 30, 'the lowest and highest drop out');
eq(R.pulse([0, 0.5, 1, 1.5], 0.5), { drift: 0, spread: 0 }, 'an even pulse');
ok(R.pulse([0, 0.55, 1.1, 1.65], 0.5).drift < 0, 'slower taps drift below the click');
eq(R.pulse([0.1, 0.6, 1.1, 1.6], 0.5).drift, 0, 'a fixed delay does not count as drift');

// Your pattern: every grid fills its bar, and a tap puts a stroke in or takes it out.
for (const g of R.GRIDS) {
  const p = R.customPattern(g.id, 'xXmb');
  eq(p.slots.length, R.beatsIn(g.sig) * g.sub, `${g.id} slots`);
  eq(R.strokes(p).filter((s, i) => i % g.sub === 0).every(s => s.dir === 'D'), true, `${g.id} beats start down`);
}
eq(R.customPattern('6-8', 'x.x').slots, 'x.x...', 'short slots are filled with ghost strokes');
eq(R.customPattern('3-8', 'xxxxxxxxxx').slots, 'xxxxxx', 'long slots are cut');
eq(R.customPattern('4-8', 'x', true).swing, true); eq(R.customPattern('6-8', 'x', true).swing, false, '6/8 does not swing');
eq(R.paint('.', 'strum'), 'x'); eq(R.paint('x', 'strum'), '.'); eq(R.paint('x', 'chuck'), 'm'); eq(R.paint('M', 'chuck'), 'm');
eq(R.gridOf(R.patternById('six-eight')).id, '6-8'); eq(R.gridOf(R.patternById('funk')).id, '4-16');

// A pattern as notes: the bar fills its meter, its notes start where the strokes sound, and a tie never starts
// a sound. Random patterns in every grid too.
eq(R.patternBar(R.patternById('d-du-udu')).bar, 'q e e~ e e e e', 'D – D U – U D U as notes');
eq(R.patternBar(R.patternById('offbeats')).bar, 'er e er e er e er e', 'short chords leave rests');
let seed = 7;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const randomPatterns = R.GRIDS.flatMap(g => Array.from({ length: 200 }, () => R.customPattern(g.id, Array.from({ length: 16 }, () => 'x.mb.X'[Math.floor(rand() * 6)]).join(''))));
for (const p of R.PATTERNS.concat(randomPatterns)) {
  const { bar, at } = R.patternBar(p), ev = R.parse(bar);
  eq(R.length(ev), R.barTicks(p.sig), `${p.id} ${p.slots} fills the bar: ${bar}`);
  const step = R.beatTicks(p.sig) / p.sub, sounding = [...p.slots].map((c, i) => c === '.' ? -1 : i * step).filter(t => t >= 0);
  eq(R.onsets(ev), sounding, `${p.id} ${p.slots} starts where it sounds: ${bar}`);
  for (const [slot, k] of Object.entries(at)) eq(R.onsets(ev.slice(0, k + 1)).pop(), slot * step, `${p.id} ${p.slots} lights slot ${slot}`);
}

// Drums: the kick on beat 1, a hi-hat on every beat, and every hit inside the bar.
for (const g of R.GRIDS) {
  const d = R.drumBeat(g.sig, g.sub);
  eq(d.find(x => x.tick === 0 && x.kind === 'kick') !== undefined, true, `${g.id} kick on 1`);
  for (let b = 0; b < R.beatsIn(g.sig); b++) eq(d.some(x => x.kind === 'hat' && x.tick === b * R.beatTicks(g.sig)), true, `${g.id} hat on beat ${b + 1}`);
  eq(d.every(x => x.tick >= 0 && x.tick < R.barTicks(g.sig)), true, `${g.id} drums inside the bar`);
}
eq(R.drumBeat([4, 4], 2).filter(x => x.kind === 'snare').map(x => x.tick), [12, 36], 'snare on 2 and 4');
eq(R.drumBeat([6, 8], 3).filter(x => x.kind === 'snare').map(x => x.tick), [18], '6/8: snare on 4');

console.log(`rhythm: ${checks} checks passed`);

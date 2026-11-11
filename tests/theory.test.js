// Run with: node tests/theory.test.js
'use strict';
const assert = require('assert');
const T = require('../js/theory.js');

let checks = 0;
const eq = (a, b, msg) => { assert.deepStrictEqual(a, b, msg); checks++; };
const ok = (v, msg) => { assert.ok(v, msg); checks++; };

// Spelling
eq(T.spell('C', '♭3'), 'E♭');
eq(T.spell('F♯', '7'), 'E♯');
eq(T.spell('G♯', '7'), 'F♯♯');
eq(T.spell('E♭', '♭7'), 'D♭');
eq(T.spell('B♭', '♭♭7'), 'A♭♭');
eq(T.spell('A', '9'), 'B');
eq(T.tonesOn('A', T.scaleById('blues')).map(t => t.name), ['A', 'C', 'D', 'E♭', 'E', 'G']);
eq(T.tonesOn('D♭', T.scaleById('major')).map(t => t.name), ['D♭', 'E♭', 'F', 'G♭', 'A♭', 'B♭', 'C']);

// Each scale spells every letter once when it has seven notes.
// The altered scale keeps its usual jazz spelling (♭2 ♯2), so it repeats a letter on purpose.
for (const s of T.SCALES.filter(s => s.toneList.length === 7 && s.id !== 'altered')) {
  for (const root of T.ROOTS) {
    const letters = T.tonesOn(root, s).map(t => t.name[0]);
    eq(new Set(letters).size, 7, `${root} ${s.id} repeats a letter: ${letters}`);
  }
}

// Key signatures match the spelled major scale.
for (const k of T.CIRCLE) {
  for (const key of [k, k.alt].filter(Boolean)) {
    const names = T.tonesOn(key.major, T.scaleById('major')).map(t => t.name);
    const accidentals = names.filter(n => n.length > 1).sort();
    eq(accidentals, T.signature(key.count).slice().sort(), `${key.major} signature`);
    eq(T.pcOf(T.spell(key.major, '6')), T.pcOf(key.minor), `${key.major} relative minor`);
  }
}

// Diatonic chords of C major and A minor.
eq(T.diatonic('C').map(c => c.name), ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°']);
eq(T.diatonic('A', 'minor').map(c => c.name), ['Am', 'B°', 'C', 'Dm', 'Em', 'F', 'G']);
eq(T.diatonic('C', 'major', true).map(c => c.name), ['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7♭5']);

// Every fretted note of a shape is a chord tone; every chord tone sounds (a fifth may be left out); the lowest note is the root.
function checkShape(rootName, chordId, frets, label) {
  const chord = T.chordById(chordId);
  const tones = T.tonesOn(rootName, chord);
  const pcs = new Set(tones.map(t => t.pc));
  const sounding = frets.map((f, s) => f === null ? null : T.STANDARD[s] + f).filter(m => m !== null);
  for (const m of sounding) ok(pcs.has(T.mod(m)), `${label}: ${T.pcName(m)} is not in ${rootName}${chord.symbol}`);
  const heard = new Set(sounding.map(m => T.mod(m)));
  for (const t of tones) if (t.label !== '5') ok(heard.has(t.pc), `${label}: ${t.name} (${t.label}) is missing`);
  eq(T.mod(Math.min(...sounding)), T.pcOf(rootName), `${label}: bass is not the root`);
}
for (const c of T.OPEN_CHORDS) checkShape(c.root, c.chord, c.frets, `open ${c.root}${T.chordById(c.chord).symbol}`);
for (const root of T.ROOTS) for (const q of ['major', 'minor']) {
  const shapes = T.cagedShapes(root, q);
  eq(shapes.map(s => s.shape).join('').length, 5);
  for (const s of shapes) checkShape(root, q, s.frets, `CAGED ${s.shape} ${root} ${q}`);
  // The order up the neck is a rotation of C-A-G-E-D.
  const order = shapes.map(s => s.shape).join('');
  ok('CAGEDCAGED'.includes(order), `${root} ${q} order ${order}`);
}

// Movable shapes and the full shape list of every chord on every root.
for (const root of T.ROOTS) for (const chord of T.CHORDS) {
  for (const shape of T.chordShapes(root, chord.id)) {
    ok(shape.low >= 0, `${root}${chord.symbol} ${shape.name} below the nut`);
    ok(shape.high - shape.low <= 4 || shape.id.startsWith('caged') || shape.id === 'open', `${root}${chord.symbol} ${shape.name} spans ${shape.low}-${shape.high}`);
    checkShape(root, chord.id, shape.frets, `${root}${chord.symbol} ${shape.name}`);
  }
}
eq(T.chordShapes('C', 'major').map(s => s.id), ['caged-C', 'caged-A', 'caged-G', 'caged-E', 'caged-D']);
eq(T.chordShapes('C', 'maj7').map(s => s.id)[0], 'open');

// Chords of a scale and parent keys of modes.
eq(T.scaleChords('D', T.scaleById('dorian')).map(c => c.name), ['Dm', 'Em', 'F', 'G', 'Am', 'B°', 'C']);
eq(T.scaleChords('A', T.scaleById('harmonic-minor')).map(c => c.name), ['Am', 'B°', 'C+', 'Dm', 'E', 'F', 'G♯°']);
eq(T.scaleChords('C', T.scaleById('major'), true).map(c => c.name), ['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7♭5']);
eq(T.parentMajor('D', 'dorian'), 'C');
eq(T.parentMajor('F♯', 'minor'), 'A');
eq(T.parentMajor('B♭', 'lydian'), 'F');
eq(T.parentMajor('E', 'phrygian'), 'C');

// Triad voicings: three inversions, chord tones only, the right bass.
for (const root of T.ROOTS) for (const q of ['major', 'minor', 'dim', 'aug']) for (const set of T.TRIAD_SETS) {
  const v = T.triadVoicings(root, q, set.id);
  eq(v.length, 3);
  v.forEach((list, inversion) => {
    ok(list.length > 0, `${root} ${q} ${set.id} inversion ${inversion} has no shape`);
    for (const shape of list) {
      const midis = shape.frets.map((f, i) => T.STANDARD[shape.strings[i]] + f);
      ok(midis[0] < midis[1] && midis[1] < midis[2], 'close voicing ascends');
      const tones = T.tonesOn(root, T.chordById(q));
      eq(T.mod(midis[0]), tones[[0, 1, 2][inversion]].pc, `${root} ${q} ${set.id} bass`);
    }
  });
}

// Scale positions: pentatonic gives 5 boxes, major gives 7 three-note-per-string positions, all notes in the scale.
for (const root of T.ROOTS) {
  for (const [id, count, per] of [['minor-pentatonic', 5, 2], ['major-pentatonic', 5, 2], ['major', 7, 3], ['minor', 7, 3]]) {
    const scale = T.scaleById(id);
    const pos = T.positions(root, scale);
    eq(pos.length, count, `${root} ${id} positions`);
    const pcs = new Set(T.tonesOn(root, scale).map(t => t.pc));
    for (const p of pos) {
      eq(p.notes.length, 6 * per);
      for (const n of p.notes) ok(pcs.has(T.mod(n.midi)), `${root} ${id} position ${p.index}`);
      ok(p.high - p.low <= (per === 2 ? 4 : 6), `${root} ${id} position ${p.index} spans ${p.low}-${p.high}`);
    }
  }
}

// The chords of every key fill one block on the circle: three positions side by side,
// three major, three minor and one diminished chord, spelled as in the key.
for (const k of T.CIRCLE.flatMap(k => [k, k.alt].filter(Boolean))) {
  for (const mode of ['major', 'minor']) {
    const key = mode === 'major' ? k.major : k.minor;
    const home = T.CIRCLE.findIndex(e => e === k || e.alt === k);
    const cells = T.keyCells(key, mode);
    const names = T.diatonic(key, mode).map(c => c.name);
    eq(cells.map(c => c.name), names, `${key} ${mode} names`);
    eq(cells.filter(c => c.ring === 'major').length, 3, `${key} ${mode} majors`);
    eq(cells.filter(c => c.ring === 'minor').length, 3, `${key} ${mode} minors`);
    eq(cells.filter(c => c.ring === 'dim').map(c => c.pos), [home], `${key} ${mode} diminished`);
    for (const ring of ['major', 'minor']) {
      eq(cells.filter(c => c.ring === ring).map(c => T.mod(c.pos - home + 1)).sort(), [0, 1, 2], `${key} ${mode} ${ring} block`);
    }
    const tonic = cells[0];
    eq([tonic.ring, tonic.pos], [mode, home], `${key} ${mode} tonic cell`);
  }
}
eq(T.keyCells('G♭').map(c => c.name), ['G♭', 'A♭m', 'B♭m', 'C♭', 'D♭', 'E♭m', 'F°']);
eq(T.keyCells('A', 'minor').map(c => c.roman), ['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII']);

console.log(`theory: ${checks} checks passed`);

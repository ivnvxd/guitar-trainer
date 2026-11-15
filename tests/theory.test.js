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

// Every fretted note of a shape is a chord tone; every chord tone sounds; the lowest note is the root.
// Players leave out the 5th, and in the usual 11 and 13 shapes also the tones that clash or that the hand cannot reach.
const MAY_GO = { 11: ['3', '5'], m11: ['5', '9'], 13: ['5', '9'] };
function checkShape(rootName, chordId, frets, label) {
  const chord = T.chordById(chordId);
  const tones = T.tonesOn(rootName, chord);
  const pcs = new Set(tones.map(t => t.pc));
  const sounding = frets.map((f, s) => f === null ? null : T.STANDARD[s] + f).filter(m => m !== null);
  for (const m of sounding) ok(pcs.has(T.mod(m)), `${label}: ${T.pcName(m)} is not in ${rootName}${chord.symbol}`);
  const heard = new Set(sounding.map(m => T.mod(m)));
  for (const t of tones) if (!(MAY_GO[chordId] || ['5']).includes(t.label)) ok(heard.has(t.pc), `${label}: ${t.name} (${t.label}) is missing`);
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
// Each CAGED shape shares at least one place with the next one up the neck, also across fret 12.
for (const root of T.ROOTS) for (const q of ['major', 'minor']) {
  const shapes = T.cagedShapes(root, q);
  const next = shapes.map((s, i) => i < 4 ? shapes[i + 1] : Object.assign({}, shapes[0], { frets: shapes[0].frets.map(f => f === null ? null : f + 12) }));
  shapes.forEach((s, i) => ok(T.sharedPlaces(s, next[i]).length > 0, `${root} ${q}: ${s.shape} and ${next[i].shape} share no note`));
  const map = T.cagedMap(root, q, 24);
  ok(map.every(s => s.low >= 0 && s.high <= 24), `${root} ${q}: map leaves the neck`);
  ok(map.length >= 8, `${root} ${q}: only ${map.length} shapes on 24 frets`);
}
eq(T.cagedMap('C', 'major', 15).map(s => s.shape).join(''), 'CAGEDC');

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

// Every position number shows with 12 or 15 frets. A position that does not fit is cut, with at least 4 notes.
for (const maxFret of [12, 15]) for (const root of T.ROOTS) for (const id of ['major', 'minor', 'dorian', 'minor-pentatonic', 'major-pentatonic']) {
  const scale = T.scaleById(id), pos = T.positions(root, scale, T.STANDARD, maxFret);
  eq(pos.map(p => p.index).sort((a, b) => a - b).join(), scale.toneList.map((_, i) => i + 1).join(), `${root} ${id} with ${maxFret} frets`);
  for (const p of pos) ok(p.notes.length >= 4 && p.notes.every(n => n.fret >= 0 && n.fret <= maxFret), `${root} ${id} position ${p.index} fits`);
  if (scale.toneList.length === 7) eq(T.boxes(root, scale, T.STANDARD, maxFret).length, 5, `${root} ${id} boxes with ${maxFret} frets`);
}

// Tunings: the standard family (a capo, half step down, drop D) gets the standard shapes moved to it,
// and every fretted note is a chord tone. Other tunings get no shapes and no CAGED map.
{
  const family = [T.STANDARD, T.TUNINGS[1].midi, T.TUNINGS[2].midi, T.STANDARD.map(m => m + 2), T.TUNINGS[1].midi.map(m => m + 3)];
  for (const tuning of family) {
    ok(T.standardShift(tuning) !== null, `${tuning} is in the standard family`);
    for (const root of T.ROOTS) for (const chord of T.CHORDS) {
      const pcs = T.tonesOn(root, chord).map(t => t.pc);
      const shapes = T.chordShapes(root, chord.id, tuning);
      if (T.CAGED[chord.id]) eq(shapes.filter(s => s.id.startsWith('caged-')).length, 5, `${root} ${chord.id} has five CAGED shapes in ${tuning}`);
      const check = (frets, what) => ok(frets.every((f, i) => f === null || (f >= 0 && pcs.includes(T.mod(tuning[i] + f)))), `${root} ${chord.id} ${what} in ${tuning}`);
      for (const s of shapes) check(s.frets, s.id);
      if (T.CAGED[chord.id]) for (const s of T.cagedMap(root, chord.id, 15, tuning)) check(s.frets, 'CAGED map ' + s.shape);
    }
  }
  for (const t of T.TUNINGS.filter(t => ['dadgad', 'open-g', 'open-d'].includes(t.id))) {
    eq(T.standardShift(t.midi), null);
    eq(T.cagedMap('C', 'major', 15, t.midi).length, 0, `${t.id} has no CAGED map`);
  }
}

// Vertical boxes: 5 for every seven-note scale, 4 or 5 frets each, 1 to 4 notes on each string, all in the scale.
// Four notes on a string come from scales with two half steps close together, such as phrygian dominant.
for (const root of T.ROOTS) for (const scale of T.SCALES.filter(s => s.toneList.length === 7)) {
  const list = T.boxes(root, scale);
  eq(list.length, 5, `${root} ${scale.id} boxes`);
  const pcs = new Set(T.tonesOn(root, scale).map(t => t.pc));
  for (const b of list) {
    ok(b.high - b.low <= 4, `${root} ${scale.id} box ${b.index} spans ${b.low}-${b.high}`);
    for (const n of b.notes) ok(pcs.has(T.mod(n.midi)), `${root} ${scale.id} box ${b.index} note`);
    for (let s = 0; s < 6; s++) {
      const n = b.notes.filter(x => x.string === s).length;
      ok(n >= 1 && n <= 4, `${root} ${scale.id} box ${b.index} has ${n} notes on string ${s}`);
    }
  }
}
// G major box 1 is the usual shape around the E-shape G chord: frets 2 to 5.
const g1 = T.boxes('G', T.scaleById('major')).find(b => b.index === 1);
eq(`${g1.low}-${g1.high}`, '2-5');
eq(g1.notes.map(n => `${n.string}/${n.fret}`).join(' '), '0/2 0/3 0/5 1/2 1/3 1/5 2/2 2/4 2/5 3/2 3/4 3/5 4/3 4/5 5/2 5/3 5/5');
eq(T.boxes('A', T.scaleById('minor-pentatonic')).length, 5, 'a pentatonic scale is its own boxes');

// The chords of every key fill one block on the circle: three major chords side by side, and four minor-ring cells
// (three minor chords, then the diminished chord in the cell with its root, one step clockwise), spelled as in the key.
for (const k of T.CIRCLE.flatMap(k => [k, k.alt].filter(Boolean))) {
  for (const mode of ['major', 'minor']) {
    const key = mode === 'major' ? k.major : k.minor;
    const home = T.CIRCLE.findIndex(e => e === k || e.alt === k);
    const cells = T.keyCells(key, mode);
    const names = T.diatonic(key, mode).map(c => c.name);
    eq(cells.map(c => c.name), names, `${key} ${mode} names`);
    eq(cells.filter(c => c.ring === 'major').length, 3, `${key} ${mode} majors`);
    eq(cells.filter(c => c.ring === 'minor').length, 4, `${key} ${mode} minor ring`);
    const dim = cells.filter(c => c.chord.id === 'dim');
    eq(dim.map(c => [c.ring, T.mod(c.pos - home)]), [['minor', 2]], `${key} ${mode} diminished`);
    eq(cells.filter(c => c.ring === 'major').map(c => T.mod(c.pos - home + 1)).sort(), [0, 1, 2], `${key} ${mode} major block`);
    eq(cells.filter(c => c.ring === 'minor' && c.chord.id !== 'dim').map(c => T.mod(c.pos - home + 1)).sort(), [0, 1, 2], `${key} ${mode} minor block`);
    // The diminished cell is the one of the minor key with the same root.
    for (const c of dim) eq(T.pcOf(T.CIRCLE[c.pos].minor), c.pc, `${key} ${mode} diminished root`);
    const tonic = cells[0];
    eq([tonic.ring, tonic.pos], [mode, home], `${key} ${mode} tonic cell`);
  }
}
eq(T.keyCells('G♭').map(c => c.name), ['G♭', 'A♭m', 'B♭m', 'C♭', 'D♭', 'E♭m', 'F°']);
eq(T.keyCells('A', 'minor').map(c => c.roman), ['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII']);

// Reverse lookup: notes to chord names. The root in the bass comes first.
const pcs = names => names.split(' ').map(T.pcOf);
const chordNames = (names, n = 0) => T.chordsFrom(pcs(names), pcs(names)[0], n).map(c => c.name);
eq(chordNames('C E G'), ['C']);
eq(chordNames('E G C'), ['C/E']);
eq(chordNames('G C E'), ['C/G']);
eq(T.chordsFrom(pcs('E G C'), T.pcOf('E'))[0].inversion, 1);
// The same four notes are two chords: the bass decides which comes first.
eq(chordNames('A C E G'), ['Am7', 'C6/A']);
eq(chordNames('C E G A'), ['C6', 'Am7/C']);
eq(chordNames('C D G'), ['Csus2', 'Gsus4/C']);
eq(chordNames('G C D'), ['Gsus4', 'Csus2/G']);
eq(chordNames('A C E♭ G'), ['Am7♭5', 'Cm6/A']);
eq(chordNames('C E♭ G A'), ['Cm6', 'Am7♭5/C']);
// Symmetric chords have a name on every note.
eq(chordNames('C E♭ F♯ A').length, 4);
eq(chordNames('C E♭ F♯ A')[0], 'C°7');
eq(chordNames('C E A♭').length, 3);
eq(chordNames('C E A♭')[0], 'C+');
eq(chordNames('C G'), ['C5']);
eq(chordNames('E♭ G B♭ D'), ['E♭maj7']);
eq(chordNames('C C♯ D'), []);
// One note short of a chord.
ok(chordNames('C E', 1).includes('C'), 'C and E are part of C');
eq(T.chordsFrom(pcs('C E'), 0, 1).find(c => c.name === 'C').missing, ['G']);
// Every chord of the list is found again from its own notes, on every root.
for (const root of T.PC_PLAIN) for (const chord of T.CHORDS) {
  const tones = T.tonesOn(root, chord).map(t => t.pc);
  ok(T.chordsFrom(tones, tones[0]).some(c => c.root === root && c.chord.id === chord.id && !c.inversion), `${root} ${chord.id} is found from its notes`);
}
// Notes to scales. A scale that starts on the lowest note comes first.
const scaleNames = names => T.scalesWith(pcs(names), pcs(names)[0]).map(s => `${s.root} ${s.scale.id}`);
eq(scaleNames('C D E F G A B')[0], 'C major');
eq(scaleNames('D E F G A B C')[0], 'D dorian');
eq(scaleNames('A C D E G')[0], 'A minor-pentatonic');
ok(scaleNames('A C D E G').includes('C major-pentatonic'), 'A minor pentatonic has the notes of C major pentatonic');
ok(T.scalesWith(pcs('A C D E G'), 9)[0].exact, 'five notes are the whole pentatonic scale');
ok(!scaleNames('C E G').some(n => n.endsWith('chromatic')), 'the chromatic scale is not an answer');
for (const s of T.scalesWith(pcs('C E♭ G♭ A'), 0)) ok(pcs('C E♭ G♭ A').every(pc => T.tonesOn(s.root, s.scale).some(t => t.pc === pc)), `${s.root} ${s.scale.id} holds the notes`);

// The scale around a chord holds every note of the chord, on every root.
for (const [quality, scaleId] of Object.entries(T.CHORD_SCALE)) for (const root of T.ROOTS) {
  const scale = T.tonesOn(root, T.scaleById(scaleId)).map(t => t.pc);
  ok(T.tonesOn(root, T.chordById(quality)).every(t => scale.includes(t.pc)), `${root} ${quality} is inside ${scaleId}`);
}

// Slash chords: the bass note is the lowest, and every other note is a chord tone.
for (const r of T.ROOTS) for (const c of T.CHORDS) for (const b of T.PC_PLAIN) {
  if (T.pcOf(b) === T.pcOf(r)) continue;
  const pcs = T.tonesOn(r, c).map(t => t.pc);
  for (const s of T.slashShapes(r, c.id, b)) {
    const midis = s.frets.map((f, i) => f === null ? null : T.STANDARD[i] + f).filter(m => m !== null);
    eq(T.mod(Math.min(...midis)), T.pcOf(b), `${r}${c.symbol}/${b} ${s.frets} has ${b} in the bass`);
    ok(midis.every(m => pcs.includes(T.mod(m)) || T.mod(m) === T.pcOf(b)), `${r}${c.symbol}/${b} ${s.frets} notes`);
  }
}
// Drop voicings: the four chord tones, one on each string, rising.
for (const c of T.CHORDS.filter(c => c.toneList.length === 4)) for (const kind of ['drop2', 'drop3']) for (const set of T.DROP_SETS[kind]) {
  const lists = T.dropVoicings('C', c.id, kind, set.id);
  if (c.toneList.some(t => t.semi >= 12)) { eq(lists.length, 0, `${c.id} has no close voicing`); continue; }
  for (const list of lists) for (const v of list) {
    const m = v.frets.map((f, i) => T.STANDARD[v.strings[i]] + f), pcs = T.tonesOn('C', c).map(t => t.pc);
    ok(m.every((x, i) => !i || x > m[i - 1]) && new Set(m.map(x => T.mod(x))).size === 4 && m.every(x => pcs.includes(T.mod(x))), `C${c.symbol} ${kind} ${set.id} ${v.frets}`);
  }
}
eq(T.dropVoicings('C', 'maj7', 'drop2', '5432')[0][0].frets.join(), '3,5,4,5', 'Cmaj7 drop 2 on strings 5 to 2');
// Finger numbers are 1 to 4, and the open chords get the usual fingers.
for (const r of T.ROOTS) for (const c of T.CHORDS) for (const s of T.chordShapes(r, c.id)) ok(T.fingers(s.frets).every(f => f === null || (f >= 1 && f <= 4)), `${r}${c.symbol} fingers`);
eq(T.fingers([null, 3, 2, 0, 1, 0]).join(), ',3,2,,1,', 'open C');
eq(T.fingers([1, 3, 3, 2, 1, 1]).join(), '1,3,4,2,1,1', 'F barre');
eq(T.fingers([null, null, 0, 2, 3, 2]).join(), ',,,1,3,2', 'open D');

// The tuner hears the pitch of a plucked string: a tone with overtones, at 48 kHz, within 3 cents.
for (const hz of [82.41, 110, 146.83, 196, 246.94, 329.63, 440, 87.3, 123.47]) {
  const rate = 48000, buf = new Float32Array(4096);
  for (let i = 0; i < buf.length; i++) { const t = i / rate; buf[i] = 0.5 * Math.sin(2 * Math.PI * hz * t) + 0.3 * Math.sin(4 * Math.PI * hz * t + 1) + 0.15 * Math.sin(6 * Math.PI * hz * t + 2); }
  const got = T.pitchOf(buf, rate);
  ok(got && Math.abs(1200 * Math.log2(got / hz)) < 3, `pitch of ${hz} Hz read as ${got && got.toFixed(2)}`);
}
eq(T.pitchOf(new Float32Array(4096), 48000), null, 'silence has no pitch');

console.log(`theory: ${checks} checks passed`);

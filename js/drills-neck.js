/* Neck drills: name the note, find every note, degrees from a root, triad shapes, CAGED. */
(function (root) {
  'use strict';
  const GT = root.GT;
  const T = GT.theory, A = GT.audio, FB = GT.fretboard;
  const { h } = GT;
  const D = GT.drills;
  const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  const ord = s => FB.ordinal(6 - s);
  const where = (s, f) => `${ord(s)} string, ${f === 0 ? 'open' : 'fret ' + f}`;
  const DUAL = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'];
  const NATURAL_PCS = [0, 2, 4, 5, 7, 9, 11];
  const RANGES = [['0-4', '0–4'], ['5-9', '5–9'], ['0-12', '0–12'], ['0-15', '0–15']];
  const range = r => r.split('-').map(Number);
  const NOTE_ROOTS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

  // ---------- name the note ----------
  D.add({
    id: 'neck-notes', track: 'neck',
    title: 'Name the note',
    blurb: 'A dot appears on the neck. Name the note as fast as you can.',
    hint: 'Answer from the shape of the neck, not by counting frets.',
    help: [
      'A dot appears on the neck. Choose its note name. The site records your time for each position, and slow or missed positions come back more often. Progress shows a map of your times.',
      'Start with one or two strings and natural notes only. Add strings and sharps or flats when most answers come under about 2 seconds.',
      'Anchors help: fret 5 and fret 7 of each string, the octave shapes, and fret 12.'
    ],
    defaults: { strings: [0, 1], frets: '0-12', naturals: true },
    fastMs: 2500,
    autoPlay: false,
    pool(c) {
      const t = GT.tuning(), [lo, hi] = range(c.frets), out = [];
      for (const s of c.strings) for (let f = lo; f <= hi; f++) if (!c.naturals || NATURAL_PCS.includes(T.mod(t[s] + f))) out.push(`${s}:${f}`);
      return out;
    },
    itemName: item => { const [s, f] = item.split(':').map(Number); return `${ord(s)} str. fret ${f}`; },
    make(item) { const [s, f] = item.split(':').map(Number); return { string: s, fret: f, midi: GT.tuning()[s] + f }; },
    // On a phone the neck stands upright, so show six frets around the dot to keep the answers on screen.
    view(q, ui) {
      const [lo, hi] = range(ui.config.frets);
      if (!ui.narrow()) return { from: lo === 0 ? 0 : lo - 1, to: Math.max(hi, (lo === 0 ? 0 : lo - 1) + 5) };
      const from = Math.max(0, Math.min(q.fret - 2, 15 - 5));
      return { from, to: from + 5 };
    },
    render(q, ui) {
      ui.title('Which note?');
      ui.sub('');
      ui.actions([['▶ Hear it', () => A.note(q.midi, 0, 1)]]);
      ui.board.replaceChildren(ui.neck([{ string: q.string, fret: q.fret, kind: 'target', label: '?' }], Object.assign(this.view(q, ui), { label: 'Name the marked note' })));
      const pcs = ui.config.naturals ? NATURAL_PCS : [...Array(12).keys()];
      ui.choices(pcs.map(pc => ({ value: pc, main: ui.config.naturals ? T.PC_SHARP[pc] : DUAL[pc] })));
    },
    play(q) { if (q) A.note(q.midi, 0, 1); return 0; },
    check: (q, v) => Number(v) === T.mod(q.midi),
    feedback(q, v, correct, ui) {
      A.note(q.midi, 0, 1);
      const t = GT.tuning(), { from, to } = this.view(q, ui);
      const markers = [];
      for (let s = 0; s < 6; s++) for (let f = from; f <= to; f++) if (T.mod(t[s] + f) === T.mod(q.midi)) markers.push({ string: s, fret: f, kind: s === q.string && f === q.fret ? 'correct' : 'ghost', label: T.PC_PLAIN[T.mod(q.midi)] });
      ui.board.replaceChildren(ui.neck(markers, { from, to, label: 'The same note in other places' }));
      return { hold: 0.8, text: `${correct ? '' : `You chose ${DUAL[Number(v)]}. `}It is ${DUAL[T.mod(q.midi)]} on the ${where(q.string, q.fret)}. The other places of this note are shown in brown.` };
    },
    options(c, set) {
      return h('div', { style: 'display:grid;gap:14px' },
        D.pickset('Strings', [5, 4, 3, 2, 1, 0].map(s => ({ value: s, main: `${ord(s)}`, sub: T.STRING_NAMES[s] })), c.strings, v => set({ strings: v })),
        D.field('Frets', GT.segmented('Frets', RANGES, c.frets, v => set({ frets: v }))),
        D.field('Notes', GT.segmented('Notes', [[true, 'Natural notes'], [false, 'All 12']], c.naturals, v => set({ naturals: v }))));
    }
  });

  // ---------- find every note ----------
  D.add({
    id: 'neck-find', track: 'neck',
    title: 'Find every note',
    blurb: 'One note name, every place on the neck. Tap them all.',
    hint: 'Use octave shapes: two strings up and two frets up.',
    help: [
      'You see a note name. Tap every place of that note on the neck in the fret range. A wrong tap counts against you, but you can go on.',
      'Look for octave shapes. Two strings higher and two frets up is the same note (three frets across the B string). Fret 12 repeats the open strings.',
      'Try one note around the cycle of fourths: C, F, B♭, E♭ and so on.'
    ],
    defaults: { frets: 12, naturals: false },
    fastMs: 14000,
    autoPlay: false,
    advanceMs: 1400,
    pool(c) { return (c.naturals ? NATURAL_PCS : [...Array(12).keys()]).map(String); },
    itemName: item => T.PC_PLAIN[Number(item)],
    make(item, c) {
      const pc = Number(item), t = GT.tuning(), positions = [];
      for (let s = 0; s < 6; s++) for (let f = 0; f <= c.frets; f++) if (T.mod(t[s] + f) === pc) positions.push(`${s}:${f}`);
      return { pc, positions, found: new Set(), wrong: [] };
    },
    render(q, ui) {
      ui.title(`Find every ${T.PC_PLAIN[q.pc]}`);
      ui.actions([['Show all', () => ui.submit('gave-up')]]);
      ui.noChoices();
      const draw = () => {
        ui.sub(`${q.found.size} of ${q.positions.length} found${q.wrong.length ? `, ${q.wrong.length} wrong tap${q.wrong.length > 1 ? 's' : ''}` : ''}.`);
        const markers = [...q.found].map(k => { const [s, f] = k.split(':').map(Number); return { string: s, fret: f, kind: 'correct', label: T.PC_PLAIN[q.pc] }; })
          .concat(q.wrong.slice(-1).map(k => { const [s, f] = k.split(':').map(Number); return { string: s, fret: f, kind: 'wrong', label: T.PC_PLAIN[T.mod(GT.tuning()[s] + f)] }; }));
        ui.board.replaceChildren(ui.neck(markers, { from: 0, to: ui.config.frets, label: `Tap every ${T.PC_PLAIN[q.pc]}`, onPress: (s, f, midi) => {
          if (q.over) return;
          const key = `${s}:${f}`;
          A.note(midi, 0, 0.7);
          if (q.positions.includes(key)) q.found.add(key); else q.wrong.push(key);
          if (q.found.size === q.positions.length) { q.over = true; draw(); ui.submit(q.wrong.length ? 'errors' : 'clean'); } else draw();
        } }));
      };
      q.draw = draw;
      draw();
    },
    check: (q, v) => v === 'clean',
    feedback(q, v, correct, ui) {
      q.over = true;
      const markers = q.positions.map(k => { const [s, f] = k.split(':').map(Number); return { string: s, fret: f, kind: q.found.has(k) ? 'correct' : 'target', label: T.PC_PLAIN[q.pc] }; });
      ui.board.replaceChildren(ui.neck(markers, { from: 0, to: ui.config.frets, label: `Every ${T.PC_PLAIN[q.pc]}` }));
      return { text: v === 'gave-up' ? `Here are all ${q.positions.length} places. The white ones were missing.` : correct ? `All ${q.positions.length} places, no wrong taps.` : `All found, with ${q.wrong.length} wrong tap${q.wrong.length > 1 ? 's' : ''}.` };
    },
    options(c, set) {
      return h('div', { style: 'display:grid;gap:14px' },
        D.field('Frets', GT.segmented('Frets', [[5, '0–5'], [12, '0–12'], [15, '0–15']], c.frets, v => set({ frets: v }))),
        D.field('Notes', GT.segmented('Notes', [[true, 'Natural notes'], [false, 'All 12']], c.naturals, v => set({ naturals: v }))));
    }
  });

  // ---------- degrees from a root ----------
  const DEGREES = ['♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7', '8'];
  const DEGREE_NAMES = { '♭2': 'minor 2nd', '2': 'major 2nd', '♭3': 'minor 3rd', '3': 'major 3rd', '4': 'perfect 4th', '♭5': 'tritone', '5': 'perfect 5th', '♭6': 'minor 6th', '6': 'major 6th', '♭7': 'minor 7th', '7': 'major 7th', '8': 'octave' };
  const PRESETS = [['3 5 8', 'Major triad'], ['♭3 5 8', 'Minor triad'], ['3 5 ♭7 7', 'Sevenths'], ['♭3 4 5 ♭7', 'Minor pentatonic'], ['2 3 4 5 6 7', 'Major scale'], [DEGREES.join(' '), 'All']];
  D.add({
    id: 'neck-degrees', track: 'neck',
    title: 'Degrees from a root',
    blurb: 'A root on the neck, a degree to find: the 3rd, the ♭7, the 5th.',
    hint: 'Find the closest one. Any octave counts.',
    help: [
      'The root is marked. Tap any place of the asked degree in the shown frets, in any octave. This builds the shapes you use for chords, arpeggios and solos.',
      'Start with the triad tones, then the sevenths, then the scale. The root moves every question.'
    ],
    defaults: { set: ['3', '5', '8'], strings: [0, 1, 2, 3] },
    fastMs: 3000,
    autoPlay: false,
    pool: c => c.set,
    itemName: item => `${item} (${DEGREE_NAMES[item]})`,
    make(item, c) {
      const t = GT.tuning(), s = c.strings[randInt(0, c.strings.length - 1)], f = randInt(2, 10);
      return { label: item, semi: item === '8' ? 12 : T.parseDegree(item).semi, string: s, fret: f, root: t[s] + f, from: Math.max(0, f - 3), to: Math.min(15, f + 4) };
    },
    render(q, ui) {
      const rootName = T.PC_PLAIN[T.mod(q.root)];
      ui.title(`Find the ${q.label}`);
      const degreeName = DEGREE_NAMES[q.label];
      ui.sub(`${degreeName[0].toUpperCase() + degreeName.slice(1)} above ${rootName}, root on the ${where(q.string, q.fret)}.`);
      ui.actions([['▶ Root', () => A.note(q.root, 0, 1)]]);
      ui.noChoices();
      ui.board.replaceChildren(ui.neck([{ string: q.string, fret: q.fret, kind: 'root', label: '1' }], { from: q.from, to: q.to, label: `Find the ${q.label}`, onPress: (s, f, midi) => {
        if (s === q.string && f === q.fret) return;
        q.tapped = { string: s, fret: f, midi };
        A.note(midi, 0, 0.8);
        ui.submit(`${s}:${f}`);
      } }));
    },
    check: (q, v) => {
      const [s, f] = String(v).split(':').map(Number);
      return T.mod(GT.tuning()[s] + f - q.root) === T.mod(q.semi) && !(s === q.string && f === q.fret);
    },
    feedback(q, v, correct, ui) {
      const t = GT.tuning(), rootName = T.PC_PLAIN[T.mod(q.root)];
      const markers = [{ string: q.string, fret: q.fret, kind: 'root', label: '1' }];
      for (let s = 0; s < 6; s++) for (let f = q.from; f <= q.to; f++) {
        if (s === q.string && f === q.fret) continue;
        if (T.mod(t[s] + f - q.root) === T.mod(q.semi)) markers.push({ string: s, fret: f, kind: 'correct', label: q.label === '8' ? '1' : q.label });
      }
      const given = q.tapped;
      if (!correct && given) {
        const semi = T.mod(given.midi - q.root);
        markers.push({ string: given.string, fret: given.fret, kind: 'wrong', label: semi === 0 ? '1' : DEGREES[semi - 1] });
      }
      ui.board.replaceChildren(ui.neck(markers, { from: q.from, to: q.to, label: 'All places of the degree' }));
      const target = T.spell(rootName, q.label === '8' ? '1' : q.label);
      return { text: `${correct ? '' : `You tapped ${T.PC_PLAIN[T.mod(given.midi)]}, the ${DEGREES[T.mod(given.midi - q.root) - 1] || 'root'}. `}The ${q.label} of ${rootName} is ${target}. Every place in these frets is green.` };
    },
    options(c, set) {
      return h('div', { style: 'display:grid;gap:14px' },
        D.field('Quick sets', h('div', { class: 'chips' }, PRESETS.map(([list, label]) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(list === c.set.join(' ')), onclick: () => set({ set: list.split(' ') }) }, label)))),
        D.pickset('Degrees', DEGREES.map(d => ({ value: d, main: d, sub: DEGREE_NAMES[d] })), c.set, v => set({ set: v })),
        D.pickset('Root on string', [5, 4, 3, 2, 1, 0].map(s => ({ value: s, main: ord(s), sub: T.STRING_NAMES[s] })), c.strings, v => set({ strings: v })));
    }
  });

  // ---------- triad shapes ----------
  D.add({
    id: 'neck-triads', track: 'neck',
    title: 'Triad shapes',
    blurb: 'Find a named triad and inversion on three strings.',
    hint: 'Find the bass note of the inversion first.',
    help: [
      'You get a chord, an inversion and a string set. Tap one note on each of the three strings. Any octave counts.',
      'Root position has the root in the bass, first inversion the third, second inversion the fifth. Find that bass note on the lowest string of the set first, then the two notes above it.',
      'The Library shows every triad shape under Triads.'
    ],
    defaults: { qualities: ['major', 'minor'], sets: ['123', '234'] },
    fastMs: 6000,
    autoPlay: false,
    pool(c) { return c.qualities.flatMap(q => [0, 1, 2].flatMap(i => c.sets.map(s => `${q}:${i}:${s}`))); },
    itemName: item => { const [q, i, s] = item.split(':'); return `${T.chordById(q).name} ${['root', '1st inv.', '2nd inv.'][i]} on ${s.split('').reverse().join('-')}`; },
    make(item) {
      const [quality, inv, setId] = item.split(':');
      const rootName = NOTE_ROOTS[randInt(0, 11)];
      const voicings = T.triadVoicings(rootName, quality, setId, GT.tuning(), 15)[Number(inv)];
      return { quality, inversion: Number(inv), setId, rootName, voicings, set: T.TRIAD_SETS.find(s => s.id === setId).strings, picked: {} };
    },
    render(q, ui) {
      const chord = T.chordById(q.quality);
      ui.title(`${T.chordName(q.rootName, chord)}, ${T.INVERSIONS[q.inversion].toLowerCase()}`);
      ui.actions([['▶ Hear it', () => A.notes(q.voicings[0].frets.map((f, i) => GT.tuning()[q.set[i]] + f), 'strum')]]);
      ui.noChoices();
      const draw = () => {
        ui.sub(`Strings ${q.setId.split('').reverse().join('–')}: tap one note on each. ${Object.keys(q.picked).length} of 3.`);
        const markers = Object.entries(q.picked).map(([s, f]) => ({ string: Number(s), fret: f, kind: 'other', label: T.PC_PLAIN[T.mod(GT.tuning()[s] + f)] }));
        ui.board.replaceChildren(ui.neck(markers, { from: 0, to: 15, label: 'Tap the triad', onPress: (s, f, midi) => {
          if (q.over || !q.set.includes(s)) return;
          if (q.picked[s] === f) delete q.picked[s]; else q.picked[s] = f;
          A.note(midi, 0, 0.6);
          if (Object.keys(q.picked).length === 3) { q.over = true; draw(); ui.submit(q.set.map(st => q.picked[st]).join(':')); } else draw();
        } }));
      };
      draw();
    },
    check: (q, v) => q.voicings.some(vc => vc.frets.join(':') === v),
    feedback(q, v, correct, ui) {
      const given = String(v).split(':').map(Number);
      const best = q.voicings.slice().sort((a, b) => Math.abs(a.frets[0] - given[0]) - Math.abs(b.frets[0] - given[0]))[0];
      const tones = T.tonesOn(q.rootName, T.chordById(q.quality));
      const markers = best.frets.map((f, i) => {
        const t = tones.find(x => x.pc === T.mod(GT.tuning()[q.set[i]] + f));
        return { string: q.set[i], fret: f, kind: FB.degreeKind(t.label), label: t.label };
      });
      if (!correct) given.forEach((f, i) => { if (best.frets[i] !== f) markers.push({ string: q.set[i], fret: f, kind: 'wrong', label: T.PC_PLAIN[T.mod(GT.tuning()[q.set[i]] + f)] }); });
      ui.board.replaceChildren(ui.neck(markers, { from: 0, to: 15, label: 'The triad shape' }));
      const midis = best.frets.map((f, i) => GT.tuning()[q.set[i]] + f);
      A.notes(midis, 'strum');
      return { hold: 1.2, text: `${T.INVERSIONS[q.inversion]}: ${best.tones.map(l => tones.find(t => t.label === l).name).join(' ')} from low to high, frets ${best.frets.join('-')}.`, actions: [['▶ Hear it', () => A.notes(midis, 'strum')], ['Open in Library', () => GT.go(`library/triads/${q.quality}/${GT.rootSlug(q.rootName)}/${q.setId}`)]] };
    },
    options(c, set) {
      return h('div', { style: 'display:grid;gap:14px' },
        D.pickset('Quality', ['major', 'minor', 'dim', 'aug'].map(id => ({ value: id, main: T.chordById(id).name })), c.qualities, v => set({ qualities: v })),
        D.pickset('String sets', T.TRIAD_SETS.map(s => ({ value: s.id, main: s.id.split('').reverse().join('–'), sub: s.name.replace(/^Strings [^(]+/, '') })), c.sets, v => set({ sets: v })));
    }
  });

  // ---------- CAGED ----------
  // Strings that carry the root in each CAGED shape, from the shape data.
  function rootStrings(quality, shapeLetter) {
    const s = T.CAGED[quality].find(x => x.shape === shapeLetter);
    return s.frets.map((f, i) => f === null ? null : T.mod(T.STANDARD[i] + f) === T.pcOf(s.root) ? i : null).filter(i => i !== null);
  }
  D.add({
    id: 'neck-caged', track: 'neck',
    title: 'CAGED shapes',
    blurb: 'Name a shape on the neck, or the two shapes that grow from a root.',
    hint: 'Look where the roots sit inside the shape.',
    help: [
      'Name the shape: a major or minor chord shape appears. Name which open chord it comes from: C, A, G, E or D.',
      'Shapes from a root: a root sits on one string. Pick the two shapes that have their root on that string. From the 6th string you can build the E and G shapes, from the 5th the A and C shapes, and so on.',
      'Use CAGED as a map of the neck: each shape joins the next one, and the five cover the whole neck. This drill uses standard tuning.'
    ],
    defaults: { mode: 'name', quality: 'major' },
    fastMs: 3500,
    autoPlay: false,
    statsKey: c => `${c.mode}:${c.quality}`,
    pool: c => c.mode === 'name' ? ['C', 'A', 'G', 'E', 'D'] : ['0', '1', '2', '3', '4', '5'],
    itemName: (item, c) => c.mode === 'name' ? `${item} shape` : `Root on ${ord(Number(item))}`,
    make(item, c) {
      const rootName = NOTE_ROOTS[randInt(0, 11)];
      if (c.mode === 'name') {
        const shape = T.cagedShapes(rootName, c.quality).find(s => s.shape === item);
        return { mode: 'name', rootName, shape, letter: item, quality: c.quality };
      }
      const s = Number(item);
      const expected = ['C', 'A', 'G', 'E', 'D'].filter(l => rootStrings(c.quality, l).includes(s));
      const fret = randInt(1, 12);
      return { mode: 'roots', string: s, fret, rootName: T.PC_PLAIN[T.mod(T.STANDARD[s] + fret)], expected, picked: [], quality: c.quality };
    },
    render(q, ui) {
      const tones = T.tonesOn(q.rootName, T.chordById(q.quality));
      if (q.mode === 'name') {
        ui.title('Which CAGED shape?');
        ui.sub(`${q.rootName} ${q.quality}.`);
        const markers = q.shape.frets.map((f, i) => f === null ? null : (() => { const t = tones.find(x => x.pc === T.mod(T.STANDARD[i] + f)); return { string: i, fret: f, kind: FB.degreeKind(t.label), label: t.label }; })()).filter(Boolean);
        ui.actions([['▶ Strum', () => A.notes(q.shape.frets.map((f, i) => f === null ? null : T.STANDARD[i] + f).filter(m => m !== null), 'strum')]]);
        const win = ui.narrow() ? { from: Math.max(0, q.shape.low - 1), to: Math.max(q.shape.low - 1, 0) + 5 } : { from: 0, to: 15 };
        ui.board.replaceChildren(ui.neck(markers, Object.assign(win, { tuning: T.STANDARD, muted: q.shape.frets.map((f, i) => f === null ? i : null).filter(i => i !== null), label: 'A CAGED shape' })));
        ui.choices(['C', 'A', 'G', 'E', 'D'].map(l => ({ value: l, main: l, sub: `${l} shape` })));
        return;
      }
      ui.title(`Root on the ${ord(q.string)} string: which two shapes?`);
      ui.sub(`${q.rootName} ${q.quality}. Pick two.`);
      ui.actions([]);
      ui.noChoices();
      const win = ui.narrow() ? { from: Math.max(0, q.fret - 2), to: Math.max(0, q.fret - 2) + 5 } : { from: 0, to: 15 };
      ui.board.replaceChildren(ui.neck([{ string: q.string, fret: q.fret, kind: 'root', label: q.rootName }], Object.assign(win, { tuning: T.STANDARD, label: 'The root' })));
      const row = h('div', { class: 'answers' });
      const draw = () => row.replaceChildren(...['C', 'A', 'G', 'E', 'D'].map((l, i) => h('button', { type: 'button', class: 'answer', 'aria-pressed': String(q.picked.includes(l)), style: q.picked.includes(l) ? 'border-color:var(--accent);background:var(--accent-soft)' : '', onclick: () => toggle(l) }, h('b', null, l), h('span', null, 'shape'), h('span', { class: 'kbd', 'aria-hidden': 'true' }, D.KEYS[i]))));
      const toggle = l => {
        if (q.over) return;
        q.picked = q.picked.includes(l) ? q.picked.filter(x => x !== l) : q.picked.concat(l);
        draw();
        if (q.picked.length === 2) { q.over = true; ui.submit(q.picked.slice().sort().join(',')); }
      };
      q.toggle = toggle;
      draw();
      ui.board.append(row);
    },
    onKey(e, q) { if (q && q.mode === 'roots') { const i = D.KEYS.indexOf(e.key); if (i >= 0 && i < 5) { e.preventDefault(); q.toggle(['C', 'A', 'G', 'E', 'D'][i]); } } },
    check: (q, v) => q.mode === 'name' ? v === q.letter : v === q.expected.slice().sort().join(','),
    feedback(q, v, correct, ui) {
      if (q.mode === 'name') {
        const strings = rootStrings(q.quality, q.letter).map(s => ord(s)).join(', ');
        return { text: `${q.letter} shape: it is the open ${q.letter}${q.quality === 'minor' ? 'm' : ''} chord moved up the neck. Its roots are on the ${strings} strings.`, actions: [['Open in Library', () => GT.go(`library/chords/${q.quality}/${GT.rootSlug(q.rootName)}/caged-${q.letter}`)]] };
      }
      ui.board.querySelectorAll('.answer').forEach(b => { b.disabled = true; const l = b.querySelector('b').textContent; if (q.expected.includes(l)) b.classList.add('is-correct'); else if (q.picked.includes(l)) b.classList.add('is-wrong'); });
      return { text: `From a root on the ${ord(q.string)} string: the ${q.expected.join(' and ')} shapes.`, actions: [['Open in Library', () => GT.go(`library/chords/${q.quality}/${GT.rootSlug(q.rootName)}`)]] };
    },
    options(c, set) {
      return h('div', { style: 'display:grid;gap:14px' },
        D.field('Mode', GT.segmented('Mode', [['name', 'Name the shape'], ['roots', 'Shapes from a root']], c.mode, v => set({ mode: v }))),
        D.field('Chords', GT.segmented('Chords', [['major', 'Major'], ['minor', 'Minor']], c.quality, v => set({ quality: v }))));
    }
  });
})(window);

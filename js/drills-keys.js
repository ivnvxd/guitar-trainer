/* Key drills: key facts, chords in a key, numbers to chords. */
(function (root) {
  'use strict';
  const GT = root.GT;
  const T = GT.theory, A = GT.audio;
  const { h, pick } = GT;
  const D = GT.drills;
  const MAJORS = T.CIRCLE.map(k => k.major);
  const MINORS = T.CIRCLE.map(k => k.minor);
  // Keys in these drills are major keys, named as on the circle.
  const idxOf = name => T.CIRCLE.findIndex(k => k.major === name);
  const entryOf = name => T.CIRCLE[idxOf(name)];
  // A key of either mode, with its alternative spelling (D♯ minor is also E♭ minor).
  const keyEntry = (name, mode) => {
    for (const k of T.CIRCLE) for (const e of [k, k.alt].filter(Boolean)) if ((mode === 'minor' ? e.minor : e.major) === name) return e;
    return null;
  };
  // A neighbor key keeps the spelling family of the asked key: IV of D♭ is G♭, not F♯.
  const neighbor = (name, step) => {
    const k = T.CIRCLE[(idxOf(name) + step + 12) % 12];
    return k.alt && (entryOf(name).count < 0) === (k.alt.count < 0) ? k.alt.major : k.major;
  };
  const sigText = count => count === 0 ? 'no sharps or flats' : `${Math.abs(count)} ${count > 0 ? 'sharp' : 'flat'}${Math.abs(count) > 1 ? 's' : ''}`;
  const keyChoices = list => list.map(k => ({ value: T.pcOf(k), main: k }));
  const COUNT_CHOICES = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map(n => ({ value: n, main: n === 0 ? '0' : `${Math.abs(n)}${n > 0 ? '♯' : '♭'}` }));

  // ---------- key facts ----------
  const FACTS = {
    V: { name: 'V of a key', ask: k => `What is V of ${k} major?`, answer: k => neighbor(k, 1), choices: () => keyChoices(MAJORS), explain: (k, a) => `${a} is one step clockwise from ${k}.` },
    IV: { name: 'IV of a key', ask: k => `What is IV of ${k} major?`, answer: k => neighbor(k, -1), choices: () => keyChoices(MAJORS), explain: (k, a) => `${a} is one step counterclockwise from ${k}.` },
    rel: { name: 'Relative minor', ask: k => `Relative minor of ${k} major?`, answer: k => entryOf(k).minor, choices: () => keyChoices(MINORS).map(c => Object.assign(c, { main: c.main + 'm' })), explain: (k, a) => `${a} minor is the 6th degree of ${k} major and shares its notes.` },
    sig: { name: 'Key signature', ask: k => `How many sharps or flats in ${k} major?`, answer: k => entryOf(k).count, choices: () => COUNT_CHOICES, explain: (k, a) => `${k} major has ${sigText(a)}${a ? ': ' + T.signature(a).join(' ') : ''}.`, numeric: true },
    from: { name: 'Key from signature', ask: k => `Which major key has ${sigText(entryOf(k).count)}?`, answer: k => k, choices: () => keyChoices(MAJORS), explain: (k) => `${k} major: ${sigText(entryOf(k).count)}${entryOf(k).count ? ', ' + T.signature(entryOf(k).count).join(' ') : ''}.` }
  };
  D.add({
    id: 'keys-facts', track: 'keys',
    title: 'Key facts',
    blurb: 'V of E♭, relative minor of D♭, flats in A♭: answer without counting.',
    hint: 'Picture the circle: clockwise is a fifth up.',
    help: [
      'Mixed questions about the circle of fifths: the V and IV of a key, the relative minor, the number of sharps or flats, and the key that has a given signature.',
      'V is one step clockwise, IV one step counterclockwise. Each step clockwise adds a sharp or removes a flat. The relative minor is three semitones below.',
      'The Library has the circle under Keys.'
    ],
    defaults: { types: ['V', 'IV', 'rel', 'sig', 'from'] },
    fastMs: 3500,
    autoPlay: false,
    pool: c => c.types.flatMap(t => MAJORS.map(k => `${t}:${k}`)),
    itemName: item => { const [t, k] = item.split(':'); return FACTS[t].ask(k).replace('?', ''); },
    make(item) { const [type, key] = item.split(':'); return { type, key, answer: FACTS[type].answer(key) }; },
    render(q, ui) {
      ui.title(FACTS[q.type].ask(q.key));
      ui.sub('');
      ui.actions([]);
      ui.choices(FACTS[q.type].choices());
    },
    check: (q, v) => FACTS[q.type].numeric ? Number(v) === q.answer : Number(v) === T.pcOf(q.answer),
    feedback(q, v, correct) {
      const ex = FACTS[q.type].explain(q.key, q.answer);
      return { text: ex, actions: [['Open on the circle', () => GT.go(`library/keys/${GT.rootSlug(q.key)}/major`)]] };
    },
    options(c, set) {
      return D.pickset('Questions', Object.entries(FACTS).map(([id, f]) => ({ value: id, main: f.name })), c.types, v => set({ types: v }));
    }
  });

  // ---------- chords in a key ----------
  const ROMANS = { major: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'], minor: ['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII'] };
  D.add({
    id: 'keys-chords', track: 'keys',
    title: 'Chords in a key',
    blurb: 'What is ii in E? What is vi in B♭? Name the chord root.',
    hint: 'The quality follows the number: ii, iii and vi are minor in a major key.',
    help: [
      'You see a key and a chord number. Choose the root of that chord. The quality is fixed by the number, so the answer shows it too.',
      'In major keys: I, IV and V are major. ii, iii and vi are minor. vii° is diminished. Minor keys are off by default. Turn them on in Options.'
    ],
    defaults: { modes: ['major'], degrees: [1, 2, 3, 4, 5, 6, 7] },
    fastMs: 3500,
    autoPlay: false,
    pool: c => c.modes.flatMap(m => (m === 'major' ? MAJORS : MINORS).flatMap(k => c.degrees.map(d => `${m}:${k}:${d}`))),
    itemName: item => { const [m, k, d] = item.split(':'); return `${ROMANS[m][d - 1]} in ${k}${m === 'minor' ? 'm' : ''}`; },
    make(item) {
      const [mode, key, d] = item.split(':');
      const chord = T.diatonic(key, mode)[Number(d) - 1];
      return { mode, key, degree: Number(d), chord, flats: keyEntry(key, mode).count < 0 };
    },
    render(q, ui) {
      ui.title(`${ROMANS[q.mode][q.degree - 1]} in ${q.key} ${q.mode}?`);
      ui.sub('');
      ui.actions([]);
      // Spell the buttons as the key does: E♯, not F, in F♯ major.
      const names = (q.flats ? T.PC_FLAT : T.PC_SHARP).slice();
      for (const c of T.diatonic(q.key, q.mode)) names[c.pc] = c.root;
      ui.choices(names.map((n, pc) => ({ value: pc, main: n })));
    },
    check: (q, v) => Number(v) === q.chord.pc,
    feedback(q) {
      const midis = q.chord.chord.toneList.map(t => 48 + T.mod(q.chord.pc - 48) + t.semi);
      A.notes(midis, 'strum');
      const all = T.diatonic(q.key, q.mode).map(c => `${c.roman} ${c.name}`).join(', ');
      return { hold: 1.2, text: `${ROMANS[q.mode][q.degree - 1]} in ${q.key} ${q.mode} is ${q.chord.name}. The key: ${all}.`, actions: [['▶ Hear it', () => A.notes(midis, 'strum')]] };
    },
    options(c, set) {
      return h('div', { class: 'opts' },
        D.pickset('Keys', [{ value: 'major', main: 'Major keys' }, { value: 'minor', main: 'Minor keys' }], c.modes, v => set({ modes: v })),
        D.pickset('Chord numbers', [1, 2, 3, 4, 5, 6, 7].map(d => ({ value: d, main: ROMANS.major[d - 1], sub: `/ ${ROMANS.minor[d - 1]}` })), c.degrees, v => set({ degrees: v })));
    }
  });

  // ---------- numbers to chords ----------
  const PROGRESSIONS = ['1-4-5-1', '1-5-6-4', '2-5-1', '1-6-4-5', '6-4-1-5', '1-4-6-5', '1-3-4-5', '4-5-3-6', '1-5-4-1', '2-5-1-6', '1-6-2-5', '4-1-5-6'];
  D.add({
    id: 'keys-numbers', track: 'keys',
    title: 'Numbers to chords',
    blurb: 'A progression in numbers and a key. Name every chord.',
    hint: 'Name the roots in order. The quality follows the number.',
    help: [
      'You see chord numbers such as 1 5 6 4 and a key. Choose the root of each chord in order. Backspace removes the last one.',
      'This is the Nashville number system: the same numbers work in any key, so you can move a song to another key on the spot.'
    ],
    defaults: { keys: MAJORS.slice() },
    fastMs: 9000,
    autoPlay: false,
    pool: c => c.keys,
    itemName: item => `${item} major`,
    make(item) {
      const prog = pick(PROGRESSIONS).split('-').map(Number);
      const chords = T.diatonic(item);
      return { key: item, prog, chords: prog.map(d => chords[d - 1]), entered: [], flats: entryOf(item).count < 0 };
    },
    render(q, ui) {
      ui.title(`${q.prog.join(' ')} in ${q.key} major`);
      ui.actions([['▶ Hear it', () => this.play(q)]]);
      ui.noChoices();
      const names = q.flats ? T.PC_FLAT : T.PC_SHARP;
      const slots = h('div', { class: 'chips slots' });
      const draw = () => {
        ui.sub(`Chord ${Math.min(q.entered.length + 1, q.prog.length)} of ${q.prog.length}.`);
        slots.replaceChildren(...q.prog.map((d, i) => h('span', { class: 'chip', 'aria-current': String(i === q.entered.length) }, q.entered[i] !== undefined ? names[q.entered[i]] : d)));
      };
      const add = pc => {
        if (q.done) return;
        q.entered.push(pc); draw();
        if (q.entered.length === q.prog.length) { q.done = true; ui.submit(q.entered.join('-')); }
      };
      q.add = add;
      q.back = () => { if (!q.done) { q.entered.pop(); draw(); } };
      draw();
      const tiles = h('div', { class: 'answers' }, names.map((n, pc) => h('button', { type: 'button', class: 'answer', onclick: () => add(pc) }, h('b', null, n), h('span', { class: 'kbd', 'aria-hidden': 'true' }, D.KEYS[pc]))));
      ui.board.replaceChildren(slots, tiles,
        h('button', { type: 'button', class: 'btn', style: 'margin-top:10px', onclick: () => q.back() }, 'Undo', h('span', { class: 'kbd' }, '⌫')));
      ui.even(tiles);
    },
    onKey(e, q) {
      if (!q || q.done) return;
      if (e.key === 'Backspace') { e.preventDefault(); q.back(); return; }
      const i = D.KEYS.indexOf(e.key);
      if (i >= 0 && i < 12) { e.preventDefault(); q.add(i); }
    },
    play(q) {
      if (!q) return 0;
      let v = null;
      const seq = q.chords.map(c => { v = T.voiceLead(c.chord.toneList.map(t => T.mod(c.pc + t.semi)), v, 52, 72); return [A.bass(c.pc)].concat(v); });
      return A.chordSequence(seq, 96, 2);
    },
    check: (q, v) => v === q.chords.map(c => c.pc).join('-'),
    feedback(q, v, correct, ui) {
      const given = String(v).split('-').map(Number);
      const names = q.flats ? T.PC_FLAT : T.PC_SHARP;
      ui.board.querySelectorAll('.answer').forEach(b => { b.disabled = true; });
      ui.board.querySelector('.chips').replaceChildren(...q.chords.map((c, i) => h('span', { class: 'chip', style: `border-color:${given[i] === c.pc ? 'var(--ok)' : 'var(--bad)'}` }, given[i] === c.pc ? c.name : `${names[given[i]]} → ${c.name}`)));
      const seconds = this.play(q);
      return { hold: seconds, text: `${q.prog.join(' ')} in ${q.key}: ${q.chords.map(c => c.name).join(' ')}.`, actions: [['▶ Hear it', () => { A.silence(); this.play(q); }]] };
    },
    options(c, set) {
      return D.pickset('Keys', MAJORS.map(k => ({ value: k, main: k, sub: sigText(entryOf(k).count) })), c.keys, v => set({ keys: v }));
    }
  });
})(window);

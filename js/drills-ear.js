/* Ear drills: intervals, scale degrees in a key, chord quality, progressions. */
(function (root) {
  'use strict';
  const GT = root.GT;
  const T = GT.theory, A = GT.audio, FB = GT.fretboard;
  const { h, store, pick } = GT;
  const D = GT.drills;
  const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  const name = midi => T.PC_PLAIN[T.mod(midi)];
  const stageOf = id => store.get('stage.' + id, 0);
  const DIR_TEXT = { up: 'up', down: 'down', harmonic: 'together' };
  const an = word => (/^[aeiou]/i.test(word) ? 'an ' : 'a ') + word;

  // ---------- intervals ----------
  const INTERVAL_STAGES = [[7, 4, 12, 5], [3, 2, 1], [9, 8, 6], [10, 11]];
  const intervalLabel = semi => semi === 12 ? '8' : semi === 6 ? '♭5' : T.intervalBySemi(semi).label;
  // Spell both notes from the lower one, so a minor 3rd always looks like a third.
  function intervalNames(q) {
    const low = Math.min(q.root, q.target);
    const lowName = name(low);
    const highName = q.semi === 0 ? lowName : T.spell(lowName, intervalLabel(q.semi));
    return q.target >= q.root ? [lowName, highName] : [highName, lowName];
  }
  function playInterval(a, b, dir, gap = 0.62) {
    if (dir === 'harmonic') { A.notes([a, b], 'together', 0, 1.4); return 0; }
    A.note(a, 0, 0.9); A.note(b, gap, 1.1);
    return gap;
  }
  // The guitar position closest to the root for the second note.
  function guitarPlace(midi, near) {
    const t = GT.tuning();
    let best = null;
    for (let s = 0; s < 6; s++) {
      const f = midi - t[s];
      if (f < 0 || f > 15) continue;
      const cost = near ? Math.abs(f - near.fret) * 1.2 + Math.abs(s - near.string) : f;
      if (!best || cost < best.cost) best = { string: s, fret: f, cost };
    }
    return best;
  }
  const where = p => `${FB.ordinal(6 - p.string)} string, ${p.fret === 0 ? 'open' : 'fret ' + p.fret}`;
  const songFor = (semi, dir) => dir === 'harmonic' ? null : (T.INTERVAL_SONGS[semi] || {})[dir] || null;
  // Your answer, then the right one, on the same first note.
  function compareIntervals(q, chosenSemi, times = 1) {
    const other = q.dir === 'down' ? q.root - chosenSemi : q.root + chosenSemi;
    const gap = q.dir === 'harmonic' ? 1.5 : 1.8;
    A.silence();
    for (let k = 0; k < times; k++) {
      A.later(() => playInterval(q.root, other, q.dir), 2 * gap * k * 1000);
      A.later(() => playInterval(q.root, q.target, q.dir), (2 * k + 1) * gap * 1000);
    }
    return 2 * gap * times;
  }

  D.add({
    id: 'ear-intervals', track: 'ear',
    title: 'Intervals',
    blurb: 'Hear two notes and name the distance. Start with four intervals, the site adds the next ones when you are ready.',
    hint: 'Listen, then choose. The starting note changes every time.',
    help: [
      'Name it: you hear two notes and choose the interval. Sing it: you see an interval, hear the first note, and sing the second before you check. On the neck: you hear the interval and tap the second note on the guitar.',
      'With "Add intervals for me" on, you start with the perfect 5th, major 3rd, octave and perfect 4th. When you answer these right about 85 percent of the time, the next group comes in: minor 3rd, major 2nd, minor 2nd, then the 6ths and the tritone, then the 7ths.',
      'Practice ascending first, then descending, then together. A right answer that takes more than 3 seconds still counts as not learned yet, so it comes back sooner. After a miss you hear your answer and the right one on the same note, and both intervals come back a few questions later.',
      'Hear all plays every interval of your set from the same first note, and lights each answer while it sounds. Use it when new intervals come in. After each answer, a song that starts with the interval helps you recall it.',
      'Ten minutes a day works better than one long session.'
    ],
    defaults: { mode: 'identify', direction: 'up', auto: true, set: [7, 4, 12, 5] },
    stages: INTERVAL_STAGES,
    // Singing and playing take longer than naming. Self-graded singing has no speed limit.
    fastMs: c => ({ identify: 3000, sing: 60000, guitar: 7000 })[c.mode] || 3000,
    statsKey: c => c.mode,
    semis(c) { return (c.auto ? INTERVAL_STAGES.slice(0, stageOf('ear-intervals') + 1).flat() : c.set).slice().sort((a, b) => a - b); },
    pool(c) {
      const dirs = c.direction === 'mixed' ? ['up', 'down', 'harmonic'] : [c.direction];
      return this.semis(c).flatMap(s => dirs.map(d => `${s}:${d}`));
    },
    unlockText(stage) { return `New intervals added: ${INTERVAL_STAGES[stage].map(s => T.intervalBySemi(s).short).join(', ')}.`; },
    itemName(item) { const [s, d] = item.split(':'); return `${T.intervalBySemi(Number(s)).short} ${DIR_TEXT[d]}`; },
    make(item, c) {
      const [s, dir] = item.split(':');
      const semi = Number(s);
      const rootMidi = dir === 'down' ? randInt(55, 69) : randInt(47, 62);
      const q = { semi, dir, root: rootMidi, target: dir === 'down' ? rootMidi - semi : rootMidi + semi, mode: c.mode };
      if (c.mode === 'guitar') {
        // Place the first note so that the second one is on the same part of the neck.
        const t = GT.tuning();
        for (let tries = 0; tries < 40; tries++) {
          const string = randInt(0, 4), fret = q.root - t[string];
          if (fret < 0 || fret > 12) { q.root = dir === 'down' ? randInt(55, 69) : randInt(45, 60); q.target = dir === 'down' ? q.root - semi : q.root + semi; continue; }
          const from = Math.max(0, fret - 5), to = Math.min(15, fret + 6);
          const fits = t.some((m, k) => q.target - m >= from && q.target - m <= to && !(k === string && q.target - m === fret));
          if (fits || semi === 0) { Object.assign(q, { place: { string, fret }, from, to }); break; }
          q.root = dir === 'down' ? randInt(55, 69) : randInt(45, 60);
          q.target = dir === 'down' ? q.root - semi : q.root + semi;
        }
      }
      return q;
    },
    render(q, ui) {
      const iv = T.intervalBySemi(q.semi);
      const replay = () => ui.play();
      if (q.mode === 'sing') {
        ui.title(`Sing ${an(iv.name.toLowerCase())} ${q.dir === 'harmonic' ? 'up' : DIR_TEXT[q.dir]}`);
        ui.sub(`From ${name(q.root)}. Sing the second note, then press Check to hear it.`);
        ui.actions([['▶ First note', () => ui.play(), 'R'], ['▶ Check', () => playInterval(q.root, q.target, q.dir === 'harmonic' ? 'up' : q.dir)]]);
        ui.choices([{ value: 'yes', main: 'I sang it right' }, { value: 'no', main: 'I was off' }]);
        return;
      }
      if (q.mode === 'guitar') {
        ui.title('Play the second note');
        ui.sub(`You hear the interval ${q.dir === 'harmonic' ? 'as one sound' : DIR_TEXT[q.dir]}. The first note is marked. Tap the second note.`);
        ui.actions([['▶ Replay', replay, 'R']]);
        ui.noChoices();
        ui.board.replaceChildren(ui.neck([{ string: q.place.string, fret: q.place.fret, kind: 'root', label: name(q.root) }], { from: q.from, to: q.to, onPress: (s, f, midi) => { q.tapped = { string: s, fret: f }; A.note(midi, 0, 0.8); ui.submit(midi); }, label: 'Tap the second note' }));
        return;
      }
      ui.title('Which interval?');
      ui.sub(q.dir === 'harmonic' ? 'Both notes together.' : q.dir === 'down' ? 'Descending: the second note is lower.' : 'Ascending: the second note is higher.');
      const semis = this.semis(ui.config);
      // Hear all: every interval of the set from the same first note, each answer lit while it sounds.
      const tour = () => {
        if (!ui.session.answered) q.assisted = true;
        A.silence();
        const tiles = ui.answers.querySelectorAll('.answer');
        const step = q.dir === 'harmonic' ? 1.6 : 1.9;
        semis.forEach((semi, i) => A.later(() => {
          tiles.forEach((t, k) => t.classList.toggle('is-playing', k === i));
          playInterval(q.root, q.dir === 'down' ? q.root - semi : q.root + semi, q.dir);
        }, i * step * 1000));
        A.later(() => tiles.forEach(t => t.classList.remove('is-playing')), semis.length * step * 1000);
      };
      ui.actions([['▶ Replay', replay, 'R'], ['▶ First note', () => A.note(q.root, 0, 1)], ['▶ Hear all', tour, 'H']]);
      q.tour = tour;
      ui.choices(semis.map(s => ({ value: s, main: T.intervalBySemi(s).short, sub: T.intervalBySemi(s).name })));
    },
    onKey(e, q) { if (q && q.tour && (e.key === 'h' || e.key === 'H')) { e.preventDefault(); q.tour(); } },
    play(q, what) {
      if (!q) return 0;
      if (q.mode === 'sing') { A.note(q.root, 0, 1.2); return 0; }
      return playInterval(q.root, q.target, q.dir);
    },
    check(q, v) {
      if (q.mode === 'sing') return v === 'yes';
      if (q.mode === 'guitar') return Number(v) === q.target;
      return Number(v) === q.semi;
    },
    feedback(q, v, correct, ui) {
      const iv = T.intervalBySemi(q.semi);
      const [a, b] = intervalNames(q);
      if (q.mode === 'sing') return { text: `${iv.name}: ${a} to ${b}.`, actions: [['▶ Hear it', () => playInterval(q.root, q.target, q.dir === 'harmonic' ? 'up' : q.dir)]] };
      const place1 = q.place || guitarPlace(q.root);
      const place2 = q.mode === 'guitar' && correct ? null : guitarPlace(q.target, place1);
      const markers = [{ string: place1.string, fret: place1.fret, kind: 'root', label: a }];
      if (q.mode === 'guitar') {
        const t = GT.tuning();
        if (!correct) {
          for (let s = 0; s < 6; s++) { const f = q.target - t[s]; if (f >= q.from && f <= q.to && !(s === place1.string && f === place1.fret)) markers.push({ string: s, fret: f, kind: 'correct', label: b }); }
          const given = Number(v);
          if (q.tapped) markers.push({ string: q.tapped.string, fret: q.tapped.fret, kind: 'wrong', label: name(given) });
          ui.board.replaceChildren(ui.neck(markers, { from: q.from, to: q.to, label: 'Answer', links: markers.filter(m => m.kind === 'correct').map(m => ({ points: [place1, m], cls: 'is-answer' })) }));
          const diff = Math.abs(given - q.root);
          const givenIv = diff <= 12 ? T.intervalBySemi(diff) : null;
          return {
            text: `You played ${name(given)}${givenIv ? `, ${an(givenIv.name.toLowerCase())} ${given >= q.root ? 'up' : 'down'}` : ''}. The ${iv.name.toLowerCase()} is ${b}, marked green.`,
            actions: [['▶ Replay', () => this.play(q)], ['▶ Yours', () => playInterval(q.root, given, q.dir === 'harmonic' ? 'up' : q.dir)]]
          };
        }
        return { text: `${iv.name}: ${a} to ${b}.` };
      }
      markers.push({ string: place2.string, fret: place2.fret, kind: FB.degreeKind(intervalLabel(q.semi)) === 'root' ? 'correct' : FB.degreeKind(intervalLabel(q.semi)), label: b });
      const lo = Math.min(place1.fret, place2.fret), hi = Math.max(place1.fret, place2.fret);
      // The two notes on the neck, joined by a line, in the result box: the answers above stay where they are.
      const visual = ui.neck(markers, { from: Math.max(0, lo - 1), to: Math.min(15, Math.max(hi + 1, lo + 4)), orientation: 'horizontal', compact: true, links: [{ points: [place1, place2], cls: 'is-answer' }], label: 'Where the interval is on the guitar' });
      const song = songFor(q.semi, q.dir);
      const frets = q.semi === 0 ? 'the same note' : `${q.semi} fret${q.semi > 1 ? 's' : ''} apart on one string`;
      const text = `${a} to ${b}: ${frets}. On the neck: ${where(place1)} to ${where(place2)}.${song ? ` Think of ${song}.` : ''}`;
      const actions = [['▶ Replay', () => this.play(q)]];
      if (!correct) {
        actions.unshift(['▶ Compare', () => compareIntervals(q, Number(v), 2)]);
        // After a miss you hear your answer and the right one at once.
        A.later(() => compareIntervals(q, Number(v), 1), 450);
      }
      return {
        title: correct ? iv.name : `It was ${an(iv.name.toLowerCase())}`,
        sub: correct ? null : `You chose ${T.intervalBySemi(Number(v)).name.toLowerCase()}. Hear yours, then the right one.`,
        text, visual, actions,
        // A mixed-up pair comes back sooner: the interval you chose is asked again soon as well.
        requeue: correct ? [] : [`${v}:${q.dir}`]
      };
    },
    options(c, set) {
      return h('div', { class: 'opts' },
        D.field('Mode', GT.segmented('Mode', [['identify', 'Name it'], ['sing', 'Sing it'], ['guitar', 'On the neck']], c.mode, v => set({ mode: v }))),
        D.field('Direction', GT.segmented('Direction', [['up', 'Ascending'], ['down', 'Descending'], ['harmonic', 'Together'], ['mixed', 'Mixed']], c.direction, v => set({ direction: v }))),
        h('label', { class: 'row', style: 'gap:8px' }, h('input', { type: 'checkbox', checked: c.auto, onchange: e => set({ auto: e.target.checked, set: this.semis(Object.assign({}, c, { auto: true })) }) }), 'Add intervals for me as I improve'),
        c.auto ? h('p', { class: 'small muted' }, `Now practicing: ${this.semis(c).map(s => T.intervalBySemi(s).short).join(', ')}.`)
          : D.pickset('Intervals', T.INTERVALS.map(i => ({ value: i.semi, main: i.short, sub: i.name })), c.set, v => set({ set: v })));
    }
  });

  // ---------- scale degrees in a key ----------
  const DEGREE_STAGES = [['1', '3', '5'], ['2', '4'], ['6', '7'], ['♭3', '♭7', '♭6', '♭2', '♯4']];
  const SOLFEGE = { '1': 'do', '2': 're', '3': 'mi', '4': 'fa', '5': 'sol', '6': 'la', '7': 'ti', '♭2': 'ra', '♭3': 'me', '♯4': 'fi', '♭6': 'le', '♭7': 'te' };
  const RESOLVE = { '1': [0], '2': [2, 0], '3': [4, 2, 0], '4': [5, 4, 2, 0], '5': [7, 9, 11, 12], '6': [9, 11, 12], '7': [11, 12], '♭2': [1, 0], '♭3': [3, 2, 0], '♯4': [6, 7, 9, 11, 12], '♭6': [8, 7, 9, 11, 12], '♭7': [10, 11, 12] };
  const KEY_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  function cadence(keyPc) {
    const chords = [[0, 4, 7], [5, 9, 0], [7, 11, 2], [0, 4, 7]];
    let v = null;
    const seq = chords.map(c => { v = T.voiceLead(c.map(x => T.mod(keyPc + x)), v, 52, 70); return [36 + T.mod(keyPc + c[0] - 36)].concat(v); });
    A.chordSequence(seq, 132, 1);
    return seq.length * 60 / 132;
  }
  D.add({
    id: 'ear-degrees', track: 'ear',
    title: 'Scale degrees',
    blurb: 'A short cadence sets the key, then one note. Name its degree in the key.',
    hint: 'Hear the note against the key, not against the last note.',
    help: [
      'The cadence I–IV–V–I tells your ear where "home" is. Then one note sounds. Name its degree: 1 is home, 5 is the fifth, and so on. After you answer, the note walks back home, so you hear how it wants to resolve.',
      'This trains the function of a note in a key, which is how you hear melodies and solos. Start with 1, 3 and 5. The 2nd and 4th come next, then the 6th and 7th, then notes outside the key.',
      'The key changes every question by default, so you learn the sound of the degree, not a fixed pitch.'
    ],
    defaults: { auto: true, set: ['1', '3', '5'], keyChange: 'each' },
    stages: DEGREE_STAGES,
    fastMs: 3500,
    labels(c) {
      const list = c.auto ? DEGREE_STAGES.slice(0, stageOf('ear-degrees') + 1).flat() : c.set;
      return list.slice().sort((a, b) => T.parseDegree(a).semi - T.parseDegree(b).semi);
    },
    pool(c) { return this.labels(c); },
    unlockText(stage) { return `New degrees added: ${DEGREE_STAGES[stage].join(', ')}.`; },
    itemName: item => `${item} (${SOLFEGE[item]})`,
    make(item, c, session) {
      if (c.keyChange === 'each' || session.keyPc === undefined || session.count % 10 === 0) session.keyPc = randInt(0, 11);
      const keyPc = session.keyPc;
      const semi = T.parseDegree(item).semi;
      let midi = 60 + T.mod(keyPc + semi);
      if (midi > 74) midi -= 12;
      return { label: item, semi, keyPc, midi, tonic: midi - semi };
    },
    render(q, ui) {
      ui.title('Which degree?');
      ui.sub(`Key of ${KEY_NAMES[q.keyPc]} major.`);
      ui.actions([['▶ Replay', () => ui.play(), 'R'], ['▶ Note only', () => A.note(q.midi, 0, 1.2)], ['▶ Cadence', () => cadence(q.keyPc)]]);
      ui.choices(this.labels(ui.config).map(l => ({ value: l, main: l, sub: SOLFEGE[l] })));
    },
    play(q) {
      if (!q) return 0;
      const len = cadence(q.keyPc);
      A.note(q.midi, len + 0.35, 1.4);
      return len + 0.35;
    },
    check: (q, v) => v === q.label,
    feedback(q, v, correct) {
      const noteName = T.spell(KEY_NAMES[q.keyPc], q.label);
      const resolve = () => RESOLVE[q.label].forEach((s, i) => A.note(q.tonic + s, i * 0.42, i === RESOLVE[q.label].length - 1 ? 1.2 : 0.4));
      A.later(resolve, 350);
      return {
        hold: 0.35 + RESOLVE[q.label].length * 0.42 + 1,
        text: `${correct ? '' : `You chose ${v}. `}It was ${q.label} (${SOLFEGE[q.label]}), the note ${noteName} in ${KEY_NAMES[q.keyPc]} major. Hear it go home.`,
        actions: [['▶ Resolve', resolve], ['▶ Replay', () => this.play(q)]].concat(correct ? [] : [['▶ Yours', () => { const s = T.parseDegree(v).semi; A.note(q.midi, 0, 1); A.note(q.tonic + s + (q.midi - q.tonic - q.semi), 1.2, 1.2); }]])
      };
    },
    options(c, set) {
      return h('div', { class: 'opts' },
        D.field('New key', GT.segmented('New key', [['each', 'Every question'], ['ten', 'Every 10 questions']], c.keyChange, v => set({ keyChange: v }))),
        h('label', { class: 'row', style: 'gap:8px' }, h('input', { type: 'checkbox', checked: c.auto, onchange: e => set({ auto: e.target.checked, set: this.labels(Object.assign({}, c, { auto: true })) }) }), 'Add degrees for me as I improve'),
        c.auto ? h('p', { class: 'small muted' }, `Now practicing: ${this.labels(c).join(', ')}.`)
          : D.pickset('Degrees', Object.keys(SOLFEGE).sort((a, b) => T.parseDegree(a).semi - T.parseDegree(b).semi).map(l => ({ value: l, main: l, sub: SOLFEGE[l] })), c.set, v => set({ set: v })));
    }
  });

  // ---------- chord quality ----------
  const CHORD_STAGES = [['major', 'minor'], ['dim', 'aug'], ['7', 'maj7', 'm7'], ['m7b5', 'dim7']];
  D.add({
    id: 'ear-chords', track: 'ear',
    title: 'Chord quality',
    blurb: 'Major or minor first, then diminished and augmented, then seventh chords.',
    hint: 'Listen for the third first, then the fifth and the seventh.',
    help: [
      'You hear one chord on a random root. Name its quality. Press Arpeggio to hear the notes one by one.',
      'With inversions on, a triad can have its third or fifth in the bass. The quality stays the same.',
      'After a miss, Compare plays your answer and the right chord on the same root.'
    ],
    defaults: { auto: true, set: ['major', 'minor'], inversions: false },
    stages: CHORD_STAGES,
    fastMs: 3500,
    statsKey: c => c.inversions ? 'inv' : 'root',
    ids(c) { return c.auto ? CHORD_STAGES.slice(0, stageOf('ear-chords') + 1).flat() : c.set; },
    pool(c) { return this.ids(c); },
    unlockText(stage) { return `New chords added: ${CHORD_STAGES[stage].map(id => T.chordById(id).name.toLowerCase()).join(', ')}.`; },
    itemName: item => T.chordById(item).name,
    voicing(chordId, rootMidi, inversion) {
      const semis = T.chordById(chordId).toneList.map(t => t.semi);
      const rotated = semis.slice(inversion).concat(semis.slice(0, inversion).map(s => s + 12));
      return rotated.map(s => rootMidi + s);
    },
    make(item, c) {
      const triad = T.chordById(item).toneList.length === 3;
      const inversion = c.inversions && triad ? randInt(0, 2) : 0;
      const rootMidi = randInt(48, 58);
      return { id: item, rootMidi, inversion, midis: this.voicing(item, rootMidi, inversion) };
    },
    render(q, ui) {
      ui.title('Which chord?');
      ui.sub(ui.config.inversions ? 'Triads may be inverted.' : 'Root position.');
      ui.actions([['▶ Replay', () => ui.play(), 'R'], ['▶ Arpeggio', () => A.notes(q.midis, 'up', 0.32, 0.9)]]);
      ui.choices(this.ids(ui.config).map(id => ({ value: id, main: T.chordById(id).name, sub: T.chordById(id).tones })));
    },
    play(q) { if (q) A.notes(q.midis, 'together', 0, 1.6); return 0; },
    check: (q, v) => v === q.id,
    feedback(q, v, correct) {
      const c = T.chordById(q.id);
      const rootName = name(q.rootMidi);
      const notes = T.tonesOn(rootName, c).map(t => t.name).join(' ');
      return {
        text: `${correct ? '' : `You chose ${T.chordById(v).name.toLowerCase()}. `}It was ${T.chordName(rootName, c)} (${c.name.toLowerCase()}, ${c.tones}): ${notes}${q.inversion ? ', ' + T.INVERSIONS[q.inversion].toLowerCase() : ''}.`,
        actions: (correct ? [] : [['▶ Compare', () => {
          const mine = this.voicing(v, q.rootMidi, Math.min(q.inversion, T.chordById(v).toneList.length - 1));
          A.silence();
          A.notes(mine, 'together', 0, 1.3);
          A.later(() => A.notes(q.midis, 'together', 0, 1.3), 1600);
        }]]).concat([['▶ Arpeggio', () => A.notes(q.midis, 'up', 0.32, 0.9)]])
      };
    },
    options(c, set) {
      return h('div', { class: 'opts' },
        h('label', { class: 'row', style: 'gap:8px' }, h('input', { type: 'checkbox', checked: c.inversions, onchange: e => set({ inversions: e.target.checked }) }), 'Invert triads'),
        h('label', { class: 'row', style: 'gap:8px' }, h('input', { type: 'checkbox', checked: c.auto, onchange: e => set({ auto: e.target.checked, set: this.ids(Object.assign({}, c, { auto: true })) }) }), 'Add chords for me as I improve'),
        c.auto ? h('p', { class: 'small muted' }, `Now practicing: ${this.ids(c).map(id => T.chordById(id).name.toLowerCase()).join(', ')}.`)
          : D.pickset('Chords', CHORD_STAGES.flat().map(id => ({ value: id, main: T.chordById(id).name, sub: T.chordById(id).tones })), c.set, v => set({ set: v })));
    }
  });

  // ---------- progressions ----------
  const NUMERAL_STAGES = [['I', 'IV', 'V'], ['vi'], ['ii'], ['iii']];
  const NUMERAL_DEGREE = { I: 0, ii: 1, iii: 2, IV: 3, V: 4, vi: 5 };
  function progressionChords(keyPc, numerals) {
    const major = T.scaleById('major').toneList;
    let v = null;
    return numerals.map(n => {
      const d = NUMERAL_DEGREE[n];
      const pcs = [0, 2, 4].map(k => T.mod(keyPc + major[(d + k) % 7].semi));
      v = T.voiceLead(pcs, v, 52, 72);
      return [36 + T.mod(pcs[0] - 36)].concat(v);
    });
  }
  D.add({
    id: 'ear-progressions', track: 'ear',
    title: 'Progressions',
    blurb: 'Four chords in a key. The first is I. Name the other three.',
    hint: 'Follow the bass note, and feel whether each chord moves away from home or back.',
    help: [
      'Four chords play in a major key. The first chord is always I. Name chords 2, 3 and 4 with the buttons or the number keys, in order. Backspace removes the last one.',
      'Start with I, IV and V. Then vi, ii and iii join. The key changes every question.',
      'Tip: V pulls back to I. IV sounds open, a step away from home. vi sounds like a sad relative of I.'
    ],
    defaults: { auto: true, set: ['I', 'IV', 'V'] },
    stages: NUMERAL_STAGES,
    fastMs: 12000,
    advanceMs: 1600,
    numerals(c) { const l = c.auto ? NUMERAL_STAGES.slice(0, stageOf('ear-progressions') + 1).flat() : c.set; return Object.keys(NUMERAL_DEGREE).filter(n => l.includes(n)); },
    pool(c) {
      const nums = this.numerals(c), out = [];
      const walk = (seq) => { if (seq.length === 4) { out.push(seq.join('-')); return; } for (const n of nums) if (n !== seq[seq.length - 1]) walk(seq.concat(n)); };
      walk(['I']);
      return out;
    },
    unlockText(stage) { return `New chords added: ${NUMERAL_STAGES[stage].join(', ')}.`; },
    itemName: item => item.replace(/-/g, ' '),
    make(item) {
      const keyPc = randInt(0, 11);
      const numerals = item.split('-');
      return { keyPc, numerals, chords: progressionChords(keyPc, numerals), entered: [] };
    },
    render(q, ui) {
      ui.title('Name chords 2, 3 and 4');
      ui.sub(`Key of ${KEY_NAMES[q.keyPc]} major. The first chord is I.`);
      ui.actions([['▶ Replay', () => ui.play(), 'R']]);
      ui.noChoices();
      const slots = h('div', { class: 'chips', style: 'margin-top:16px;gap:8px' });
      const nums = this.numerals(ui.config);
      const drawSlots = () => slots.replaceChildren(...q.numerals.map((n, i) => h('span', { class: 'chip', style: 'min-width:64px;justify-content:center;font-weight:700;font-size:17px', 'aria-current': String(i === q.entered.length + 1) }, i === 0 ? 'I' : (q.entered[i - 1] || '?'))));
      const add = n => {
        if (q.done || q.entered.length >= 3) return;
        q.entered.push(n); drawSlots();
        if (q.entered.length === 3) { q.done = true; ui.submit(['I'].concat(q.entered).join('-')); }
      };
      q.add = add;
      q.back = () => { if (!q.done) { q.entered.pop(); drawSlots(); } };
      drawSlots();
      ui.board.replaceChildren(slots, h('div', { class: 'answers' }, nums.map((n, i) => h('button', { type: 'button', class: 'answer', onclick: () => add(n) }, h('b', null, n), h('span', null, T.diatonic(KEY_NAMES[q.keyPc])[NUMERAL_DEGREE[n]].name), h('span', { class: 'kbd', 'aria-hidden': 'true' }, D.KEYS[i])))),
        h('button', { type: 'button', class: 'btn', style: 'margin-top:10px', onclick: () => q.back() }, 'Undo', h('span', { class: 'kbd' }, '⌫')));
    },
    onKey(e, q, ui) {
      if (!q || q.done) return;
      if (e.key === 'Backspace') { e.preventDefault(); q.back(); return; }
      const i = D.KEYS.indexOf(e.key), nums = this.numerals(ui.config);
      if (i >= 0 && nums[i]) { e.preventDefault(); q.add(nums[i]); }
    },
    play(q) { if (!q) return 0; return A.chordSequence(q.chords, 96, 2); },
    check: (q, v) => v === q.numerals.join('-'),
    feedback(q, v, correct, ui) {
      const chordNames = q.numerals.map(n => T.diatonic(KEY_NAMES[q.keyPc])[NUMERAL_DEGREE[n]].name);
      const given = String(v).split('-');
      ui.board.querySelectorAll('.answer').forEach(b => { b.disabled = true; });
      const slots = ui.board.querySelector('.chips');
      slots.replaceChildren(...q.numerals.map((n, i) => h('span', { class: 'chip', style: `min-width:64px;justify-content:center;font-weight:700;font-size:17px;border-color:${given[i] === n ? 'var(--ok)' : 'var(--bad)'}` }, given[i] === n ? n : `${given[i]} → ${n}`)));
      return {
        text: `It was ${q.numerals.join(' ')}: ${chordNames.join(' ')}.`,
        actions: [['▶ Replay', () => this.play(q)]].concat(correct ? [] : [['▶ Yours', () => A.chordSequence(progressionChords(q.keyPc, given), 96, 2)]])
      };
    },
    options(c, set) {
      return h('div', { class: 'opts' },
        h('label', { class: 'row', style: 'gap:8px' }, h('input', { type: 'checkbox', checked: c.auto, onchange: e => set({ auto: e.target.checked, set: this.numerals(Object.assign({}, c, { auto: true })) }) }), 'Add chords for me as I improve'),
        c.auto ? h('p', { class: 'small muted' }, `Now practicing: ${this.numerals(c).join(', ')}.`)
          : D.pickset('Chords', Object.keys(NUMERAL_DEGREE).map(n => ({ value: n, main: n })), c.set, v => set({ set: v.includes('I') ? v : ['I'].concat(v) }), 2));
    }
  });
})(window);

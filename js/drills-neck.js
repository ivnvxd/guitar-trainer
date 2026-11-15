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
    itemName: item => { const [s, f] = item.split(':').map(Number); return `${T.PC_PLAIN[T.mod(GT.tuning()[s] + f)]}: ${ord(s)} string, ${f ? 'fret ' + f : 'open'}`; },
    // The places you missed, on one neck, each with its note name.
    missedVisual(items, ui) {
      const [lo, hi] = range(ui.config.frets), t = GT.tuning();
      const markers = items.map(item => { const [s, f] = item.split(':').map(Number); return { string: s, fret: f, kind: 'wrong', label: T.PC_PLAIN[T.mod(t[s] + f)] }; });
      return ui.neck(markers, { from: lo === 0 ? 0 : lo - 1, to: Math.max(hi, (lo === 0 ? 0 : lo - 1) + 5), turn: false, label: 'The places you missed' });
    },
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
      return { hold: 0.8, text: `${correct ? '' : `You chose ${DUAL[Number(v)]}. `}It is ${DUAL[T.mod(q.midi)]} on the ${where(q.string, q.fret)}. The faint dots show the other places of this note.` };
    },
    options(c, set) {
      return h('div', { class: 'opts' },
        D.pickset('Strings', [5, 4, 3, 2, 1, 0].map(s => ({ value: s, main: `${ord(s)}`, sub: T.STRING_NAMES[s] })), c.strings, v => set({ strings: v })),
        D.field('Frets', GT.segmented('Frets', RANGES, c.frets, v => set({ frets: v }))),
        D.field('Notes', GT.segmented('Notes', [[true, 'Natural notes'], [false, 'All notes']], c.naturals, v => set({ naturals: v }))));
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
      return { text: v === 'gave-up' ? `Here are all ${q.positions.length} places. You found the green ones.` : correct ? `All ${q.positions.length} places, no wrong taps.` : `All found, with ${q.wrong.length} wrong tap${q.wrong.length > 1 ? 's' : ''}.` };
    },
    options(c, set) {
      return h('div', { class: 'opts' },
        D.field('Frets', GT.segmented('Frets', [[5, '0–5'], [12, '0–12'], [15, '0–15']], c.frets, v => set({ frets: v }))),
        D.field('Notes', GT.segmented('Notes', [[true, 'Natural notes'], [false, 'All notes']], c.naturals, v => set({ naturals: v }))));
    }
  });

  // ---------- read the staff ----------
  // A note on the treble staff, written as guitar music is: an octave above the sound. Tap one place that plays it.
  const LETTERS = 'CDEFGAB';
  const octaveName = midi => `${T.PC_PLAIN[T.mod(midi)]}${Math.floor(midi / 12) - 1}`;
  function staff(midi) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    const el = (name, attrs, parent = svg) => { const n = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); parent.appendChild(n); return n; };
    svg.setAttribute('viewBox', '0 0 200 150');
    svg.setAttribute('class', 'staff');
    const written = midi + 12, name = T.PC_PLAIN[T.mod(written)];
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `The note ${name} on the treble staff`);
    // Step 0 is E4, the bottom line. Each step is a line or a space.
    const step = LETTERS.indexOf(name[0]) + 7 * (Math.floor(written / 12) - 1) - (2 + 7 * 4);
    const y = s => 98 - s * 5, x = 128;
    for (let s = 0; s <= 8; s += 2) el('line', { x1: 8, x2: 192, y1: y(s), y2: y(s), class: 'staff-line' });
    // Ledger lines above and below the staff.
    for (let s = -2; s >= step; s -= 2) el('line', { x1: x - 13, x2: x + 13, y1: y(s), y2: y(s), class: 'staff-line' });
    for (let s = 10; s <= step; s += 2) el('line', { x1: x - 13, x2: x + 13, y1: y(s), y2: y(s), class: 'staff-line' });
    el('text', { x: 12, y: 108, class: 'staff-clef' }).textContent = '𝄞';
    if (name.length > 1) el('text', { x: x - 21, y: y(step) + 5, class: 'staff-acc', 'text-anchor': 'middle' }).textContent = name.slice(1);
    el('ellipse', { cx: x, cy: y(step), rx: 6.6, ry: 4.9, transform: `rotate(-20 ${x} ${y(step)})`, class: 'staff-note' });
    return svg;
  }
  D.add({
    id: 'neck-staff', track: 'neck',
    title: 'Read the staff',
    blurb: 'A note on the staff. Tap where you play it on the neck.',
    hint: 'Guitar music sounds an octave lower than written: the bottom line, E, is the open D string up two frets.',
    help: [
      'A note appears on the treble staff. Tap one place on the neck that plays it, in the same octave. Guitar music is written an octave higher than it sounds, so the open low E string sits three ledger lines below the staff.',
      'Start in the first position, frets 0 to 4, with natural notes. Most beginner music stays there.',
      'Landmarks: the bottom line E is the D string at fret 2, the top line F is the high e string at fret 1, and the middle line B is the open B string.'
    ],
    defaults: { frets: 4, naturals: true },
    fastMs: 4000,
    autoPlay: false,
    pool(c) {
      const t = GT.tuning(), out = new Set();
      for (let s = 0; s < 6; s++) for (let f = 0; f <= c.frets; f++) if (!c.naturals || NATURAL_PCS.includes(T.mod(t[s] + f))) out.add(String(t[s] + f));
      return [...out];
    },
    itemName: item => octaveName(Number(item)),
    make(item) { return { midi: Number(item) }; },
    render(q, ui) {
      ui.title('Where do you play this note?');
      ui.sub('Tap one place on the neck. Any string works, in the same octave.');
      ui.noChoices();
      ui.board.replaceChildren(staff(q.midi), ui.neck([], { from: 0, to: ui.config.frets, label: 'Tap where the note is', onPress: (s, f, midi) => {
        if (q.over) return;
        q.over = true;
        A.note(midi, 0, 0.7);
        q.tap = { string: s, fret: f, midi };
        ui.submit(midi === q.midi ? 'right' : 'wrong');
      } }));
    },
    check: (q, v) => v === 'right',
    feedback(q, v, correct, ui) {
      const t = GT.tuning(), places = [];
      for (let s = 0; s < 6; s++) for (let f = 0; f <= Math.max(ui.config.frets, 12); f++) if (t[s] + f === q.midi) places.push({ string: s, fret: f, kind: 'correct', label: T.PC_PLAIN[T.mod(q.midi)] });
      const markers = places.concat(q.tap && !correct ? [{ string: q.tap.string, fret: q.tap.fret, kind: 'wrong', label: T.PC_PLAIN[T.mod(q.tap.midi)] }] : []);
      ui.board.replaceChildren(staff(q.midi), ui.neck(markers, { from: 0, to: Math.max(ui.config.frets, ...places.map(p => p.fret)), label: `Every place of ${octaveName(q.midi)}` }));
      return { text: correct ? `Right: ${octaveName(q.midi)}. The green dots are the other places of the same note.`
        : q.tap ? `That is ${octaveName(q.tap.midi)}. The note is ${octaveName(q.midi)}, at the green dots.` : `The note is ${octaveName(q.midi)}, at the green dots.` };
    },
    options(c, set) {
      return h('div', { class: 'opts' },
        D.field('Frets', GT.segmented('Frets', [[4, '0–4'], [7, '0–7'], [12, '0–12']], c.frets, v => set({ frets: v }))),
        D.field('Notes', GT.segmented('Notes', [[true, 'Natural notes'], [false, 'All notes']], c.naturals, v => set({ naturals: v }))));
    }
  });

  // ---------- play the note ----------
  // You play a note on your guitar, and the microphone checks it. It hears the pitch only and cannot tell which
  // string played it, so every question asks for a pitch: a note name in any octave, each octave of a note in the
  // fret range, or the exact pitch of a note on the staff. The page plays no sound while it listens.
  const PLAY_MODES = [['any', 'Any octave'], ['octaves', 'Every octave'], ['staff', 'From the staff']];
  const pitchesOf = (pc, frets) => {
    const t = GT.tuning(), out = new Set();
    for (let s = 0; s < 6; s++) for (let f = 0; f <= frets; f++) if (T.mod(t[s] + f) === pc) out.add(t[s] + f);
    return [...out].sort((a, b) => a - b);
  };
  const pitchPlaces = (midi, frets) => {
    const t = GT.tuning(), out = [];
    for (let s = 0; s < 6; s++) for (let f = 0; f <= frets; f++) if (t[s] + f === midi) out.push({ string: s, fret: f });
    return out;
  };
  // The listening state lives as long as the drill page: the microphone stays on from one question to the next.
  // A note counts when its pitch holds for three readings in a row (about a quarter second) and it is new: a new
  // pluck (the sound grows), or a pitch other than the last one heard. A note that still rings from the last
  // question does not answer the next one.
  const ear = { on: false, q: null, ui: null, view: null, t0: 0, floor: 1, fresh: false, run: [], last: null };
  // The microphone stops when the page is hidden: another tab, another app, or a locked phone.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || !ear.on) return;
    A.stopListening();
    ear.on = false;
    if (ear.view) ear.view.say('The microphone stopped when you left the page. Tap Start listening to go on.');
    if (ear.restart) ear.restart();
  });
  function hear(buf, rate) {
    const v = ear.view;
    if (!v) return;
    if (!buf) { v.say('The sound of the page is paused. Leave the drill and open it again.'); return; }
    const { rms } = A.levelOf(buf);
    v.level.style.width = `${Math.min(100, Math.round(rms / 0.08 * 100))}%`;
    // The page follows the sound also between questions, so a note played during the feedback is known.
    if (rms > Math.max(0.012, ear.floor * 1.8)) { ear.fresh = true; ear.run = []; ear.floor = rms; }
    else ear.floor = Math.min(ear.floor, rms);
    const f = T.pitchOf(buf, rate);
    if (!f) { ear.run = []; return; }
    const midi = Math.round(69 + 12 * Math.log2(f / 440));
    ear.run.push(midi);
    if (ear.run.length > 3) ear.run.shift();
    v.heard(midi);
    if (ear.run.length < 3 || !ear.run.every(m => m === midi)) return;
    const q = ear.q;
    // Between questions, and in the first 300 ms of one, a note is heard but is no answer. A new question then
    // waits for a new pluck or another pitch.
    if (!q || q.over || performance.now() - ear.t0 < 300) { ear.last = midi; ear.fresh = false; return; }
    if (!ear.fresh && midi === ear.last) return;
    ear.fresh = false; ear.run = []; ear.last = midi;
    PLAY.answer(q, midi, ear.ui);
  }
  const PLAY = {
    id: 'neck-play', track: 'neck',
    title: 'Play the note',
    blurb: 'The page asks for a note. Play it on your guitar, and the microphone checks it.',
    hint: 'Play one note and let it ring.',
    help: [
      'The microphone hears the pitch you play. It cannot tell which string you used, so every place with the right pitch counts. After each answer the neck shows every place of that pitch.',
      'Any octave: play the named note anywhere. Every octave: play each one in the fret range, best from low to high; the page ticks each one it hears. From the staff: play the exact note on the staff. Guitar music sounds an octave lower than it is written.',
      'Use a quiet room and hold the phone near the guitar. The page plays no sound while it listens, and it asks for the microphone at the first question.'
    ],
    defaults: { mode: 'any', frets: 12, naturals: true },
    statsKey: c => c.mode,
    fastMs: c => c.mode === 'octaves' ? 15000 : c.mode === 'staff' ? 5000 : 3500,
    autoPlay: false,
    advanceMs: 1300,
    pool(c) {
      const pcs = c.naturals ? NATURAL_PCS : [...Array(12).keys()];
      if (c.mode !== 'staff') return pcs.map(String);
      const t = GT.tuning(), out = new Set();
      for (let s = 0; s < 6; s++) for (let f = 0; f <= c.frets; f++) if (pcs.includes(T.mod(t[s] + f))) out.add(String(t[s] + f));
      return [...out];
    },
    // A pitch class (0 to 11) or, from the staff, an exact pitch (a MIDI number, 40 or more).
    itemName: item => Number(item) > 11 ? octaveName(Number(item)) : T.PC_PLAIN[Number(item)],
    make(item, c) {
      const n = Number(item);
      if (c.mode === 'staff') return { mode: 'staff', midi: n };
      if (c.mode === 'octaves') return { mode: 'octaves', pc: n, targets: pitchesOf(n, c.frets), found: new Set(), wrong: [] };
      return { mode: 'any', pc: n };
    },
    render(q, ui) {
      const frets = ui.config.frets;
      ui.title(q.mode === 'staff' ? 'Play this note' : q.mode === 'octaves' ? `Play every ${T.PC_PLAIN[q.pc]}` : `Play ${/^[AEF]/.test(T.PC_PLAIN[q.pc]) ? 'an' : 'a'} ${T.PC_PLAIN[q.pc]}`);
      ui.sub(q.mode === 'staff' ? 'The exact pitch on the staff, on any string.' : q.mode === 'octaves' ? `Frets 0–${frets}, best from low to high.` : 'In any octave, on any string.');
      ui.noChoices();
      ui.actions([['Show me', () => ui.submit('skip')]]);
      // The panel under the question: what the microphone hears, and the octaves found so far.
      const heard = h('b', { class: 'listen-note' }, '–');
      const say = h('p', { class: 'listen-say', 'aria-live': 'polite' });
      const level = h('i');
      const octaves = q.mode === 'octaves' ? h('div', { class: 'listen-octaves', role: 'list', 'aria-label': 'Octaves to play' }) : null;
      const drawOctaves = () => { if (octaves) octaves.replaceChildren(...q.targets.map(m => h('span', { role: 'listitem', class: 'listen-octave' + (q.found.has(m) ? ' is-found' : '') }, octaveName(m), q.found.has(m) ? ' ✓' : ''))); };
      drawOctaves();
      const startBtn = h('button', { type: 'button', class: 'btn btn-primary btn-big', onclick: async () => {
        startBtn.disabled = true;
        say.textContent = 'Waiting for the microphone…';
        try {
          if (!await A.listen(hear)) return;
          ear.on = true;
          startBtn.remove();
          say.textContent = 'Listening.';
          ear.t0 = performance.now();
          ui.startClock(0);
        } catch (e) { startBtn.disabled = false; say.textContent = GT.micError(e); }
      } }, 'Start listening');
      const panel = h('div', { class: 'listen' },
        h('div', { class: 'listen-row' }, h('span', { class: 'muted' }, 'Heard'), heard, h('div', { class: 'listen-level', title: 'What the microphone hears' }, level)),
        octaves, ear.on ? null : startBtn, say);
      // Back on the page after the microphone stopped: the button comes back.
      ear.restart = () => { startBtn.disabled = false; if (!startBtn.isConnected) panel.insertBefore(startBtn, say); };
      ear.view = { level, say: t => { say.textContent = t; }, heard: m => { heard.textContent = octaveName(m); } };
      q.drawOctaves = drawOctaves;
      ear.q = q; ear.ui = ui; ear.t0 = performance.now(); ear.fresh = false; ear.run = [];
      ui.board.replaceChildren(...[q.mode === 'staff' ? staff(q.midi) : null, panel].filter(Boolean));
      if (ear.on) say.textContent = 'Listening.';
      else say.textContent = 'The page needs the microphone to hear you. It hears only while this drill is open, and nothing leaves this device.';
    },
    // A heard note. Any octave and the staff take one note; every octave takes notes until all are found.
    answer(q, midi, ui) {
      if (q.mode === 'any') { q.played = midi; ui.submit(T.mod(midi) === q.pc ? 'right' : 'wrong'); return; }
      if (q.mode === 'staff') { q.played = midi; ui.submit(midi === q.midi ? 'right' : 'wrong'); return; }
      if (T.mod(midi) !== q.pc) { q.wrong.push(midi); ear.view.say(`${octaveName(midi)} is not ${T.PC_PLAIN[q.pc]}.`); return; }
      if (!q.targets.includes(midi)) { ear.view.say(`${octaveName(midi)} is outside frets 0–${ui.config.frets}.`); return; }
      q.found.add(midi);
      q.drawOctaves();
      ear.view.say(`${octaveName(midi)}: ${q.found.size} of ${q.targets.length}.`);
      if (q.found.size === q.targets.length) { q.over = true; ui.submit(q.wrong.length ? 'errors' : 'clean'); }
    },
    check: (q, v) => v === 'right' || v === 'clean',
    feedback(q, v, correct, ui) {
      q.over = true;
      const frets = ui.config.frets;
      const name = T.PC_PLAIN[q.mode === 'staff' ? T.mod(q.midi) : q.pc];
      let markers = [], text;
      if (q.mode === 'octaves') {
        for (const m of q.targets) for (const p of pitchPlaces(m, frets)) markers.push(Object.assign(p, { kind: q.found.has(m) ? 'correct' : 'target', label: name }));
        text = v === 'skip' ? `Every ${name} in frets 0–${frets}: ${q.targets.map(octaveName).join(', ')}. You played the green ones.`
          : correct ? `All ${q.targets.length} octaves: ${q.targets.map(octaveName).join(', ')}.` : `All ${q.targets.length} found, with ${q.wrong.length} wrong note${q.wrong.length > 1 ? 's' : ''}.`;
      } else {
        const want = q.mode === 'staff' ? [q.midi] : pitchesOf(q.pc, frets);
        const played = q.played !== undefined && v !== 'skip' ? q.played : null;
        for (const m of want) for (const p of pitchPlaces(m, frets)) markers.push(Object.assign(p, { kind: played === m ? 'correct' : q.mode === 'staff' ? 'correct' : 'ghost', label: name }));
        if (played !== null && !correct) for (const p of pitchPlaces(played, frets)) markers.push(Object.assign(p, { kind: 'wrong', label: T.PC_PLAIN[T.mod(played)] }));
        const what = q.mode === 'staff' ? octaveName(q.midi) : name;
        text = v === 'skip' ? `${what} is at the marked places.`
          : correct ? (q.mode === 'staff' ? `Right: ${octaveName(q.midi)}. The green dots are every place of it.` : `Right: you played ${octaveName(played)}. The green dots are the places of that pitch, the faint ones the other ${name}s.`)
          : `You played ${octaveName(played)}. ${what} is at the ${q.mode === 'staff' ? 'green' : 'marked'} dots.`;
      }
      const to = Math.max(frets, ...markers.map(m => m.fret));
      const neck = ui.neck(markers, { from: 0, to, label: `Every place of ${q.mode === 'staff' ? octaveName(q.midi) : name}` });
      ui.board.replaceChildren(...[q.mode === 'staff' ? staff(q.midi) : null, neck].filter(Boolean));
      return { text };
    },
    stop() { A.stopListening(); Object.assign(ear, { on: false, q: null, ui: null, view: null, restart: null }); },
    options(c, set) {
      return h('div', { class: 'opts' },
        D.field('Mode', GT.segmented('Mode', PLAY_MODES, c.mode, v => set({ mode: v }))),
        D.field('Frets', GT.segmented('Frets', [[4, '0–4'], [7, '0–7'], [12, '0–12']], c.frets, v => set({ frets: v }))),
        D.field('Notes', GT.segmented('Notes', [[true, 'Natural notes'], [false, 'All notes']], c.naturals, v => set({ naturals: v }))));
    }
  };
  D.add(PLAY);

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
      return h('div', { class: 'opts' },
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
      return h('div', { class: 'opts' },
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
  const andList = list => list.length > 1 ? list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1] : list.join('');
  const placesOf = frets => frets.map((f, s) => f === null ? null : { string: s, fret: f }).filter(Boolean);
  // The outlines of a shape and its neighbors on the map, with rings on the notes they share.
  function cagedPicture(rootName, quality, shapes, extra = {}) {
    const map = T.cagedMap(rootName, quality, 17);
    const regions = [], shared = new Set(), links = [];
    for (const sh of shapes) {
      const at = map.findIndex(m => m.frets.every((f, k) => f === sh.frets[k]));
      if (at < 0) continue;
      for (const n of [map[at - 1], map[at + 1]].filter(Boolean)) {
        if (!shapes.includes(n) && !extra.only) regions.push({ points: placesOf(n.frets), label: n.shape, cls: 'is-near shape-' + n.shape });
        T.sharedPlaces(sh, n).forEach(x => shared.add(x));
      }
      regions.push({ points: placesOf(sh.frets), label: map[at].shape, cls: 'is-current shape-' + map[at].shape });
      links.push({ points: placesOf(sh.frets), cls: 'is-shape' });
    }
    return { regions, links, ring: (s, f) => shared.has(`${s}:${f}`) };
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
        q.win = win; q.markers = markers;
        // Lines join the notes, so the shape reads as one figure. The lane under the neck waits for the answer's letters.
        ui.board.replaceChildren(ui.neck(markers, Object.assign({}, win, { tuning: T.STANDARD, lane: true, links: [{ points: placesOf(q.shape.frets), cls: 'is-shape' }], muted: q.shape.frets.map((f, i) => f === null ? i : null).filter(i => i !== null), label: 'A CAGED shape' })));
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
      const draw = () => row.replaceChildren(...['C', 'A', 'G', 'E', 'D'].map((l, i) => h('button', { type: 'button', class: 'answer', 'aria-pressed': String(q.picked.includes(l)), onclick: () => toggle(l) }, h('b', null, l), h('span', null, 'shape'), h('span', { class: 'kbd', 'aria-hidden': 'true' }, D.KEYS[i]))));
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
        const strings = andList(rootStrings(q.quality, q.letter).map(s => ord(s)));
        // The answer on the same neck: the shape's outline and the shapes before and after it.
        const pic = cagedPicture(q.rootName, q.quality, [q.shape]);
        const markers = q.markers.map(m => Object.assign({}, m, { ring: pic.ring(m.string, m.fret) }));
        ui.board.replaceChildren(ui.neck(markers, Object.assign({}, q.win, { tuning: T.STANDARD, lane: true, regions: pic.regions, links: pic.links, muted: q.shape.frets.map((f, i) => f === null ? i : null).filter(i => i !== null), label: 'The shape and its neighbors' })));
        const near = pic.regions.filter(r => r.cls.startsWith('is-near')).map(r => r.label);
        return {
          title: `${q.letter} shape`,
          text: `The open ${q.letter}${q.quality === 'minor' ? 'm' : ''} chord moved up the neck. Its roots are on the ${strings} strings.${near.length ? ` Beside it on the neck: the ${andList(near)} ${near.length > 1 ? 'shapes' : 'shape'}. The ringed notes are the ones they share.` : ''}`,
          actions: [['Open in Library', () => GT.go(`library/chords/${q.quality}/${GT.rootSlug(q.rootName)}/caged-${q.letter}`)]]
        };
      }
      ui.board.querySelectorAll('.answer').forEach(b => { b.disabled = true; const l = b.querySelector('b').textContent; if (q.expected.includes(l)) { b.classList.add('is-correct'); b.append(D.icon('check', 'answer-mark')); } else if (q.picked.includes(l)) { b.classList.add('is-wrong'); b.append(D.icon('cross', 'answer-mark')); } });
      // Both shapes that grow from this root, side by side on the neck.
      const map = T.cagedMap(q.rootName, q.quality, 17);
      const both = q.expected.map(l => map.find(m => m.shape === l && m.frets[q.string] === q.fret)).filter(Boolean);
      let visual = null;
      if (both.length) {
        const pic = cagedPicture(q.rootName, q.quality, both, { only: true });
        const tones = T.tonesOn(q.rootName, T.chordById(q.quality));
        const markers = [];
        for (const sh of both) sh.frets.forEach((f, s) => {
          if (f === null || markers.some(m => m.string === s && m.fret === f)) return;
          const t = tones.find(x => x.pc === T.mod(T.STANDARD[s] + f));
          markers.push({ string: s, fret: f, kind: FB.degreeKind(t.label), label: t.label, ring: pic.ring(s, f) });
        });
        const lo = Math.min(...both.map(b => b.low)), hi = Math.max(...both.map(b => b.high));
        visual = ui.neck(markers, { from: Math.max(0, lo - 1), to: Math.min(17, Math.max(hi + 1, lo + 5)), tuning: T.STANDARD, turn: false, regions: pic.regions, links: pic.links, label: 'The two shapes from this root' });
      }
      return { title: `${q.expected.join(' and ')} shapes`, text: `From a root on the ${ord(q.string)} string, ${q.rootName} at fret ${q.fret}. The two shapes overlap where they share notes.`, visual, actions: [['Open in Library', () => GT.go(`library/chords/${q.quality}/${GT.rootSlug(q.rootName)}`)]] };
    },
    options(c, set) {
      return h('div', { class: 'opts' },
        D.field('Mode', GT.segmented('Mode', [['name', 'Name the shape'], ['roots', 'Shapes from a root']], c.mode, v => set({ mode: v }))),
        D.field('Chords', GT.segmented('Chords', [['major', 'Major'], ['minor', 'Minor']], c.quality, v => set({ quality: v }))));
    }
  });
})(window);

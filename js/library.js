/* Library: the reference part of the site. A start page with search, then six topics in the order
   you learn them: notes, intervals, scales, chords, triads and keys. Every view has its own link,
   for example #/library/scales/blues/a or #/library/chords/maj7/c/caged-e. */
(function (root) {
  'use strict';
  const GT = root.GT;
  const T = GT.theory, FB = GT.fretboard, A = GT.audio;
  const { h, store, settings, rootSlug, rootFromSlug } = GT;

  const lib = Object.assign({ labels: 'notes' }, store.get('library', {}));
  const saveLib = patch => { Object.assign(lib, patch); store.set('library', lib); };
  // find: more words that the search knows a topic by.
  const TOPICS = [
    { id: 'notes', name: 'Notes', title: 'Notes on the neck', line: 'Where every note is. Start with the natural notes.', find: 'fretboard note names natural sharps flats' },
    { id: 'intervals', name: 'Intervals', title: 'Intervals', line: 'The distance between two notes, and its shape on the neck.', find: 'distance semitones' },
    { id: 'scales', name: 'Scales', title: 'Scales', line: 'Major, minor, pentatonic and modes, in positions over the whole neck.', find: 'modes positions boxes pentatonic play along backing drone' },
    { id: 'chords', name: 'Chords', title: 'Chords and CAGED', line: 'The notes of a chord, its shapes, and how the five CAGED shapes join.', find: 'shapes open barre' },
    { id: 'triads', name: 'Triads', title: 'Triads', line: 'Three-note chords on each set of strings, with their inversions.', find: 'inversions three strings' },
    { id: 'keys', name: 'Keys', title: 'Keys and the circle of fifths', line: 'The seven chords of a key, its signature and common progressions.', find: 'key signature progressions roman numerals play along backing loop' }
  ];
  // A tool beside the topics: from notes on the neck to their name.
  const LOOKUP = { id: 'name', name: 'Name it', title: 'Name these notes', line: 'Tap notes on the neck and get the name of the chord and the scales that hold them.', find: 'identify chord finder namer reverse lookup what is this' };
  // The drills that train what a topic shows: [drill id, text of the link].
  const PRACTICE = {
    notes: [['neck-notes', 'Name the note'], ['neck-find', 'Find every note']],
    intervals: [['ear-intervals', 'Intervals by ear'], ['neck-degrees', 'Degrees from a root']],
    scales: [['ear-degrees', 'Scale degrees by ear'], ['neck-degrees', 'Degrees from a root']],
    chords: [['neck-caged', 'CAGED shapes'], ['ear-chords', 'Chord quality by ear']],
    triads: [['neck-triads', 'Triad shapes'], ['ear-chords', 'Chord quality by ear']],
    keys: [['keys-chords', 'Chords in a key'], ['keys-facts', 'Key facts'], ['keys-numbers', 'Numbers to chords'], ['ear-progressions', 'Progressions by ear']]
  };
  const PROPER = /^(Dorian|Phrygian|Lydian|Mixolydian|Locrian|Hungarian|Ionian|Aeolian)/;
  const lowerName = name => PROPER.test(name) ? name : name[0].toLowerCase() + name.slice(1);
  const stringOrdinal = s => FB.ordinal(6 - s);
  let lastRender = null;

  // ---------- shared pieces ----------
  // The control panel above the neck: every choice of a page in one place, one tap each.
  // A plain control needs no label on a phone, because its buttons say what it is.
  function ctl(label, control, cls = '') { return h('div', { class: 'ctl ' + cls }, h('span', { class: 'ctl-label' }, label), control); }
  function controls(...items) { return h('div', { class: 'controls', role: 'group', 'aria-label': 'Choices' }, items.flat().filter(Boolean)); }
  // Root: seven letters and a sharp or flat. Every root is in view and at most two taps away.
  // A letter gives the natural note. The sharp or flat then changes it.
  function rootCtl(state, view) {
    const current = state.root, letter = current[0], acc = current.slice(1);
    const go = name => { if (name !== current) GT.go(view.link(Object.assign({}, state, { root: name, pos: null })), true); };
    const letters = h('div', { class: 'letters', role: 'radiogroup', 'aria-label': 'Root letter' }, 'CDEFGAB'.split('').map(l =>
      h('button', { type: 'button', class: 'chip', role: 'radio', 'aria-checked': String(l === letter), onclick: () => go(l === letter ? current : l) }, l)));
    const accs = h('div', { class: 'seg accs', role: 'radiogroup', 'aria-label': 'Sharp or flat' }, [['♭', 'Flat'], ['', 'Natural'], ['♯', 'Sharp']].map(([a, name]) =>
      h('button', { type: 'button', role: 'radio', 'aria-checked': String(a === acc), 'aria-label': name, disabled: !T.ROOTS.includes(letter + a), onclick: () => go(letter + a) }, a || '♮')));
    return [ctl('Root', letters, 'ctl-root ctl-plain'), ctl('Sharp or flat', accs, 'ctl-plain ctl-quiet')];
  }
  // A type picker: the common types as chips, one tap each, and a list for the rest.
  // quick: [[value, text]]; groups: [{ name, items: [[value, text]] }].
  function typePick(label, quick, groups, value, onChange) {
    const isQuick = v => quick.some(q => q[0] === v);
    const rest = groups.map(g => ({ name: g.name, items: g.items.filter(([v]) => !isQuick(v)) })).filter(g => g.items.length);
    const more = `More ${label.toLowerCase()}s`;
    const select = h('select', { class: 'more' + (isQuick(value) ? '' : ' is-on'), 'aria-label': more, onchange: e => onChange(e.target.value) },
      h('option', { value: '', selected: isQuick(value), disabled: true }, more),
      rest.map(g => h('optgroup', { label: g.name }, g.items.map(([v, t]) => h('option', { value: v, selected: v === value }, t)))));
    return h('div', { class: 'types', role: 'group', 'aria-label': label },
      quick.map(([v, t]) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(v === value), onclick: () => { if (v !== value) onChange(v); } }, t)), select);
  }
  function labelsCtl(onChange) {
    return ctl('Labels', GT.segmented('Labels', [['notes', 'Notes'], ['degrees', 'Degrees']], lib.labels, v => { saveLib({ labels: v }); onChange(); }), 'ctl-plain');
  }
  // On a phone the neck scrolls, so the number of frets matters less: this control shows on wide screens only.
  function fretsCtl(onChange) {
    return ctl('Frets', GT.segmented('Frets shown', [[12, '12'], [15, '15'], [24, '24']], settings.frets, v => { GT.saveSettings({ frets: v }); onChange(); }), 'ctl-wide-only');
  }
  const kindOf = t => t.kind || FB.degreeKind(t.label);
  // The tones of a scale or chord as a row of equal tiles. The row is also the color key of the neck.
  function toneRow(tones, tile, label) {
    const n = tones.length;
    return h('div', { class: 'formula', role: label ? 'group' : null, 'aria-label': label, style: `--n:${n};--cols:${n <= 7 ? n : Math.ceil(n / 2)}` }, tones.map(tile));
  }
  const toneInside = t => [
    h('i', { class: 'swatch' + (kindOf(t) === 'root' ? ' is-root' : ''), style: `background:var(--${kindOf(t)})` }),
    h('b', null, lib.labels === 'notes' ? t.name : t.label), h('span', null, lib.labels === 'notes' ? t.label : t.name)];
  // A two-octave keyboard from C, with the tones of the page from the root up. A key plays its note.
  // On a keyboard a semitone is the very next key, so the steps of a scale or chord are easy to see.
  function piano(tones, rootName) {
    const el = FB.el, WHITE = [0, 2, 4, 5, 7, 9, 11], KW = 24, KH = 88, BW = 15, BH = 54;
    const svg = el('svg', { viewBox: `0 0 ${14 * KW + 2} ${KH + 2}`, class: 'piano', role: 'group', 'aria-label': 'Piano keyboard, two octaves from C' });
    const base = T.pcOf(rootName);
    const at = new Map(tones.map(t => { let k = base + t.semi; while (k > 23) k -= 12; return [k, t]; }));
    const key = (k, x, w, height, cls) => {
      const t = at.get(k);
      const g = el('g', { class: `pkey ${cls}${t ? ' is-on fb-' + kindOf(t) : ''}`, role: 'button', tabindex: '0', 'aria-label': t ? `${t.name}, ${t.label}` : T.PC_PLAIN[k % 12] }, svg);
      el('rect', { x, y: 1, width: w, height, rx: 3 }, g);
      if (t) {
        const text = lib.labels === 'notes' || t.kind ? t.name : t.label;
        const cx = x + w / 2, cy = height - 13, r = cls === 'black' ? 7 : 8.5;
        if (kindOf(t) === 'root') el('rect', { x: cx - r, y: cy - r, width: r * 2, height: r * 2, rx: r * 0.42, class: 'pdot' }, g);
        else el('circle', { cx, cy, r, class: 'pdot' }, g);
        el('text', { x: cx, y: cy + 3.2, class: 'plabel' + (text.length > 1 ? ' plabel-long' : '') }, g).textContent = text;
      }
      const play = () => A.note(48 + k, 0, 0.9, 0.5);
      g.addEventListener('click', play);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); } });
    };
    for (let o = 0; o < 2; o++) WHITE.forEach((semi, i) => key(o * 12 + semi, 1 + (o * 7 + i) * KW, KW, KH, 'white'));
    for (let o = 0; o < 2; o++) [0, 1, 3, 4, 5].forEach(i => key(o * 12 + WHITE[i] + 1, 1 + (o * 7 + i + 1) * KW - BW / 2, BW, BH, 'black'));
    return svg;
  }
  // The keyboard folds away. Each topic remembers whether you opened it. Intervals show it from the start.
  function pianoBox(topic, tones, rootName, note) {
    const saved = lib.piano || {};
    const box = h('details', { class: 'piano-box', open: topic in saved ? saved[topic] : topic === 'intervals' },
      h('summary', null, 'On a piano'), h('div', { class: 'piano-wrap' }, piano(tones, rootName)), note ? h('p', { class: 'small muted' }, note) : null);
    box.addEventListener('toggle', () => saveLib({ piano: Object.assign({}, lib.piano, { [topic]: box.open }) }));
    return box;
  }
  const head = (title, sub, buttons) => h('div', { class: 'lib-title' }, h('div', null, h('h1', null, title), sub ? h('p', { class: 'muted lib-sub' }, sub) : null), buttons ? h('div', { class: 'row lib-play' }, buttons) : null);
  // A caption under the neck that names the note you pressed.
  function caption() { return h('p', { class: 'small muted', 'aria-live': 'polite', style: 'min-height:1.5em;margin-top:6px' }, 'Tap a note on the neck to hear it.'); }
  function pressPlayer(capEl, describe) {
    return (s, f, midi, g) => {
      A.note(midi, 0, 0, 0.55);
      if (capEl) capEl.textContent = describe(s, f, midi);
      g.classList.remove('fb-flash'); void g.getBBox(); g.classList.add('fb-flash');
    };
  }
  // Markers for every place of the given tones on the neck.
  function toneMarkers(tones, opts = {}) {
    const tuning = GT.tuning(), to = opts.to ?? settings.frets, from = opts.from ?? 0;
    const out = [];
    for (let s = 0; s < tuning.length; s++) for (let f = from; f <= to; f++) {
      const t = tones.find(x => x.pc === T.mod(tuning[s] + f));
      if (!t) continue;
      if (opts.only && !opts.only(s, f)) continue;
      out.push({ string: s, fret: f, label: lib.labels === 'notes' ? t.name : t.label, kind: opts.kind || FB.degreeKind(t.label), dim: opts.focus && t.label !== opts.focus, title: `${t.name}, ${t.label}` });
    }
    return out;
  }
  function neck(markers, extra = {}) {
    const box = h('div', { class: 'neck' });
    FB.render(box, Object.assign({ from: 0, to: settings.frets, tuning: GT.tuning(), markers, leftHanded: settings.leftHanded, orientation: settings.orientation, turn: true }, extra));
    return box;
  }
  function miniNeck(markers, low, high, label, muted, extra = {}) {
    const from = low <= 1 ? 0 : low - 1;
    const to = Math.max(from + 4, high);
    const box = h('div', { class: 'neck' });
    FB.render(box, Object.assign({ from, to, tuning: GT.tuning(), markers, muted, orientation: 'vertical', mini: true, leftHanded: settings.leftHanded, label }, extra));
    return box;
  }
  function describeNote(tones) {
    return (s, f, midi) => {
      const t = tones && tones.find(x => x.pc === T.mod(midi));
      const name = t ? t.name : T.PC_PLAIN[T.mod(midi)];
      return `${name}${t ? ', ' + t.label : ''}: ${stringOrdinal(s)} string, ${f === 0 ? 'open' : 'fret ' + f}`;
    };
  }
  const chordMidis = (rootName, chord, base = 48) => {
    const r = base + T.mod(T.pcOf(rootName) - base);
    return chord.toneList.map(t => r + t.semi);
  };
  const shapeMidis = frets => frets.map((f, s) => f === null ? null : GT.tuning()[s] + f).filter(m => m !== null);
  function playButton(text, fn) { return h('button', { type: 'button', class: 'btn', onclick: fn }, '▶ ', text); }
  function section(title, intro, ...content) {
    return h('section', { class: 'lib-section' }, h('h2', null, title), intro ? h('p', null, intro) : null, content);
  }
  // One row of links from a topic to the drills that train it.
  function practice(topic) {
    const links = PRACTICE[topic].filter(([id]) => GT.drills.byId[id]);
    return h('nav', { class: 'practice', 'aria-label': 'Practice this' }, h('span', { class: 'practice-label' }, GT.drills.icon('train'), 'Practice'),
      links.map(([id, text]) => h('a', { class: 'chip', href: '#/train/' + id }, text)));
  }

  // ---------- play-along ----------
  // One backing at a time: a loop of chords or a drone. It keeps on while you change the position or the labels.
  // It stops when you change the key, the root or the scale, or when you leave the Library.
  // scope names the page that owns the loop, for example "keys:C:major". onStep draws the chord that sounds;
  // each drawing of the page sets it again, because the page is rebuilt under a running loop.
  const backing = { id: null, scope: null, onStep: null };
  const TEMPOS = { min: 48, max: 160, step: 4 };
  const tempo = () => Math.max(TEMPOS.min, Math.min(TEMPOS.max, lib.tempo || 84));
  function stopBacking() {
    A.stopLoop();
    if (backing.onStep) backing.onStep(null);
    Object.assign(backing, { id: null, scope: null, onStep: null });
    document.querySelectorAll('.prog[aria-pressed="true"]').forEach(b => b.setAttribute('aria-pressed', 'false'));
    document.querySelectorAll('.prog .is-now').forEach(x => x.classList.remove('is-now'));
  }
  function tempoCtl() {
    const out = h('output', null, `${tempo()} bpm`);
    const change = by => { const v = Math.max(TEMPOS.min, Math.min(TEMPOS.max, tempo() + by)); saveLib({ tempo: v }); A.setLoopTempo(v); out.textContent = `${v} bpm`; };
    return h('div', { class: 'tempo', role: 'group', 'aria-label': 'Tempo of the backing' },
      h('button', { type: 'button', class: 'btn btn-icon', 'aria-label': 'Slower', onclick: () => change(-TEMPOS.step) }, '−'), out,
      h('button', { type: 'button', class: 'btn btn-icon', 'aria-label': 'Faster', onclick: () => change(TEMPOS.step) }, '+'));
  }
  // Chords of a loop as MIDI numbers: the bass, then a close voicing that moves little from chord to chord.
  function loopMidis(chords) {
    let v = null;
    return chords.map(c => { v = T.voiceLead(c.pcs, v); return [A.bass(c.pcs[0])].concat(v); });
  }
  // A list of loops. items: [{ id, name, chords: [{ name, pcs }] }], one bar for each chord.
  // A tap starts a loop, a tap on the same one stops it. onStep(item, i) runs when chord i sounds, and with null at the end.
  function backingList(scope, items, onStep, cls = '') {
    // Chords that repeat show once with a count: "A7 ×4".
    const groups = item => item.chords.reduce((list, c, i) => { const last = list[list.length - 1]; if (last && last.name === c.name) last.to = i; else list.push({ name: c.name, from: i, to: i }); return list; }, []);
    const step = item => i => {
      const row = document.querySelector(`.prog[data-id="${item.id}"]`);
      if (row) row.querySelectorAll('.prog-chords span').forEach(x => x.classList.toggle('is-now', i !== null && i >= Number(x.dataset.from) && i <= Number(x.dataset.to)));
      if (onStep) onStep(item, i);
    };
    const start = item => {
      stopBacking();
      A.silence();
      if (!A.startLoop(loopMidis(item.chords), tempo(), 4, i => backing.onStep && backing.onStep(i))) return;
      Object.assign(backing, { id: item.id, scope, onStep: step(item) });
      const row = document.querySelector(`.prog[data-id="${item.id}"]`);
      if (row) row.setAttribute('aria-pressed', 'true');
    };
    // The page was drawn again under a running loop: point the loop at the new rows.
    const playing = items.find(item => item.id === backing.id);
    if (playing) backing.onStep = step(playing);
    return h('div', { class: 'prog-list ' + cls }, items.map(item => h('button', { type: 'button', class: 'prog', dataset: { id: item.id }, 'aria-pressed': String(item.id === backing.id), onclick: () => item.id === backing.id ? stopBacking() : start(item) },
      h('span', { class: 'prog-play', 'aria-hidden': 'true' }), h('b', null, item.name),
      h('span', { class: 'prog-chords' }, groups(item).map(g => h('span', { dataset: { from: g.from, to: g.to } }, g.name, g.to > g.from ? ` ×${g.to - g.from + 1}` : null))))));
  }
  const pcsOf = (rootName, chord) => chord.toneList.map(t => T.mod(T.pcOf(rootName) + t.semi));
  // Roman numeral of a chord built on a scale degree: "♭VII", "ii", "vii°".
  function numeral(c) {
    const d = T.parseDegree(c.label), id = c.chord.id;
    const n = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][d.step];
    return c.label.replace(/\d+/, '') + (['minor', 'dim'].includes(id) ? n.toLowerCase() : n) + (id === 'dim' ? '°' : id === 'aug' ? '+' : '');
  }
  // Backings that fit a scale: degrees of the chords built on the scale itself. A mode gets the two or three chords
  // that make its sound. A pentatonic or blues scale borrows the chords of the seven-note scale it comes from.
  const VAMPS = {
    major: [[1, 4, 5, 1], [1, 5, 6, 4]], minor: [[1, 6, 7, 1], [1, 4, 5, 1]],
    dorian: [[1, 4]], phrygian: [[1, 2]], lydian: [[1, 2]], mixolydian: [[1, 7, 4, 1]], locrian: [[1, 2]],
    'harmonic-minor': [[1, 4, 5, 1]], 'melodic-minor': [[1, 4]], 'phrygian-dominant': [[1, 2]]
  };
  const VAMP_FROM = { 'minor-pentatonic': 'minor', blues: 'minor', 'major-pentatonic': 'major', 'major-blues': 'major' };
  const BLUES_12 = ['1', '1', '1', '1', '4', '4', '1', '1', '5', '4', '1', '5'];
  function scaleBackings(r, scale) {
    const from = T.scaleById(VAMP_FROM[scale.id] || scale.id);
    const chords = T.scaleChords(r, from);
    const items = (VAMPS[from.id] || []).filter(degrees => degrees.every(d => chords[d - 1] && chords[d - 1].chord)).map((degrees, i) => ({
      id: `scales:${r}:${scale.id}:${i}`, name: degrees.map(d => numeral(chords[d - 1])).join('–'),
      // A rare spelling such as B♭♭ shows under its plain name here: these are chords to play along with.
      chords: degrees.map(d => ({ name: T.chordName(rootForLink(chords[d - 1].root), chords[d - 1].chord), pcs: pcsOf(chords[d - 1].root, chords[d - 1].chord) }))
    }));
    // The blues scale and the minor pentatonic are at home over twelve bars of dominant seventh chords.
    if (['blues', 'major-blues', 'minor-pentatonic'].includes(scale.id)) {
      const seventh = T.chordById('7');
      items.push({ id: `scales:${r}:${scale.id}:blues`, name: '12-bar blues', chords: BLUES_12.map(d => { const root = rootForLink(T.spell(r, d)); return { name: T.chordName(root, seventh), pcs: pcsOf(root, seventh) }; }) });
    }
    return items;
  }
  function playAlong(r, scale) {
    const items = scaleBackings(r, scale), pc = T.pcOf(r);
    const drone = h('button', { type: 'button', class: 'btn drone', 'aria-pressed': String(A.droneRoot === pc), onclick: () => {
      if (A.droneRoot === pc) A.stopDrone(); else A.startDrone(pc);
      drone.setAttribute('aria-pressed', String(A.droneRoot === pc));
    } }, h('span', { class: 'prog-play', 'aria-hidden': 'true' }), `Drone on ${r}`);
    return section('Play along', items.length ? 'Start a backing and play the scale over it. It goes on while you change the position. The drone holds the root, so you hear each note against it.'
      : 'The drone holds the root, so you hear each note of the scale against it.',
      h('div', { class: 'row backing-row' }, drone, items.length ? tempoCtl() : null),
      items.length ? backingList(`scales:${r}:${scale.id}`, items, null, 'prog-stack') : null);
  }

  // ---------- scales ----------
  const scalesView = {
    parse(p) {
      const scale = T.scaleById(p[0]) || T.scaleById('major');
      return { scale, root: rootFromSlug(p[1]) || 'C', pos: p[2] && p[2].startsWith('position-') ? Number(p[2].slice(9)) : null };
    },
    link: s => `library/scales/${s.scale.id}/${rootSlug(s.root)}${s.pos ? '/position-' + s.pos : ''}`,
    title: s => `${s.root} ${lowerName(s.scale.name)}`,
    render(state) {
      const { scale, root: r } = state;
      const tones = T.tonesOn(r, scale);
      const positions = scalePositions(r, scale);
      const pos = positions.find(p => p.index === state.pos) || null;
      let focus = null;
      const cap = caption();
      const neckSlot = h('div');
      const drawNeck = () => {
        let markers;
        if (pos) {
          const inPos = new Set(pos.notes.map(n => `${n.string}:${n.fret}`));
          markers = toneMarkers(tones, { focus }).map(m => inPos.has(`${m.string}:${m.fret}`) ? m : Object.assign(m, { kind: 'ghost', label: m.label }));
        } else markers = toneMarkers(tones, { focus });
        neckSlot.replaceChildren(neck(markers, { onPress: pressPlayer(cap, describeNote(tones)), pressMarkersOnly: false, dimOutside: pos ? [pos.low, pos.high] : null, label: `${scalesView.title(state)} on the neck` }));
      };
      const formula = toneRow(tones, t => {
        const b = h('button', { type: 'button', class: 'tone', 'aria-pressed': 'false', onclick: () => {
          focus = focus === t.label ? null : t.label;
          formula.querySelectorAll('.tone').forEach(x => x.setAttribute('aria-pressed', String(x === b && focus !== null)));
          A.note(48 + T.mod(T.pcOf(r) - 48) + t.semi);
          drawNeck();
        } }, toneInside(t));
        return b;
      }, 'Scale tones. Select one to highlight it.');
      const play = () => {
        const base = 48 + T.mod(T.pcOf(r) - 48);
        const up = tones.map(t => base + t.semi).concat(base + 12);
        A.notes(up.concat(up.slice(0, -1).reverse()), 'up', 0.32, 0.4);
      };
      drawNeck();
      const posOptions = [[0, 'All positions']].concat(positions.slice().sort((a, b) => a.index - b.index).map(p => [p.index, `${p.index}`]));
      const groups = T.SCALE_GROUPS.map(g => ({ name: g.name, items: g.items.map(i => [i.id, i.name]) }));
      const out = [
        head(scalesView.title(state), null, playButton('Play', play)),
        controls(
          rootCtl(state, scalesView),
          labelsCtl(rerender),
          ctl('Scale', typePick('Scale', SCALE_QUICK, groups, scale.id, v => GT.go(scalesView.link(Object.assign({}, state, { scale: T.scaleById(v), pos: null })), true)), 'ctl-wide ctl-plain'),
          positions.length ? ctl('Position', GT.segmented('Position', posOptions, pos ? pos.index : 0, v => GT.go(scalesView.link(Object.assign({}, state, { pos: v || null })), true)), 'ctl-plain') : null,
          fretsCtl(rerender)),
        neckSlot, cap,
        formula,
        h('p', { class: 'small muted lib-note' }, pos ? `Position ${pos.index} starts on the ${pos.startLabel} on the 6th string, frets ${pos.low}–${pos.high}. ` : '', 'Tap a tone to light it on the neck.'),
        practice('scales'),
        playAlong(r, scale),
        pianoBox('scales', tones.concat(Object.assign({}, tones[0], { semi: 12 })), r, 'On a keyboard, a half step (H) is the very next key and a whole step (W) skips one. On the guitar that is 1 fret and 2 frets.')
      ];
      const steps = stepNames(scale);
      out.push(section('Steps', 'W is a whole step (2 frets), H is a half step (1 fret).', h('div', { class: 'grid-chips', style: `--n:${steps.length};--cols:${steps.length <= 7 ? steps.length : Math.ceil(steps.length / 2)}` }, steps.map(s => h('span', { class: 'chip' }, s)))));
      if (scale.toneList.length === 7) {
        const triads = T.scaleChords(r, scale), sevenths = T.scaleChords(r, scale, true);
        out.push(section('Chords in this scale', 'Built by stacking every other note of the scale. Open one to see its shapes.',
          h('div', { class: 'chord-strip' }, triads.map(c => chordLink(c))),
          h('div', { class: 'chord-row', style: 'margin-top:8px' }, sevenths.map(c => chordLink(c)))));
      }
      const related = relatedScales(r, scale);
      if (related.length) out.push(section('Related', null, h('div', { class: 'chips' }, related.map(x => h('a', { class: 'chip', href: '#/' + x.href }, x.text)))));
      return out;
    }
  };
  const SCALE_QUICK = [['major', 'Major'], ['minor', 'Minor'], ['minor-pentatonic', 'Minor pent.'], ['major-pentatonic', 'Major pent.'], ['blues', 'Blues']];
  function chordLink(c) {
    const href = c.chord ? `#/library/chords/${c.chord.id}/${rootSlug(rootForLink(c.root))}` : null;
    return h(href ? 'a' : 'span', { class: 'chord-btn', href, style: 'text-decoration:none;color:inherit' }, h('small', null, c.label), h('b', null, c.name));
  }
  // Links use the 17 picker roots; a rare spelling such as E♯ falls back to its plain name.
  const rootForLink = name => T.ROOTS.includes(name) ? name : T.PC_PLAIN[T.pcOf(name)];
  function stepNames(scale) {
    const semis = scale.toneList.map(t => t.semi).concat(12);
    return semis.slice(1).map((s, i) => ({ 1: 'H', 2: 'W', 3: 'W+H', 4: '2W' })[s - semis[i]] || `${s - semis[i]}`);
  }
  // Positions: pentatonic boxes and 3-notes-per-string. Blues scales use the pentatonic boxes plus the added note.
  function scalePositions(r, scale) {
    const extra = { blues: 'minor-pentatonic', 'major-blues': 'major-pentatonic' }[scale.id];
    if (!extra) return T.positions(r, scale, GT.tuning(), settings.frets);
    const base = T.positions(r, T.scaleById(extra), GT.tuning(), settings.frets);
    const blue = T.tonesOn(r, scale).find(t => !T.scaleById(extra).toneList.some(x => x.label === t.label));
    return base.map(p => {
      const notes = p.notes.slice();
      for (let s = 0; s < 6; s++) for (let f = p.low; f <= p.high; f++) if (T.mod(GT.tuning()[s] + f) === blue.pc) notes.push({ string: s, fret: f, midi: GT.tuning()[s] + f });
      return Object.assign({}, p, { notes });
    });
  }
  function relatedScales(r, scale) {
    const out = [];
    const link = (id, rootName, text) => out.push({ href: `library/scales/${id}/${rootSlug(rootForLink(rootName))}`, text });
    const parent = T.parentMajor(r, scale.id);
    if (parent && scale.id !== 'major') link('major', parent, `Same notes as ${parent} major`);
    if (parent) {
      const modes = T.SCALE_GROUPS[0].items.filter(m => m.id !== scale.id && m.id !== 'major');
      for (const m of modes) {
        const idx = T.MODE_INDEX[m.id];
        const modeRoot = T.spell(parent, T.scaleById('major').toneList[idx].label);
        link(m.id, modeRoot, `${modeRoot} ${lowerName(m.name)}`);
      }
    }
    if (scale.id === 'minor-pentatonic') { const rel = T.spell(r, '♭3'); link('major-pentatonic', rel, `Same notes as ${rel} major pentatonic`); link('blues', r, `${r} blues`); }
    if (scale.id === 'major-pentatonic') { const rel = T.spell(r, '6'); link('minor-pentatonic', rel, `Same notes as ${rel} minor pentatonic`); link('major-blues', r, `${r} major blues`); }
    if (scale.id === 'blues') link('minor-pentatonic', r, `${r} minor pentatonic without the ♭5`);
    if (['minor', 'harmonic-minor', 'melodic-minor'].includes(scale.id)) for (const id of ['minor', 'harmonic-minor', 'melodic-minor'].filter(x => x !== scale.id)) link(id, r, `${r} ${lowerName(T.scaleById(id).name)}`);
    // The key on the circle: a mode of the major scale points to its parent key, any other scale to the key that its third names.
    const keyRoot = parent && scale.id !== 'minor' ? parent : r;
    const keyMode = keyRoot === parent || scale.toneList.some(t => t.label === '3') ? 'major' : 'minor';
    out.push({ href: `library/keys/${rootSlug(rootForLink(keyRoot))}/${keyMode}`, text: `${keyRoot} ${keyMode} on the circle of fifths` });
    return out;
  }

  // ---------- chords ----------
  const chordsView = {
    parse(p) {
      const chord = T.chordById(p[0]) || T.chordById('major');
      return { chord, root: rootFromSlug(p[1]) || 'C', shape: p[2] || null };
    },
    link: s => `library/chords/${s.chord.id}/${rootSlug(s.root)}${s.shape ? '/' + s.shape : ''}`,
    // Open chords link to their shape: open C is the C shape, open Cmaj7 is the open shape.
    openChords() {
      const openLink = c => {
        const shapes = T.chordShapes(c.root, c.chord);
        const match = shapes.find(s => s.frets.every((f, i) => f === c.frets[i]));
        return '#/' + chordsView.link({ chord: T.chordById(c.chord), root: c.root, shape: match ? match.id : null });
      };
      return h('div', { class: 'chip-grid' }, T.OPEN_CHORDS.filter(c => c.chord !== 'power').map(c => h('a', { class: 'chip', href: openLink(c) }, T.chordName(c.root, T.chordById(c.chord)))));
    },
    title: s => T.chordName(s.root, s.chord),
    render(state) {
      const { chord, root: r } = state;
      const tones = T.tonesOn(r, chord);
      const shapes = T.chordShapes(r, chord.id, GT.tuning());
      // Major and minor chords open on the CAGED map: the five shapes over the whole neck.
      const caged = shapes.some(s => s.id.startsWith('caged-'));
      const want = state.shape || (caged ? 'caged' : null);
      const shape = want === 'neck' || want === 'caged' ? null : shapes.find(s => s.id.toLowerCase() === String(want).toLowerCase()) || shapes[0] || null;
      const showMap = caged && want === 'caged';
      const map = caged ? T.cagedMap(r, chord.id, settings.frets) : [];
      const placesOf = sh => sh.frets.map((f, s) => f === null ? null : { string: s, fret: f }).filter(Boolean);
      const cap = caption();
      let markers;
      const extra = {};
      if (showMap) {
        // A note that two shapes use gets a ring: that is where the shapes join.
        const uses = new Map();
        for (const sh of map) for (const p of placesOf(sh)) uses.set(`${p.string}:${p.fret}`, (uses.get(`${p.string}:${p.fret}`) || 0) + 1);
        markers = toneMarkers(tones).map(m => { const n = uses.get(`${m.string}:${m.fret}`); return n ? Object.assign(m, { ring: n > 1 }) : Object.assign(m, { kind: 'ghost' }); });
        extra.regions = map.map(sh => ({ points: placesOf(sh), label: sh.shape, cls: 'shape-' + sh.shape }));
      } else if (shape) {
        // One shape: lines join its notes, and the outlines of the shapes before and after it show where it connects.
        const at = map.findIndex(sh => sh.frets.every((f, k) => f === shape.frets[k]));
        const near = at < 0 ? [] : [map[at - 1], map[at + 1]].filter(Boolean);
        const shared = new Set(near.flatMap(n => T.sharedPlaces(shape, n)));
        markers = toneMarkers(tones).map(m => shape.frets[m.string] === m.fret ? Object.assign(m, { ring: shared.has(`${m.string}:${m.fret}`) }) : Object.assign(m, { kind: 'ghost' }));
        extra.links = [{ points: placesOf(shape), cls: 'is-shape' }];
        if (at >= 0) extra.regions = near.map(n => ({ points: placesOf(n), label: n.shape, cls: 'is-near shape-' + n.shape })).concat({ points: placesOf(shape), label: map[at].shape, cls: 'is-current shape-' + map[at].shape });
        if (shape.low > 0) extra.dimOutside = [shape.low, shape.high];
        extra.muted = shape.frets.map((f, s) => f === null ? s : null).filter(s => s !== null);
      } else markers = toneMarkers(tones);
      const strum = () => A.notes(shape ? shapeMidis(shape.frets) : chordMidis(r, chord), 'strum');
      const arpeggio = () => A.notes(shape ? shapeMidis(shape.frets) : chordMidis(r, chord), 'up', 0.28, 0.5);
      // Short names for the buttons: "C" for the C shape, and "Root on 6th", "5th", "4th" for the movable shapes.
      const firstRoot = shapes.find(s => s.id.startsWith('root-'));
      const shortName = s => s.id.startsWith('root-') ? (s === firstRoot ? 'Root on ' : '') + s.name.replace('-string root', '') : s.name.replace(' shape', '');
      const shapeOptions = (caged ? [['caged', 'CAGED']] : []).concat([['neck', 'All notes']], shapes.map(s => [s.id, shortName(s)]));
      const current = showMap ? 'caged' : shape ? shape.id : 'neck';
      const atShape = shape && map.findIndex(sh => sh.frets.every((f, k) => f === shape.frets[k]));
      const mapNote = showMap ? 'Five shapes cover the neck, and each one overlaps the next. A ringed note belongs to two shapes: that is where they join. Pick a shape to see it alone.'
        : shape && caged && atShape >= 0 ? `Lines join the notes of the ${shape.name}. The outlines beside it are the ${[map[atShape - 1], map[atShape + 1]].filter(Boolean).map(n => n.shape + ' shape').join(' and the ')}, and the ringed notes are the ones they share.` : null;
      const groups = T.CHORD_GROUPS.map(g => ({ name: g.name, items: g.items.map(i => [i.id, `${i.name} (${r}${i.symbol})`]) }));
      const out = [
        head(chordsView.title(state), `${r} ${lowerName(chord.name)}`, [playButton('Strum', strum), playButton('Arpeggio', arpeggio)]),
        controls(
          rootCtl(state, chordsView),
          labelsCtl(rerender),
          ctl('Chord', typePick('Chord', CHORD_QUICK.map(id => [id, T.chordName(r, T.chordById(id))]), groups, chord.id, v => GT.go(chordsView.link({ chord: T.chordById(v), root: r }), true)), 'ctl-wide ctl-plain'),
          shapes.length ? ctl('Shape', GT.segmented('Shape', shapeOptions, current, v => GT.go(chordsView.link(Object.assign({}, state, { shape: v })), true)), 'ctl-plain') : null,
          fretsCtl(rerender)),
        neck(markers, Object.assign({ onPress: pressPlayer(cap, describeNote(tones)), label: `${chordsView.title(state)} on the neck` }, extra)),
        cap,
        toneRow(tones, t => h('div', { class: 'tone is-still' }, toneInside(t))),
        mapNote ? h('p', { class: 'small muted lib-note' }, mapNote) : null,
        practice('chords'),
        pianoBox('chords', tones, r, 'A chord takes every other note of its scale. On a keyboard you see the gaps: 4 keys up for a major third, 3 for a minor third.')
      ];
      if (shapes.length) {
        out.push(section(CAGEDnote(chord) ? 'The five CAGED shapes' : 'Shapes', CAGEDnote(chord),
          h('div', { class: 'cards' }, shapes.map(s => {
            const m = s.frets.map((f, i) => f === null ? null : (() => {
              const t = tones.find(x => x.pc === T.mod(GT.tuning()[i] + f));
              return { string: i, fret: f, label: lib.labels === 'notes' ? t.name : t.label, kind: FB.degreeKind(t.label) };
            })()).filter(Boolean);
            const mutedStrings = s.frets.map((f, i) => f === null ? i : null).filter(i => i !== null);
            return h('a', { class: 'card', href: '#/' + chordsView.link(Object.assign({}, state, { shape: s.id })), style: 'text-decoration:none;color:inherit', 'aria-current': String(!!shape && shape.id === s.id) },
              h('h3', null, s.name), h('p', null, s.low === 0 ? 'Open position' : `Frets ${s.low}–${s.high}`),
              miniNeck(m, s.low, s.high, `${s.name} of ${chordsView.title(state)}`, mutedStrings, { links: [{ points: placesOf(s), cls: 'is-shape' }] }));
          }))));
      }
      if (TRIAD_QUALITIES.includes(chord.id)) out.push(section('Related', null, h('div', { class: 'chips' },
        h('a', { class: 'chip', href: '#/' + triadsView.link({ quality: chord.id, root: r, set: '123' }) }, `${chordsView.title(state)} triads on three strings`))));
      out.push(section('Open chords', 'The chords in the first frets. A chord that is also a CAGED shape opens as that shape.', chordsView.openChords()));
      return out;
    }
  };
  const CHORD_QUICK = ['major', 'minor', '7', 'maj7', 'm7'];
  const CAGEDnote = chord => ['major', 'minor'].includes(chord.id) ? 'Each shape is an open chord moved up the neck. In order up the neck they repeat C, A, G, E, D. Neighbor shapes share notes, so the five join into one map of the neck.' : null;

  // ---------- intervals ----------
  const intervalsView = {
    parse(p) {
      const interval = T.INTERVALS.find(i => i.id === p[0]) || T.INTERVALS.find(i => i.id === 'P5');
      return { interval, root: rootFromSlug(p[1]) || 'C' };
    },
    link: s => `library/intervals/${s.interval.id}/${rootSlug(s.root)}`,
    title: s => s.interval.name,
    render(state) {
      const { interval, root: r } = state;
      const label = interval.semi === 12 ? '8' : interval.label;
      const target = T.spell(r, interval.semi === 12 ? '8' : interval.semi === 6 ? '♭5' : label);
      const both = [{ label: '1', name: r, pc: T.pcOf(r), semi: 0 }, { label, name: target, pc: T.mod(T.pcOf(r) + interval.semi), semi: interval.semi }];
      // A unison and an octave have one note name: the neck shows it once.
      const tones = interval.semi === 0 || interval.semi === 12 ? both.slice(0, 1) : both;
      const cap = caption();
      const base = 48 + T.mod(T.pcOf(r) - 48);
      const inv = T.INTERVALS.find(i => i.semi === 12 - interval.semi);
      const songs = T.INTERVAL_SONGS[interval.semi] || {};
      const out = [
        head(interval.name, `${r} to ${target}, ${interval.semi} ${interval.semi === 1 ? 'fret' : 'frets'} on one string`,
          [playButton('Up', () => A.notes([base, base + interval.semi], 'up')), playButton('Down', () => A.notes([base, base + interval.semi], 'down')), playButton('Together', () => A.notes([base, base + interval.semi], 'together'))]),
        controls(
          rootCtl(state, intervalsView),
          labelsCtl(rerender),
          ctl('Interval', h('div', { class: 'grid-chips', style: '--cols:7;--n:13', role: 'group', 'aria-label': 'Interval' }, T.INTERVALS.map(i => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(i.id === interval.id), title: i.name, 'aria-label': i.name, onclick: () => GT.go(intervalsView.link({ interval: i, root: r }), true) }, i.short))), 'ctl-wide ctl-plain'),
          fretsCtl(rerender)),
        neck(toneMarkers(tones), { onPress: pressPlayer(cap, describeNote(tones)), label: `${interval.name} from ${r}` }),
        cap,
        practice('intervals'),
        pianoBox('intervals', both, r, `Count the keys from ${r} up to ${target}, black keys too: ${interval.semi}. Each key is one semitone, the same as one fret.`),
        h('p', { class: 'small muted lib-note' }, `Turned upside down, ${/^[aeiou]/i.test(interval.name) ? 'an' : 'a'} ${interval.name.toLowerCase()} is ${inv ? (/^[aeiou]/i.test(inv.name) ? 'an ' : 'a ') + inv.name.toLowerCase() : 'a unison'}.`),
        songs.up || songs.down ? section('Songs that start with it', 'A song you know makes the sound easy to recall. Sing the start of it, then check with the buttons above.',
          h('dl', { class: 'facts' }, songs.up ? [h('dt', null, 'Going up'), h('dd', null, songs.up)] : null, songs.down ? [h('dt', null, 'Going down'), h('dd', null, songs.down)] : null)) : null,
        section('Shapes on the neck', 'Where the upper note sits when you start on one string. The B string is tuned a semitone lower than the pattern, so shapes that cross it move one fret up.', intervalShapes(interval.semi))
      ];
      return out;
    }
  };
  function intervalShapes(semi) {
    const t = T.STANDARD, rows = [];
    const seen = new Set();
    for (let d = 0; d <= 3; d++) for (let s = 0; s + d <= 5; s++) {
      const offset = semi - (t[s + d] - t[s]);
      if (offset < -4 || offset > 5) continue;
      const crosses = s < 4 && s + d >= 4;
      const key = `${d}:${offset}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const where = d === 0 ? 'Same string' : `${d} string${d > 1 ? 's' : ''} higher`;
      const move = offset === 0 ? 'same fret' : offset > 0 ? `${offset} fret${offset > 1 ? 's' : ''} up` : `${-offset} fret${offset < -1 ? 's' : ''} down`;
      rows.push(h('tr', null, h('td', null, where), h('td', null, move), h('td', { class: 'muted' }, d === 0 ? '' : crosses ? 'when the shape crosses the B string' : 'when it does not cross the B string')));
    }
    return h('table', { class: 'table' }, h('thead', null, h('tr', null, h('th', null, 'Upper note'), h('th', null, 'Move'), h('th', null, 'Applies'))), h('tbody', null, rows));
  }

  // ---------- triads ----------
  const TRIAD_QUALITIES = ['major', 'minor', 'dim', 'aug'];
  const triadsView = {
    parse(p) {
      return { quality: TRIAD_QUALITIES.includes(p[0]) ? p[0] : 'major', root: rootFromSlug(p[1]) || 'C', set: T.TRIAD_SETS.some(s => s.id === p[2]) ? p[2] : '123' };
    },
    link: s => `library/triads/${s.quality}/${rootSlug(s.root)}/${s.set}`,
    title: s => `${T.chordName(s.root, T.chordById(s.quality))} triads`,
    render(state) {
      const chord = T.chordById(state.quality), r = state.root;
      const tones = T.tonesOn(r, chord);
      const set = T.TRIAD_SETS.find(s => s.id === state.set);
      const voicings = T.triadVoicings(r, state.quality, state.set, GT.tuning(), settings.frets);
      const cap = caption();
      const onSet = (s) => set.strings.includes(s);
      const out = [
        head(triadsView.title(state), `${tones.map(t => t.name).join(' ')} on ${set.name.replace('Strings', 'strings')}`, playButton('Play', () => A.notes(chordMidis(r, chord), 'strum'))),
        controls(
          rootCtl(state, triadsView),
          labelsCtl(rerender),
          ctl('Quality', GT.segmented('Quality', TRIAD_QUALITIES.map(q => [q, { major: 'Major', minor: 'Minor', dim: 'Dim', aug: 'Aug' }[q]]), state.quality, v => GT.go(triadsView.link(Object.assign({}, state, { quality: v })), true)), 'ctl-plain'),
          ctl('Strings', GT.segmented('String set', T.TRIAD_SETS.map((s, i) => [s.id, [i ? null : h('span', { class: 'seg-word' }, 'Strings '), s.id.split('').reverse().join('–')]]), state.set, v => GT.go(triadsView.link(Object.assign({}, state, { set: v })), true)), 'ctl-plain'),
          fretsCtl(rerender)),
        neck(toneMarkers(tones, { only: s => onSet(s) }), { onPress: pressPlayer(cap, describeNote(tones)), label: `${triadsView.title(state)} on ${set.name}` }),
        cap,
        toneRow(tones, t => h('div', { class: 'tone is-still' }, toneInside(t))),
        practice('triads'),
        section('Inversions', 'The same three notes with a different note in the bass. Tap a card to hear it. Up the neck the order repeats: root position, first inversion, second inversion.',
          h('div', { class: 'cards' }, voicings.map((list, inversion) => {
            const v = list[0];
            if (!v) return null;
            const markers = v.frets.map((f, i) => {
              const t = tones.find(x => x.pc === T.mod(GT.tuning()[v.strings[i]] + f));
              return { string: v.strings[i], fret: f, label: lib.labels === 'notes' ? t.name : t.label, kind: FB.degreeKind(t.label) };
            });
            const midis = v.frets.map((f, i) => GT.tuning()[v.strings[i]] + f);
            const low = Math.min(...v.frets), high = Math.max(...v.frets);
            return h('button', { type: 'button', class: 'card', onclick: () => A.notes(midis, 'strum') },
              h('h3', null, T.INVERSIONS[inversion]), h('p', null, `${v.tones[0]} in the bass, frets ${low}–${high}`), miniNeck(markers, low, high, `${T.INVERSIONS[inversion]}`));
          }))),
        section('Related', null, h('div', { class: 'chips' },
          h('a', { class: 'chip', href: '#/' + chordsView.link({ chord, root: r }) }, `All ${T.chordName(r, chord)} chord shapes`)))
      ];
      return out;
    }
  };

  // ---------- keys and the circle of fifths ----------
  const KEY_NAMES = T.CIRCLE.flatMap(k => [k, k.alt].filter(Boolean));
  // The angle of the wheel, kept between drawings: a new key turns into place from the last one.
  let lastTurn = null;
  const keysView = {
    parse(p) {
      const mode = p[1] === 'minor' ? 'minor' : 'major';
      const name = rootFromSlug(p[0]) || (mode === 'minor' ? 'A' : 'C');
      const entry = KEY_NAMES.find(k => (mode === 'major' ? k.major : k.minor) === name) || KEY_NAMES.find(k => T.pcOf(mode === 'major' ? k.major : k.minor) === T.pcOf(name));
      return { mode, key: mode === 'major' ? entry.major : entry.minor, entry };
    },
    link: s => `library/keys/${rootSlug(s.key)}/${s.mode}`,
    title: s => `${s.key} ${s.mode}`,
    render(state) {
      const { key, mode, entry } = state;
      const scale = T.scaleById(mode === 'major' ? 'major' : 'minor');
      const tones = T.tonesOn(key, scale);
      const triads = T.diatonic(key, mode), sevenths = T.diatonic(key, mode, true);
      const cells = T.keyCells(key, mode);
      const circle = circleOfFifths(state, cells);
      const idx = T.CIRCLE.findIndex(k => k === entry || k.alt === entry);
      const relName = mode === 'major' ? entry.minor : entry.major;
      const next = T.CIRCLE[(idx + 1) % 12], prev = T.CIRCLE[(idx + 11) % 12];
      // The same key under its other name, for example F♯ major and G♭ major.
      const twin = T.CIRCLE[idx].alt === entry ? T.CIRCLE[idx] : T.CIRCLE[idx].alt;
      const pick = k => mode === 'major' ? k.major : k.minor;
      const keyLink = (name, m) => h('a', { href: '#/' + keysView.link({ key: name, mode: m }) }, `${name} ${m}`);
      const playChord = c => {
        const pcs = c.chord.toneList.map(t => T.mod(c.pc + t.semi));
        A.silence();
        A.notes([A.bass(c.pc)].concat(T.voiceLead(pcs, null)), 'strum');
      };
      // Six of each, so the list fills its rows in one, two or three columns.
      const progressions = mode === 'major'
        ? [['I–IV–V–I', [1, 4, 5, 1]], ['I–V–vi–IV', [1, 5, 6, 4]], ['ii–V–I', [2, 5, 1]], ['I–vi–IV–V', [1, 6, 4, 5]], ['vi–IV–I–V', [6, 4, 1, 5]], ['I–vi–ii–V', [1, 6, 2, 5]]]
        : [['i–iv–v–i', [1, 4, 5, 1]], ['i–♭VI–♭III–♭VII', [1, 6, 3, 7]], ['i–♭VII–♭VI–♭VII', [1, 7, 6, 7]], ['ii°–v–i', [2, 5, 1]], ['i–♭VI–♭VII–i', [1, 6, 7, 1]], ['i–iv–♭VII–♭III', [1, 4, 7, 3]]];

      // The seven chords in one row. A tap plays the chord, marks it on the circle and shows how to play it.
      const panel = h('div', { class: 'chord-panel', 'aria-live': 'polite' });
      const strip = h('div', { class: 'chord-strip', role: 'group', 'aria-label': `The chords of ${key} ${mode}` }, triads.map((c, i) =>
        h('button', { type: 'button', class: 'chord-btn', 'aria-pressed': String(i === 0), onclick: () => { stopBacking(); choose(i); playChord(c); } }, h('small', null, c.roman), h('b', null, c.name))));
      const light = i => {
        strip.querySelectorAll('.chord-btn').forEach((b, k) => b.classList.toggle('is-playing', k === i));
        circle.hot(i === null ? null : cells[i]);
      };
      function choose(i) {
        strip.querySelectorAll('.chord-btn').forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
        circle.hot(cells[i]);
        const c = triads[i], c7 = sevenths[i], chordTones = T.tonesOn(c.root, c.chord);
        // The shape nearest to the nut: the open chord when there is one.
        const shape = T.chordShapes(c.root, c.chord.id, GT.tuning()).slice().sort((a, b) => a.low - b.low)[0];
        const dots = shape ? shape.frets.map((f, s) => {
          if (f === null) return null;
          const t = chordTones.find(x => x.pc === T.mod(GT.tuning()[s] + f));
          return { string: s, fret: f, label: lib.labels === 'notes' ? t.name : t.label, kind: FB.degreeKind(t.label) };
        }).filter(Boolean) : [];
        panel.replaceChildren(
          h('div', { class: 'chord-panel-text' },
            h('h3', null, c.name, h('small', null, ` ${c.roman} in ${key} ${mode}`)),
            h('p', null, `${chordTones.map(t => t.name).join(' ')}. With a seventh it is ${c7.name}.`),
            h('div', { class: 'row' }, playButton(c.name, () => playChord(c)), playButton(c7.name, () => playChord(c7)),
              h('a', { class: 'btn', href: `#/library/chords/${c.chord.id}/${rootSlug(rootForLink(c.root))}` }, 'All shapes'))),
          shape ? miniNeck(dots, shape.low, shape.high, `${c.name}, ${shape.name}`, shape.frets.map((f, s) => f === null ? s : null).filter(s => s !== null)) : null);
      }
      choose(0);
      circle.hot(null);
      // A progression loops, one bar for each chord. The chord that sounds lights up on the circle and in the row.
      const loops = backingList(`keys:${key}:${mode}`, progressions.map(([name, degrees], i) => ({
        id: `keys:${key}:${mode}:${i}`, name, degrees,
        chords: degrees.map(d => ({ name: triads[d - 1].name, pcs: triads[d - 1].chord.toneList.map(t => T.mod(triads[d - 1].pc + t.semi)) }))
      })), (item, i) => light(i === null ? null : item.degrees[i] - 1));
      const facts = h('dl', { class: 'facts' },
        h('dt', null, 'Key signature'), h('dd', null, sigText(entry.count)),
        h('dt', null, mode === 'major' ? 'Relative minor' : 'Relative major'), h('dd', null, keyLink(relName, mode === 'major' ? 'minor' : 'major'), ', the same notes'),
        h('dt', null, 'One fifth up'), h('dd', null, keyLink(pick(next), mode), ', one step clockwise'),
        h('dt', null, 'One fifth down'), h('dd', null, keyLink(pick(prev), mode), ', one step counterclockwise'),
        twin ? [h('dt', null, 'Other name'), h('dd', null, keyLink(pick(twin), mode), `, ${sigText(twin.count)}`)] : null);
      return [
        h('div', { class: 'lib-title' }, h('div', null, h('h1', null, keysView.title(state)), h('p', { class: 'muted lib-sub' }, sigText(entry.count))),
          GT.segmented('Mode', [['major', 'Major'], ['minor', 'Minor']], mode, v => GT.go(keysView.link({ key, mode: v }), true))),
        h('div', { class: 'circle-wrap' },
          h('div', { class: 'circle-col' }, circle, h('p', { class: 'circle-note' }, 'Tap a key to turn the circle to it. The frame at the top holds the seven chords of the key.')),
          h('div', { class: 'keys-main' },
            h('div', { class: 'lib-section' }, h('h2', null, 'Chords in the key'), strip, panel,
              mode === 'minor' ? h('p', { class: 'small muted', style: 'margin-top:10px' }, `Songs in minor keys often make v a major chord (${T.spell(key, '5')}), borrowed from the harmonic minor.`) : null),
            h('div', { class: 'lib-section' }, h('div', { class: 'section-head' }, h('h2', null, 'Common progressions'), tempoCtl()),
              h('p', null, 'Tap one to loop it, one bar for each chord. Tap it again to stop.'), loops))),
        practice('keys'),
        h('div', { class: 'keys-more' },
          h('div', { class: 'lib-section' }, h('h2', null, 'Scale'),
            toneRow(tones, t => h('button', { type: 'button', class: 'tone', onclick: () => A.note(48 + T.mod(T.pcOf(key) - 48) + t.semi) }, h('b', null, t.name), h('span', null, t.label))),
            h('p', { style: 'margin-top:12px' }, h('a', { href: `#/library/scales/${scale.id}/${rootSlug(rootForLink(key))}` }, `Show ${key} ${lowerName(scale.name)} on the neck`)),
            pianoBox('keys', tones.concat(Object.assign({}, tones[0], { semi: 12 })), key, 'C major uses only the white keys. Each step around the circle changes one note of the scale.')),
          h('div', { class: 'lib-section' }, h('h2', null, 'Facts'), facts))
      ];
    }
  };
  function sigText(count, short) {
    if (count === 0) return short ? 'none' : 'No sharps or flats';
    const list = T.signature(count);
    if (short) return `${Math.abs(count)}${count > 0 ? '♯' : '♭'}`;
    return `${Math.abs(count)} ${count > 0 ? 'sharp' : 'flat'}${Math.abs(count) > 1 ? 's' : ''}: ${list.join(' ')}`;
  }
  // Sharps (plus) or flats (minus) in the major scale of a key name, also for names such as C♭.
  const sigCount = name => T.tonesOn(name, T.scaleById('major')).reduce((n, t) => n + (t.name.match(/♯/g) || []).length - (t.name.match(/♭/g) || []).length, 0);
  // Three rings: major keys, their relative minors, and the vii° of the major key at each position.
  // The wheel turns, so the chosen key is always at the top. A frame there holds the seven chords of the key,
  // each with its Roman numeral: IV, I and V outside, ii, vi and iii inside, vii° below.
  function circleOfFifths(state, cells) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '-212 -212 424 424');
    svg.setAttribute('class', 'circle');
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', `Circle of fifths, turned to ${state.key} ${state.mode}. The frame at the top holds the chords of the key. Clockwise is a fifth up.`);
    const el = (name, attrs, parent) => { const n = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); (parent || svg).appendChild(n); return n; };
    const STEP = Math.PI / 6;
    const RINGS = { major: [148, 208, 178], minor: [100, 148, 124], dim: [62, 100, 81] };
    const pt = (r, a) => `${(r * Math.sin(a)).toFixed(2)} ${(-r * Math.cos(a)).toFixed(2)}`;
    const arc = (r1, r2, a1, a2) => `M ${pt(r2, a1)} A ${r2} ${r2} 0 0 1 ${pt(r2, a2)} L ${pt(r1, a2)} A ${r1} ${r1} 0 0 0 ${pt(r1, a1)} Z`;
    const tonic = cells[0];
    const inKey = new Map(cells.map(c => [`${c.ring}:${c.pos}`, c]));
    const paths = new Map();
    const wheel = el('g', { class: 'wheel' });
    // Text lines per ring: numeral, name, signature (offsets from the middle of the cell).
    const LAYOUT = { major: [[null, 2, 19], [-14, 5, 20]], minor: [[null, 5], [-7, 10]], dim: [[null, 4], [-6, 10]] };
    T.CIRCLE.forEach((k, i) => {
      const a = i * STEP;
      for (const ring of ['major', 'minor', 'dim']) {
        const c = inKey.get(`${ring}:${i}`);
        const [r1, r2, mid] = RINGS[ring];
        const d = arc(r1, r2, a - STEP / 2, a + STEP / 2);
        paths.set(`${ring}:${i}`, d);
        const g = el('g', { class: `cell ring-${ring}${c ? ' in-key' : ''}${c === tonic ? ' is-tonic' : ''}` }, wheel);
        el('path', { d }, g);
        const x = (mid * Math.sin(a)).toFixed(1), y = -mid * Math.cos(a);
        // The words turn back by the angle of the wheel, around the middle of their cell, so they stay upright.
        const words = el('g', { class: 'cell-text', style: `transform-origin:${x}px ${y.toFixed(1)}px` }, g);
        const text = (cls, dy, value) => { el('text', { x, y: (y + dy).toFixed(1), class: cls }, words).textContent = value; };
        const [numY, nameY, sigY] = LAYOUT[ring][c ? 1 : 0];
        if (c) text('t-num', numY, c.roman);
        text('t-name', nameY, c ? c.name : ring === 'major' ? (k.alt ? `${k.major}/${k.alt.major}` : k.major) : ring === 'minor' ? `${k.minor}m` : `${T.spell(k.major, '7')}°`);
        // Keys such as G♯ major (8♯) exist only in theory, so their cell shows no signature.
        if (ring === 'major' && !(c && Math.abs(sigCount(c.root)) > 7)) text('t-sig', sigY, c ? sigText(sigCount(c.root), true) : k.alt ? `${sigText(k.count, true)}/${sigText(k.alt.count, true)}` : sigText(k.count, true));
        if (ring === 'dim') continue;
        // Diminished chords are not keys. Major and minor cells turn the circle to their key.
        const pick = e => ring === 'major' ? e.major : e.minor;
        const entry = c && k.alt && pick(k.alt) === c.root ? k.alt : k;
        const target = pick(entry);
        g.setAttribute('role', 'link');
        g.setAttribute('tabindex', '0');
        g.setAttribute('aria-label', `${target} ${ring}${c ? `, ${c.roman} in ${state.key} ${state.mode}` : ''}, ${sigText(entry.count)}`);
        const open = () => GT.go(keysView.link({ key: target, mode: ring }), true);
        g.addEventListener('click', open);
        g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      }
    });
    // Marks one chord of the key, for example while it plays. It turns with the wheel.
    const hot = el('path', { class: 'hot', visibility: 'hidden' }, wheel);
    svg.hot = c => {
      if (!c) { hot.setAttribute('visibility', 'hidden'); return; }
      hot.setAttribute('d', paths.get(`${c.ring}:${c.pos}`));
      hot.setAttribute('visibility', 'visible');
    };
    el('circle', { r: 60, class: 'hub' });
    el('text', { y: -2, class: 't-hub' }).textContent = state.key;
    el('text', { y: 16, class: 't-hub-sub' }).textContent = state.mode;
    el('text', { y: 34, class: 't-hub-sig' }).textContent = state.entry.count === 0 ? 'no ♯ or ♭' : sigText(state.entry.count, true);
    // The frame stays at the top. The wheel turns under it.
    const F = steps => steps * STEP;
    el('path', { class: 'key-frame', d: `M ${pt(208, F(-1.5))} A 208 208 0 0 1 ${pt(208, F(1.5))} L ${pt(100, F(1.5))} A 100 100 0 0 0 ${pt(100, F(0.5))} L ${pt(62, F(0.5))} A 62 62 0 0 0 ${pt(62, F(-0.5))} L ${pt(100, F(-0.5))} A 100 100 0 0 0 ${pt(100, F(-1.5))} Z` });
    // Turn the short way round from the last key.
    const target = -tonic.pos * 30;
    const turn = lastTurn === null ? target : lastTurn + (((target - lastTurn) % 360 + 540) % 360 - 180);
    svg.style.setProperty('--turn', `${lastTurn === null ? turn : lastTurn}deg`);
    if (lastTurn !== null && lastTurn !== turn) requestAnimationFrame(() => requestAnimationFrame(() => svg.style.setProperty('--turn', `${turn}deg`)));
    lastTurn = turn;
    return svg;
  }

  // ---------- notes ----------
  const notesView = {
    parse(p) { return { mode: ['all', 'naturals'].includes(p[0]) ? p[0] : rootFromSlug(p[0]) ? 'one' : 'naturals', note: rootFromSlug(p[0]) || null }; },
    link: s => `library/notes/${s.mode === 'one' ? rootSlug(s.note) : s.mode}`,
    title: s => s.mode === 'one' ? `Every ${s.note} on the neck` : 'Notes on the neck',
    render(state) {
      const cap = caption();
      const tuning = GT.tuning();
      const markers = [];
      for (let s = 0; s < 6; s++) for (let f = 0; f <= settings.frets; f++) {
        const pc = T.mod(tuning[s] + f), name = T.PC_PLAIN[pc];
        if (state.mode === 'naturals' && name.length > 1) continue;
        if (state.mode === 'one' && pc !== T.pcOf(state.note)) continue;
        markers.push({ string: s, fret: f, label: state.mode === 'one' ? state.note : name, kind: state.mode === 'one' ? 'root' : name.length > 1 ? 'ghost' : 'other' });
      }
      const one = state.mode === 'one' ? T.pcOf(state.note) : -1;
      // The keyboard shows the same choice: the natural notes are its white keys.
      const keys = T.PC_PLAIN.map((name, pc) => ({ name, label: name, semi: pc, kind: state.mode === 'one' ? 'root' : name.length > 1 ? 'ghost' : 'other' }))
        .filter(t => state.mode === 'all' || (state.mode === 'naturals' ? t.name.length === 1 : t.semi === one))
        .flatMap(t => state.mode === 'one' ? [Object.assign({}, t, { name: state.note }), Object.assign({}, t, { name: state.note, semi: t.semi + 12 })] : [t]);
      return [
        head(notesView.title(state), state.mode === 'one' ? 'The same note repeats 12 frets higher on each string.' : 'Learn the natural notes first. The sharps and flats sit between them.'),
        controls(
          ctl('Show', GT.segmented('Show', [['naturals', 'Natural notes'], ['all', 'All notes']], state.mode, v => GT.go(notesView.link({ mode: v }), true)), 'ctl-plain'),
          ctl('One note', h('div', { class: 'grid-chips', style: '--cols:6;--n:12', role: 'group', 'aria-label': 'Show one note' },
            T.PC_PLAIN.map((n, pc) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(pc === one), onclick: () => GT.go(notesView.link(pc === one ? { mode: 'naturals' } : { mode: 'one', note: n }), true) }, n))), 'ctl-wide'),
          fretsCtl(rerender)),
        neck(markers, { onPress: pressPlayer(cap, describeNote(null)), label: notesView.title(state) }),
        cap,
        practice('notes'),
        pianoBox('notes', keys, 'C', 'B to C and E to F have no black key between them. On the guitar they are one fret apart, and all other natural notes are two frets apart.'),
        section('Ways to remember', null, h('dl', { class: 'facts' },
          h('dt', null, 'Octave shape'), h('dd', null, 'Two strings higher and two frets up. Across the B string it is three frets up.'),
          h('dt', null, 'Fret 12'), h('dd', null, 'Every string starts again: the notes repeat 12 frets higher.'),
          h('dt', null, 'Fret 5'), h('dd', null, 'Fret 5 of one string is the next open string. On the G string it is fret 4.'),
          h('dt', null, 'Half steps'), h('dd', null, 'B to C and E to F are one fret apart. All other natural notes are two frets apart.')))
      ];
    }
  };

  // ---------- name these notes ----------
  // The other way round: you tap notes on the neck and the page names the chord and the scales that hold them.
  // The places are in the link, so a set of notes can be shared: "1.3-2.2-3.0" is string.fret, and the low E string is 0.
  // A place beyond the frets on screen is dropped: a note you cannot see must not change the name.
  const nameView = {
    parse(p) {
      const places = (p[0] || '').split('-').map(x => x.split('.').map(Number))
        .filter(([s, f]) => Number.isInteger(s) && Number.isInteger(f) && s >= 0 && s < 6 && f >= 0 && f <= settings.frets);
      return { places };
    },
    link: s => 'library/name' + (s.places.length ? '/' + s.places.map(p => p.join('.')).join('-') : ''),
    title: () => LOOKUP.title,
    render(state) {
      let places = state.places.slice(), showAll = false;
      const tuning = GT.tuning();
      const neckSlot = h('div'), result = h('div', { class: 'named', 'aria-live': 'polite' });
      const sorted = () => places.map(([s, f]) => ({ string: s, fret: f, midi: tuning[s] + f })).sort((a, b) => a.midi - b.midi);
      const row = (href, name, text, tag) => h('a', { class: 'found', href: '#/' + href }, h('span', { class: 'found-text' }, h('b', null, name), text ? h('small', null, text) : null), tag ? h('span', null, tag) : null);
      const draw = () => {
        const notes = sorted(), pcs = [...new Set(notes.map(n => T.mod(n.midi)))];
        const bass = notes.length ? T.mod(notes[0].midi) : 0;
        const chords = pcs.length > 1 ? T.chordsFrom(pcs, bass) : [];
        const near = pcs.length > 1 && !chords.length ? T.chordsFrom(pcs, bass, 1).slice(0, 6) : [];
        const scales = pcs.length > 2 ? T.scalesWith(pcs, bass) : [];
        // The first chord colors the notes: its root is the square.
        const best = chords[0] ? T.tonesOn(chords[0].root, chords[0].chord) : [];
        const toneOf = pc => best.find(t => t.pc === pc) || { name: T.PC_PLAIN[pc], label: '', kind: 'other' };
        const markers = notes.map(n => { const t = toneOf(T.mod(n.midi)); return { string: n.string, fret: n.fret, label: lib.labels === 'degrees' && t.label ? t.label : t.name, kind: kindOf(t), title: t.label ? `${t.name}, ${t.label}` : t.name }; });
        neckSlot.replaceChildren(neck(markers, { onPress: toggle, label: 'Tap the notes you play' }));
        const out = [];
        if (!notes.length) out.push(h('p', { class: 'muted' }, 'No notes yet. For a chord, tap one note on each string you play. For a scale, tap every note of the run.'));
        else {
          out.push(toneRow(pcs.map(toneOf), t => h('div', { class: 'tone is-still' }, h('i', { class: 'swatch' + (kindOf(t) === 'root' ? ' is-root' : ''), style: `background:var(--${kindOf(t)})` }), h('b', null, t.name), h('span', null, t.label || ' ')), 'The notes you chose'));
          if (pcs.length === 1) out.push(h('p', { class: 'muted named-note' }, 'One note. Tap one more for an interval, or two more for a chord.'),
            h('div', { class: 'found-list' }, row(notesView.link({ mode: 'one', note: T.PC_PLAIN[pcs[0]] }), `Every ${T.PC_PLAIN[pcs[0]]} on the neck`, null, 'Notes')));
          if (pcs.length === 2) {
            const iv = T.intervalBySemi(T.mod(pcs.find(pc => pc !== bass) - bass)), from = T.PC_PLAIN[bass];
            out.push(h('h2', null, 'Interval'), h('div', { class: 'found-list' }, row(intervalsView.link({ interval: iv, root: from }), iv.name, `${from} up to ${T.spell(from, iv.semi === 6 ? '♭5' : iv.label)}`, 'Interval')));
          }
          if (chords.length) out.push(h('h2', null, chords.length > 1 ? 'Chords' : 'Chord'), h('div', { class: 'found-list' }, chords.map(c => row(
            chordsView.link({ chord: c.chord, root: c.root }), c.name,
            `${c.root} ${lowerName(c.chord.name)}${c.inversion ? `, ${T.tonesOn(c.root, c.chord)[c.inversion].name} in the bass` : ''}`, c.inversion ? null : 'Root in the bass'))));
          else if (pcs.length > 1) out.push(h('h2', null, 'Chord'), h('p', { class: 'muted' }, near.length ? 'No chord of the Library has exactly these notes. One more note gives:' : 'No chord of the Library has these notes.'),
            near.length ? h('div', { class: 'found-list' }, near.map(c => row(chordsView.link({ chord: c.chord, root: c.root }), c.name, `with ${c.missing.join(' ')}`, null))) : null);
          if (pcs.length > 2) {
            const shown = showAll ? scales : scales.slice(0, 6);
            out.push(h('h2', null, 'Scales with these notes'),
              scales.length ? h('div', { class: 'found-list' }, shown.map(x => row(scalesView.link({ scale: x.scale, root: x.root }), `${x.root} ${lowerName(x.scale.name)}`,
                x.exact ? 'These are all its notes' : `${pcs.length} of its ${x.scale.toneList.length} notes`, x.onBass ? 'Starts on the lowest note' : null)))
                : h('p', { class: 'muted' }, 'No scale of the Library holds all these notes.'),
              scales.length > shown.length ? h('button', { type: 'button', class: 'btn', onclick: () => { showAll = true; draw(); } }, `Show ${scales.length - shown.length} more`) : null);
          }
        }
        result.replaceChildren(...out.filter(Boolean));
        play.disabled = clear.disabled = !notes.length;
      };
      // A tap adds a note or takes it away. The page is not drawn again, so the sound and your place on it stay.
      function toggle(s, f, midi) {
        const at = places.findIndex(([ps, pf]) => ps === s && pf === f);
        if (at >= 0) places.splice(at, 1); else { places.push([s, f]); A.note(midi, 0, 0, 0.55); }
        showAll = false;
        const href = nameView.link({ places });
        history.replaceState(null, '', '#/' + href);
        saveLib({ last: Object.assign({}, lib.last, { name: { href, title: LOOKUP.title } }) });
        draw();
        const again = neckSlot.querySelector(`.fb-pos[data-string="${s}"][data-fret="${f}"]`);
        if (again) again.focus({ preventScroll: true });
      }
      const play = h('button', { type: 'button', class: 'btn', onclick: () => A.notes(sorted().map(n => n.midi), 'strum') }, '▶ Play');
      const clear = h('button', { type: 'button', class: 'btn', onclick: () => { places = []; history.replaceState(null, '', '#/library/name'); saveLib({ last: Object.assign({}, lib.last, { name: null }) }); draw(); } }, 'Clear');
      draw();
      return [
        head(LOOKUP.title, 'Tap notes on the neck. The page names the chord, and the scales that hold the notes.', [play, clear]),
        h('div', { class: 'lib-stage' }, controls(labelsCtl(rerender), fretsCtl(rerender)), neckSlot),
        h('p', { class: 'small muted', style: 'margin-top:6px' }, 'Tap a note to add it. Tap it again to take it away.'),
        result
      ];
    }
  };

  const VIEWS = { notes: notesView, intervals: intervalsView, scales: scalesView, chords: chordsView, triads: triadsView, keys: keysView, name: nameView };
  let rerender = () => {};

  // ---------- start page ----------
  // Search: "am7", "d dorian", "f sharp minor", "bb major key". Sharps and flats can be typed as # and b.
  const plain = text => text.toLowerCase().replace(/♯/g, '#').replace(/♭/g, 'b').replace(/[()–,]/g, ' ').replace(/\s+/g, ' ').trim();
  let index = null;
  function searchIndex() {
    if (index) return index;
    index = [];
    // rank: the place of a scale or chord in its list, so the plain major and minor come before the rare ones.
    // type: what an entry is, without its root. The search shows one entry of each type,
    // so "pentatonic" lists each pentatonic scale once and not one scale in eight roots.
    const add = (title, kind, href, type, more = '', rank = title.length, words = plain(`${title} ${more}`).split(' ')) => index.push({ title, kind, href, type, rank, words });
    TOPICS.forEach((t, i) => add(t.title, 'Topic', 'library/' + t.id, 'topic:' + t.id, t.find, i - 30));
    add(LOOKUP.title, 'Tool', 'library/name', 'topic:name', LOOKUP.find, -24);
    for (const r of T.ROOTS) {
      // "am" means A minor: the chord, the key and the scale.
      const short = plain(r) + 'm';
      T.SCALES.forEach((s, i) => add(`${r} ${lowerName(s.name)}`, 'Scale', scalesView.link({ scale: s, root: r }), 'scale:' + s.id, 'scale' + (s.id === 'minor' ? ' ' + short : ''), i));
      // A chord symbol is one word, also with brackets in it: "Am(maj7)" is found as "ammaj7" and as "am maj7".
      T.CHORDS.forEach((c, i) => add(T.chordName(r, c), 'Chord', chordsView.link({ chord: c, root: r }), 'chord:' + c.id, '', i,
        [plain(T.chordName(r, c)).replace(/ /g, '')].concat(plain(`${r} ${c.name} chord ${(c.symbol.match(/\(([^)]+)\)/) || [])[1] || ''}${['major', 'minor'].includes(c.id) ? ' caged' : ''}`).split(' '))));
      for (const q of TRIAD_QUALITIES) add(`${T.chordName(r, T.chordById(q))} triads`, 'Triads', triadsView.link({ quality: q, root: r, set: '123' }), 'triads:' + q, `${r} ${T.chordById(q).name} triad`);
      add(`Every ${r} on the neck`, 'Notes', notesView.link({ mode: 'one', note: r }), 'note', `${r} note`);
    }
    for (const k of KEY_NAMES) for (const m of ['major', 'minor']) {
      const name = m === 'major' ? k.major : k.minor;
      add(`${name} ${m}`, 'Key', keysView.link({ key: name, mode: m }), 'key:' + m, 'key circle of fifths' + (m === 'minor' ? ` ${plain(name)}m` : ''));
    }
    for (const i of T.INTERVALS) add(i.name, 'Interval', intervalsView.link({ interval: i, root: 'C' }), 'interval:' + i.id, `${i.short} interval`);
    return index;
  }
  function find(query) {
    const tokens = plain(query.replace(/\s*sharp\b/gi, '#').replace(/\s*flat\b/gi, 'b')).split(' ').filter(Boolean);
    if (!tokens.length) return [];
    const hits = [];
    for (const entry of searchIndex()) {
      // Every word you type must start its own word of the entry. A whole word counts more.
      const free = entry.words.slice();
      let score = 0;
      for (const t of tokens) {
        let at = free.indexOf(t), points = 2;
        if (at < 0) {
          at = free.findIndex(w => w.startsWith(t));
          // "am" is the start of Am7 and of Amaj7. You mean the minor chords: for a major seventh you type "ama".
          points = at >= 0 && t.endsWith('m') && free[at].slice(t.length).startsWith('aj') ? 0.4 : 1;
          // One or two letters are a root, not the start of a word in the text of a topic.
          if (t.length < 3 && entry.type.startsWith('topic:')) at = -1;
        }
        if (at < 0) { score = 0; break; }
        free.splice(at, 1);
        score += points;
      }
      if (score) hits.push({ entry, score: score * 100 - entry.rank });
    }
    hits.sort((a, b) => b.score - a.score);
    // One entry of each type: the best root for it. Then one of each kind first:
    // "F sharp minor" is a chord, a key, a scale and a set of triads.
    const types = new Set(), byKind = new Map();
    for (const x of hits) {
      if (types.has(x.entry.type)) continue;
      types.add(x.entry.type);
      byKind.set(x.entry.kind, (byKind.get(x.entry.kind) || []).concat(x.entry));
    }
    const out = [];
    for (let round = 0; out.length < 8 && round < 8; round++) for (const list of byKind.values()) if (list[round] && out.length < 8) out.push(list[round]);
    return out;
  }
  // A small picture for each topic, drawn with the same neck as the pages.
  function thumb(id) {
    const box = h('div', { class: 'topic-thumb', 'aria-hidden': 'true' });
    if (id === 'keys') {
      const el = FB.el, svg = el('svg', { viewBox: '-50 -50 100 100', class: 'thumb-circle' });
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        el('circle', { cx: (36 * Math.sin(a)).toFixed(1), cy: (-36 * Math.cos(a)).toFixed(1), r: i === 0 ? 9 : 7, class: i === 0 ? 'is-tonic' : i === 1 || i === 11 ? 'in-key' : '' }, svg);
      }
      box.append(svg);
      return box;
    }
    const dot = (string, fret, kind) => ({ string, fret, kind });
    const pictures = {
      notes: { from: 0, to: 5, markers: [dot(1, 3, 'root'), dot(4, 1, 'root'), dot(0, 3, 'other'), dot(2, 2, 'other'), dot(3, 2, 'other'), dot(5, 5, 'other'), dot(2, 5, 'other')] },
      intervals: { from: 1, to: 6, markers: [dot(1, 3, 'root'), dot(2, 5, 'fifth')], links: [{ points: [{ string: 1, fret: 3 }, { string: 2, fret: 5 }], cls: 'is-answer' }] },
      scales: { from: 4, to: 9, markers: [[0, 5, 'root'], [0, 8], [1, 5], [1, 7], [2, 5], [2, 7, 'root'], [3, 5], [3, 7], [4, 5], [4, 8], [5, 5, 'root'], [5, 8]].map(([s, f, k]) => dot(s, f, k || 'other')) },
      chords: { from: 0, to: 4, markers: [dot(1, 3, 'root'), dot(2, 2, 'third'), dot(3, 0, 'fifth'), dot(4, 1, 'root'), dot(5, 0, 'third')], links: [{ points: [[1, 3], [2, 2], [3, 0], [4, 1], [5, 0]].map(([string, fret]) => ({ string, fret })), cls: 'is-shape' }] },
      triads: { from: 3, to: 9, markers: [dot(3, 5, 'root'), dot(4, 5, 'third'), dot(5, 3, 'fifth'), dot(3, 9, 'third'), dot(4, 8, 'fifth'), dot(5, 8, 'root')],
        links: [[[3, 5], [4, 5], [5, 3]], [[3, 9], [4, 8], [5, 8]]].map(l => ({ points: l.map(([string, fret]) => ({ string, fret })), cls: 'is-shape' })) },
      name: { from: 0, to: 4, markers: [[1, 3], [2, 2], [4, 1]].map(([string, fret]) => ({ string, fret, kind: 'target', label: '?' })) }
    };
    FB.render(box, Object.assign({ tuning: T.STANDARD, bare: true, orientation: 'horizontal' }, pictures[id]));
    return box;
  }
  function home(main) {
    const results = h('div', { class: 'found-list', role: 'listbox', 'aria-label': 'Search results' });
    const input = h('input', { type: 'search', class: 'search', placeholder: 'Find a scale, chord or key', 'aria-label': 'Find a scale, chord or key', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'go' });
    const show = () => {
      const hits = find(input.value);
      results.replaceChildren(...(hits.length ? hits.map(e => h('a', { class: 'found', href: '#/' + e.href, role: 'option' }, h('b', null, e.title), h('span', null, e.kind)))
        : input.value.trim() ? [h('p', { class: 'small muted found-none' }, 'Nothing found. Try a root and a name, for example "A minor pentatonic", "F#m7" or "Bb major".')] : []));
    };
    input.addEventListener('input', show);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { const first = results.querySelector('a'); if (first) location.hash = first.getAttribute('href'); } });
    const last = lib.last || {};
    const tool = last[LOOKUP.id];
    main.append(h('div', { class: 'lib-home' },
      h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Library'), h('p', null, 'Every note, scale, chord and key, shown on the neck. Choose a topic, then change the root and the type with one tap.'))),
      h('div', { class: 'search-box' }, input, h('p', { class: 'small muted search-hint' }, 'For example: Am7, D dorian, F# minor, E major triads.'), results),
      h('ol', { class: 'topics' }, TOPICS.map((t, i) => h('li', null,
        h('a', { class: 'topic', href: '#/' + (last[t.id] ? last[t.id].href : 'library/' + t.id) },
          thumb(t.id),
          h('div', { class: 'topic-text' },
            h('h2', null, h('span', { class: 'topic-no' }, i + 1), t.title, i === 0 ? h('span', { class: 'topic-start' }, 'Start here') : null),
            h('p', null, t.line),
            last[t.id] ? h('p', { class: 'topic-last' }, `You looked at: ${last[t.id].title}`) : null))))),
      h('a', { class: 'topic topic-tool', href: '#/' + (tool ? tool.href : 'library/name') },
        thumb(LOOKUP.id),
        h('div', { class: 'topic-text' }, h('h2', null, LOOKUP.title), h('p', null, LOOKUP.line)))));
    document.title = `Library · ${GT.siteName}`;
  }

  function render(main, parts) {
    main.replaceChildren();
    if (!VIEWS[parts[0]]) { stopBacking(); A.stopDrone(); rerender = () => {}; lastRender = null; home(main); return; }
    const tab = parts[0];
    const view = VIEWS[tab];
    const state = view.parse(parts.slice(1));
    // A lookup page changes its link as you tap, so a new drawing reads the link again.
    rerender = () => render(main, tab === 'name' ? location.hash.replace(/^#\/?/, '').split('/').slice(1) : parts);
    // A loop belongs to one key or one scale on one root. The drone follows the root of the scale page.
    const scope = tab === 'keys' ? `keys:${state.key}:${state.mode}` : tab === 'scales' ? `scales:${state.root}:${state.scale.id}` : null;
    // Another page stops the sound itself: then the row must not look as if it still plays.
    if (backing.scope && (backing.scope !== scope || !A.loopRunning)) stopBacking();
    if (A.droneRoot !== null && tab !== 'scales') A.stopDrone();
    else if (A.droneRoot !== null && A.droneRoot !== T.pcOf(state.root)) A.startDrone(T.pcOf(state.root));
    // Topic row. A topic with roots opens on the root you look at now.
    const tabLink = id => {
      const target = VIEWS[id], base = target.parse([]);
      return '#/' + (state.root && base.root ? target.link(Object.assign(base, { root: state.root })) : 'library/' + id);
    };
    // The search button stands before the topics. It opens the start page with the cursor in the search box.
    // The page is drawn inside the tap, because a phone opens its keyboard only then.
    const toSearch = e => {
      e.preventDefault();
      history.pushState(null, '', '#/library');
      GT.render();
      const box = document.querySelector('.search');
      if (box) box.focus();
    };
    const tabs = h('div', { class: 'lib-tabs' },
      TOPICS.map(t => h('a', { href: tabLink(t.id), 'aria-current': String(t.id === tab) }, t.name)),
      h('a', { href: '#/library/name', class: 'lib-tool-link', 'aria-current': String(tab === LOOKUP.id) }, LOOKUP.name));
    const nav = h('nav', { class: 'lib-nav', 'aria-label': 'Library topics' },
      h('a', { href: '#/library', class: 'lib-home-link', 'aria-label': 'Search the Library', title: 'Search the Library', onclick: toSearch }, GT.drills.icon('search')), tabs);
    const body = h('div', { class: 'lib-main' }, view.render(state));
    // The panel and the neck travel together: on a phone held sideways the neck comes first.
    const panel = body.querySelector(':scope > .controls');
    if (panel && panel.nextElementSibling) { const stage = h('div', { class: 'lib-stage' }); panel.before(stage); stage.append(panel, panel.nextElementSibling); }
    main.append(h('div', { class: 'lib' }, nav, body));
    const chosen = tabs.querySelector('[aria-current="true"]');
    if (chosen) tabs.scrollLeft += chosen.getBoundingClientRect().left - tabs.getBoundingClientRect().left - (tabs.clientWidth - chosen.offsetWidth) / 2;
    document.title = `${view.title(state)} · ${GT.siteName}`;
    // The start page opens each topic where you left it.
    if (tab !== LOOKUP.id) saveLib({ last: Object.assign({}, lib.last, { [tab]: { href: view.link(state), title: view.title(state) } }) });
    lastRender = rerender;
  }

  GT.route('library', { render, resize: () => lastRender && lastRender() });
  GT.library = { lowerName };
})(window);

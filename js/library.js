/* Library: the reference part of the site. A start page with search, then six topics in the order
   you learn them: notes, intervals, scales, chords, triads and keys. Every view has its own link,
   for example #/library/scales/blues/a or #/library/chords/maj7/c/caged-e. */
(function (root) {
  'use strict';
  const GT = root.GT;
  const T = GT.theory, FB = GT.fretboard, A = GT.audio;
  const { h, store, settings, rootSlug, rootFromSlug } = GT;

  const lib = Object.assign({ labels: 'notes', triadNotes: true, scaleShapes: 'boxes' }, store.get('library', {}));
  const saveLib = patch => { Object.assign(lib, patch); store.set('library', lib); };
  // The Library plays with the capo of Settings: the open strings sound at the capo, and a neck counts its frets
  // from there. The drills ignore the capo.
  const capo = () => settings.capo || 0;
  const openStrings = () => GT.tuning().map(m => m + capo());
  const lastFret = () => Math.max(5, settings.frets - capo());
  // CAGED shapes exist in standard tuning and its family: a capo, half step down, drop D.
  const cagedTuning = () => T.standardShift(openStrings()) !== null;
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
  const TUNE = { id: 'tune', name: 'Tuner', title: 'Tuner', line: 'Tune your guitar with the microphone of your phone or computer.', find: 'tuner tune tuning microphone pitch strings' };
  // A second tool: the scales that fit the chords of a song.
  const FIT = { id: 'fit', name: 'Scales for chords', title: 'Scales for chords', line: 'Add the chords of a song and get the scales that hold every note of them. Loop the chords and play over them.', find: 'scale chord fit over solo improvise what scale progression song chords to scales' };
  const LOOKUP = { id: 'name', name: 'Name it', title: 'Name it', line: 'Tap notes on the neck and get the name of the chord and the scales that hold them.', find: 'identify chord finder namer reverse lookup what is this' };
  // The drills that train what a topic shows: [drill id, text of the link].
  const PRACTICE = {
    notes: ['neck-notes', 'neck-find', 'neck-staff'],
    intervals: ['ear-intervals', 'neck-degrees'],
    scales: ['ear-degrees', 'neck-degrees'],
    chords: ['neck-caged', 'ear-chords'],
    triads: ['neck-triads', 'ear-chords'],
    keys: ['keys-chords', 'keys-facts', 'keys-numbers', 'ear-progressions']
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
  // The Notes page has no root until you pick one note: then no letter is chosen.
  function rootCtl(state, view, label = 'Root') {
    const current = state.root || '', letter = current[0] || '', acc = current.slice(1);
    const go = name => { if (name !== current) GT.go(view.link(Object.assign({}, state, { root: name, pos: null })), true); };
    const letters = h('div', { class: 'letters', role: 'radiogroup', 'aria-label': 'Root letter' }, 'CDEFGAB'.split('').map(l =>
      h('button', { type: 'button', class: 'chip', role: 'radio', 'aria-checked': String(l === letter), onclick: () => go(l === letter ? current : l) }, l)));
    const accs = h('div', { class: 'seg accs', role: 'radiogroup', 'aria-label': 'Sharp or flat' }, [['♭', 'Flat'], ['', 'Natural'], ['♯', 'Sharp']].map(([a, name]) =>
      h('button', { type: 'button', role: 'radio', 'aria-checked': String(!!letter && a === acc), 'aria-label': name, disabled: !letter || !T.ROOTS.includes(letter + a), onclick: () => go(letter + a) }, a || '♮')));
    return [ctl(label, letters, 'ctl-root ctl-plain'), ctl('Sharp or flat', accs, 'ctl-plain ctl-quiet')];
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
      quick.map(([v, t]) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(v === value), onclick: () => { if (v !== value) onChange(v); } }, t)), rest.length ? select : null);
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
  const head = (title, sub, buttons) => h('div', { class: 'lib-title' }, h('div', null, h('h1', null, title), sub ? h('p', { class: 'muted lib-sub' }, sub) : null), h('div', { class: 'row lib-play' }, buttons, shareMenu()));
  // Share a page: its link (the state of the page is in the link), the neck as a picture, or a printout.
  function shareMenu() {
    const menu = h('details', { class: 'share' });
    const done = (b, text) => { const was = b.textContent; b.textContent = text; setTimeout(() => { b.textContent = was; menu.open = false; }, 1600); };
    const link = h('button', { type: 'button', class: 'btn', onclick: async () => {
      try {
        if (navigator.share) { await navigator.share({ title: document.title, url: location.href }); menu.open = false; }
        else { await navigator.clipboard.writeText(location.href); done(link, 'Link copied'); }
      } catch (e) { if (e && e.name !== 'AbortError') done(link, 'Could not share'); }
    } }, navigator.share ? 'Share the link' : 'Copy the link');
    const pic = h('button', { type: 'button', class: 'btn', onclick: () => savePicture().then(ok => ok ? (menu.open = false) : done(pic, 'No neck on this page')) }, 'Save the neck as a picture');
    menu.append(h('summary', { class: 'btn btn-icon', 'aria-label': 'Share or save this page', title: 'Share' }, GT.drills.icon('share')),
      h('div', { class: 'share-menu' }, link, pic, h('button', { type: 'button', class: 'btn', onclick: () => { menu.open = false; root.print(); } }, 'Print this page')));
    // The menu opens under the button and stays inside the screen.
    menu.addEventListener('toggle', () => {
      if (!menu.open) return;
      const box = menu.querySelector('.share-menu');
      box.style.right = '0px';
      const r = box.getBoundingClientRect();
      if (r.left < 8) box.style.right = `${Math.round(r.left - 8)}px`;
    });
    return menu;
  }
  // The neck as a PNG file: every style the page gives it is copied into the picture, on the background of the page.
  async function savePicture() {
    const svg = document.querySelector('.lib-main .neck svg.fb');
    if (!svg) return false;
    const clone = svg.cloneNode(true);
    const props = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap', 'opacity', 'font-family', 'font-size', 'font-weight', 'visibility', 'display'];
    const from = [svg, ...svg.querySelectorAll('*')], to = [clone, ...clone.querySelectorAll('*')];
    from.forEach((el, i) => { const cs = getComputedStyle(el); to[i].setAttribute('style', props.map(p => `${p}:${cs.getPropertyValue(p)}`).join(';')); });
    const [, , w, hgt] = svg.getAttribute('viewBox').split(' ').map(Number);
    clone.setAttribute('width', w); clone.setAttribute('height', hgt);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%'); bg.setAttribute('fill', getComputedStyle(document.body).backgroundColor);
    clone.insertBefore(bg, clone.firstChild);
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
    await img.decode();
    // The title of the page goes above the neck, so the picture makes sense on its own.
    const top = 44, title = (document.querySelector('.lib-main h1') || {}).textContent || '';
    const canvas = document.createElement('canvas');
    canvas.width = w * 2; canvas.height = (hgt + top) * 2;
    const g = canvas.getContext('2d'); g.scale(2, 2);
    g.fillStyle = getComputedStyle(document.body).backgroundColor; g.fillRect(0, 0, w, hgt + top);
    g.fillStyle = getComputedStyle(document.body).color; g.font = `700 22px ${getComputedStyle(document.body).fontFamily}`;
    g.fillText(title, 16, 30);
    g.drawImage(img, 0, top);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    const name = (document.title.split(' · ')[0] || 'neck').replace(/[^\w♯♭#-]+/g, '-') + '.png';
    const file = new File([blob], name, { type: 'image/png' });
    // A phone saves the picture from its share sheet. Elsewhere it downloads.
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); return true; } catch (e) { if (e.name === 'AbortError') return true; } }
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    return true;
  }
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
    const tuning = openStrings(), to = opts.to ?? lastFret(), from = opts.from ?? 0;
    const out = [];
    for (let s = 0; s < tuning.length; s++) for (let f = from; f <= to; f++) {
      const t = tones.find(x => x.pc === T.mod(tuning[s] + f));
      if (!t) continue;
      if (opts.only && !opts.only(s, f)) continue;
      out.push({ string: s, fret: f, label: lib.labels === 'notes' ? t.name : t.label, kind: opts.kind || FB.degreeKind(t.label), small: opts.small, dim: (opts.focus && t.label !== opts.focus) || (opts.lit && !opts.lit.has(t.pc)), title: `${t.name}, ${t.label}` });
    }
    return out;
  }
  function neck(markers, extra = {}) {
    const box = h('div', { class: 'neck' });
    FB.render(box, Object.assign({ from: 0, to: lastFret(), tuning: openStrings(), capo: capo(), markers, leftHanded: settings.leftHanded, orientation: settings.orientation, turn: true }, extra));
    return box;
  }
  function miniNeck(markers, low, high, label, muted, extra = {}) {
    const from = low <= 1 ? 0 : low - 1;
    const to = Math.max(from + 4, high);
    const box = h('div', { class: 'neck' });
    FB.render(box, Object.assign({ from, to, tuning: openStrings(), capo: capo(), markers, muted, orientation: 'vertical', mini: true, leftHanded: settings.leftHanded, label }, extra));
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
  const shapeMidis = frets => frets.map((f, s) => f === null ? null : openStrings()[s] + f).filter(m => m !== null);
  function playButton(text, fn) { return h('button', { type: 'button', class: 'btn', onclick: fn }, '▶ ', text); }
  // The places of a chord shape on the neck, and the five CAGED shapes as faint outlines behind another picture.
  const placesOf = sh => sh.frets.map((f, s) => f === null ? null : { string: s, fret: f }).filter(Boolean);
  const cagedBehind = (r, quality) => T.cagedMap(r, quality, lastFret(), openStrings()).map(sh => ({ points: placesOf(sh), label: sh.shape, cls: 'is-faint shape-' + sh.shape }));
  // A switch chip for a faint layer. It keeps the setting and draws the page again.
  const layerChip = (key, text, label, title) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(!!lib[key]), 'aria-label': label, title, onclick: () => { saveLib({ [key]: !lib[key] }); rerender(); } }, text);
  function section(title, intro, ...content) {
    return h('section', { class: 'lib-section' }, h('h2', null, title), intro ? h('p', null, intro) : null, content);
  }
  // One row of links from a topic to the drills that train it.
  function practice(topic) {
    // The links use the names of the drills on the Train page.
    const links = PRACTICE[topic].map(id => GT.drills.byId[id]).filter(Boolean);
    return h('nav', { class: 'practice', 'aria-label': 'Practice this', dataset: { n: links.length } }, h('span', { class: 'practice-label' }, GT.drills.icon('train'), 'Practice'),
      links.map(d => h('a', { class: 'chip', href: '#/train/' + d.id }, d.title)));
  }

  // ---------- play-along ----------
  // One backing at a time: a loop of chords or a drone. It keeps on while you change the position or the labels.
  // It stops when you change the key, the root or the scale, or when you leave the Library.
  // scope names the page that owns the loop, for example "keys:C:major". onStep draws the chord that sounds;
  // each drawing of the page sets it again, because the page is rebuilt under a running loop.
  // at: the chord that sounds now, so a page drawn again under the loop shows it at once.
  const backing = { id: null, scope: null, onStep: null, at: null };
  const TEMPOS = { min: 48, max: 160, step: 4 };
  const tempo = () => Math.max(TEMPOS.min, Math.min(TEMPOS.max, lib.tempo || 84));
  function stopBacking() {
    A.stopLoop();
    if (backing.onStep) backing.onStep(null);
    Object.assign(backing, { id: null, scope: null, onStep: null, at: null });
    document.querySelectorAll('.prog[aria-pressed="true"]').forEach(b => b.setAttribute('aria-pressed', 'false'));
    document.querySelectorAll('.prog .is-now').forEach(x => x.classList.remove('is-now'));
  }
  function tempoCtl() {
    const out = h('output', null, `${tempo()} bpm`);
    const change = by => { const v = Math.max(TEMPOS.min, Math.min(TEMPOS.max, tempo() + by)); saveLib({ tempo: v }); A.setLoopTempo(v); out.textContent = `${v} bpm`; };
    // Drums go on and off while a loop plays.
    const drums = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(!!lib.drums), title: 'A drum beat under the loop', onclick: () => {
      saveLib({ drums: !lib.drums }); A.setDrums(lib.drums);
      document.querySelectorAll('.tempo .chip').forEach(b => b.setAttribute('aria-pressed', String(!!lib.drums)));
    } }, 'Drums');
    return h('div', { class: 'tempo', role: 'group', 'aria-label': 'Tempo of the backing' },
      h('button', { type: 'button', class: 'btn btn-icon', 'aria-label': 'Slower', onclick: () => change(-TEMPOS.step) }, '−'), out,
      h('button', { type: 'button', class: 'btn btn-icon', 'aria-label': 'Faster', onclick: () => change(TEMPOS.step) }, '+'), drums);
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
      backing.at = i;
      const row = document.querySelector(`.prog[data-id="${item.id}"]`);
      if (row) row.querySelectorAll('.prog-chords span').forEach(x => x.classList.toggle('is-now', i !== null && i >= Number(x.dataset.from) && i <= Number(x.dataset.to)));
      if (onStep) onStep(item, i);
    };
    const start = item => {
      stopBacking();
      A.silence();
      A.setDrums(!!lib.drums);
      if (!A.startLoop(loopMidis(item.chords), tempo(), 4, i => backing.onStep && backing.onStep(i))) return;
      Object.assign(backing, { id: item.id, scope, onStep: step(item) });
      const row = document.querySelector(`.prog[data-id="${item.id}"]`);
      if (row) row.setAttribute('aria-pressed', 'true');
    };
    // The page was drawn again under a running loop: point the loop at the new rows.
    const playing = items.find(item => item.id === backing.id);
    if (playing) {
      backing.onStep = step(playing);
      if (onStep && backing.at !== null) onStep(playing, backing.at);
    }
    const now = (item, g) => item.id === backing.id && backing.at !== null && backing.at >= g.from && backing.at <= g.to;
    return h('div', { class: 'prog-list ' + cls }, items.map(item => h('button', { type: 'button', class: 'prog', dataset: { id: item.id }, 'aria-pressed': String(item.id === backing.id), onclick: () => item.id === backing.id ? stopBacking() : start(item) },
      h('span', { class: 'prog-play', 'aria-hidden': 'true' }), h('b', null, item.name),
      h('span', { class: 'prog-chords' }, groups(item).map(g => h('span', { class: now(item, g) ? 'is-now' : null, dataset: { from: g.from, to: g.to } }, g.name, g.to > g.from ? ` ×${g.to - g.from + 1}` : null))))));
  }
  const pcsOf = (rootName, chord) => chord.toneList.map(t => T.mod(T.pcOf(rootName) + t.semi));
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
      id: `scales:${r}:${scale.id}:${i}`, name: degrees.map(d => chords[d - 1].roman).join('–'),
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
  function playAlong(r, scale, onStep) {
    const items = scaleBackings(r, scale), pc = T.pcOf(r);
    const drone = h('button', { type: 'button', class: 'btn drone', 'aria-pressed': String(A.droneRoot === pc), onclick: () => {
      if (A.droneRoot === pc) A.stopDrone(); else A.startDrone(pc);
      drone.setAttribute('aria-pressed', String(A.droneRoot === pc));
    } }, h('span', { class: 'prog-play', 'aria-hidden': 'true' }), `Drone on ${r}`);
    return section('Play along', items.length ? 'Start a backing and play the scale over it. The notes of the chord that sounds stay bright on the neck. The backing goes on while you change the position. The drone holds the root, so you hear each note against it.'
      : 'The drone holds the root, so you hear each note of the scale against it.',
      h('div', { class: 'row backing-row' }, drone, items.length ? tempoCtl() : null),
      items.length ? backingList(`scales:${r}:${scale.id}`, items, onStep, 'prog-stack') : null);
  }

  // A run of notes as tab: up across the strings and back down, high e on top.
  function tabOf(notes) {
    const names = openStrings().map(m => T.PC_PLAIN[T.mod(m - capo())]);
    const up = notes.slice().sort((a, b) => a.string - b.string || a.fret - b.fret);
    const run = up.concat(up.slice(0, -1).reverse());
    const lines = [5, 4, 3, 2, 1, 0].map(s => ({ s, text: (s === 5 && names[s] === 'E' ? 'e' : names[s]).padEnd(2) + '|-' }));
    for (const n of run) {
      const fret = String(n.fret + capo());
      for (const l of lines) l.text += (l.s === n.string ? fret : '-'.repeat(fret.length)) + '-';
    }
    return lines.map(l => l.text + '|').join('\n');
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
      // The chord on the root: major with a 3 and a 5, minor with a ♭3 and a 5. Its CAGED shapes can sit behind the scale.
      const has = l => scale.toneList.some(t => t.label === l);
      const tonic = scale.id === 'chromatic' || !has('5') || !cagedTuning() ? null : has('3') ? 'major' : has('♭3') ? 'minor' : null;
      const tonicName = tonic && T.chordName(r, T.chordById(tonic));
      const caged = tonic && lib.scaleCaged;
      // focus: the tone you tapped. now: the notes of the chord that the backing plays.
      let focus = null, now = null;
      // A second scale on the same root, to compare: its other notes are dashed, the notes only in this scale have a ring.
      const cmp = lib.compare && lib.compare !== scale.id ? T.scaleById(lib.compare) : null;
      const cmpTones = cmp ? T.tonesOn(r, cmp) : [];
      const basePcs = new Set(tones.map(t => t.pc)), cmpPcs = new Set(cmpTones.map(t => t.pc));
      const onlyHere = cmp ? tones.filter(t => !cmpPcs.has(t.pc)) : [], onlyThere = cmpTones.filter(t => !basePcs.has(t.pc));
      const cap = caption();
      const neckSlot = h('div');
      const drawNeck = () => {
        let markers;
        if (pos) {
          const inPos = new Set(pos.notes.map(n => `${n.string}:${n.fret}`));
          markers = toneMarkers(tones, { focus, lit: now }).map(m => inPos.has(`${m.string}:${m.fret}`) ? m : Object.assign(m, { kind: 'ghost', label: m.label }));
        } else markers = toneMarkers(tones, { focus, lit: now });
        if (cmp) markers = markers.map(m => cmpPcs.has(T.mod(openStrings()[m.string] + m.fret)) || m.kind === 'ghost' ? m : Object.assign(m, { ring: true }))
          .concat(toneMarkers(onlyThere, { kind: 'compare' }));
        neckSlot.replaceChildren(neck(markers, { onPress: pressPlayer(cap, describeNote(tones)), pressMarkersOnly: false, dimOutside: pos ? [pos.low, pos.high] : null,
          regions: caged ? cagedBehind(r, tonic) : null, tools: tonic ? [layerChip('scaleCaged', 'CAGED', 'CAGED shapes', `Show the five CAGED shapes of ${tonicName}`)] : null, label: `${scalesView.title(state)} on the neck` }));
      };
      const follow = (item, i) => {
        now = i === null ? null : new Set(item.chords[i].pcs);
        drawNeck();
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
      // A seven-note scale has two kinds of positions: vertical boxes and diagonal shapes of three notes on each string.
      // The switch keeps you near the same frets.
      const twoKinds = scale.toneList.length === 7;
      const shapesCtl = twoKinds ? ctl('Shapes', GT.segmented('Position shapes', [['boxes', 'Boxes'], ['nps', '3 per string']], lib.scaleShapes === 'nps' ? 'nps' : 'boxes', v => {
        saveLib({ scaleShapes: v });
        const list = scalePositions(r, scale);
        const next = pos && list.length ? list.reduce((a, p) => Math.abs(p.low - pos.low) < Math.abs(a.low - pos.low) ? p : a) : null;
        GT.go(scalesView.link(Object.assign({}, state, { pos: next ? next.index : null })), true);
      }), 'ctl-plain') : null;
      const posOptions = [[0, 'All']].concat(positions.slice().sort((a, b) => a.index - b.index).map(p => [p.index, `${p.index}`]));
      const groups = T.SCALE_GROUPS.map(g => ({ name: g.name, items: g.items.map(i => [i.id, i.name]) }));
      const out = [
        head(scalesView.title(state), null, playButton('Play', play)),
        controls(
          rootCtl(state, scalesView),
          labelsCtl(rerender),
          ctl('Scale', typePick('Scale', SCALE_QUICK, groups, scale.id, v => GT.go(scalesView.link(Object.assign({}, state, { scale: T.scaleById(v), pos: null })), true)), 'ctl-wide ctl-plain'),
          shapesCtl,
          positions.length ? ctl('Position', GT.segmented('Position', posOptions, pos ? pos.index : 0, v => GT.go(scalesView.link(Object.assign({}, state, { pos: v || null })), true)), 'ctl-plain') : null,
          ctl('Compare', h('select', { class: 'more' + (cmp ? ' is-on' : ''), 'aria-label': 'Compare with another scale', onchange: e => { saveLib({ compare: e.target.value || null }); rerender(); } },
            h('option', { value: '', selected: !cmp }, 'Compare with another scale'),
            T.SCALE_GROUPS.map(g => h('optgroup', { label: g.name }, g.items.filter(i => i.id !== scale.id).map(i => h('option', { value: i.id, selected: !!cmp && cmp.id === i.id }, `Compare with ${r} ${lowerName(i.name)}`))))), 'ctl-wide ctl-plain'),
          fretsCtl(rerender)),
        neckSlot, cap,
        formula,
        h('p', { class: 'small muted lib-note' }, pos ? (pos.partial ? `Position ${pos.index} does not fit the frets shown, so it stops at the ${pos.low === 0 ? (capo() ? 'capo' : 'nut') : 'last fret'}. `
          : `Position ${pos.index} starts on the ${pos.startLabel} on the 6th string, frets ${pos.low + capo()}–${pos.high + capo()}. `) : '',
          pos && twoKinds && lib.scaleShapes !== 'nps' ? 'A box is a pentatonic box with the other notes of the scale added. ' : '', 'Tap a tone to light it on the neck.',
          caged ? ` The faint outlines are the CAGED shapes of ${tonicName}, the chord on the root.` : null,
          cmp ? ` Compared with ${r} ${lowerName(cmp.name)}: ${onlyThere.length ? `the dashed notes (${onlyThere.map(t => t.name).join(' ')}) are only in ${r} ${lowerName(cmp.name)}` : `it has no other notes`}${onlyHere.length ? `, and the ringed notes (${onlyHere.map(t => t.name).join(' ')}) are only in ${r} ${lowerName(scale.name)}` : ''}.` : null),
        pos ? section('As tab', `Position ${pos.index} up and down, from the lowest note. The numbers are frets.`, h('pre', { class: 'tab', 'aria-label': `Position ${pos.index} as tab` }, tabOf(pos.notes))) : null,
        practice('scales'),
        playAlong(r, scale, follow),
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
    return h(href ? 'a' : 'span', { class: 'chord-btn', href, style: 'text-decoration:none;color:inherit' }, h('small', null, c.roman || c.label), h('b', null, c.name));
  }
  // Links use the 17 picker roots; a rare spelling such as E♯ falls back to its plain name.
  const rootForLink = name => T.ROOTS.includes(name) ? name : T.PC_PLAIN[T.pcOf(name)];
  function stepNames(scale) {
    const semis = scale.toneList.map(t => t.semi).concat(12);
    return semis.slice(1).map((s, i) => ({ 1: 'H', 2: 'W', 3: 'W+H', 4: '2W' })[s - semis[i]] || `${s - semis[i]}`);
  }
  // Positions: pentatonic boxes, and boxes or 3-notes-per-string shapes for seven-note scales.
  // Blues scales use the pentatonic boxes plus the added note.
  function scalePositions(r, scale) {
    const extra = { blues: 'minor-pentatonic', 'major-blues': 'major-pentatonic' }[scale.id];
    if (!extra) return scale.toneList.length === 7 && lib.scaleShapes !== 'nps' ? T.boxes(r, scale, openStrings(), lastFret()) : T.positions(r, scale, openStrings(), lastFret());
    const base = T.positions(r, T.scaleById(extra), openStrings(), lastFret());
    const blue = T.tonesOn(r, scale).find(t => !T.scaleById(extra).toneList.some(x => x.label === t.label));
    return base.map(p => {
      const notes = p.notes.slice();
      for (let s = 0; s < 6; s++) for (let f = p.low; f <= p.high; f++) if (T.mod(openStrings()[s] + f) === blue.pc) notes.push({ string: s, fret: f, midi: openStrings()[s] + f });
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
  // A degree label for any note above a root, for a slash bass outside the chord: "♭7", "2".
  const DEGREE_OF = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];
  const DROP_NAMES = { drop2: 'Drop 2', drop3: 'Drop 3' };
  const chordsView = {
    // library/chords/<chord>/<root>[/over-<bass>][/<shape>]. A bass makes a slash chord, for example C/E.
    parse(p) {
      const chord = T.chordById(p[0]) || T.chordById('major');
      const rest = p.slice(2);
      const bass = rest[0] && rest[0].startsWith('over-') ? rootFromSlug(rest[0].slice(5)) : null;
      if (bass) rest.shift();
      return { chord, root: rootFromSlug(p[1]) || 'C', bass, shape: rest[0] || null };
    },
    link: s => `library/chords/${s.chord.id}/${rootSlug(s.root)}${s.bass ? '/over-' + rootSlug(s.bass) : ''}${s.shape ? '/' + s.shape : ''}`,
    // Open chords link to their shape: open C is the C shape, open Cmaj7 is the open shape.
    openChords() {
      const openLink = c => {
        const shapes = T.chordShapes(c.root, c.chord);
        const match = shapes.find(s => s.frets.every((f, i) => f === c.frets[i]));
        return '#/' + chordsView.link({ chord: T.chordById(c.chord), root: c.root, shape: match ? match.id : null });
      };
      return h('div', { class: 'chip-grid' }, T.OPEN_CHORDS.filter(c => c.chord !== 'power').map(c => h('a', { class: 'chip', href: openLink(c) }, T.chordName(c.root, T.chordById(c.chord)))));
    },
    title: s => T.chordName(s.root, s.chord) + (s.bass && T.pcOf(s.bass) !== T.pcOf(s.root) ? '/' + s.bass : ''),
    render(state) {
      const { chord, root: r } = state;
      const tones = T.tonesOn(r, chord);
      const bass = state.bass && T.pcOf(state.bass) !== T.pcOf(r) ? state.bass : null;
      const bassPc = bass ? T.pcOf(bass) : null;
      // A bass outside the chord joins the notes of the page, for example the B♭ of C/B♭.
      const bassTone = bass && !tones.some(t => t.pc === bassPc) ? { name: bass, label: DEGREE_OF[T.mod(bassPc - T.pcOf(r))], pc: bassPc, semi: T.mod(bassPc - T.pcOf(r)) } : null;
      const allTones = bassTone ? tones.concat(bassTone) : tones;
      const shapes = bass ? T.slashShapes(r, chord.id, bass, openStrings()) : T.chordShapes(r, chord.id, openStrings());
      const four = chord.toneList.length === 4 && chord.toneList.every(t => t.semi < 12) && !bass;
      // Drop 2 and drop 3 voicings of a four-note chord, on the string set chosen in the section below.
      const dropKind = lib.dropKind === 'drop3' ? 'drop3' : 'drop2';
      const dropSet = T.DROP_SETS[dropKind].some(x => x.id === (lib.dropSets || {})[dropKind]) ? lib.dropSets[dropKind] : T.DROP_SETS[dropKind][1 % T.DROP_SETS[dropKind].length].id;
      const drops = four ? T.dropVoicings(r, chord.id, dropKind, dropSet, openStrings(), lastFret()) : [];
      const asShape = (v, id) => { const frets = Array(6).fill(null); v.strings.forEach((st, i) => { frets[st] = v.frets[i]; }); return { id, name: `${DROP_NAMES[v.kind]}, ${v.tones[0] === '1' ? 'root' : v.tones[0]} in the bass`, frets, low: Math.min(...v.frets), high: Math.max(...v.frets), drop: v }; };
      const dropShape = id => {
        const m = /^(drop[23])-(\d{4})-([0-3])-(\d+)$/.exec(id || '');
        if (!m || !four) return null;
        const list = T.dropVoicings(r, chord.id, m[1], m[2], openStrings(), lastFret())[Number(m[3])] || [];
        return list[Number(m[4])] ? asShape(list[Number(m[4])], id) : null;
      };
      // Major and minor chords open on the CAGED map: the five shapes over the whole neck.
      const caged = !bass && shapes.some(s => s.id.startsWith('caged-'));
      const arps = bass ? [] : T.arpeggioBoxes(r, chord.id, openStrings(), lastFret());
      const want = state.shape || (caged ? 'caged' : null);
      const arp = /^arp-\d$/.test(want || '') ? arps.find(p => p.index === Number(want.slice(4))) || null : null;
      const shape = want === 'neck' || want === 'caged' || arp ? null : dropShape(want) || shapes.find(s => s.id.toLowerCase() === String(want).toLowerCase()) || (want ? null : shapes[0]) || null;
      const showMap = caged && want === 'caged';
      const map = caged ? T.cagedMap(r, chord.id, lastFret(), openStrings()) : [];
      const cap = caption();
      // Fingers: 1 is the index finger. They replace the labels of a shape on the neck and on the cards.
      const fingerOf = sh => lib.fingers ? T.fingers(sh.frets) : null;
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
        const fingers = fingerOf(shape);
        markers = toneMarkers(allTones).map(m => shape.frets[m.string] === m.fret
          ? Object.assign(m, { ring: shared.has(`${m.string}:${m.fret}`) }, fingers && fingers[m.string] ? { label: String(fingers[m.string]) } : {})
          : Object.assign(m, { kind: 'ghost' }));
        extra.links = [{ points: placesOf(shape), cls: 'is-shape' }];
        if (at >= 0) extra.regions = near.map(n => ({ points: placesOf(n), label: n.shape, cls: 'is-near shape-' + n.shape })).concat({ points: placesOf(shape), label: map[at].shape, cls: 'is-current shape-' + map[at].shape });
        if (shape.low > 0) extra.dimOutside = [shape.low, shape.high];
        extra.muted = shape.frets.map((f, s) => f === null ? s : null).filter(s => s !== null);
      } else if (arp) {
        // An arpeggio position: the notes of the chord inside one box. The rest of the neck is faint.
        const inBox = new Set(arp.notes.map(n => `${n.string}:${n.fret}`));
        markers = toneMarkers(tones).map(m => inBox.has(`${m.string}:${m.fret}`) ? m : Object.assign(m, { kind: 'ghost' }));
        extra.dimOutside = [arp.low, arp.high];
      } else markers = toneMarkers(allTones).map(m => bass && T.mod(openStrings()[m.string] + m.fret) === bassPc ? Object.assign(m, { ring: true }) : m);
      // The other notes of the usual scale over the chord, as small faint dots. Full faint dots already mean the chord notes outside a shape.
      const scale = T.CHORD_SCALE[chord.id] ? T.scaleById(T.CHORD_SCALE[chord.id]) : null;
      const others = scale ? T.tonesOn(r, scale).filter(t => !allTones.some(x => x.pc === t.pc)) : [];
      const withScale = scale && lib.chordNotes;
      if (withScale) markers = markers.concat(toneMarkers(others, { kind: 'ghost', small: true }));
      const scaleNote = withScale ? `The small faint notes are the other notes of ${r} ${lowerName(scale.name)}, the usual scale over ${T.chordName(r, chord)}.` : null;
      const loose = () => (bass ? [A.bass(bassPc)] : []).concat(chordMidis(r, chord));
      const strum = () => A.notes(shape ? shapeMidis(shape.frets) : loose(), 'strum');
      const arpeggio = () => A.notes(shape ? shapeMidis(shape.frets) : arp ? arp.notes.map(n => n.midi).sort((a, b) => a - b) : loose(), 'up', 0.28, 0.5);
      // Short names for the buttons: "C" for the C shape, and "String 6" for the shape with its root on the 6th string.
      // A bare "5th" would read as a chord degree.
      const shortName = s => s.id.startsWith('root-') ? 'String ' + s.id.slice(5) : s.name.replace(' shape', '');
      const shapeOptions = (caged ? [['caged', 'CAGED']] : []).concat([['neck', 'All']], shapes.map(s => [s.id, shortName(s)]));
      const current = showMap ? 'caged' : shape && !shape.drop ? shape.id : shape ? null : 'neck';
      const atShape = shape && map.findIndex(sh => sh.frets.every((f, k) => f === shape.frets[k]));
      const mapNote = showMap ? 'Five shapes cover the neck, and each one overlaps the next. A ringed note belongs to two shapes: that is where they join. Pick a shape to see it alone.'
        : shape && caged && atShape >= 0 ? `Lines join the notes of the ${shape.name}. The outlines beside it are the ${[map[atShape - 1], map[atShape + 1]].filter(Boolean).map(n => n.shape + ' shape').join(' and the ')}, and the ringed notes are the ones they share.`
        : shape && shape.drop ? `Lines join the four notes of the ${shape.name.toLowerCase()}, on strings ${shape.drop.strings.map(st => 6 - st).join('–')}.`
        : arp ? `Arpeggio position ${arp.index}: the notes of ${chordsView.title(state)} inside one box of 4 or 5 frets. Play them up and down; the faint notes are the same chord in other places.`
        : bass ? `${bass} in the bass: play it on the lowest string you use. The ringed notes are the places of ${bass}.` : null;
      const fingerNote = lib.fingers && shape ? (fingerOf(shape).some(Boolean) ? 'The numbers are fingers: 1 is the index finger, and a 1 on several strings is a barre.' : 'This shape has more than one way to finger it, so it shows no finger numbers.') : null;
      const groups = T.CHORD_GROUPS.map(g => ({ name: g.name, items: g.items.map(i => [i.id, `${i.name} (${r}${i.symbol})`]) }));
      // The bass: the root, or another note for a slash chord. The chord tones come first: they make inversions.
      const bassPick = h('select', { class: 'more' + (bass ? ' is-on' : ''), 'aria-label': 'Bass note', onchange: e => GT.go(chordsView.link({ chord, root: r, bass: e.target.value || null }), true) },
        h('option', { value: '', selected: !bass }, `Bass: ${r}, the root`),
        h('optgroup', { label: 'A note of the chord' }, tones.slice(1).map(t => h('option', { value: t.name, selected: bass === t.name }, `Bass: ${t.name} (${t.label})`))),
        h('optgroup', { label: 'Another note' }, T.PC_PLAIN.map((n, pc) => tones.some(t => t.pc === pc) ? null : h('option', { value: n, selected: bass === n }, `Bass: ${n}`))));
      const positionsCtl = arps.length && !shape && !showMap ? ctl('Arpeggio', GT.segmented('Arpeggio position', [['neck', 'All']].concat(arps.slice().sort((a, b) => a.index - b.index).map(p => [`arp-${p.index}`, String(p.index)])), arp ? `arp-${arp.index}` : 'neck', v => GT.go(chordsView.link(Object.assign({}, state, { shape: v })), true)), 'ctl-plain') : null;
      const card = (s, title, sub) => {
        const fingers = fingerOf(s);
        const m = s.frets.map((f, i) => f === null ? null : (() => {
          const t = allTones.find(x => x.pc === T.mod(openStrings()[i] + f));
          return { string: i, fret: f, label: fingers && fingers[i] ? String(fingers[i]) : lib.labels === 'notes' ? t.name : t.label, kind: FB.degreeKind(t.label) };
        })()).filter(Boolean);
        const mutedStrings = s.frets.map((f, i) => f === null ? i : null).filter(i => i !== null);
        // A card shows its shape on the neck and plays it, as the inversion cards on the Triads page do.
        const href = '#/' + chordsView.link(Object.assign({}, state, { shape: s.id }));
        return h('a', { class: 'card', href, style: 'text-decoration:none;color:inherit', 'aria-current': String(!!shape && shape.id === s.id),
          onclick: e => { e.preventDefault(); GT.go(href, true); A.notes(shapeMidis(s.frets), 'strum'); } },
          h('h3', null, title), h('p', null, sub || (s.low === 0 ? (capo() ? `At the capo, fret ${capo()}` : 'Open position') : `Frets ${s.low + capo()}–${s.high + capo()}`)),
          miniNeck(m, s.low, s.high, `${title} of ${chordsView.title(state)}`, mutedStrings, { links: [{ points: placesOf(s), cls: 'is-shape' }] }));
      };
      const out = [
        head(chordsView.title(state), `${r} ${lowerName(chord.name)}${bass ? ` with ${bass} in the bass` : ''}`, [playButton('Strum', strum), playButton('Arpeggio', arpeggio)]),
        controls(
          rootCtl(state, chordsView),
          labelsCtl(rerender),
          ctl('Chord', typePick('Chord', CHORD_QUICK.map(id => [id, T.chordName(r, T.chordById(id))]), groups, chord.id, v => GT.go(chordsView.link({ chord: T.chordById(v), root: r, bass }), true)), 'ctl-wide ctl-plain'),
          shapes.length ? ctl('Shape', GT.segmented('Shape', shapeOptions, current, v => GT.go(chordsView.link(Object.assign({}, state, { shape: v })), true)), 'ctl-plain') : null,
          positionsCtl,
          ctl('Bass', bassPick, 'ctl-plain'),
          fretsCtl(rerender)),
        neck(markers, Object.assign({ onPress: pressPlayer(cap, describeNote(withScale ? allTones.concat(others) : allTones)), label: `${chordsView.title(state)} on the neck`,
          tools: [scale ? layerChip('chordNotes', 'Scale notes', 'Scale notes', `Show the other notes of ${r} ${lowerName(scale.name)}`) : null,
            shapes.length || four ? layerChip('fingers', 'Fingers', 'Finger numbers', 'Show which finger plays each note of a shape') : null] }, extra)),
        cap,
        toneRow(allTones, t => h('div', { class: 'tone is-still' }, toneInside(t))),
        mapNote || scaleNote || fingerNote ? h('p', { class: 'small muted lib-note' }, [mapNote, fingerNote, scaleNote].filter(Boolean).join(' ')) : null,
        practice('chords'),
        pianoBox('chords', allTones, r, 'A chord takes every other note of its scale. On a keyboard you see the gaps: 4 keys up for a major third, 3 for a minor third.')
      ];
      if (shapes.length) {
        out.push(section(bass ? `Shapes with ${bass} in the bass` : CAGEDnote(chord) ? 'The five CAGED shapes' : 'Shapes',
          [bass ? null : CAGEDnote(chord), 'Tap a card to see its shape on the neck and hear it.'].filter(Boolean).join(' '),
          h('div', { class: 'cards' }, shapes.map(s => card(s, bass ? `${s.name} over ${bass}` : s.name)))));
      } else if (bass) out.push(section(`Shapes with ${bass} in the bass`, `No shape of ${T.chordName(r, chord)} takes ${bass} under it within reach. Play ${bass} on a low string and the chord above it, or choose the shape on the neck with the notes shown.`));
      if (four) {
        const setLabel = st => st.id.split('').join('–');
        out.push(section('Drop 2 and drop 3 voicings', 'Four notes on four strings, as jazz and comping players use them. A drop 2 voicing lowers the second note from the top of a close chord by an octave; a drop 3 voicing lowers the third and skips a string. Each card has another chord tone in the bass. Tap a card to see it on the neck and hear it.',
          h('div', { class: 'row drop-pick' },
            GT.segmented('Voicing', [['drop2', 'Drop 2'], ['drop3', 'Drop 3']], dropKind, v => { saveLib({ dropKind: v }); rerender(); }),
            GT.segmented('Strings', T.DROP_SETS[dropKind].map(st => [st.id, setLabel(st)]), dropSet, v => { saveLib({ dropSets: Object.assign({}, lib.dropSets, { [dropKind]: v }) }); rerender(); })),
          h('div', { class: 'cards' }, drops.map((list, bi) => list.length ? card(asShape(list[0], `${dropKind}-${dropSet}-${bi}-0`), `${chord.toneList[bi].label === '1' ? 'Root' : chord.toneList[bi].label} in the bass`) : null))));
      }
      const related = [];
      if (TRIAD_QUALITIES.includes(chord.id) && !bass) related.push(h('a', { class: 'chip', href: '#/' + triadsView.link({ quality: chord.id, root: r, set: '123' }) }, `${chordsView.title(state)} triads on three strings`));
      if (typeof fitView !== 'undefined') related.push(h('a', { class: 'chip', href: '#/' + fitView.link({ chords: [{ root: r, chord }] }) }, `Scales that fit ${T.chordName(r, chord)}`));
      if (related.length) out.push(section('Related', null, h('div', { class: 'chips' }, related)));
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

  // ---------- scales for chords ----------
  // library/fit/<root>.<chord>_<root>.<chord>... The chords of a song or a progression, and the scales that hold all
  // their notes. The neck shows the first scale; the chords loop over it, and the notes of the chord that sounds stay bright.
  const fitView = {
    parse(p) {
      const chords = (p[0] || '').split('_').filter(Boolean).map(tok => {
        const [rs, id] = tok.split('.');
        const root = rootFromSlug(rs), chord = T.chordById(id);
        return root && chord ? { root, chord } : null;
      }).filter(Boolean).slice(0, 8);
      return { chords };
    },
    link: s => 'library/fit' + (s.chords.length ? '/' + s.chords.map(c => `${rootSlug(c.root)}.${c.chord.id}`).join('_') : ''),
    title: () => FIT.title,
    render(state) {
      const { chords } = state;
      const go = list => GT.go(fitView.link({ chords: list }), true);
      const name = c => T.chordName(c.root, c.chord);
      const pcsOfChord = c => c.chord.toneList.map(t => T.mod(T.pcOf(c.root) + t.semi));
      // Add a chord: a root and a type, then Add. The type list is the one of the Chords page.
      const lastChord = chords[chords.length - 1];
      const addRoot = h('select', { 'aria-label': 'Root of the chord to add' }, T.ROOTS.map(rt => h('option', { value: rt, selected: rt === (lastChord ? lastChord.root : 'C') }, rt)));
      const addType = h('select', { 'aria-label': 'Type of the chord to add' }, T.CHORD_GROUPS.map(g => h('optgroup', { label: g.name }, g.items.map(i => h('option', { value: i.id, selected: i.id === 'major' }, `${i.name}${i.symbol ? ` (${i.symbol})` : ''}`)))));
      const add = h('button', { type: 'button', class: 'btn btn-primary', disabled: chords.length >= 8, onclick: () => go(chords.concat({ root: addRoot.value, chord: T.chordById(addType.value) })) }, 'Add');
      const list = h('div', { class: 'chips fit-chords', role: 'list', 'aria-label': 'Your chords' }, chords.map((c, i) => h('span', { class: 'chip fit-chord', role: 'listitem' }, name(c),
        h('button', { type: 'button', class: 'fit-remove', 'aria-label': `Remove ${name(c)}`, onclick: () => go(chords.filter((_, k) => k !== i)) }, '×'))));
      const examples = [
        ['ii–V–I in C', [['D', 'm7'], ['G', '7'], ['C', 'maj7']]],
        ['Am F C G', [['A', 'minor'], ['F', 'major'], ['C', 'major'], ['G', 'major']]],
        ['Blues in A', [['A', '7'], ['D', '7'], ['E', '7']]],
        ['Em C D', [['E', 'minor'], ['C', 'major'], ['D', 'major']]]
      ].map(([text, cs]) => h('a', { class: 'chip fit-example', href: '#/' + fitView.link({ chords: cs.map(([root, id]) => ({ root, chord: T.chordById(id) })) }) }, text));
      const out = [
        head(FIT.title, 'Add the chords of a song. The list shows the scales that hold every note of them.'),
        h('div', { class: 'controls fit-add', role: 'group', 'aria-label': 'Add a chord' }, addRoot, addType, add,
          chords.length ? h('button', { type: 'button', class: 'btn', onclick: () => go([]) }, 'Clear') : null),
        chords.length ? list : h('div', null, h('p', { class: 'muted' }, 'No chords yet. Add them one by one, or start from an example:'), h('div', { class: 'chips fit-examples' }, examples))
      ];
      if (!chords.length) return out;
      const pcs = [...new Set(chords.flatMap(pcsOfChord))];
      const fits = T.scalesWith(pcs, T.pcOf(chords[0].root)).slice(0, 8);
      // No scale holds every note, as over a blues: the scales that miss the fewest, on the root of the first chord first.
      const firstPc = T.pcOf(chords[0].root);
      const near = fits.length ? [] : T.SCALES.filter(sc => sc.id !== 'chromatic').flatMap(scale => T.PC_PLAIN.map((root, rpc) => {
        const has = new Set(scale.toneList.map(t => T.mod(rpc + t.semi)));
        return { root, scale, miss: pcs.filter(pc => !has.has(pc)), onRoot: rpc === firstPc };
      })).sort((a, b) => a.miss.length - b.miss.length || (b.onRoot - a.onRoot) || T.SCALES.indexOf(a.scale) - T.SCALES.indexOf(b.scale)).slice(0, 6);
      const best = fits[0] || near[0];
      const cap = caption();
      const neckSlot = h('div');
      let now = null;
      const drawNeck = () => {
        if (!best) { neckSlot.replaceChildren(neck(toneMarkers(T.tonesOn(chords[0].root, chords[0].chord)), { label: 'The notes of the chords' })); return; }
        const tones = T.tonesOn(best.root, best.scale);
        const lit = now || new Set(pcs);
        const markers = toneMarkers(tones).map(m => lit.has(T.mod(openStrings()[m.string] + m.fret)) ? m : Object.assign(m, { kind: 'ghost' }));
        neckSlot.replaceChildren(neck(markers, { onPress: pressPlayer(cap, describeNote(tones)), label: `${best.root} ${lowerName(best.scale.name)} under your chords` }));
      };
      drawNeck();
      const follow = (item, i) => { now = i === null ? null : new Set(item.chords[i].pcs); drawNeck(); };
      const loop = backingList(`fit:${chords.map(name).join(' ')}`, [{ id: 'fit:' + chords.map(name).join(' '), name: 'Your chords', chords: chords.map(c => ({ name: name(c), pcs: pcsOfChord(c) })) }], follow);
      const row = (href, title, text, tag) => h('a', { class: 'found', href: '#/' + href }, h('span', { class: 'found-text' }, h('b', null, title), text ? h('small', null, text) : null), tag ? h('span', { class: 'found-tag' }, tag) : null);
      out.push(list,
        neckSlot, cap,
        h('p', { class: 'small muted lib-note' }, `The neck shows ${best.root} ${lowerName(best.scale.name)}. The bright notes are in your chords; the faint ones are the rest of the scale.`,
          fits.length ? null : ' No scale holds every note of these chords, so it is the scale that misses the fewest.'),
        section('Play along', 'Loop your chords, one bar each, and play the scale over them. The notes of the chord that sounds stay bright.', h('div', { class: 'row backing-row' }, tempoCtl()), loop),
        fits.length ? section('Scales that fit', `Each scale holds every note of ${chords.map(name).join(', ')}. Scales on the root of the first chord come first.`,
          h('div', { class: 'found-list' }, fits.map(f => row(scalesView.link({ scale: f.scale, root: rootForLink(f.root) }), `${f.root} ${lowerName(f.scale.name)}`,
            f.exact ? 'The same notes, no more' : `${f.scale.toneList.length - pcs.length} more note${f.scale.toneList.length - pcs.length > 1 ? 's' : ''}`, f.onBass ? `On ${chords[0].root}` : null))))
          : section('Near fits', 'No scale holds every note of these chords. These miss the fewest. Over a blues, players use the minor pentatonic or the blues scale and bend the missing notes.',
            h('div', { class: 'found-list' }, near.map(f => row(scalesView.link({ scale: f.scale, root: rootForLink(f.root) }), `${f.root} ${lowerName(f.scale.name)}`, `Misses ${f.miss.map(pc => T.PC_PLAIN[pc]).join(' ')}`, f.onRoot ? `On ${chords[0].root}` : null)))),
        chords.length > 1 ? section('Over each chord', 'The usual scale over each chord on its own. Change scale with the chord, or keep one scale from the list above.',
          h('div', { class: 'found-list' }, chords.map(c => {
            const id = T.CHORD_SCALE[c.chord.id], sc = id && T.scaleById(id);
            return sc ? row(scalesView.link({ scale: sc, root: rootForLink(c.root) }), name(c), `${c.root} ${lowerName(sc.name)}`) : null;
          }))) : null);
      return out;
    }
  };

  // ---------- tuner ----------
  // The microphone hears a string, and the page shows its note and how far it is from the string of your tuning.
  // The pitch comes from the autocorrelation of 4096 samples, about ten times a second. The tuner ignores the capo.
  let tuner = null;
  function stopTuner() {
    if (!tuner) return;
    clearInterval(tuner.timer);
    tuner.stream.getTracks().forEach(t => t.stop());
    tuner.ctx.close().catch(() => {});
    tuner = null;
    // Back to playback only, so the silent switch of an iPhone does not mute the site.
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* older browsers */ }
  }
  const tuneView = {
    parse: () => ({}),
    link: () => 'library/tune',
    title: () => TUNE.title,
    render() {
      const strings = GT.tuning();
      const name = m => `${T.PC_PLAIN[T.mod(m)]}${Math.floor(m / 12) - 1}`;
      const note = h('b', { class: 'tuner-name' }, '–');
      const detail = h('p', { class: 'tuner-detail muted', 'aria-live': 'polite' }, 'Tap Start and play one string.');
      const NS = 'http://www.w3.org/2000/svg';
      const gauge = document.createElementNS(NS, 'svg');
      gauge.setAttribute('viewBox', '-110 -100 220 112');
      gauge.setAttribute('class', 'tuner-gauge');
      gauge.setAttribute('aria-hidden', 'true');
      const el = (n, attrs) => { const x = document.createElementNS(NS, n); for (const [k, v] of Object.entries(attrs)) x.setAttribute(k, v); gauge.appendChild(x); return x; };
      el('path', { d: 'M -90 0 A 90 90 0 0 1 90 0', class: 'tuner-arc' });
      el('path', { d: `M ${-90 * Math.sin(Math.PI / 36)} ${-90 * Math.cos(Math.PI / 36)} A 90 90 0 0 1 ${90 * Math.sin(Math.PI / 36)} ${-90 * Math.cos(Math.PI / 36)}`, class: 'tuner-zone' });
      for (const c of [-50, -25, 0, 25, 50]) { const a = c * 1.8 * Math.PI / 180; el('line', { x1: 80 * Math.sin(a), y1: -80 * Math.cos(a), x2: 96 * Math.sin(a), y2: -96 * Math.cos(a), class: 'tuner-tick' }); }
      const needle = el('line', { x1: 0, y1: 0, x2: 0, y2: -84, class: 'tuner-needle' });
      el('circle', { r: 5, class: 'tuner-hub' });
      // A string chip plays its note, to tune by ear.
      const chips = h('div', { class: 'chips tuner-strings', role: 'group', 'aria-label': 'Strings of your tuning. Tap one to hear it.' }, strings.map((m, s) => h('button', { type: 'button', class: 'chip', dataset: { s }, onclick: () => A.note(m, 0, 2.5) }, `${6 - s} · ${name(m)}`)));
      const box = h('div', { class: 'tuner' }, gauge, note, detail, chips);
      const start = h('button', { type: 'button', class: 'btn btn-primary', onclick: async () => {
        if (tuner) { stopTuner(); start.textContent = 'Start'; detail.textContent = 'The tuner is off.'; box.classList.remove('is-on'); return; }
        try {
          // An iPhone records only when the page asks for recording and playback together.
          try { if (navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch { /* older browsers */ }
          const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
          const ctx = new (root.AudioContext || root.webkitAudioContext)();
          const an = ctx.createAnalyser(); an.fftSize = 4096;
          ctx.createMediaStreamSource(stream).connect(an);
          const buf = new Float32Array(an.fftSize), last = [];
          tuner = { stream, ctx, timer: setInterval(() => {
            an.getFloatTimeDomainData(buf);
            const f = T.pitchOf(buf, ctx.sampleRate);
            if (!f) return;
            last.push(f); if (last.length > 5) last.shift();
            const hz = last.slice().sort((a, b) => a - b)[last.length >> 1];
            const exact = 69 + 12 * Math.log2(hz / 440), midi = Math.round(exact), cents = Math.round((exact - midi) * 100);
            // The nearest string of your tuning, and how far the sound is from it.
            const s = strings.reduce((k, m, i) => Math.abs(exact - m) < Math.abs(exact - strings[k]) ? i : k, 0);
            const off = Math.round((exact - strings[s]) * 100);
            note.textContent = name(midi);
            needle.setAttribute('transform', `rotate(${Math.max(-50, Math.min(50, cents)) * 1.8})`);
            box.classList.toggle('is-in', Math.abs(cents) <= 5);
            detail.textContent = `${hz.toFixed(1)} Hz, ${cents === 0 ? 'in tune' : `${Math.abs(cents)} cents ${cents < 0 ? 'low' : 'high'}`}. ${Math.abs(off) <= 300 ? `${6 - s}${['th', 'th', 'th', 'rd', 'nd', 'st'][s]} string, ${name(strings[s])}: ${Math.abs(off) <= 5 ? 'in tune' : `${off < 0 ? 'tune up' : 'tune down'}, ${Math.abs(off)} cents`}.` : ''}`;
            chips.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.s) === s && Math.abs(off) <= 300)));
          }, 90) };
          start.textContent = 'Stop';
          box.classList.add('is-on');
          detail.textContent = 'Play one string and let it ring.';
        } catch (e) {
          detail.textContent = e && e.name === 'NotAllowedError' ? 'The microphone is blocked. Allow it for this site in the settings of your browser, then tap Start again.' : 'This browser gives no microphone to the page.';
        }
      } }, 'Start');
      return [
        head(TUNE.title, `Tune to ${strings.map(m => T.PC_PLAIN[T.mod(m)]).join(' ')}, the tuning of Settings.`, start),
        box,
        h('p', { class: 'small muted lib-note' }, 'The tuner uses the microphone only while it is on, and nothing leaves this device. A capo does not change it: tune the open strings, then put the capo on.')
      ];
    }
  };

  // ---------- triads ----------
  const TRIAD_QUALITIES = ['major', 'minor', 'dim', 'aug'];
  const triadsView = {
    parse(p) {
      const inv = /^inversion-[0-2]$/.test(p[3] || '') ? Number(p[3].slice(10)) : null;
      return { quality: TRIAD_QUALITIES.includes(p[0]) ? p[0] : 'major', root: rootFromSlug(p[1]) || 'C', set: T.TRIAD_SETS.some(s => s.id === p[2]) ? p[2] : '123', inv };
    },
    // inv: one inversion picked from the cards. Its shapes stay bright on the neck, the others go faint.
    link: s => `library/triads/${s.quality}/${rootSlug(s.root)}/${s.set}${s.inv !== null && s.inv !== undefined ? '/inversion-' + s.inv : ''}`,
    title: s => `${T.chordName(s.root, T.chordById(s.quality))} triads`,
    render(state) {
      const chord = T.chordById(state.quality), r = state.root;
      const tones = T.tonesOn(r, chord);
      const set = T.TRIAD_SETS.find(s => s.id === state.set);
      const voicings = T.triadVoicings(r, state.quality, state.set, openStrings(), lastFret());
      const cap = caption();
      const onSet = (s) => set.strings.includes(s);
      // A line joins the three notes of each shape. A shape that runs past the last fret keeps the part you see.
      const picked = state.inv;
      const all = T.triadVoicings(r, state.quality, state.set, openStrings(), lastFret() + 4).flat();
      const links = all.map(v => ({ points: v.frets.map((f, i) => ({ string: v.strings[i], fret: f })).filter(p => p.fret <= lastFret()), cls: 'is-shape' + (picked !== null && v.inversion !== picked ? ' is-off' : '') }));
      // The places of the picked inversion, to keep them bright.
      const lit = new Set(picked === null ? [] : all.filter(v => v.inversion === picked).flatMap(v => v.frets.map((f, i) => `${v.strings[i]}:${f}`)));
      // The other notes of the scale around the triad, faint, on the same three strings: the notes for a melody between the shapes.
      const scale = T.scaleById(T.CHORD_SCALE[state.quality]), scaleTones = T.tonesOn(r, scale);
      const around = lib.triadNotes ? toneMarkers(scaleTones.filter(t => !tones.some(x => x.pc === t.pc)), { only: s => onSet(s), kind: 'ghost' }) : [];
      // Major and minor triads also sit inside the five CAGED shapes of their chord.
      const cagedOk = !!T.CAGED[state.quality] && cagedTuning();
      const caged = cagedOk && lib.triadCaged;
      const out = [
        head(triadsView.title(state), `${tones.map(t => t.name).join(' ')} on ${set.name.replace('Strings', 'strings')}`, playButton('Play', () => A.notes(chordMidis(r, chord), 'strum'))),
        controls(
          rootCtl(state, triadsView),
          labelsCtl(rerender),
          // The same chips as the chord types on the Chords page.
          ctl('Quality', typePick('Quality', TRIAD_QUALITIES.map(q => [q, T.chordName(r, T.chordById(q))]), [], state.quality, v => GT.go(triadsView.link(Object.assign({}, state, { quality: v })), true)), 'ctl-wide ctl-plain'),
          ctl('Strings', GT.segmented('String set', T.TRIAD_SETS.map((s, i) => [s.id, [i ? null : h('span', { class: 'seg-word' }, 'Strings '), s.id.split('').reverse().join('–')]]), state.set, v => GT.go(triadsView.link(Object.assign({}, state, { set: v })), true)), 'ctl-plain'),
          fretsCtl(rerender)),
        neck(toneMarkers(tones, { only: s => onSet(s) }).map(m => picked !== null && !lit.has(`${m.string}:${m.fret}`) ? Object.assign(m, { dim: true }) : m).concat(around), { links, regions: caged ? cagedBehind(r, state.quality) : null,
          tools: [layerChip('triadNotes', 'Scale notes', 'Scale notes', `Show the other notes of ${r} ${lowerName(scale.name)}`),
            cagedOk ? layerChip('triadCaged', 'CAGED', 'CAGED shapes', `Show the five CAGED shapes of ${T.chordName(r, chord)}`) : null],
          onPress: pressPlayer(cap, describeNote(lib.triadNotes ? scaleTones : tones)), label: `${triadsView.title(state)} on ${set.name}` }),
        cap,
        toneRow(tones, t => h('div', { class: 'tone is-still' }, toneInside(t))),
        h('p', { class: 'small muted lib-note' }, 'A line joins the three notes of one shape. ', lib.triadNotes ? `The faint notes are the other notes of ${r} ${lowerName(scale.name)} on the same strings. ` : null,
          caged ? `The faint outlines are the CAGED shapes of ${T.chordName(r, chord)}. ${state.set === '456' ? 'Only the E and G shapes use the 6th string, so on these strings a triad is part of one of those two.' : 'Each triad is part of one of them.'}` : null),
        practice('triads'),
        section('Inversions', 'The same three notes with a different note in the bass. Tap a card to see its shapes on the neck and hear it. Up the neck the order repeats: root position, first inversion, second inversion.',
          h('div', { class: 'cards' }, voicings.map((list, inversion) => {
            const v = list[0];
            if (!v) return null;
            const markers = v.frets.map((f, i) => {
              const t = tones.find(x => x.pc === T.mod(openStrings()[v.strings[i]] + f));
              return { string: v.strings[i], fret: f, label: lib.labels === 'notes' ? t.name : t.label, kind: FB.degreeKind(t.label) };
            });
            const midis = v.frets.map((f, i) => openStrings()[v.strings[i]] + f);
            const low = Math.min(...v.frets), high = Math.max(...v.frets);
            // A card shows its inversion on the neck and plays it. A second tap shows every inversion again.
            return h('button', { type: 'button', class: 'card', 'aria-pressed': String(picked === inversion), onclick: () => {
              GT.go(triadsView.link(Object.assign({}, state, { inv: picked === inversion ? null : inversion })), true);
              A.notes(midis, 'strum');
            } },
              h('h3', null, T.INVERSIONS[inversion]), h('p', null, `${v.tones[0]} in the bass, frets ${low + capo()}–${high + capo()}`),
              miniNeck(markers, low, high, `${T.INVERSIONS[inversion]}`, null, { links: [{ points: markers.map(m => ({ string: m.string, fret: m.fret })), cls: 'is-shape' }] }));
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
      // Chords from outside the key: secondary dominants and borrowed chords. In a minor key, V and V7 too.
      const outside = T.outsideChords(key, mode);
      // A step of a progression is a degree of the key (a number) or the numeral of a chord from outside the key.
      const chordOf = step => typeof step === 'number' ? triads[step - 1] : outside.find(c => c.roman === step);
      const nameOf = steps => steps.map(st => chordOf(st).roman).join('–');
      // Six of each, so the list fills its rows in one, two or three columns. Minor-key songs mostly use the major V.
      const progressions = (mode === 'major'
        ? [[1, 4, 5, 1], [1, 5, 6, 4], [2, 5, 1], [1, 6, 4, 5], [6, 4, 1, 5], [1, '♭VII', 4, 1]]
        : [[1, 4, 'V', 1], [1, 6, 3, 7], [1, 7, 6, 7], [2, 'V7', 1], [1, 6, 7, 1], [1, 4, 7, 3]]).map(steps => [nameOf(steps), steps]);

      // The seven chords in one row. A tap plays the chord, marks it on the circle and shows how to play it.
      // The chords from outside the key work the same way, in rows under it.
      const panel = h('div', { class: 'chord-panel', 'aria-live': 'polite' });
      const chordBtn = c => h('button', { type: 'button', class: 'chord-btn', dataset: { roman: c.roman }, 'aria-pressed': String(c === triads[0]), onclick: () => { stopBacking(); choose(c); playChord(c); } }, h('small', null, c.roman), h('b', null, c.name));
      const strip = h('div', { class: 'chord-strip', role: 'group', 'aria-label': `The chords of ${key} ${mode}` }, triads.map(chordBtn));
      const groups = [...new Set(outside.map(c => c.group))];
      const outsideBox = h('div', { class: 'outside' }, groups.map(g => h('div', { class: 'outside-group' }, h('p', { class: 'small muted' }, g),
        // Rows of even length: five chords go three and two, never four and one.
        h('div', { class: 'chord-row', role: 'group', 'aria-label': g, style: `--cols:${(n => n === 5 || n === 6 ? 3 : n)(outside.filter(c => c.group === g).length)}` }, outside.filter(c => c.group === g).map(chordBtn)))));
      const allBtns = () => [...strip.querySelectorAll('.chord-btn'), ...outsideBox.querySelectorAll('.chord-btn')];
      // What a chord from outside the key does: a secondary dominant leads to the chord after its slash.
      const outsideText = c => {
        const aim = c.roman.split('/')[1], to = aim && triads.find(t => t.roman.toLowerCase() === aim.toLowerCase());
        if (to) return `The V7 of ${aim}: it leads to the chord on ${to.root}.`;
        return c.group.startsWith('From harmonic') ? `From ${key} harmonic minor: its leading tone pulls back to ${key}.` : c.roman === 'IV' ? `Borrowed from ${key} dorian.` : `Borrowed from ${key} minor.`;
      };
      const cellOf = c => { const i = triads.indexOf(c); return i >= 0 ? cells[i] : null; };
      const light = c => {
        allBtns().forEach(b => b.classList.toggle('is-playing', !!c && b.dataset.roman === c.roman));
        circle.hot(c ? cellOf(c) : null);
      };
      function choose(c) {
        allBtns().forEach(b => b.setAttribute('aria-pressed', String(b.dataset.roman === c.roman)));
        circle.hot(cellOf(c));
        const i = triads.indexOf(c);
        const c7 = i >= 0 ? sevenths[i] : null, chordTones = T.tonesOn(c.root, c.chord);
        // The shape nearest to the nut: the open chord when there is one.
        const shape = T.chordShapes(c.root, c.chord.id, openStrings()).slice().sort((a, b) => a.low - b.low)[0];
        const dots = shape ? shape.frets.map((f, s) => {
          if (f === null) return null;
          const t = chordTones.find(x => x.pc === T.mod(openStrings()[s] + f));
          return { string: s, fret: f, label: lib.labels === 'notes' ? t.name : t.label, kind: FB.degreeKind(t.label) };
        }).filter(Boolean) : [];
        panel.replaceChildren(
          h('div', { class: 'chord-panel-text' },
            h('h3', null, c.name, h('small', null, ` ${c.roman} in ${key} ${mode}`)),
            h('p', null, `${chordTones.map(t => t.name).join(' ')}.`, c7 ? ` With a seventh it is ${c7.name}.` : ` ${outsideText(c)}`),
            h('div', { class: 'row' }, playButton(c.name, () => playChord(c)), c7 ? playButton(c7.name, () => playChord(c7)) : null,
              h('a', { class: 'btn', href: `#/library/chords/${c.chord.id}/${rootSlug(rootForLink(c.root))}` }, 'All shapes'))),
          shape ? miniNeck(dots, shape.low, shape.high, `${c.name}, ${shape.name}`, shape.frets.map((f, s) => f === null ? s : null).filter(s => s !== null)) : null);
      }
      choose(triads[0]);
      circle.hot(null);
      // A progression loops, one bar for each chord. The chord that sounds lights up on the circle and in the row.
      const loops = backingList(`keys:${key}:${mode}`, progressions.map(([name, steps], i) => ({
        id: `keys:${key}:${mode}:${i}`, name, steps,
        chords: steps.map(chordOf).map(c => ({ name: c.name, pcs: c.chord.toneList.map(t => T.mod(c.pc + t.semi)) }))
      })), (item, i) => light(i === null ? null : chordOf(item.steps[i])));
      const facts = h('dl', { class: 'facts' },
        h('dt', null, 'Key signature'), h('dd', null, sigText(entry.count)),
        h('dt', null, mode === 'major' ? 'Relative minor' : 'Relative major'), h('dd', null, keyLink(relName, mode === 'major' ? 'minor' : 'major'), ', the same notes'),
        h('dt', null, 'One fifth up'), h('dd', null, keyLink(pick(next), mode), ', one step clockwise'),
        h('dt', null, 'One fifth down'), h('dd', null, keyLink(pick(prev), mode), ', one step counterclockwise'),
        twin ? [h('dt', null, 'Other name'), h('dd', null, keyLink(pick(twin), mode), `, ${sigText(twin.count)}`)] : null);
      return [
        h('div', { class: 'lib-title' }, h('div', null, h('h1', null, keysView.title(state)), h('p', { class: 'muted lib-sub' }, sigText(entry.count))),
          h('div', { class: 'row lib-play' }, GT.segmented('Mode', [['major', 'Major'], ['minor', 'Minor']], mode, v => GT.go(keysView.link({ key, mode: v }), true)), shareMenu())),
        h('div', { class: 'circle-wrap' },
          h('div', { class: 'circle-col' },
            GT.segmented('Circle shows', [['chords', 'Chords'], ['intervals', 'Intervals']], lib.circleMode === 'intervals' ? 'intervals' : 'chords', v => { saveLib({ circleMode: v }); rerender(); }),
            circle, circle.readout || null,
            h('p', { class: 'circle-note' }, lib.circleMode === 'intervals'
              ? `Each step clockwise is a perfect fifth, so the intervals from ${key} keep their places: P5 beside the key, TT at the bottom. Tap notes to hear them with ${key}. Three or more make the shape of a chord.`
              : 'Tap a key to turn the circle to it. The frame at the top holds the seven chords of the key.')),
          h('div', { class: 'keys-main' },
            h('div', { class: 'lib-section' }, h('h2', null, 'Chords in the key'), strip, panel),
            h('div', { class: 'lib-section' }, h('h2', null, 'Outside the key'),
              h('p', null, mode === 'minor'
                ? `Most songs in a minor key make v a major chord: V (${T.spell(key, '5')}) from the harmonic minor, often with its seventh. A secondary dominant leads into the chord after the slash.`
                : 'A secondary dominant is the V7 of another chord of the key: it leads into the chord after the slash. Borrowed chords come from the minor key on the same root.'),
              outsideBox),
            h('div', { class: 'lib-section' }, h('div', { class: 'section-head' }, h('h2', null, 'Common progressions'), tempoCtl()),
              h('p', null, 'Tap one to loop it, one bar for each chord. Tap it again to stop.'), loops,
              h('p', { class: 'small', style: 'margin-top:10px' }, h('a', { href: '#/' + fitView.link({ chords: progressions[1][1].map(chordOf).map(c => ({ root: rootForLink(c.root), chord: c.chord })) }) },
                `Which scales fit ${progressions[1][0]}? Open Scales for chords`))))),
        practice('keys'),
        h('div', { class: 'keys-more' },
          h('div', { class: 'lib-section' }, h('h2', null, 'Scale'),
            toneRow(tones, t => h('button', { type: 'button', class: 'tone', onclick: () => A.note(48 + T.mod(T.pcOf(key) - 48) + t.semi) }, toneInside(t))),
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
        const isKey = ring === 'major' && lib.circleMode === 'intervals' && T.pcOf(k.major) === T.pcOf(state.key);
        const g = el('g', { class: `cell ring-${ring}${c ? ' in-key' : ''}${c === tonic ? ' is-tonic' : ''}${isKey ? ' is-key' : ''}` }, wheel);
        el('path', { d }, g);
        const x = (mid * Math.sin(a)).toFixed(1), y = -mid * Math.cos(a);
        // The words turn back by the angle of the wheel, around the middle of their cell, so they stay upright.
        const words = el('g', { class: 'cell-text', style: `transform-origin:${x}px ${y.toFixed(1)}px` }, g);
        const text = (cls, dy, value) => { el('text', { x, y: (y + dy).toFixed(1), class: cls }, words).textContent = value; };
        const [numY, nameY, sigY] = LAYOUT[ring][c ? 1 : 0];
        if (c) text('t-num', numY, c.roman);
        // In the intervals view a note is spelled from the key: G♯ in E major, not A♭.
        const spelled = isKey || (ring === 'major' && lib.circleMode === 'intervals') ? T.spell(state.key, ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'][T.mod(T.pcOf(k.major) - T.pcOf(state.key))]) : null;
        text('t-name', nameY, spelled || (c ? c.name : ring === 'major' ? (k.alt ? `${k.major}/${k.alt.major}` : k.major) : ring === 'minor' ? `${k.minor}m` : `${T.spell(k.major, '7')}°`));
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
        // In the intervals view a note cell adds its note to the shape. Otherwise it turns the circle to its key.
        const open = () => lib.circleMode === 'intervals' ? svg._pickNote && ring === 'major' && svg._pickNote(T.pcOf(target)) : GT.go(keysView.link({ key: target, mode: ring }), true);
        g.addEventListener('click', open);
        g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      }
    });
    // Intervals: the inner rings give way to the interval of each note from the key, which keep their places because
    // the key is always at the top. A tap on a note, or on its interval, adds it to a shape; the middle names it.
    if (lib.circleMode === 'intervals') {
      svg.classList.add('is-intervals');
      const tonicPc = T.pcOf(state.key);
      const KIND = s => FB.degreeKind(T.intervalBySemi(s).label === 'TT' ? '♭5' : ({ 0: '1', 1: '♭2', 2: '2', 3: '♭3', 4: '3', 5: '4', 6: '♭5', 7: '5', 8: '♭6', 9: '6', 10: '♭7', 11: '7' })[s]);
      const semiAt = k => (k * 7) % 12;
      const picked = new Set([0]);
      const layer = el('g', { class: 'iv-layer' });
      const shape = el('path', { class: 'iv-shape' }, layer);
      const dots = el('g', {}, layer);
      const cellsIv = [];
      for (let k = 0; k < 12; k++) {
        const a = k * STEP, s = semiAt(k);
        const g = el('g', { class: `iv-cell kind-${KIND(s)}`, role: 'button', tabindex: '0', 'aria-pressed': String(k === 0), 'aria-label': `${T.intervalBySemi(s).name}: ${T.PC_PLAIN[T.mod(tonicPc + s)]}` }, layer);
        el('path', { d: arc(64, 146, a - STEP / 2, a + STEP / 2) }, g);
        const [x, y] = [127 * Math.sin(a), -127 * Math.cos(a)];
        el('text', { x: x.toFixed(1), y: (y + 5).toFixed(1), class: 't-iv' }, g).textContent = s === 0 ? 'P1' : T.intervalBySemi(s).short;
        const toggle = () => { if (k) { if (picked.has(k)) picked.delete(k); else picked.add(k); } draw(true); };
        g.addEventListener('click', toggle);
        g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
        cellsIv.push(g);
      }
      layer.appendChild(shape); layer.appendChild(dots);
      // The note cells of the outer ring add their note too, in place of turning the circle.
      svg._pickNote = pc => { const k = (T.mod(pc - tonicPc) * 7) % 12; if (k) { if (picked.has(k)) picked.delete(k); else picked.add(k); } draw(true); };
      // The names go under the circle, so the middle stays free for the shape.
      const big = h('b'), small = h('span');
      svg.readout = h('p', { class: 'iv-readout', 'aria-live': 'polite' }, big, small);
      const R = 94;
      const draw = sound => {
        const ks = [...picked].sort((a, b) => a - b);
        cellsIv.forEach((g, k) => g.setAttribute('aria-pressed', String(picked.has(k))));
        const p = k => [R * Math.sin(k * STEP), -R * Math.cos(k * STEP)];
        // Straight sides between the notes, in their order around the circle.
        const d = ks.length > 1 ? ks.map(p).map(([x, y], i) => `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + (ks.length > 2 ? ' Z' : '') : '';
        shape.setAttribute('d', d);
        shape.classList.toggle('is-open', ks.length === 2);
        shape.classList.remove('is-new'); void shape.getBBox; requestAnimationFrame(() => shape.classList.add('is-new'));
        dots.replaceChildren();
        ks.forEach(k => { const [x, y] = p(k); el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 6, class: `iv-dot kind-${KIND(semiAt(k))}` }, dots); });
        // Notes and intervals in the order of their pitch above the key.
        const up = ks.slice().sort((a, b) => semiAt(a) - semiAt(b));
        const pcs = up.map(k => T.mod(tonicPc + semiAt(k)));
        const names = up.map(k => T.spell(state.key, ({ 0: '1', 1: '♭2', 2: '2', 3: '♭3', 4: '3', 5: '4', 6: '♭5', 7: '5', 8: '♭6', 9: '6', 10: '♭7', 11: '7' })[semiAt(k)]));
        const ivs = up.map(k => k ? T.intervalBySemi(semiAt(k)).short : 'P1');
        const found = ks.length > 2 ? T.chordsFrom(pcs, tonicPc).find(c => !c.inversion) : null;
        if (ks.length === 1) { big.textContent = `Intervals from ${state.key}`; small.textContent = 'Tap a note or its interval.'; }
        else if (ks.length === 2) { const iv = T.intervalBySemi(semiAt(ks[1])); big.textContent = `${iv.name}: ${names.join(' to ')}`; small.textContent = `${Math.min(ks[1], 12 - ks[1])} step${Math.min(ks[1], 12 - ks[1]) > 1 ? 's' : ''} apart on the circle.`; }
        else { big.textContent = found ? `${found.root} ${lowerName(found.chord.name)}` : names.join(' '); small.textContent = `${found ? found.name + ': ' : ''}${names.join(' ')}, ${ivs.join(' ')}`; }
        if (sound && ks.length > 1) {
          const base = 48 + T.mod(tonicPc - 48), midis = ks.map(k => base + semiAt(k)).sort((a, b) => a - b);
          A.silence();
          if (ks.length === 2) A.notes(midis, 'up'); else A.notes(midis, 'strum');
        }
      };
      svg._drawIntervals = () => draw(false);
    }
    // Marks one chord of the key, for example while it plays. It turns with the wheel.
    const hot = el('path', { class: 'hot', visibility: 'hidden' }, wheel);
    svg.hot = c => {
      if (!c) { hot.setAttribute('visibility', 'hidden'); return; }
      hot.setAttribute('d', paths.get(`${c.ring}:${c.pos}`));
      hot.setAttribute('visibility', 'visible');
    };
    el('circle', { r: 60, class: 'hub' });
    const hubName = el('text', { y: -2, class: 't-hub' }), hubSub = el('text', { y: 16, class: 't-hub-sub' }), hubSig = el('text', { y: 34, class: 't-hub-sig' });
    hubName.textContent = state.key;
    hubSub.textContent = state.mode;
    hubSig.textContent = state.entry.count === 0 ? 'no ♯ or ♭' : sigText(state.entry.count, true);
    if (svg._drawIntervals) { svg.appendChild(svg.querySelector('.iv-layer')); svg._drawIntervals(); }
    // The frame stays at the top. The wheel turns under it.
    const F = steps => steps * STEP;
    el('path', { class: 'key-frame', d: `M ${pt(208, F(-1.5))} A 208 208 0 0 1 ${pt(208, F(1.5))} L ${pt(100, F(1.5))} A 100 100 0 0 0 ${pt(100, F(0.5))} L ${pt(62, F(0.5))} A 62 62 0 0 0 ${pt(62, F(-0.5))} L ${pt(100, F(-0.5))} A 100 100 0 0 0 ${pt(100, F(-1.5))} Z` });
    // Turn the short way round from the last key.
    // In the intervals view the note of the key itself goes to the top of the outer ring, also in a minor key.
    const target = lib.circleMode === 'intervals' ? -((T.pcOf(state.key) * 7) % 12) * 30 : -tonic.pos * 30;
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
      const tuning = openStrings();
      const markers = [];
      for (let s = 0; s < 6; s++) for (let f = 0; f <= lastFret(); f++) {
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
          rootCtl({ root: state.mode === 'one' ? state.note : null }, { link: s => notesView.link({ mode: 'one', note: s.root }) }, 'One note'),
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
        .filter(([s, f]) => Number.isInteger(s) && Number.isInteger(f) && s >= 0 && s < 6 && f >= 0 && f <= lastFret());
      return { places };
    },
    link: s => 'library/name' + (s.places.length ? '/' + s.places.map(p => p.join('.')).join('-') : ''),
    title: () => LOOKUP.title,
    render(state) {
      let places = state.places.slice(), showAll = false;
      const tuning = openStrings();
      // Labels of this page: note names, degrees in the chord that was found, or intervals from the first note you tapped.
      const mode = ['notes', 'degrees', 'intervals'].includes(lib.nameLabels) ? lib.nameLabels : lib.labels;
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
        const chordTone = pc => best.find(t => t.pc === pc) || { name: T.PC_PLAIN[pc], label: '', kind: 'other' };
        // Intervals: every note is measured from the first note you tapped, upward and in any octave.
        // That note is the square, with a ring, and it stays the measure when a lower note joins.
        const first = places.length ? { string: places[0][0], fret: places[0][1], midi: tuning[places[0][0]] + places[0][1] } : null;
        const stepOf = n => { const up = T.mod(n.midi - first.midi); return up === 0 && n.midi !== first.midi ? T.intervalBySemi(12) : T.intervalBySemi(up); };
        const fromFirst = pc => { const iv = T.intervalBySemi(T.mod(pc - first.midi)); return { pc, name: T.PC_PLAIN[pc], label: iv.short, long: iv.name, kind: FB.degreeKind(iv.label) }; };
        const toneOf = mode === 'intervals' ? fromFirst : chordTone;
        const markers = notes.map(n => {
          const t = toneOf(T.mod(n.midi));
          if (mode !== 'intervals') return { string: n.string, fret: n.fret, label: mode === 'degrees' && t.label ? t.label : t.name, kind: kindOf(t), title: t.label ? `${t.name}, ${t.label}` : t.name };
          const iv = stepOf(n);
          return { string: n.string, fret: n.fret, label: iv.short, kind: t.kind, ring: n.string === first.string && n.fret === first.fret, title: `${t.name}, ${iv.name.toLowerCase()} from ${T.PC_PLAIN[T.mod(first.midi)]}` };
        });
        neckSlot.replaceChildren(neck(markers, { onPress: toggle, label: 'Tap the notes you play' }));
        const out = [];
        if (!notes.length) out.push(h('p', { class: 'muted' }, 'No notes yet. For a chord, tap one note on each string you play. For a scale, tap every note of the run.'));
        else {
          // In the row the notes go up from the first one in the intervals mode, and from the lowest one in the other modes.
          const inRow = mode === 'intervals' ? pcs.slice().sort((a, b) => T.mod(a - first.midi) - T.mod(b - first.midi)) : pcs;
          out.push(toneRow(inRow.map(toneOf), t => h('div', { class: 'tone is-still', title: t.long || null }, h('i', { class: 'swatch' + (kindOf(t) === 'root' ? ' is-root' : ''), style: `background:var(--${kindOf(t)})` }), h('b', null, mode === 'notes' || !t.label ? t.name : t.label), h('span', null, mode === 'notes' ? t.label || ' ' : t.label ? t.name : ' ')), 'The notes you chose'));
          if (pcs.length === 1) out.push(h('p', { class: 'muted named-note' }, 'One note. Tap one more for an interval, or two more for a chord.'),
            h('div', { class: 'found-list' }, row(notesView.link({ mode: 'one', note: T.PC_PLAIN[pcs[0]] }), `Every ${T.PC_PLAIN[pcs[0]]} on the neck`, null, 'Notes')));
          if (mode === 'intervals' && pcs.length > 1) {
            const from = T.PC_PLAIN[T.mod(first.midi)];
            out.push(h('h2', null, `Intervals from ${from}`), h('p', { class: 'muted named-note' }, `${from} is the first note you tapped. Each note shows its interval above ${from}, in any octave.`),
              h('div', { class: 'found-list' }, inRow.filter(pc => pc !== T.mod(first.midi)).map(pc => { const iv = T.intervalBySemi(T.mod(pc - first.midi)); return row(intervalsView.link({ interval: iv, root: from }), iv.name, `${from} up to ${T.PC_PLAIN[pc]}, ${iv.semi} ${iv.semi === 1 ? 'fret' : 'frets'} on one string`, iv.short); })));
          } else if (pcs.length === 2) {
            const iv = T.intervalBySemi(T.mod(pcs.find(pc => pc !== bass) - bass)), from = T.PC_PLAIN[bass];
            out.push(h('h2', null, 'Interval'), h('div', { class: 'found-list' }, row(intervalsView.link({ interval: iv, root: from }), iv.name, `${from} up to ${T.spell(from, iv.semi === 6 ? '♭5' : iv.label)}`, 'Interval')));
          }
          if (chords.length) out.push(h('h2', null, chords.length > 1 ? 'Chords' : 'Chord'), h('div', { class: 'found-list' }, chords.map(c => row(
            chordsView.link({ chord: c.chord, root: c.root, bass: c.inversion ? T.PC_PLAIN[T.mod(bass)] : null }), c.name,
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
        h('div', { class: 'lib-stage' }, controls(ctl('Labels', GT.segmented('Labels', [['notes', 'Notes'], ['degrees', 'Degrees'], ['intervals', 'Intervals']], mode, v => { saveLib({ nameLabels: v }); rerender(); }), 'ctl-plain'), fretsCtl(rerender)), neckSlot),
        h('p', { class: 'small muted', style: 'margin-top:6px' }, 'Tap a note to add it. Tap it again to take it away.'),
        result
      ];
    }
  };

  const VIEWS = { notes: notesView, intervals: intervalsView, scales: scalesView, chords: chordsView, triads: triadsView, keys: keysView, name: nameView, fit: fitView, tune: tuneView };
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
    add(FIT.title, 'Tool', 'library/fit', 'topic:fit', FIT.find, -23);
    add(TUNE.title, 'Tool', 'library/tune', 'topic:tune', TUNE.find, -22);
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
    // "Perfect 5th" is also found as "perfect fifth".
    const WORDS = { '2nd': 'second', '3rd': 'third', '4th': 'fourth', '5th': 'fifth', '6th': 'sixth', '7th': 'seventh' };
    for (const i of T.INTERVALS) add(i.name, 'Interval', intervalsView.link({ interval: i, root: 'C' }), 'interval:' + i.id, `${i.short} interval ${i.name.replace(/\d(st|nd|rd|th)/, n => WORDS[n] || n)}`);
    return index;
  }
  function find(query) {
    // A slash chord such as "C/E" or "Am7/G" opens the chord with that note in the bass.
    const slash = /^\s*([a-g])\s*(#|b|♯|♭|sharp|flat)?\s*([^/]*?)\s*\/\s*([a-g])\s*(#|b|♯|♭|sharp|flat)?\s*$/i.exec(query);
    if (slash) {
      const acc = a => !a ? '' : /^(#|♯|sharp)$/i.test(a) ? '♯' : '♭';
      const root = slash[1].toUpperCase() + acc(slash[2]), bassName = slash[4].toUpperCase() + acc(slash[5]);
      const sym = slash[3].replace(/b/g, '♭').replace(/#/g, '♯');
      const chord = T.CHORDS.find(c => c.symbol.replace(/[()]/g, '') === sym.replace(/[()]/g, '')) || (sym === '' ? T.chordById('major') : null);
      if (chord && T.ROOTS.includes(root) && T.ROOTS.includes(bassName)) {
        const title = `${T.chordName(root, chord)}/${bassName}`;
        return [{ title, kind: 'Chord', href: chordsView.link({ chord, root, bass: bassName }), type: 'chord:slash', rank: 0 }];
      }
    }
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
      name: { from: 0, to: 4, markers: [[1, 3], [2, 2], [4, 1]].map(([string, fret]) => ({ string, fret, kind: 'target', label: '?' })) },
      // A scale under a chord: the chord notes bright, the other notes of the scale faint.
      tune: { from: 0, to: 4, markers: ['E', 'A', 'D', 'G', 'B', 'e'].map((label, string) => ({ string, fret: 0, kind: string === 1 ? 'root' : 'other', label })) },
      fit: { from: 0, to: 4, markers: [dot(1, 3, 'root'), dot(2, 2, 'third'), dot(3, 0, 'fifth'), dot(4, 1, 'root'), dot(1, 0, 'ghost'), dot(2, 0, 'ghost'), dot(3, 2, 'ghost'), dot(4, 3, 'ghost'), dot(5, 1, 'ghost'), dot(5, 3, 'ghost')] }
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
        h('div', { class: 'topic-text' }, h('h2', null, LOOKUP.title), h('p', null, LOOKUP.line))),
      h('a', { class: 'topic topic-tool', href: '#/' + (last.fit ? last.fit.href : 'library/fit') },
        thumb(FIT.id),
        h('div', { class: 'topic-text' }, h('h2', null, FIT.title), h('p', null, FIT.line))),
      h('a', { class: 'topic topic-tool', href: '#/library/tune' },
        thumb(TUNE.id),
        h('div', { class: 'topic-text' }, h('h2', null, TUNE.title), h('p', null, TUNE.line)))));
    document.title = `Library · ${GT.siteName}`;
  }

  function render(main, parts) {
    main.replaceChildren();
    // The microphone is on only while the tuner is on the screen.
    stopTuner();
    if (!VIEWS[parts[0]]) { stopBacking(); A.stopDrone(); rerender = () => {}; lastRender = null; home(main); return; }
    const tab = parts[0];
    const view = VIEWS[tab];
    const state = view.parse(parts.slice(1));
    // A lookup page changes its link as you tap, so a new drawing reads the link again.
    rerender = () => render(main, tab === 'name' ? location.hash.replace(/^#\/?/, '').split('/').slice(1) : parts);
    const fitScope = tab === 'fit' ? `fit:${state.chords.map(c => T.chordName(c.root, c.chord)).join(' ')}` : null;
    // A loop belongs to one key or one scale on one root. The drone follows the root of the scale page.
    const scope = tab === 'keys' ? `keys:${state.key}:${state.mode}` : tab === 'scales' ? `scales:${state.root}:${state.scale.id}` : fitScope;
    // Another page stops the sound itself: then the row must not look as if it still plays.
    if (backing.scope && (backing.scope !== scope || !A.loopRunning)) stopBacking();
    if (A.droneRoot !== null && tab !== 'scales') A.stopDrone();
    else if (A.droneRoot !== null && A.droneRoot !== T.pcOf(state.root)) A.startDrone(T.pcOf(state.root));
    // Topic row. A topic with roots opens on the root you look at now.
    // A tab keeps the root, and a minor sound: from A dorian, Chords opens Am and Keys opens A minor.
    const tabLink = id => {
      const target = VIEWS[id], base = target.parse([]), r = state.root || state.key;
      if (!r || !(base.root || base.key)) return '#/library/' + id;
      const labels = state.scale ? state.scale.toneList.map(t => t.label) : state.chord ? state.chord.toneList.map(t => t.label) : [];
      const minor = state.mode === 'minor' || state.quality === 'minor' || (labels.includes('♭3') && !labels.includes('3'));
      if (id === 'keys') return '#/' + keysView.link({ key: r, mode: minor ? 'minor' : 'major' });
      const next = Object.assign(base, { root: r });
      if (minor && id === 'scales') next.scale = T.scaleById('minor');
      if (minor && id === 'chords') next.chord = T.chordById('minor');
      if (minor && id === 'triads') next.quality = 'minor';
      return '#/' + target.link(next);
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
      h('a', { href: '#/library/name', class: 'lib-tool-link', 'aria-current': String(tab === LOOKUP.id) }, LOOKUP.name),
      h('a', { href: '#/' + (lib.last && lib.last.fit ? lib.last.fit.href : 'library/fit'), class: 'lib-tool-link', 'aria-current': String(tab === FIT.id) }, FIT.name),
      h('a', { href: '#/library/tune', class: 'lib-tool-link', 'aria-current': String(tab === TUNE.id) }, TUNE.name));
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

  GT.route('library', { render, leave: stopTuner, resize: () => { if (!tuner && lastRender) lastRender(); } });
  GT.library = { lowerName };
})(window);
